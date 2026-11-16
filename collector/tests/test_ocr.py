from nhlcollector.gamestate import GameState
from nhlcollector.ocr import (banner_outcome, find_players, parse_clock, parse_period, parse_score,
                              user_for_player)

ROSTER = [
    {"rosterPlayerId": 1, "firstName": "Nathan", "surname": "MacKinnon", "position": "C"},
    {"rosterPlayerId": 2, "firstName": "Cale", "surname": "Makar", "position": "D"},
    {"rosterPlayerId": 3, "firstName": "Mikko", "surname": "Rantanen", "position": "RW"},
    {"rosterPlayerId": 4, "firstName": "Tim", "surname": "Stützle", "position": "C, LW"},
]
USERS = [{"userId": 10, "name": "Michal", "position": "C"}, {"userId": 11, "name": "Peter", "position": "LD"},
         {"userId": 12, "name": "Jano", "position": "RW"}]


def test_parse_clock():
    assert parse_clock("12:34") == "12:34"
    assert parse_clock(" 5.07 ") == "05:07"
    assert parse_clock("1234") == "12:34"
    assert parse_clock("O:45") == "00:45"
    assert parse_clock("25:00") is None
    assert parse_clock("PP") is None


def test_parse_period():
    assert parse_period("1st") == "P1"
    assert parse_period("2ND") == "P2"
    assert parse_period("3rd") == "P3"
    assert parse_period("OT") == "OT"
    assert parse_period("Shootout") == "SO"
    assert parse_period("FINAL/OT") == "FINAL"
    assert parse_period("") is None


def test_parse_score():
    assert parse_score("2 1") == (2, 1)
    assert parse_score("3-0") == (3, 0)
    assert parse_score("21") == (2, 1)
    assert parse_score("x") is None


def test_find_players_in_reading_order_with_typos_and_diacritics():
    found = find_players("GOAL! RANTANEN (12) Assists: MAKAR, MACKINNQN", ROSTER)
    assert [p["rosterPlayerId"] for p in found] == [3, 2, 1]
    assert find_players("STUTZLE scores", ROSTER)[0]["rosterPlayerId"] == 4


def test_user_for_player_by_position():
    assert user_for_player(ROSTER[0], USERS)["userId"] == 10
    assert user_for_player(ROSTER[1], USERS)["userId"] == 11      # D → LD user
    assert user_for_player({"position": "LW"}, USERS) is None       # nobody plays LW


def test_banner_outcome():
    assert banner_outcome("MacKinnon SCORES!") == "goal"
    assert banner_outcome("SAVE by Oettinger") == "miss"
    assert banner_outcome("Line change") is None


def test_game_state_needs_two_reads_and_never_goes_back():
    g = GameState()
    assert g.feed(period="P1") == []
    assert g.feed(period="P1") == [("period", "P1")]
    g.feed(period="P2"); assert g.period == "P1"   # one read is not enough
    assert g.feed(period="P2") == [("period", "P2")]
    g.feed(period="P1"); g.feed(period="P1")        # replay of an earlier period
    assert g.period == "P2"
    g.feed(period="SO")
    assert g.feed(period="SO") == [("period", "SO")]
    g.feed(period="FINAL")
    assert g.feed(period="FINAL") == [("final", "SO")]


def test_game_state_score_change():
    g = GameState()
    g.feed(score=(0, 0)); g.feed(score=(0, 0))
    g.feed(score=(1, 0))
    assert g.feed(score=(1, 0)) == [("score", ((0, 0), (1, 0)))]


# ─── EA NHL banners and aliases ─────────────────────────────────────────────

from nhlcollector.ocr import match_alias, parse_banner, resolve_aliases  # noqa: E402


def test_parse_banner_ea_goal_and_assists():
    assert parse_banner("PIŤŤŠY\nGOAL[1]") == {"type": "goal", "names": ["PIŤŤŠY"]}
    # as Tesseract actually read it from the screenshot
    assert parse_banner("PITTS]\nGOAL IT]") == {"type": "goal", "names": ["PITTS"]}
    assert parse_banner("WZRD, GOGUEN\nASSISTS") == {"type": "assists", "names": ["WZRD", "GOGUEN"]}
    assert parse_banner("UNASSISTED") == {"type": "assists", "names": []}


def test_parse_banner_one_line_goal_lists_scorer_first():
    assert parse_banner("GOAL MACKINNON  Assist: MAKAR") == {"type": "goal", "names": ["MACKINNON", "MAKAR"]}
    assert parse_banner("ITC 2 SOG 9 WIZ 3") is None


ALIAS_USERS = [{"userId": 10, "name": "Michal Singer", "position": "C"}, {"userId": 11, "name": "Peter", "position": "LD"}]
ALIAS_ROSTER = [{"rosterPlayerId": 2, "firstName": "Cale", "surname": "Makar", "position": "D"}]


def test_resolve_aliases_and_fuzzy_match():
    entries, warnings = resolve_aliases(
        {"PIŤŤŠY": "Michal", "WZRD": {"user": "Peter", "player": "Makar"}, "X": "Nobody"}, ALIAS_USERS, ALIAS_ROSTER)
    assert warnings == ["Alias 'X': používateľ 'Nobody' nie je v sezóne."]
    assert match_alias("PITTS", entries)["userId"] == 10      # one letter dropped by OCR
    assert match_alias("PITTSY", entries)["userId"] == 10
    wzrd = match_alias("wzrd", entries)
    assert wzrd["userId"] == 11 and wzrd["rosterPlayerId"] == 2
    assert match_alias("WZRO", entries) is None              # short names must match exactly
    assert match_alias("GOGUEN", entries) is None
