from __future__ import annotations

import io
import json
import logging
import threading
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable

log = logging.getLogger(__name__)


@dataclass
class Region:
    """A watched area of the screen, in fractions of the frame (0–1), so it works at any resolution."""
    name: str
    label: str
    x: float
    y: float
    w: float
    h: float

    def clamp(self) -> "Region":
        self.w = min(max(self.w, 0.01), 1.0)
        self.h = min(max(self.h, 0.01), 1.0)
        self.x = min(max(self.x, 0.0), 1.0 - self.w)
        self.y = min(max(self.y, 0.0), 1.0 - self.h)
        return self


# Starting points measured on EA NHL's scoreboard (top-left: two stacked team rows with the score
# on the right of each, then shots, then clock over period). Goal and assist banners replace the
# team rows in the same box. Calibrate them on the page by dragging over the real scoreboard.
DEFAULT_REGIONS = [
    # Only the score digits of both rows: the game clock next to them changes every second.
    Region("score", "Skóre (len čísla)", 0.134, 0.036, 0.027, 0.068),
    Region("clock", "Čas", 0.190, 0.045, 0.070, 0.031),
    Region("period", "Tretina", 0.190, 0.072, 0.063, 0.023),
    Region("banner", "Banner (gól / asistencie / nájazd)", 0.060, 0.030, 0.150, 0.072),
    # Bottom left: number and name of the player the console is controlling ('33 H. DISPOSABLE').
    Region("controlled", "Ovládaný hráč", 0.040, 0.920, 0.110, 0.042),
]


class RegionStore:
    def __init__(self, path: Path):
        self.path = path
        self._lock = threading.Lock()
        self.regions: dict[str, Region] = {r.name: Region(**asdict(r)) for r in DEFAULT_REGIONS}
        if path.exists():
            for raw in json.loads(path.read_text(encoding="utf-8")):
                if raw.get("name") in self.regions:
                    self.regions[raw["name"]] = Region(**raw).clamp()

    def get(self, name: str) -> Region:
        with self._lock:
            return self.regions[name]

    def all(self) -> list[dict]:
        with self._lock:
            return [asdict(r) for r in self.regions.values()]

    def update(self, name: str, x: float, y: float, w: float, h: float) -> Region:
        with self._lock:
            if name not in self.regions:
                raise KeyError(name)
            r = self.regions[name]
            r.x, r.y, r.w, r.h = float(x), float(y), float(w), float(h)
            r.clamp()
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps([asdict(v) for v in self.regions.values()], indent=1), encoding="utf-8")
            return r


def signature(image, region: Region, size: tuple[int, int] = (32, 16)) -> list[int]:
    """Small grayscale thumbnail of a region: cheap to compare, tolerant of compression noise."""
    width, height = image.size
    box = (int(region.x * width), int(region.y * height),
           int((region.x + region.w) * width), int((region.y + region.h) * height))
    thumb = image.crop(box).convert("L").resize(size)
    return list(thumb.tobytes())


def difference(a: list[int], b: list[int]) -> float:
    """Mean absolute pixel difference, 0 (same) – 255 (inverted)."""
    if not a or len(a) != len(b):
        return 255.0
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)


class ChangeDetector:
    """
    Fires when a region changes and stays changed: `confirm_frames` frames in a row must differ
    from the last stable look by more than `threshold`. One-frame flickers (camera cuts,
    compression) don't fire, and `cooldown` seconds after firing it stays quiet while the
    scoreboard animates.
    """

    def __init__(self, threshold: float = 6.0, confirm_frames: int = 2, cooldown: float = 6.0,
                 clock: Callable[[], float] = time.monotonic):
        self.threshold = threshold
        self.confirm_frames = confirm_frames
        self.cooldown = cooldown
        self._clock = clock
        self.baseline: list[int] | None = None
        self._streak = 0
        self._quiet_until = 0.0
        self.last_diff = 0.0

    def feed(self, sig: list[int]) -> bool:
        if self.baseline is None:
            self.baseline = sig
            return False
        self.last_diff = difference(sig, self.baseline)
        now = self._clock()
        if now < self._quiet_until:
            self.baseline = sig  # follow the animation, compare against where it settles
            self._streak = 0
            return False
        if self.last_diff > self.threshold:
            self._streak += 1
            if self._streak >= self.confirm_frames:
                self.baseline = sig
                self._streak = 0
                self._quiet_until = now + self.cooldown
                return True
        else:
            self._streak = 0
        return False


