from __future__ import annotations

import json
import re
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib import resources

from .recorder import Recorder
from .session import CommandError
from .vision import FrameWatcher

STATUS_LABELS = {"Proposed": "čaká na potvrdenie", "Confirmed": "potvrdené", "Rejected": "zamietnuté"}


class WebApp:
    """Local page (127.0.0.1 only) that shows what the Collector sees and asks what happened."""

    def __init__(self, recorder: Recorder, watcher: FrameWatcher):
        self.recorder = recorder
        self.watcher = watcher
        self._status_checked = 0.0
        self._status_error: str | None = None

    # ─── state for the page ───────────────────────────────────────────────

    def state(self) -> dict:
        r = self.recorder
        if time.monotonic() - self._status_checked > 5:
            self._status_checked = time.monotonic()
            self._status_error = r.refresh_server_status()

        events = []
        for item in reversed(r.outbox.items):
            e = item["event"]
            if item["error"]:
                status, label = "error", f"odmietnuté pri odoslaní: {item['error']}"
            elif not item["sent"]:
                status, label = "pending", "neodoslané, skúšam znova"
            else:
                server = r.status_of(item["proposalId"]) or "Proposed"
                status, label = server.lower(), STATUS_LABELS.get(server, server)
            events.append({
                "id": e["clientEventId"], "type": e["eventType"], "opponent": e["isOpponent"],
                "subtype": e.get("eventSubtype"), "goalType": e.get("goalType"),
                "display": e.get("_display"), "period": e.get("period"), "clock": e.get("gameClock"),
                "note": e.get("note"), "status": status, "statusLabel": label,
                "at": e.get("occurredAt"),
            })

        m = r.ctx["match"]
        return {
            "match": {"id": m["id"], "number": m.get("matchNumber"), "home": m.get("homeTeamShortName"),
                      "away": m.get("awayTeamShortName"), "hostedIsHome": r.ctx.get("hostedIsHome")},
            "period": r.session.period_label,
            "users": r.ctx["users"],
            "roster": r.ctx["roster"],
            "events": events,
            "questions": [{"id": q.id, "kind": q.kind, "text": q.text, "createdAt": q.created_at}
                          for q in self.watcher.questions.open()],
            "obs": {"connected": r.obs.connected, "error": r.obs.error},
            "frame": {"at": self.watcher.latest_at, "error": self.watcher.error},
            "detector": {"enabled": self.watcher.detector_enabled, "available": self.watcher.pillow,
                         "diff": round(self.watcher.detector.last_diff, 1),
                         "threshold": self.watcher.detector.threshold},
            "regions": self.watcher.regions.all(),
            "server": {"flushError": r.last_flush_error, "statusError": self._status_error},
        }

    # ─── actions ──────────────────────────────────────────────────────────

    def _event_from_answer(self, body: dict) -> dict:
        kind = body.get("kind")
        goal_type = body.get("goalType") or None
        clock = body.get("clock") or None
        s = self.recorder.session
        user_id = body.get("userId")
        roster_player_id = body.get("rosterPlayerId")
        if kind == "goal":
            return s.make("Goal", user_id=user_id, roster_player_id=roster_player_id, goal_type=goal_type, clock=clock)
        if kind == "opp_goal":
            return s.make("Goal", is_opponent=True, goal_type=goal_type, clock=clock)
        if kind == "penalty":
            return s.make("Penalty", user_id=user_id, roster_player_id=roster_player_id, clock=clock)
        if kind == "opp_penalty":
            return s.make("Penalty", is_opponent=True, clock=clock)
        raise CommandError("Neznáma odpoveď.")

    def answer(self, qid: int, body: dict) -> dict:
        q = self.watcher.questions.get(qid)
        if q is None or q.status != "open":
            raise CommandError("Otázka už nie je otvorená.")
        if body.get("kind") == "none":
            self.watcher.questions.resolve(qid, "dismissed", "nič")
            return {"ok": True}
        event = self._event_from_answer(body)
        self.recorder.record_event(event, note=f"Odpoveď na otázku: {q.text}")
        self.watcher.questions.resolve(qid, "answered", event["eventType"])
        return {"ok": True}

    def quick(self, body: dict) -> dict:
        self.recorder.record_event(self._event_from_answer(body))
        return {"ok": True}

    def command(self, line: str) -> dict:
        event, display = self.recorder.record(line)
        return {"ok": True, "recorded": event is not None, "display": display}

    def ask_now(self) -> dict:
        q = self.watcher.questions.ask("manual", "Ručne otvorená otázka. Čo sa stalo?", self.watcher.latest)
        return {"ok": True, "id": q.id}


def _make_handler(app: WebApp):
    page = resources.files("nhlcollector").joinpath("static/index.html").read_bytes()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):  # keep the terminal clean for typed commands
            pass

        def _send(self, status: int, body: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, obj, status: int = 200) -> None:
            self._send(status, json.dumps(obj, ensure_ascii=False).encode(), "application/json; charset=utf-8")

        def _body(self) -> dict:
            length = int(self.headers.get("Content-Length") or 0)
            return json.loads(self.rfile.read(length) or b"{}") if length else {}

        def do_GET(self):
            path = self.path.split("?", 1)[0]
            if path == "/":
                return self._send(200, page, "text/html; charset=utf-8")
            if path == "/api/state":
                return self._json(app.state())
            if path == "/api/frame.jpg":
                frame = app.watcher.latest
                return self._send(200, frame, "image/jpeg") if frame else self._json({}, 404)
            m = re.fullmatch(r"/api/questions/(\d+)/frame\.jpg", path)
            if m:
                q = app.watcher.questions.get(int(m.group(1)))
                return self._send(200, q.frame, "image/jpeg") if q and q.frame else self._json({}, 404)
            self._json({"error": "not found"}, 404)

        def do_POST(self):
            path = self.path.split("?", 1)[0]
            # The page is only for this computer; refuse cross-site requests from other tabs.
            origin = self.headers.get("Origin")
            if origin and not re.fullmatch(r"http://(127\.0\.0\.1|localhost):\d+", origin):
                return self._json({"error": "forbidden"}, 403)
            try:
                body = self._body()
                if path == "/api/command":
                    return self._json(app.command(str(body.get("line", ""))))
                if path == "/api/quick":
                    return self._json(app.quick(body))
                if path == "/api/ask":
                    return self._json(app.ask_now())
                if path == "/api/detector":
                    app.watcher.detector_enabled = bool(body.get("enabled"))
                    if "threshold" in body:
                        app.watcher.detector.threshold = float(body["threshold"])
                    return self._json({"ok": True})
                m = re.fullmatch(r"/api/questions/(\d+)/answer", path)
                if m:
                    return self._json(app.answer(int(m.group(1)), body))
                m = re.fullmatch(r"/api/regions/(\w+)", path)
                if m:
                    region = app.watcher.regions.update(m.group(1), body["x"], body["y"], body["w"], body["h"])
                    app.watcher.detector.baseline = None  # new area → new reference look
                    return self._json({"ok": True, "region": region.__dict__})
            except CommandError as exc:
                return self._json({"error": str(exc)}, 400)
            except (KeyError, ValueError, TypeError) as exc:
                return self._json({"error": f"zlá požiadavka: {exc}"}, 400)
            self._json({"error": "not found"}, 404)

    return Handler


def start_web(app: WebApp, port: int) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer(("127.0.0.1", port), _make_handler(app))
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server
