# NHL Stats 2.0

Tracks player performance (plus/minus points, goals, penalties) and converts it into monetary payouts across seasons of NHL (PlayStation/Xbox) play.

## Language

**Season**:
A tournament or league instance users compete in. Has a status (active/completed) and a start date.
_Avoid_: Tournament, league, competition

**Playoff Season**:
A `Season` whose `ParentSeasonId` points at a regular Season, scoping a subset of users into elimination play with its own (often higher) payout rate.
_Avoid_: Sub-season, child season

**Match**:
A single game within a Season, between a home team and an away team, with a tracked score.
_Avoid_: Game (used informally in UI copy, but the entity/domain term is Match)

**UserMatch**:
One player's stats entry for a Match. `MatchId` is nullable to allow historical stat entries not tied to a specific recorded Match.
_Avoid_: Player match, stat entry

**Point**:
A single scored event tied to a `PointReason` (e.g. Win, Goal, Assist, High Penalty), recorded as a `UserMatchPoint` against a `UserMatch`. Points can be positive or negative.
_Avoid_: Score, stat point

**Point Reason**:
An admin-defined category of Point with a fixed value (e.g. "Goal" = +1, "High Penalty" = -1).
_Avoid_: Point type, point category

**Money Config**:
An effective-dated payout rate: dollars per positive Point and dollars per negative Point. Multiple configs can exist over time (e.g. playoffs pay more per point).
_Avoid_: Payout rate, point value (point value belongs to Point Reason, not Money Config)

**Earnings**:
A user's Points multiplied by the active Money Config rate for a Season, before Expenses are subtracted.
_Avoid_: Winnings, income

**Payout**:
Final amount owed to a user for a Season: Earnings minus that user's share of Expenses.
_Avoid_: Earnings (Earnings is the pre-expense figure; Payout is final)

**Expense**:
A cost (e.g. league fee, trophy split) deducted from user Payouts for a Season.
_Avoid_: Fee, cost

**Team**:
One of the 32 seeded NHL teams. Can host a Season, play in Matches (home or away), and have a roster of assigned users. Only the Season's hosted Team has a full tracked season of Matches — opponent Teams appear only in whatever Matches they happened to play against the hosted Team, so opponent-side stats/odds cannot assume an independent season/last10/home-away sample exists (see `HostedShutoutWin`/`OpponentShutoutWin`, both computed from the hosted Team's own record).
_Avoid_: Club, franchise

**SeasonUser**:
Join entity linking a Season, a User, and the Team that user represents in that Season. No duplicate (Season, User, Team) combination allowed.
_Avoid_: Season participant, season roster entry

**RosterPlayer**:
A real NHL player record scoped to a Season, importable via CSV. Distinct from `User` — represents the real-world player, not the app's player-user.
_Avoid_: Player (ambiguous with User/participant — use RosterPlayer for the real NHL athlete record specifically)

**Bet**:
A user's betting ticket: a Stake, a combined `TotalOdds`, a Status, and one or more `BetLeg`s (each a single prediction on a Match). A Bet wins only if every Leg wins.
_Avoid_: Wager, pick, ticket (Bet is the domain term; "ticket" may appear informally in UI copy)

**BetLeg**:
A single prediction within a Bet, scoped to one Match and one `BetType` (e.g. `TeamWin`, `UserGoal`, `MatchTotalGoals`). Carries its own locked-in Odds and Won/Lost/Cancelled/Pending Status independent of the parent Bet's rollup.
_Avoid_: Selection, pick, bet line

**BetType**:
The kind of outcome a BetLeg predicts. Existing: `TeamWin`, `TeamWinOrDraw`, `TeamDraw`, `UserGoal`, `UserPenalty`, `UserPlusPoint`, `UserMinusPoint`. New: `MatchTotalGoals`, `HostedShutoutWin`, `OpponentShutoutWin` (see below).
_Avoid_: Bet category, market (market is used for the odds-generation concept, not the leg's type)

**MatchTotalGoals** (BetType):
A bet on the combined goals scored by both teams in a Match reaching a threshold N (3+, 4+, 5+, ...). Not tied to any single user or team — a match-total market. Requires at least 10 completed Matches in the Season before betting opens. Only one `MatchTotalGoals` leg allowed per Match per Bet.
_Avoid_: Over/under, goal bet (ambiguous with UserGoal)

**HostedShutoutWin** (BetType):
A bet that the Season's hosted Team wins the Match by any means (regulation, overtime, or shootout) while the opponent scores 0 goals. Treated as one atomic event for odds purposes (not a composite of separate win-probability and shutout-probability).
_Avoid_: Clean sheet, shutout bet (ambiguous — always specify Hosted or Opponent)

**OpponentShutoutWin** (BetType):
A bet that the opponent Team wins the Match by any means while the Season's hosted Team scores 0 goals. Only users who are not participants in the Match may place this bet (participants are fully blocked, same restriction tier as `TeamDraw`).
_Avoid_: Clean sheet, shutout bet

**Odds Bucket**:
One of four weighted components blended into a market's win-probability: Season (65%), Last10 (15%, most recent 10 completed Matches), Head-to-Head (10%, past meetings between the two specific Teams, spanning prior Seasons if needed), and Home/Away (10%, rate for the side — home or away — matching the upcoming Match's structure). Bucket population scope varies by BetType: `TeamWin` uses each side's own Team-specific buckets; `HostedShutoutWin` and `OpponentShutoutWin` are **both** computed entirely from the hosted Team's own record (shutout-win rate vs. shutout-loss rate, respectively) since opponent Teams have no independent match history to draw a season/last10/home-away rate from (see `Team`); `MatchTotalGoals` uses league-wide Season/Last10/Home-Away buckets (combined goals aren't a single-Team stat) but a Team-specific Head-to-Head and a Home/Away bucket scoped to the upcoming Match's home Team's own home-match history. Do not assume uniform scope across BetTypes without checking the specific formula.
_Avoid_: Weight, factor (too generic — Odds Bucket is the named concept)