@dataclass
class Question:
    id: int
    kind: str
    text: str
    created_at: float
    frame: bytes | None
    status: str = "open"  # open / answered / dismissed
    answer: str | None = None
    # What the app thinks happened, pre-filled on the card: {"kind", "userId", "rosterPlayerId", "assists", ...}
    suggestion: dict | None = None
    version: int = 0


class QuestionQueue:
    def __init__(self, max_items: int = 50):
        self._items: list[Question] = []
        self._next = 1
        self._lock = threading.Lock()
        self._max = max_items

    def ask(self, kind: str, text: str, frame: bytes | None, suggestion: dict | None = None) -> Question:
        with self._lock:
            q = Question(self._next, kind, text, time.time(), frame, suggestion=suggestion)
            self._next += 1
            self._items.append(q)
            del self._items[:-self._max]
            return q

    def get(self, qid: int) -> Question | None:
        with self._lock:
            return next((q for q in self._items if q.id == qid), None)

    def resolve(self, qid: int, status: str, answer: str | None = None) -> Question | None:
        with self._lock:
            q = next((q for q in self._items if q.id == qid and q.status == "open"), None)
            if q:
                q.status, q.answer = status, answer
            return q

    def suggest(self, qid: int, suggestion: dict, text: str | None = None) -> None:
        with self._lock:
            q = next((q for q in self._items if q.id == qid and q.status == "open"), None)
            if q:
                q.suggestion = suggestion
                if text:
                    q.text = text
                q.version += 1

    def open(self) -> list[Question]:
        with self._lock:
            return [q for q in self._items if q.status == "open"]


