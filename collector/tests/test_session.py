import pytest

from nhlcollector.session import CommandError, MatchSession

USERS = [
    {"userId": 10, "name": "Michal", "position": "C"},
    {"userId": 11, "name": "Peter", "position": "LD"},
]
ROSTER = [
    {"rosterPlayerId": 1, "firstName": "Nathan", "surname": "MacKinnon", "position": "C"},
    {"rosterPlayerId": 2, "firstName": "Ryan", "surname": "MacKenzie", "position": "D"},
    {"rosterPlayerId": 3, "firstName": "Tim", "surname": "Stützle", "position": "C"},
    {"rosterPlayerId": 4, "firstName": "Nazem", "surname": "Kadri", "position": "C"},
]


def session():
    return MatchSession(match_id=5, users=USERS, roster=ROSTER)


def test_goal_with_user_and_player():
    e = session().parse("g 1 kadri @12:34")
    assert e["eventType"] == "Goal"
    assert e["userId"] == 10 and e["rosterPlayerId"] == 4
    assert e["gameClock"] == "12:34"
    assert e["isOpponent"] is False
    assert len(e["clientEventId"]) == 32


def test_ambiguous_player_resolved_by_user_position():
    assert session().parse("g 1 mac")["rosterPlayerId"] == 1  # C user → MacKinnon
    assert session().parse("p 2 mac")["rosterPlayerId"] == 2  # LD user → MacKenzie


def test_player_search_ignores_diacritics():
    assert session().parse("g 1 stutzle")["rosterPlayerId"] == 3


def test_goal_type_flag():
    assert session().parse("g 1 kadri pp")["goalType"] == "PowerPlay"
    assert session().parse("o sh")["goalType"] == "ShortHanded"


def test_unknown_scorer_and_opponent_events():
    e = session().parse("g")
    assert e["userId"] is None and e["confidence"] == "Low"
    assert session().parse("o")["isOpponent"] is True
    assert session().parse("po")["eventType"] == "Penalty"


def test_user_without_player_is_an_error():
    with pytest.raises(CommandError):
        session().parse("g 1")


def test_bad_user_number_and_unknown_player():
    with pytest.raises(CommandError):
        session().parse("g 7 kadri")
    with pytest.raises(CommandError):
        session().parse("g 1 gretzky")


def test_periods_advance_and_stamp_events():
    s = session()
    assert s.parse("o")["period"] is None
    assert s.parse("n")["eventSubtype"] == "P1"
    assert s.parse("o")["period"] == 1
    s.parse("n"); s.parse("n")
    assert s.parse("n")["eventSubtype"] == "OT"
    with pytest.raises(CommandError):
        s.parse("n")


def test_match_end_variants():
    assert session().parse("end")["eventSubtype"] is None
    assert session().parse("end so")["eventSubtype"] == "SO"
    with pytest.raises(CommandError):
        session().parse("end later")


def test_unknown_command():
    with pytest.raises(CommandError):
        session().parse("zzz")


def test_goal_with_assists():
    e = session().parse("g 1 kadri a 2 mackenzie")
    assert e["assists"] == [{"userId": 11, "rosterPlayerId": 2}]
    assert "asist." in e["_display"]
    with pytest.raises(CommandError):
        session().parse("g 1 kadri a 2 mackenzie a 1 mack a 2 mackenzie")
    with pytest.raises(CommandError):
        session().parse("g 1 kadri a 2")


def test_goal_without_assists_sends_none():
    assert session().parse("g 1 kadri")["assists"] is None


def test_fight_with_outcome():
    e = session().parse("f 2 mackenzie w")
    assert e["eventType"] == "Fight" and e["fightOutcome"] == "Won"
    assert e["userId"] == 11 and e["rosterPlayerId"] == 2
    e = session().parse("f 1 l")
    assert e["fightOutcome"] == "Lost" and e["rosterPlayerId"] is None
    with pytest.raises(CommandError):
        session().parse("f 1 kadri")


def test_make_validates_assists_and_fight():
    s = session()
    e = s.make("Goal", user_id=10, roster_player_id=4, assists=[{"userId": 11, "rosterPlayerId": 2}])
    assert e["assists"] == [{"userId": 11, "rosterPlayerId": 2}]
    with pytest.raises(CommandError):
        s.make("Goal", is_opponent=True, assists=[{"userId": 11, "rosterPlayerId": 2}])
    with pytest.raises(CommandError):
        s.make("Fight", user_id=10)
    assert s.make("Fight", user_id=10, fight_outcome="Draw")["_display"].endswith("nerozhodne")
