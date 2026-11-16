from __future__ import annotations

ORDER = ["P1", "P2", "P3", "OT", "SO", "FINAL"]


class Stable:
    """A value read from the screen that only counts once it was read the same way `need` times in a row."""

    def __init__(self, need: int = 2):
        self.need = need
        self.value = None
        self._candidate = None
        self._count = 0

    def feed(self, value) -> bool:
        """Returns True when the stable value changed."""
        if value is None:
            return False
        if value == self._candidate:
            self._count += 1
        else:
            self._candidate, self._count = value, 1
        if self._count >= self.need and value != self.value:
            self.value = value
            return True
        return False


class GameState:
    """
    Period, clock and score as read from the scoreboard. Periods only move forward
    (P1 → P2 → P3 → OT → SO → FINAL), so a replay or intermission screen showing an earlier
    period can't send it back.
    """

    def __init__(self):
        self._period = Stable()
        self._clock = Stable(need=1)
        self._score = Stable()
        self.period: str | None = None
        self.clock: str | None = None
        self.score: tuple[int, int] | None = None

    def feed(self, period: str | None = None, clock: str | None = None,
             score: tuple[int, int] | None = None) -> list[tuple[str, object]]:
        changes: list[tuple[str, object]] = []
        if self._clock.feed(clock):
            self.clock = self._clock.value
        if self._period.feed(period):
            new = self._period.value
            if self.period is None or ORDER.index(new) > ORDER.index(self.period):
                previous, self.period = self.period, new
                changes.append(("final", previous) if new == "FINAL" else ("period", new))
        if self._score.feed(score):
            previous, self.score = self.score, self._score.value
            if previous is not None:
                changes.append(("score", (previous, self.score)))
        return changes
