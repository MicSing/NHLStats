import io

from PIL import Image, ImageDraw

from nhlcollector.vision import (ChangeDetector, FrameWatcher, QuestionQueue, Region, RegionStore,
                                 difference, signature)

# Score digits sit at x 40–100 px, y 4–34 px of a 320x180 frame; the clock is to their right.
BOARD = Region("score", "Skóre", 40 / 320, 4 / 180, 60 / 320, 30 / 180)


def frame(score: str, clock: str = "12:00") -> Image.Image:
    img = Image.new("RGB", (320, 180), (20, 40, 60))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, 200, 38), fill=(10, 10, 10))
    # Render the score large, like on a real broadcast scoreboard.
    txt = Image.new("L", (30, 10), 0)
    ImageDraw.Draw(txt).text((0, -1), score, fill=255)
    img.paste((255, 255, 255), (40, 4), txt.resize((60, 30)))
    d.text((120, 14), clock, fill=(255, 255, 255))  # ticking clock outside the score region
    d.ellipse((200, 100, 260, 160), fill=(200, 0, 0))
    return img


def jpeg(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=80)
    return buf.getvalue()


def test_clock_and_play_outside_the_region_are_ignored():
    a, b = frame("1:0", "12:00"), frame("1:0", "11:59")
    ImageDraw.Draw(b).rectangle((200, 100, 300, 170), fill=(0, 255, 0))
    assert difference(signature(a, BOARD), signature(b, BOARD)) < 1


def test_score_change_clears_default_threshold():
    diff = difference(signature(frame("1:0"), BOARD), signature(frame("2:0"), BOARD))
    assert diff > ChangeDetector().threshold


class Clock:
    t = 0.0

    def __call__(self):
        return self.t


def test_detector_needs_two_changed_frames_and_ignores_flicker():
    det = ChangeDetector(threshold=1.0, confirm_frames=2, cooldown=5, clock=Clock())
    same, changed = signature(frame("1:0"), BOARD), signature(frame("2:0"), BOARD)
    assert det.feed(same) is False          # baseline
    assert det.feed(changed) is False       # one frame: could be a camera cut
    assert det.feed(same) is False          # back to normal → reset
    assert det.feed(changed) is False
    assert det.feed(changed) is True        # stayed changed → fire
    assert det.feed(changed) is False       # new baseline, no repeat


def test_detector_cooldown_follows_animation():
    clock = Clock()
    det = ChangeDetector(threshold=1.0, confirm_frames=1, cooldown=5, clock=clock)
    a, b, c = (signature(frame(s), BOARD) for s in ("0:0", "1:0", "1:1"))
    det.feed(a)
    assert det.feed(b) is True
    clock.t = 2
    assert det.feed(c) is False             # inside cooldown, just follows
    clock.t = 10
    assert det.feed(c) is False             # settled look is the baseline now


def test_region_store_persists_and_clamps(tmp_path):
    store = RegionStore(tmp_path / "regions.json")
    store.update("score", 0.9, 0.1, 0.5, 0.1)
    reopened = RegionStore(tmp_path / "regions.json")
    r = reopened.get("score")
    assert (round(r.x, 2), r.w) == (0.5, 0.5)  # pulled back inside the frame


def test_watcher_asks_a_question_when_scoreboard_changes(tmp_path):
    frames = iter([jpeg(frame("0:0", f"12:0{i}")) for i in range(3)] + [jpeg(frame("1:0"))] * 3)
    store = RegionStore(tmp_path / "r.json")
    store.update("score", BOARD.x, BOARD.y, BOARD.w, BOARD.h)
    q = QuestionQueue()
    w = FrameWatcher(lambda: next(frames), store, q, detector=ChangeDetector(cooldown=0))
    for _ in range(6):
        w.tick()
    assert w.latest is not None
    open_qs = q.open()
    assert len(open_qs) == 1 and open_qs[0].kind == "score_change" and open_qs[0].frame


def test_watcher_survives_grab_errors(tmp_path):
    def boom():
        raise RuntimeError("OBS closed")

    w = FrameWatcher(boom, RegionStore(tmp_path / "r.json"), QuestionQueue())
    w.tick()
    assert w.error == "OBS closed"


def test_question_queue_resolve_once():
    q = QuestionQueue()
    a = q.ask("manual", "?", None)
    assert q.resolve(a.id, "answered", "Goal") is not None
    assert q.resolve(a.id, "dismissed") is None
    assert q.open() == []
