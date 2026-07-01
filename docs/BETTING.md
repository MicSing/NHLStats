# Betting Feature

Users place multi-leg betting tickets (`Bet` + `BetLeg`) on upcoming (not-yet-played) Matches. Terminology follows [CONTEXT.md](../CONTEXT.md) — see `Bet`, `BetLeg`, `BetType`, `Odds Bucket` there.

---

## Bet Types

| BetType | Odds model | Participant rules |
|---|---|---|
| `TeamWin` | Composite (season/last10/h2h/goal-factor) | Participants restricted to hosted team |
| `TeamWinOrDraw` | Derived from TeamWin + Draw | Participants restricted to hosted team |
| `TeamDraw` | Derived from TeamWin | Blocked for participants |
| `UserGoal` | Windowed blend (curr/last10/prev), Occasions-based | Cannot bet on self |
| `UserPenalty` | Windowed blend, Occasions-based | Cannot bet on self |
| `UserPlusPoint` | Windowed blend, Occasions-based | Blocked for participants; **max 1 per match per ticket** |
| `UserMinusPoint` | Windowed blend, Occasions-based | Blocked for participants; **max 1 per match per ticket** |
| `MatchTotalGoals` | 4-bucket blend (65/15/10/10), N-window | No restriction; **max 1 per match per ticket** |
| `HostedShutoutWin` | 4-bucket blend, atomic event | Participants allowed (inherently hosted-side) |
| `OpponentShutoutWin` | 4-bucket blend, atomic event | Blocked for participants |

At most one match-result leg (`TeamWin`/`TeamWinOrDraw`/`TeamDraw`) per match per ticket. `UserPlusPoint` and `UserMinusPoint` are capped independently — a ticket may carry one of each on the same match, just not two of the same type.

### MatchTotalGoals

Bets on combined home+away goals reaching a threshold N (3+, 4+, 5+, ...). Not tied to a user or team. Requires ≥10 completed Matches in the season. Odds are exposed as a sliding window of exactly 4 consecutive N values, floored at 3+, that slides up when low thresholds become near-certain (odds < 1.0) and trims from the top when high thresholds become too improbable (`BettingConstants.MinBettableProbability`).

Odds Bucket weights (65/15/10/10):
- **Season (65%)**: league-wide rate across all completed matches this season.
- **Last10 (15%)**: league-wide rate across the 10 most recent completed matches.
- **H2H (10%)**: rate across past meetings between the two specific teams (any season).
- **Home/Away (10%)**: this match's home team's own home-match history this season.

### HostedShutoutWin / OpponentShutoutWin

`HostedShutoutWin`: the season's hosted team wins by any means (regulation, OT, or shootout) while the opponent scores 0. `OpponentShutoutWin`: the opponent wins by any means while the hosted team scores 0. Each is priced as a single atomic event via the same 65/15/10/10 blend, but **both markets are computed entirely from the hosted team's own match history** — this app only tracks a full season of matches for the hosted team; an opponent team only appears in however many games it happened to play against the hosted team, so there's no reliable independent season/last10/home-away sample to draw an opponent-side rate from.
- **Season (65%)**: hosted team's rate across its completed matches this season — shutout-**win** rate for `HostedShutoutWin`, shutout-**loss** rate (hosted scored 0 and lost) for `OpponentShutoutWin`.
- **Last10 (15%)**: same rate, hosted team's 10 most recent completed matches.
- **H2H (10%)**: same rate, restricted to past meetings between the hosted team and this specific opponent (naturally small sample — real data either way, since H2H is inherently opponent-scoped).
- **Home/Away (10%)**: same rate, hosted team's matches this season played on the same side (home/away) as the upcoming match.

Each bucket falls back to the season rate when its own sample is empty (no last10/h2h/home-away history yet).

---

## Retroactive Plus/Minus Odds Recalculation

Historical tickets placed before the 1-per-match cap could stack multiple `UserPlusPoint`/`UserMinusPoint` legs on the same match, multiplying all their odds together. An admin-triggered global recalculation (`POST /api/admin/bets/recalculate-plus-minus-odds`) finds Won bets with such same-match stacks and collapses each offending match's legs (per type) to their single highest odds — other legs, and plus/minus legs on other matches, are untouched. See [ADR 0002](adr/0002-retroactive-plus-minus-odds-recalculation.md) for the full rationale. The recalculation is a pure function of leg data, safe to re-run at any time; there is no tracking flag. Admin UI: Finance page → Betting tab.