class FrameWatcher:
    """
    Pulls a frame from OBS about once a second and works out what is going on:

    * score: a pixel-change detector on the score digits (always), plus OCR of the numbers
      when Tesseract is installed, which also tells which team scored;
    * period and clock: OCR of the scoreboard, so every event gets its exact time, period
      changes / overtime / shootout are recorded automatically and FINAL proposes the match end;
    * banner: OCR of goal and shootout banners, matched against the roster to suggest the scorer,
      the assists and, through the user's position, the user.

    Anything the app is unsure about becomes a question on the page with its guess pre-filled.
    """

    def __init__(self, grab: Callable[[], bytes | None], regions: RegionStore, questions: QuestionQueue,
                 interval: float = 1.0, detector: ChangeDetector | None = None, reader=None):
        from .gamestate import GameState

        self._grab = grab
        self.regions = regions
        self.questions = questions
        self.interval = interval
        self.detector = detector or ChangeDetector()
        self.banner_detector = ChangeDetector(threshold=8.0, confirm_frames=1, cooldown=2.0)
        self.reader = reader
        self.game = GameState()
        self.context: dict = {"users": [], "roster": [], "hostedIsHome": True}
        self.aliases: list[dict] = []  # in-game names → user / roster player (config [aliases])
        self.home_first = True  # the scoreboard lists the home team first (top or left)
        # The user playing on the streamed console: the controlled player belongs to them.
        self.controlled_user_id: int | None = None
        self.controlled: dict | None = None  # last controlled player: {"at", "label", "rosterPlayerId", ...}
        # Ring colour → user (config [colors]); the watcher remembers which hockey player each
        # user skated with last, read from the name tag under their ring.
        self.user_colors: dict[int, str] = {}
        self.user_players: dict[int, dict] = {}  # userId → {"rosterPlayerId", "label", "at"}
        self._tag_candidates: dict[int, tuple[int, int]] = {}
        self._ticks = 0
        self.ring_every = 2  # read the rings every n-th frame: it's the slowest part
        self._controlled_candidate: tuple[str, int] | None = None
        self.on_game_change: Callable[[str, object], None] | None = None
        self.latest: bytes | None = None
        self.latest_at: float | None = None
        self.detector_enabled = True
        self.error: str | None = None
        self.readings: dict = {}
        self.banners: list[tuple[float, str]] = []  # recent banner texts (time, text)
        self._banner_reread_at: float | None = None
        self.parsed_banners: list[dict] = []  # recent recognised banners: {"at", "type", "names", "clock"}
        self._score_question: tuple[int, float] | None = None  # (question id, asked at) awaiting a banner
        self._stop = threading.Event()
        try:
            from PIL import Image  # noqa: F401
            self.pillow = True
        except ImportError:
            self.pillow = False

    @property
    def ocr(self) -> bool:
        return bool(self.reader is not None and getattr(self.reader, "available", False))

    def start(self) -> None:
        threading.Thread(target=self._run, daemon=True).start()

    def stop(self) -> None:
        self._stop.set()

    def _run(self) -> None:
        while not self._stop.wait(self.interval):
            self.tick()

    def tick(self) -> None:
        try:
            frame = self._grab()
        except Exception as exc:  # noqa: BLE001 - keep watching, show the error on the page
            self.error = str(exc) or exc.__class__.__name__
            return
        if frame is None:
            return
        self.error = None
        self.latest, self.latest_at = frame, time.time()
        if not (self.pillow and self.detector_enabled):
            return
        from PIL import Image

        try:
            image = Image.open(io.BytesIO(frame))
            image.load()
            sig = signature(image, self.regions.get("score"))
        except Exception as exc:  # noqa: BLE001
            self.error = f"frame decode: {exc}"
            return

        pixel_change = self.detector.feed(sig)
        if self.ocr:
            self._read_screen(image, frame)
        # Without a readable score, fall back to "something changed in the score area".
        if pixel_change and self.game.score is None:
            self.questions.ask("score_change", "Zmenilo sa skóre. Čo sa stalo?", frame)

    # ─── OCR-driven logic ─────────────────────────────────────────────────

    def _read_screen(self, image, frame: bytes) -> None:
        from .ocr import parse_clock, parse_period, parse_score

        r = self.reader
        raw_period = r.read(image, self.regions.get("period"), "period")
        raw_clock = r.read(image, self.regions.get("clock"), "clock")
        raw_score = r.read(image, self.regions.get("score"), "score")
        banner_text = None
        now = time.time()
        if self.banner_detector.feed(signature(image, self.regions.get("banner"))) or self.banner_detector.baseline is None:
            banner_text = r.read(image, self.regions.get("banner"), "text")
            # Banners slide in: read once more when it has settled.
            self._banner_reread_at = now + 1.5
        elif self._banner_reread_at and now >= self._banner_reread_at:
            self._banner_reread_at = None
            banner_text = r.read(image, self.regions.get("banner"), "text")
        if banner_text:
            self.banners.append((now, banner_text))
            self.banners = [(t, x) for t, x in self.banners if now - t < 30]

        self._ticks += 1
        if self.user_colors and self._ticks % self.ring_every == 1 % self.ring_every:
            self._track_colors(image, now)
        raw_controlled = r.read(image, self.regions.get("controlled"), "line")
        self._track_controlled(raw_controlled, now)

        changes = self.game.feed(parse_period(raw_period), parse_clock(raw_clock), parse_score(raw_score))
        self.readings = {
            "period": raw_period, "clock": raw_clock, "score": raw_score, "controlled": raw_controlled,
            "controlledPlayer": (self.controlled or {}).get("label"),
            "userPlayers": [{"userId": uid, "color": self.user_colors.get(uid), "player": m["label"],
                             "ago": round(now - m["at"])} for uid, m in self.user_players.items()],
            "banner": self.banners[-1][1] if self.banners else None,
            "state": {"period": self.game.period, "clock": self.game.clock,
                      "score": list(self.game.score) if self.game.score else None},
        }

        for kind, value in changes:
            if kind == "score":
                self._on_score_change(value, frame)
            elif self.on_game_change:
                self.on_game_change(kind, value)

        if banner_text:
            self._on_banner(banner_text, frame)

    def _track_controlled(self, text: str | None, now: float) -> None:
        """
        Remembers who the console controls. The box disappears during banners and replays, so the
        last reading is the player who had the puck before the goal. A name counts after two equal reads.
        """
        from .ocr import find_controlled, parse_controlled, user_for_player

        c = parse_controlled(text)
        if not c:
            return
        key = f"{c['number']} {c['surname']}"
        count = self._controlled_candidate[1] + 1 if self._controlled_candidate and self._controlled_candidate[0] == key else 1
        self._controlled_candidate = (key, count)
        if count < 2:
            return
        if self.controlled and self.controlled["key"] == key:
            self.controlled["at"] = now
            return
        player = find_controlled(c, self.context.get("roster", []))
        users = self.context.get("users", [])
        mem_uid = self._user_by_memory(player["rosterPlayerId"]) if player else None
        user = next((u for u in users if u["userId"] == self.controlled_user_id), None) \
            or next((u for u in users if u["userId"] == mem_uid), None) \
            or (user_for_player(player, users) if player else None)
        self.controlled = {
            "key": key, "at": now, "number": c["number"],
            "label": f"{player['firstName']} {player['surname']}" if player else f"{c['number']} {c['initial']}. {c['surname']}",
            "rosterPlayerId": player["rosterPlayerId"] if player else None,
            "userId": user["userId"] if user else None,
            "userSure": bool(user) and (self.controlled_user_id is not None or mem_uid is not None
                                        or user_for_player(player, users) is not None),
        }

    def _track_colors(self, image, now: float) -> None:
        """Reads the name tag under each user's ring and remembers the player once read twice in a row."""
        from .ocr import find_controlled, match_alias
        from .rings import find_rings, hue_band, tag_name

        bands = {}
        for uid, color in self.user_colors.items():
            try:
                bands[uid] = hue_band(color)
            except ValueError:
                continue
        spots = find_rings(image, {str(uid): band for uid, band in bands.items()})
        for key, (x, y, w, h) in spots.items():
            uid = int(key)
            name = tag_name(self.reader.read(image, Region(f"tag:{self.user_colors[uid]}", "", x, y, w, h), "tag"))
            if not name:
                continue
            player = find_controlled({"surname": name.upper(), "initial": ""}, self.context.get("roster", []))
            if not player:
                alias = match_alias(name, self.aliases)
                if alias and alias.get("rosterPlayerId"):
                    player = next((p for p in self.context.get("roster", [])
                                   if p["rosterPlayerId"] == alias["rosterPlayerId"]), None)
            if not player:
                continue
            pid = player["rosterPlayerId"]
            prev = self._tag_candidates.get(uid)
            count = prev[1] + 1 if prev and prev[0] == pid else 1
            self._tag_candidates[uid] = (pid, count)
            if count < 2:
                continue
            self.user_players[uid] = {"rosterPlayerId": pid, "label": f"{player['firstName']} {player['surname']}", "at": now}
            for other, mem in list(self.user_players.items()):
                if other != uid and mem["rosterPlayerId"] == pid:
                    del self.user_players[other]  # a player is skated by one user at a time

    def _user_by_memory(self, roster_player_id, seconds: float = 300) -> int | None:
        """The user who was last seen skating with this hockey player (by ring colour)."""
        now = time.time()
        hits = [(m["at"], uid) for uid, m in self.user_players.items()
                if m["rosterPlayerId"] == roster_player_id and now - m["at"] < seconds]
        return max(hits)[1] if hits else None

    def _controlled_before(self, at: float, seconds: float = 30) -> dict | None:
        """The controlled player seen last before `at` (the goal), if seen recently enough."""
        c = self.controlled
        return c if c and at - seconds <= c["at"] <= at + 1 and c.get("rosterPlayerId") else None

    def _recent_banner_text(self, seconds: float = 20) -> str:
        now = time.time()
        return " | ".join(x for t, x in self.banners if now - t < seconds)

    def _recent(self, kind: str, seconds: float = 40) -> dict | None:
        now = time.time()
        return next((b for b in reversed(self.parsed_banners) if b["type"] == kind and now - b["at"] < seconds), None)

    def _on_score_change(self, change, frame: bytes) -> None:
        (old_first, old_second), (first, second) = change
        if first + second <= old_first + old_second:
            return  # a correction or replay, not a new goal
        if self.game.period == "SO":
            return  # shootout goals come from the banner
        home, away = (first, second) if self.home_first else (second, first)
        old_home = old_first if self.home_first else old_second
        home_scored = home > old_home
        ours = home_scored == bool(self.context.get("hostedIsHome", True))
        suggestion = self._goal_suggestion(ours)
        # The goal banner covers the score, so the score changes seconds after the goal: prefer
        # the clock read when the banner appeared.
        goal_banner = self._recent("goal")
        suggestion["clock"] = (goal_banner or {}).get("clock") or self.game.clock
        q = self.questions.ask("score_change", self._goal_text(suggestion, home, away), frame, suggestion)
        self._score_question = (q.id, time.time())

    def _resolve(self, name: str) -> dict | None:
        """A name from a banner → {"userId", "rosterPlayerId", "label"}: roster surname first, then aliases."""
        from .ocr import find_players, match_alias, user_for_player

        players = find_players(name, self.context.get("roster", []))
        if players:
            p = players[0]
            users = self.context.get("users", [])
            # Who skated with this player: alias > ring colour memory > the only user at that position.
            alias = match_alias(name, self.aliases)
            uid = (alias or {}).get("userId") or self._user_by_memory(p["rosterPlayerId"])
            user = next((u for u in users if u["userId"] == uid), None) if uid else user_for_player(p, users)
            return {"userId": user["userId"] if user else None, "rosterPlayerId": p["rosterPlayerId"],
                    "label": f"{p['firstName']} {p['surname']}", "userSure": user is not None}
        alias = match_alias(name, self.aliases)
        if alias:
            return {"userId": alias["userId"], "rosterPlayerId": alias["rosterPlayerId"],
                    "label": alias["label"], "userSure": alias["userId"] is not None}
        return None

    def _goal_suggestion(self, ours: bool) -> dict:
        if not ours:
            return {"kind": "opp_goal"}
        s: dict = {"kind": "goal"}
        goal = self._recent("goal")
        assists_banner = self._recent("assists")
        if goal:
            scorer = next((r for n in goal["names"][:1] if (r := self._resolve(n))), None)
            assist_names = goal["names"][1:]
            if assists_banner and assists_banner["at"] >= goal["at"]:
                assist_names = assists_banner["names"]
        else:
            # No recognised banner: look for any roster name in the recent banner texts.
            from .ocr import find_players
            found = find_players(self._recent_banner_text(), self.context.get("roster", []))
            scorer = self._resolve(found[0]["surname"]) if found else None
            assist_names = [p["surname"] for p in found[1:]]
        # Who the console controlled just before the goal (the banner time, else now).
        controlled = self._controlled_before(goal["at"] if goal else time.time())
        if controlled:
            if not scorer:
                scorer = {**controlled, "source": "controlled"}
            elif scorer.get("rosterPlayerId") == controlled["rosterPlayerId"]:
                # banner and controlled player agree: take the controlled player's user, it's surer
                if controlled.get("userId"):
                    scorer = {**scorer, "userId": controlled["userId"], "userSure": True}
            else:
                s["controlledLabel"] = controlled["label"]
        if scorer:
            s.update(rosterPlayerId=scorer["rosterPlayerId"], userId=scorer["userId"],
                     userSure=scorer["userSure"], scorerLabel=scorer["label"])
            if scorer.get("source") == "controlled":
                s["scorerSource"] = "controlled"
            s["assists"] = [{"userId": r["userId"], "rosterPlayerId": r["rosterPlayerId"]}
                            for n in assist_names[:2] if (r := self._resolve(n)) and r["userId"]]
        return s

    def _goal_text(self, s: dict, home: int, away: int) -> str:
        score = f"{home}:{away}"
        if s.get("kind") == "opp_goal":
            return f"Skóre {score}: gól súpera?"
        name = s.get("scorerLabel") or self._player_name(s.get("rosterPlayerId"))
        text = f"Skóre {score}: náš gól" + (f", strelec {name}?" if name else ". Kto skóroval?")
        if s.get("scorerSource") == "controlled":
            text += " (podľa ovládaného hráča)"
        elif s.get("controlledLabel"):
            text += f" Pred gólom bol ovládaný {s['controlledLabel']}."
        return text

    def _player_name(self, roster_player_id) -> str | None:
        p = next((p for p in self.context.get("roster", []) if p["rosterPlayerId"] == roster_player_id), None)
        return f"{p['firstName']} {p['surname']}" if p else None

    def _on_banner(self, text: str, frame: bytes) -> None:
        from .ocr import banner_outcome, parse_banner

        parsed = parse_banner(text)
        if parsed:
            now = time.time()
            last = self.parsed_banners[-1] if self.parsed_banners else None
            if last and now - last["at"] < 10 and last["type"] == parsed["type"] and last["names"] == parsed["names"]:
                return  # the same banner read again
            self.parsed_banners.append({**parsed, "at": now, "clock": self.game.clock})
            self.parsed_banners = [b for b in self.parsed_banners if now - b["at"] < 60]

        if self.game.period == "SO":
            if banner_outcome(text) != "goal":
                return
            names = (parsed or {}).get("names") or [text]
            shooter = next((r for n in names if (r := self._resolve(n))), None)
            if shooter:
                suggestion = {"kind": "so_goal", "rosterPlayerId": shooter["rosterPlayerId"],
                              "userId": shooter["userId"], "userSure": shooter["userSure"]}
                self.questions.ask("shootout", f"Nájazd: gól, {shooter['label']}?", frame, suggestion)
            else:
                self.questions.ask("shootout", "Nájazd: gól súpera?", frame, {"kind": "opp_so_goal"})
            return

        # A goal or assists banner shortly after the score changed: fill in the open question.
        if self._score_question and time.time() - self._score_question[1] < 40:
            qid = self._score_question[0]
            q = self.questions.get(qid)
            if q and q.status == "open" and q.suggestion and q.suggestion.get("kind") == "goal":
                s = self._goal_suggestion(True)
                old = q.suggestion
                better = (s.get("rosterPlayerId") and not old.get("rosterPlayerId")) or \
                         (len(s.get("assists") or []) > len(old.get("assists") or []))
                if better:
                    s["clock"] = old.get("clock")
                    score = self.game.score or (0, 0)
                    home, away = score if self.home_first else (score[1], score[0])
                    self.questions.suggest(qid, s, self._goal_text(s, home, away))
