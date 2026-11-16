import json
import urllib.request

import httpx
import pytest

from nhlcollector.api import NhlStatsClient
from nhlcollector.config import ObsConfig
from nhlcollector.obs import ObsBridge
from nhlcollector.outbox import Outbox
from nhlcollector.recorder import Recorder
from nhlcollector.vision import FrameWatcher, QuestionQueue, RegionStore
from nhlcollector.web import WebApp, start_web

CTX = {
    "match": {"id": 5, "matchNumber": 3, "homeTeamShortName": "COL", "awayTeamShortName": "DAL"},
    "hostedIsHome": True,
    "users": [{"userId": 10, "name": "Michal", "position": "C"}],
    "roster": [{"rosterPlayerId": 4, "firstName": "Nazem", "surname": "Kadri", "position": "C"}],
}


@pytest.fixture
def web(tmp_path):
    submitted = []

    def handler(request):
        if request.method == "POST":
            events = json.loads(request.content)["events"]
            submitted.extend(events)
            return httpx.Response(200, json={"results": [
                {"clientEventId": e["clientEventId"], "proposalId": i + 1, "duplicate": False, "error": None}
                for i, e in enumerate(events)]})
        return httpx.Response(200, json=[{"id": 1, "status": "Confirmed"}])

    client = NhlStatsClient("http://api.test", "k", transport=httpx.MockTransport(handler))
    recorder = Recorder(client, CTX, ObsBridge(ObsConfig(enabled=False), tmp_path), Outbox(tmp_path / "o.json"))
    questions = QuestionQueue()
    watcher = FrameWatcher(lambda: None, RegionStore(tmp_path / "r.json"), questions)
    server = start_web(WebApp(recorder, watcher), 0)
    base = f"http://127.0.0.1:{server.server_address[1]}"
    yield base, submitted, questions
    server.shutdown()


def call(base, path, body=None, headers=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(base + path, data=data, headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def test_page_and_state(web):
    base, _, _ = web
    status, page = call(base, "/")
    assert status == 200 and b"Collector" in page
    status, raw = call(base, "/api/state")
    state = json.loads(raw)
    assert state["match"]["home"] == "COL" and state["regions"][0]["name"] == "score"


def test_answering_a_question_records_a_proposal(web):
    base, submitted, questions = web
    q = questions.ask("score_change", "Čo sa stalo?", None)
    status, _ = call(base, f"/api/questions/{q.id}/answer",
                     {"kind": "goal", "userId": 10, "rosterPlayerId": 4, "goalType": "PowerPlay", "clock": "12:34"})
    assert status == 200
    assert submitted[0]["eventType"] == "Goal" and submitted[0]["rosterPlayerId"] == 4
    assert submitted[0]["goalType"] == "PowerPlay" and submitted[0]["gameClock"] == "12:34"
    assert "_display" not in submitted[0]
    assert questions.open() == []

    state = json.loads(call(base, "/api/state")[1])
    assert state["events"][0]["status"] == "confirmed"  # status pulled from the server


def test_own_goal_needs_a_player(web):
    base, submitted, questions = web
    q = questions.ask("manual", "?", None)
    status, raw = call(base, f"/api/questions/{q.id}/answer", {"kind": "goal", "userId": 10})
    assert status == 400 and "hráča" in json.loads(raw)["error"]
    assert submitted == []


def test_dismiss_and_command(web):
    base, submitted, questions = web
    q = questions.ask("score_change", "?", None)
    assert call(base, f"/api/questions/{q.id}/answer", {"kind": "none"})[0] == 200
    assert submitted == [] and questions.open() == []
    assert call(base, "/api/command", {"line": "n"})[0] == 200
    assert submitted[0]["eventSubtype"] == "P1"


def test_region_calibration(web):
    base, _, _ = web
    status, raw = call(base, "/api/regions/score", {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.05})
    assert status == 200 and json.loads(raw)["region"]["x"] == 0.1


def test_cross_site_post_is_refused(web):
    base, submitted, _ = web
    status, _ = call(base, "/api/command", {"line": "o"}, headers={"Origin": "https://evil.example"})
    assert status == 403 and submitted == []
