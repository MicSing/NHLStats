from __future__ import annotations

import re
import unicodedata
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

PERIODS = ["P1", "P2", "P3", "OT"]
CLOCK_RE = re.compile(r"^@(\d{1,2}:\d{2})$")
GOAL_TYPES = {"pp": "PowerPlay", "sh": "ShortHanded"}
FIGHT_LABELS = {"Won": "vyhral", "Lost": "prehral", "Draw": "nerozhodne"}
FIGHT_OUTCOMES = {"w": "Won", "v": "Won", "l": "Lost", "p": "Lost", "d": "Draw", "r": "Draw"}


class CommandError(Exception):
    pass


def _fold(text: str) -> str:
    """Lowercase without diacritics, so 'stutzle' finds 'Stützle'."""
    return "".join(c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c))


@dataclass
class MatchSession:
    """Turns short typed commands into event proposals for one match."""

    match_id: int
    users: list[dict]
    roster: list[dict]
    period_index: int = -1  # -1 = not started yet
    log: list[dict] = field(default_factory=list)

    @property
    def period(self) -> int | None:
        return self.period_index + 1 if self.period_index >= 0 else None

    @property
    def period_label(self) -> str:
        return PERIODS[self.period_index] if self.period_index >= 0 else "pred zápasom"

    # ─── lookups ──────────────────────────────────────────────────────────

    def user_by_number(self, token: str) -> dict:
        if not token.isdigit() or not 1 <= int(token) <= len(self.users):
            raise CommandError(f"Používateľ '{token}' neexistuje, zadaj číslo 1–{len(self.users)}.")
        return self.users[int(token) - 1]

    def find_player(self, query: str, position: str | None = None) -> dict:
        q = _fold(query)
        matches = [p for p in self.roster if q in _fold(f"{p['firstName']} {p['surname']}")]
        if not matches:
            raise CommandError(f"Hráč '{query}' nie je v súpiske.")
        exact = [p for p in matches if _fold(p["surname"]) == q]
        if len(exact) == 1:
            return exact[0]
        if len(matches) > 1 and position:
            # Prefer players at the user's position (C user typing 'mac' → MacKinnon, not MacKenzie D).
            wanted = "D" if position.upper() in ("LD", "RD") else position.upper()
            same_pos = [p for p in matches
                        if wanted in [x.strip().upper() for x in (p.get("position") or "").split(",")]]
            if len(same_pos) == 1:
                return same_pos[0]
        if len(matches) > 1:
            names = ", ".join(f"{p['firstName']} {p['surname']}" for p in matches[:6])
            raise CommandError(f"'{query}' sedí na viac hráčov: {names}. Napíš viac písmen.")
        return matches[0]

    # ─── command parsing ──────────────────────────────────────────────────

    def parse(self, line: str) -> dict | None:
        """
        Returns an event dict ready for the API, or None for commands that create no event.
        Raises CommandError with a message for the operator.
        """
        tokens = line.strip().split()
        if not tokens:
            return None

        clock = None
        rest: list[str] = []
        for t in tokens[1:]:
            m = CLOCK_RE.match(t)
            if m:
                clock = m.group(1)
            else:
                rest.append(t)
        cmd = tokens[0].lower()

        if cmd == "g":
            # g 1 kadri a 2 makar a 3 rantanen  → goal with up to two assists
            parts = self._split_on(rest, "a")
            assists = [self._assist(part) for part in parts[1:]]
            if len(assists) > 2:
                raise CommandError("Najviac 2 asistencie.")
            event = self._attributed("Goal", parts[0], clock, allow_goal_type=True)
            event["assists"] = [a for a, _ in assists] or None
            if assists:
                event["_display"] += ", asist. " + ", ".join(d for _, d in assists)
            return event
        if cmd == "f":
            # f 2 makar w|l|d   (w = vyhral, l = prehral, d = nerozhodne)
            outcome = None
            for t in list(rest):
                if t.lower() in FIGHT_OUTCOMES:
                    rest.remove(t)
                    outcome = FIGHT_OUTCOMES[t.lower()]
            if outcome is None or not rest:
                raise CommandError("Bitka: f <číslo používateľa> [hráč] w|l|d  (vyhral / prehral / nerozhodne).")
            user = self.user_by_number(rest[0])
            player = self.find_player(" ".join(rest[1:]), user.get("position")) if len(rest) > 1 else None
            return self.make("Fight", user_id=user["userId"],
                             roster_player_id=player["rosterPlayerId"] if player else None,
                             fight_outcome=outcome, clock=clock)
        if cmd == "p":
            return self._attributed("Penalty", rest, clock)
        if cmd == "so":
            return self._attributed("ShootoutGoal", rest, clock)
        if cmd in ("o", "go"):
            return self._event("Goal", is_opponent=True, clock=clock, goal_type=self._goal_type(rest))
        if cmd == "po":
            return self._event("Penalty", is_opponent=True, clock=clock)
        if cmd == "soo":
            return self._event("ShootoutGoal", is_opponent=True, clock=clock)
        if cmd == "n":
            if self.period_index + 1 >= len(PERIODS):
                raise CommandError("Po predĺžení už ďalšia perióda nie je, použi 'end ot' alebo nájazdy.")
            self.period_index += 1
            return self._event("PeriodChange", subtype=PERIODS[self.period_index], clock=clock)
        if cmd == "end":
            subtype = (rest[0].upper() if rest else None)
            if subtype not in (None, "OT", "SO"):
                raise CommandError("Použi 'end', 'end ot' alebo 'end so'.")
            return self._event("MatchEnd", subtype=subtype, clock=clock)
        raise CommandError(f"Neznámy príkaz '{tokens[0]}'. Napíš 'h' pre pomoc.")

    @staticmethod
    def _split_on(tokens: list[str], marker: str) -> list[list[str]]:
        parts: list[list[str]] = [[]]
        for t in tokens:
            if t.lower() == marker:
                parts.append([])
            else:
                parts[-1].append(t)
        return parts

    def _assist(self, tokens: list[str]) -> tuple[dict, str]:
        if len(tokens) < 2:
            raise CommandError("Asistencia: a <číslo používateľa> <hráč>, napr. 'a 2 makar'.")
        user = self.user_by_number(tokens[0])
        player = self.find_player(" ".join(tokens[1:]), user.get("position"))
        return ({"userId": user["userId"], "rosterPlayerId": player["rosterPlayerId"]},
                f"{user['name']} ({player['surname']})")

    @staticmethod
    def _goal_type(rest: list[str]) -> str | None:
        for t in list(rest):
            if t.lower() in GOAL_TYPES:
                rest.remove(t)
                return GOAL_TYPES[t.lower()]
        return None

    def _attributed(self, event_type: str, rest: list[str], clock: str | None,
                    allow_goal_type: bool = False) -> dict:
        goal_type = self._goal_type(rest) if allow_goal_type else None
        user = player = None
        if rest:
            user = self.user_by_number(rest[0])
            if len(rest) > 1:
                player = self.find_player(" ".join(rest[1:]), user.get("position"))
            else:
                raise CommandError("Za číslom používateľa napíš aj hráča (časť priezviska), "
                                   "alebo nechaj oboje prázdne pre neznámeho strelca.")
        event = self._event(event_type, clock=clock, goal_type=goal_type,
                            user_id=user["userId"] if user else None,
                            roster_player_id=player["rosterPlayerId"] if player else None)
        event["_display"] = (f"{user['name']} ({player['firstName']} {player['surname']})"
                             if user and player else "neznámy hráč")
        return event

    def make(self, event_type: str, *, is_opponent: bool = False, user_id: int | None = None,
             roster_player_id: int | None = None, goal_type: str | None = None,
             clock: str | None = None, assists: list[dict] | None = None,
             fight_outcome: str | None = None) -> dict:
        """Builds an event from structured input (the web page's buttons) with the same checks as commands."""
        if event_type not in ("Goal", "Penalty", "ShootoutGoal", "Fight"):
            raise CommandError(f"Typ '{event_type}' sa nedá zapísať tlačidlom.")
        is_fight = event_type == "Fight"
        if is_fight and (is_opponent or user_id is None or fight_outcome not in ("Won", "Lost", "Draw")):
            raise CommandError("Pri bitke vyber používateľa a výsledok.")
        user = player = None
        if not is_opponent and user_id is not None:
            user = self._user(user_id)
            player = next((p for p in self.roster if p["rosterPlayerId"] == roster_player_id), None)
            if player is None and not is_fight:
                raise CommandError("Vyber aj hráča zo súpisky.")

        clean_assists: list[dict] = []
        names: list[str] = []
        for a in assists or []:
            if event_type != "Goal" or is_opponent:
                raise CommandError("Asistencie sa zapisujú iba k nášmu gólu.")
            au = self._user(a.get("userId"))
            ap = next((p for p in self.roster if p["rosterPlayerId"] == a.get("rosterPlayerId")), None)
            if ap is None:
                raise CommandError("Pri asistencii vyber aj hráča.")
            clean_assists.append({"userId": au["userId"], "rosterPlayerId": ap["rosterPlayerId"]})
            names.append(f"{au['name']} ({ap['surname']})")
        if len(clean_assists) > 2:
            raise CommandError("Najviac 2 asistencie.")

        event = self._event(event_type, is_opponent=is_opponent, clock=clock, goal_type=goal_type,
                            user_id=user["userId"] if user else None,
                            roster_player_id=player["rosterPlayerId"] if player else None)
        if clean_assists:
            event["assists"] = clean_assists
        if is_fight:
            event["fightOutcome"] = fight_outcome
        who = (f"{user['name']} ({player['firstName']} {player['surname']})" if user and player
               else user["name"] if user else None if is_opponent else "neznámy hráč")
        if is_fight:
            who = f"{who}: {FIGHT_LABELS[fight_outcome]}"
        if names:
            who += ", asist. " + ", ".join(names)
        event["_display"] = who
        return event

    def _user(self, user_id) -> dict:
        user = next((u for u in self.users if u["userId"] == user_id), None)
        if user is None:
            raise CommandError("Neznámy používateľ.")
        return user

    def _event(self, event_type: str, *, is_opponent: bool = False, subtype: str | None = None,
               goal_type: str | None = None, user_id: int | None = None,
               roster_player_id: int | None = None, clock: str | None = None) -> dict:
        return {
            "clientEventId": uuid.uuid4().hex,
            "eventType": event_type,
            "isOpponent": is_opponent,
            "eventSubtype": subtype,
            "goalType": goal_type,
            "userId": user_id,
            "rosterPlayerId": roster_player_id,
            "period": self.period,
            "gameClock": clock,
            # A person typed it, but the reviewer still confirms it in NHLStats.
            "confidence": "Medium" if user_id or is_opponent or event_type in ("PeriodChange", "MatchEnd") else "Low",
            "occurredAt": datetime.now(timezone.utc).isoformat(),
        }