---

## Backend

### Domain

**`Bet`** (`backend/src/NHLStats.Domain/Entities/Bet.cs`): ticket header — `Id` (Guid), `CreatedBy`, `Stake`, `TotalOdds`, `Status` (Pending/Won/Lost/Cancelled), timestamps, and a collection of `Legs`.

**`BetLeg`** (`backend/src/NHLStats.Domain/Entities/BetLeg.cs`): one leg — `MatchId`, `BetType`, optional `UserId`/`TeamId`, locked-in `Odds`, `Occasions` (also used to carry the N threshold for `MatchTotalGoals`), `Status`.

**`BetType`** (`backend/src/NHLStats.Domain/Entities/BetType.cs`): `TeamWin=1, UserGoal=2, UserPenalty=3, TeamWinOrDraw=4, UserPlusPoint=5, UserMinusPoint=6, TeamDraw=7, MatchTotalGoals=8, HostedShutoutWin=9, OpponentShutoutWin=10`.

**`MatchOdds`** (`backend/src/NHLStats.Domain/Entities/MatchOdds.cs`): precomputed odds per `(MatchId, BetType, TargetId)` (unique index). `TargetId` holds a user/team id for user- and team-scoped markets, the N threshold for `MatchTotalGoals`, or is `null` for match-level markets (`Draw`, `HostedShutoutWin`, `OpponentShutoutWin`).

### Services

- **`BettingOddsService`** (`RecalculateForMatchAsync`, `GetMatchOddsAsync`, `GetUserEventOddsForOccasionsAsync`): computes and persists `MatchOdds` rows. Holds all probability-bucket math.
- **`BetService`** (`PlaceBetAsync`, `EvaluateMatchBetsAsync`, `RecalculatePlusMinusOddsAsync`, ...): validates and places tickets, resolves win/loss on match completion, and runs the retroactive recalculation.
- **`BettingBalanceService`** / **`BettingCalculator`**: compute a user's available betting balance and max-win cap from points, aggregated data, and bet history.

### API (`BetsController`)

| Method | Route | Notes |
|---|---|---|
| `GET` | `/api/betting/balance` | Current user's balance |
| `GET` | `/api/betting/matches/{matchId}/odds` | Full `MatchOddsDto` for a match |
| `GET` | `/api/betting/matches/{matchId}/odds/occasions` | Occasions-window odds for a user-event market |
| `GET` | `/api/betting/bets/active` \| `/history` \| `/all` | Ticket listings |
| `POST` | `/api/betting/bets` | Place a ticket (`CreateBetDto`) |
| `DELETE` | `/api/betting/bets/{betId}` | Cancel a pending ticket |
| `POST` | `/api/admin/matches/{matchId}/re-evaluate-bets` | Admin: re-run evaluation for a match |
| `POST` | `/api/admin/bets/recalculate-plus-minus-odds` | Admin: global retroactive recalculation |

---

## Frontend

- **Types**: `frontend/src/types/bet.ts` (`ApiBetType`, `MatchOddsDto`, `MatchTotalGoalsOddsDto`, `BetDto`, `CreateBetDto`).
- **Betting UI**: `frontend/src/components/betting/` — `BettingTab.tsx` (draft-ticket state, per-match-cap guards), `MarketsSection.tsx` (renders all markets incl. total-goals and shutout), `bettingTypes.ts` (`teamOutcomeTypes`, `matchHasLegOfType` helper, leg labeling).
- **Admin recalculation UI**: `frontend/src/components/finance/BettingAdminTab.tsx`, wired into `FinancePage.tsx`'s "Betting" tab.
- **i18n**: `betting.*` namespace in `en.json`/`sk.json` (markets, per-match-cap error messages); `admin.betting.*` for the recalculation panel.

---

## Tests

- `backend/tests/NHLStats.Application.Tests/Services/BettingOddsServiceTeamWinTests.cs` — TeamWin/Draw odds math.
- `backend/tests/NHLStats.Application.Tests/Services/BettingOddsServiceNewMarketsTests.cs` — MatchTotalGoals window, shutout blend.
- `backend/tests/NHLStats.Application.Tests/Services/BetServiceRecalculationTests.cs` — retroactive collapse logic (per-match-group collapse, idempotency, cross-match isolation).
- `backend/tests/NHLStats.Api.Tests/Bets/BetsTests.cs` — end-to-end ticket placement, per-match caps, admin recalculation endpoint.
