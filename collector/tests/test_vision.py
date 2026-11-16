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


class FakeReader:
    """Stands in for Tesseract: returns scripted text per region for each frame."""
    available = True

    def __init__(self, script):
        self.script = iter(script)
        self.current = {}

    def read(self, image, region, mode):
        if region.name == "period":  # period is read first on every tick
            self.current = next(self.script)
        return self.current.get(region.name)


CTX = {
    "hostedIsHome": True,
    "users": [{"userId": 10, "name": "Michal", "position": "C"}, {"userId": 11, "name": "Peter", "position": "LD"}],
    "roster": [{"rosterPlayerId": 1, "firstName": "Nathan", "surname": "MacKinnon", "position": "C"},
               {"rosterPlayerId": 2, "firstName": "Cale", "surname": "Makar", "position": "D"}],
}


def frame_for(step, i):
    img = frame("0:0", f"12:{i:02d}")
    if step.get("banner"):  # a banner covers the scoreboard box, top left
        shade = 240 - 60 * ("ASSIST" in step["banner"])  # a different banner looks different
        ImageDraw.Draw(img).rectangle((19, 5, 68, 19), fill=(shade, shade, shade))
    return jpeg(img)


def watcher_with(script, tmp_path):
    frames = iter([frame_for(step, i) for i, step in enumerate(script)])
    w = FrameWatcher(lambda: next(frames), RegionStore(tmp_path / "r.json"), QuestionQueue(), reader=FakeReader(script))
    w.context = CTX
    changes = []
    w.on_game_change = lambda kind, value: changes.append((kind, value))
    return w, changes


def test_ocr_score_change_suggests_scorer_and_assist_from_banner(tmp_path):
    script = [
        {"period": "1st", "clock": "15:00", "score": "0 0"},
        {"period": "1st", "clock": "14:59", "score": "0 0"},
        {"period": "1st", "clock": "14:58", "score": "1 0"},
        {"period": "1st", "clock": "14:58", "score": "1 0", "banner": "GOAL MACKINNON  Assist: MAKAR"},
    ]
    w, changes = watcher_with(script, tmp_path)
    for _ in script:
        w.tick()
    assert changes == [("period", "P1")]
    assert w.game.clock == "14:58"
    q = w.questions.open()[0]
    assert q.suggestion["kind"] == "goal"
    assert q.suggestion["rosterPlayerId"] == 1 and q.suggestion["userId"] == 10
    assert q.suggestion["assists"] == [{"userId": 11, "rosterPlayerId": 2}]
    assert "MacKinnon" in q.text


def test_ocr_opponent_goal_and_final(tmp_path):
    script = [
        {"period": "OT", "clock": "4:00", "score": "2 2"},
        {"period": "OT", "clock": "3:59", "score": "2 2"},
        {"period": "OT", "clock": "3:10", "score": "2 3"},
        {"period": "OT", "clock": "3:10", "score": "2 3"},
        {"period": "FINAL", "clock": "", "score": "2 3"},
        {"period": "FINAL", "clock": "", "score": "2 3"},
    ]
    w, changes = watcher_with(script, tmp_path)
    for _ in script:
        w.tick()
    assert w.questions.open()[0].suggestion == {"kind": "opp_goal", "clock": "03:10"}
    assert changes == [("period", "OT"), ("final", "OT")]


def test_shootout_goal_banner_asks_with_shooter(tmp_path):
    script = [
        {"period": "SO", "clock": "", "score": "2 2"},
        {"period": "SO", "clock": "", "score": "2 2"},
        {"period": "SO", "clock": "", "score": "2 2", "banner": "MAKAR SCORES"},
    ]
    w, changes = watcher_with(script, tmp_path)
    for _ in script:
        w.tick()
    q = w.questions.open()[-1]
    assert q.kind == "shootout"
    assert q.suggestion["kind"] == "so_goal" and q.suggestion["rosterPlayerId"] == 2 and q.suggestion["userId"] == 11


