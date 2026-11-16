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


# Rough starting points; calibrate them on the page by dragging over the real scoreboard/banner.
DEFAULT_REGIONS = [
    # Only the score digits: the game clock right next to them changes every second.
    Region("score", "Skóre (len čísla)", 0.12, 0.03, 0.08, 0.06),
    Region("banner", "Banner (gól / vylúčenie)", 0.15, 0.74, 0.70, 0.12),
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


class QuestionQueue:
    def __init__(self, max_items: int = 50):
        self._items: list[Question] = []
        self._next = 1
        self._lock = threading.Lock()
        self._max = max_items

    def ask(self, kind: str, text: str, frame: bytes | None) -> Question:
        with self._lock:
            q = Question(self._next, kind, text, time.time(), frame)
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

    def open(self) -> list[Question]:
        with self._lock:
            return [q for q in self._items if q.status == "open"]


class FrameWatcher:
    """
    Pulls a frame from OBS about once a second, keeps the latest one for the page, and runs the
    score change detector on it. In the test phase a change only asks the operator what
    happened; later the recognition will fill in the answer itself.
    """

    def __init__(self, grab: Callable[[], bytes | None], regions: RegionStore, questions: QuestionQueue,
                 interval: float = 1.0, detector: ChangeDetector | None = None):
        self._grab = grab
        self.regions = regions
        self.questions = questions
        self.interval = interval
        self.detector = detector or ChangeDetector()
        self.latest: bytes | None = None
        self.latest_at: float | None = None
        self.detector_enabled = True
        self.error: str | None = None
        self._stop = threading.Event()
        try:
            from PIL import Image  # noqa: F401
            self.pillow = True
        except ImportError:
            self.pillow = False

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
            sig = signature(image, self.regions.get("score"))
        except Exception as exc:  # noqa: BLE001
            self.error = f"frame decode: {exc}"
            return
        if self.detector.feed(sig):
            self.questions.ask("score_change",
                               "Zmenilo sa skóre. Čo sa stalo?", frame)
