from __future__ import annotations

import threading

import httpx

from .api import ApiError, NhlStatsClient
from .obs import ObsBridge
from .outbox import Outbox
from .session import MatchSession


class Recorder:
    """Everything one match needs: parsing commands, OBS capture, the outbox and sending.
    Shared by the terminal and the local web page, so both record events the same way."""

    def __init__(self, client: NhlStatsClient, ctx: dict, obs: ObsBridge, outbox: Outbox):
        self.client = client
        self.ctx = ctx
        self.match_id: int = ctx["match"]["id"]
        self.obs = obs
        self.outbox = outbox
        self.session = MatchSession(self.match_id, ctx["users"], ctx["roster"])
        self.last_flush_error: str | None = None
        self._server_status: dict[int, str] = {}
        self._lock = threading.Lock()
        self.game = None  # GameState from the frame watcher, when the scoreboard is being read

    def on_game_change(self, kind: str, value) -> None:
        """Period changes and the final whistle read from the scoreboard become proposals automatically."""
        with self._lock:
            if kind == "period":
                event = self.session.set_period(value, clock=None)
            elif kind == "final":
                event = self.session.match_end(value)
            else:
                return
        if event is not None:
            event["_display"] = "automaticky zo scoreboardu"
            self.record_event(event)

    def record(self, line: str, *, note: str | None = None) -> tuple[dict | None, str | None]:
        """Parses and records a command. Returns (event, display text); raises CommandError."""
        with self._lock:
            event = self.session.parse(line)
        if event is None:
            return None, None
        return self.record_event(event, note=note)

    def record_event(self, event: dict, *, note: str | None = None) -> tuple[dict, str | None]:
        """Records an already-built event (from parse() or make())."""
        with self._lock:
            display = event.pop("_display", None)
            if note:
                event["note"] = note[:500]
            # Exact time from the scoreboard when the operator didn't type one.
            if self.game is not None:
                if not event.get("gameClock") and self.game.clock:
                    event["gameClock"] = self.game.clock
            if event.get("period") is None and self.session.period is not None:
                event["period"] = self.session.period
            event["mediaRef"] = self.obs.capture(event["eventType"].lower())
            event["_display"] = display  # kept locally for the web page, stripped before sending
            self.outbox.add(event)
        self.flush()
        return event, display

    def flush(self) -> tuple[int, str | None]:
        sent, error = self.outbox.flush(self.client, self.match_id)
        self.last_flush_error = error
        return sent, error

    def refresh_server_status(self) -> str | None:
        """Pulls review status (Proposed/Confirmed/Rejected) of this match's proposals."""
        try:
            proposals = self.client.proposals(self.match_id)
        except (httpx.HTTPError, ApiError) as exc:
            return str(exc)
        self._server_status = {p["id"]: p["status"] for p in proposals}
        return None

    def status_of(self, proposal_id: int | None) -> str | None:
        return self._server_status.get(proposal_id) if proposal_id else None