def test_ea_style_goal_then_assists_banner_then_score(tmp_path):
    # EA NHL: the goal banner covers the score, then an assists banner, then the new score shows.
    script = [
        {"period": "1st", "clock": "15:00", "score": "0 0"},
        {"period": "1st", "clock": "14:59", "score": "0 0"},
        {"period": "1st", "clock": "14:40", "score": None, "banner": "MACKINNON\nGOAL[1]"},
        {"period": "1st", "clock": "14:40", "score": None, "banner": "MAKAR\nASSISTS"},
        {"period": "1st", "clock": "14:40", "score": "1 0"},
        {"period": "1st", "clock": "14:40", "score": "1 0"},
    ]
    w, changes = watcher_with(script, tmp_path)
    w.banner_detector.cooldown = 0  # frames come every second in reality, here all at once
    for _ in script:
        w.tick()
    q = w.questions.open()[0]
    assert q.suggestion["kind"] == "goal"
    assert q.suggestion["rosterPlayerId"] == 1 and q.suggestion["userId"] == 10
    assert q.suggestion["assists"] == [{"userId": 11, "rosterPlayerId": 2}]
    assert q.suggestion["clock"] == "14:40"


def test_away_first_scoreboard_and_alias_scorer(tmp_path):
    from nhlcollector.ocr import resolve_aliases

    script = [
        {"period": "2nd", "clock": "10:00", "score": "0 0"},
        {"period": "2nd", "clock": "09:59", "score": "0 0"},
        {"period": "2nd", "clock": "09:30", "score": None, "banner": "PITTS]\nGOAL IT]"},
        {"period": "2nd", "clock": "09:30", "score": "0 1"},
        {"period": "2nd", "clock": "09:30", "score": "0 1"},
    ]
    w, _ = watcher_with(script, tmp_path)
    w.home_first = False  # bottom row is the home team, and we are home
    w.aliases, _ = resolve_aliases({"PIŤŤŠY": "Michal"}, CTX["users"], CTX["roster"])
    for _ in script:
        w.tick()
    q = w.questions.open()[0]
    assert q.suggestion["kind"] == "goal" and q.suggestion["userId"] == 10
    assert q.text.startswith("Skóre 1:0")


def test_ring_colour_memory_decides_the_scorers_user(tmp_path):
    # By position Makar (D) would be Peter (LD); the green ring shows Michal skating with him.
    script = [
        {"period": "1st", "clock": "10:00", "score": "0 0", "tag:green": "X MAKAR"},
        {"period": "1st", "clock": "09:59", "score": "0 0", "tag:green": "X MAKAR"},
        {"period": "1st", "clock": "09:58", "score": "0 0", "tag:green": "X MAKAR"},
        {"period": "1st", "clock": "09:50", "score": None, "banner": "MAKAR\nGOAL[3]"},
        {"period": "1st", "clock": "09:50", "score": "1 0"},
        {"period": "1st", "clock": "09:50", "score": "1 0"},
    ]
    frames = []
    for i, step in enumerate(script):
        img = Image.open(io.BytesIO(frame_for(step, i)))
        ImageDraw.Draw(img).ellipse((140, 90, 165, 100), outline=(40, 200, 60), width=2)
        frames.append(jpeg(img))
    it = iter(frames)
    w = FrameWatcher(lambda: next(it), RegionStore(tmp_path / "r.json"), QuestionQueue(), reader=FakeReader(script))
    w.context = CTX
    w.user_colors = {10: "green"}
    w.ring_every = 1  # read the rings on every frame of this short script
    for _ in script:
        w.tick()
    assert w.user_players[10]["rosterPlayerId"] == 2
    q = w.questions.open()[0]
    assert q.suggestion["rosterPlayerId"] == 2 and q.suggestion["userId"] == 10 and q.suggestion["userSure"]


def test_controlled_player_is_the_scorer_when_no_banner(tmp_path):
    script = [
        {"period": "2nd", "clock": "08:00", "score": "1 1", "controlled": "> 29 N. MACKINNON"},
        {"period": "2nd", "clock": "07:59", "score": "1 1", "controlled": "29 N. MACKINNON"},
        {"period": "2nd", "clock": "07:40", "score": None},
        {"period": "2nd", "clock": "07:40", "score": "2 1"},
        {"period": "2nd", "clock": "07:40", "score": "2 1"},
    ]
    w, _ = watcher_with(script, tmp_path)
    w.controlled_box = True
    for _ in script:
        w.tick()
    q = w.questions.open()[0]
    assert q.suggestion["rosterPlayerId"] == 1 and q.suggestion["userId"] == 10
    assert "ovládaného" in q.text
