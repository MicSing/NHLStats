import json

import httpx

from nhlcollector.api import NhlStatsClient
from nhlcollector.outbox import Outbox


def make_client(handler):
    return NhlStatsClient("http://api.test", "nhls_test", transport=httpx.MockTransport(handler))


def event(cid, **kw):
    return {"clientEventId": cid, "eventType": "Goal", "isOpponent": True, **kw}


def test_client_sends_api_key_header():
    seen = {}

    def handler(request):
        seen["key"] = request.headers.get("X-Api-Key")
        return httpx.Response(200, json={"apiKeyId": 1, "name": "PC"})

    assert make_client(handler).whoami()["name"] == "PC"
    assert seen["key"] == "nhls_test"


def test_flush_marks_sent_and_keeps_validation_errors(tmp_path):
    def handler(request):
        events = json.loads(request.content)["events"]
        return httpx.Response(200, json={"results": [
            {"clientEventId": e["clientEventId"], "proposalId": None if e["clientEventId"] == "bad" else 7,
             "duplicate": False, "error": "nope" if e["clientEventId"] == "bad" else None}
            for e in events]})

    box = Outbox(tmp_path / "outbox.json")
    box.add(event("ok"))
    box.add(event("bad"))
    sent, err = box.flush(make_client(handler), 5)

    assert (sent, err) == (1, None)
    items = {i["event"]["clientEventId"]: i for i in box.items}
    assert items["ok"]["sent"] and items["ok"]["proposalId"] == 7
    assert items["bad"]["error"] == "nope" and not items["bad"]["sent"]
    assert box.pending_count == 0


def test_events_survive_outage_and_restart(tmp_path):
    def down(request):
        raise httpx.ConnectError("offline")

    box = Outbox(tmp_path / "outbox.json")
    box.add(event("a"))
    sent, err = box.flush(make_client(down), 5)
    assert sent == 0 and "offline" in err

    reopened = Outbox(tmp_path / "outbox.json")
    assert reopened.pending_count == 1

    calls = []

    def up(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={"results": [{"clientEventId": "a", "proposalId": 1, "duplicate": False, "error": None}]})

    assert reopened.flush(make_client(up), 5) == (1, None)
    assert reopened.flush(make_client(up), 5) == (0, None)  # nothing re-sent
    assert len(calls) == 1


def test_remove_unsent_only(tmp_path):
    box = Outbox(tmp_path / "outbox.json")
    box.add(event("a"))
    assert box.remove_unsent("a") is True
    assert box.remove_unsent("a") is False
