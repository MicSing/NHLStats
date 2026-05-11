# Betting Feature — Current Implementation

> **Status**: To be rewritten. This document captures the state of the feature as of April 2026.

---

## Overview

Users can place one bet per match on upcoming (future) matches. Three bet types are supported:

| BetType       | Value | What the user bets on                  |
|---------------|-------|----------------------------------------|
| `TeamWin`     | 1     | One of the two match teams will win    |
| `UserGoal`    | 2     | A specific player will score a goal    |
| `UserPenalty`  | 3     | A specific player will get a penalty   |

Each user may have **at most one bet per match** (enforced by a unique DB index on `(MatchId, CreatedBy)`).

---

## Backend

### Domain

**`Bet` entity** (`backend/src/NHLStats.Domain/Entities/Bet.cs`):

| Column      | Type        | Notes                                          |
|-------------|-------------|-------------------------------------------------|
| `Id`        | `Guid`      | Primary key                                     |
| `MatchId`   | `int`       | FK → `Matches`, cascade delete                  |
| `BetType`   | `BetType`   | Enum: TeamWin=1, UserGoal=2, UserPenalty=3      |
| `UserId`    | `int?`      | FK → `Users` (restrict delete), nullable        |
| `TeamId`    | `int?`      | FK → `Teams` (restrict delete), nullable        |
| `CreatedBy` | `string`    | Login identifier of the bet creator (required)  |
| `CreatedOn` | `DateTime`  | UTC timestamp when bet was created               |
| `UpdatedOn` | `DateTime?` | UTC timestamp of last update                     |
| `EvaluatedOn`| `DateTime?`| UTC timestamp when bet was evaluated             |

Navigation properties: `Match`, `User`, `Team`.

Inverse navigation collections added to `Match.Bets`, `User.Bets`, `Team.Bets`.

**`BetType` enum** (`backend/src/NHLStats.Domain/Entities/BetType.cs`):
```csharp
public enum BetType { TeamWin = 1, UserGoal = 2, UserPenalty = 3 }
```

**DbContext** (`NhlStatsDbContext.cs`):
- `DbSet<Bet> Bets`
- Unique index on `(MatchId, CreatedBy)`
- FK configurations with cascade/restrict delete behaviors

**Migration**: `20260309170703_AddBetTable` — creates the `Bets` table with indexes and FKs.

### DTOs (`backend/src/NHLStats.Application/DTOs/BetDto.cs`)

| Record              | Fields                                                                 | Usage              |
|---------------------|------------------------------------------------------------------------|--------------------|
| `BetDto`            | Id, MatchId, BetType, UserId, TeamId, CreatedBy, CreatedOn, UpdatedOn, EvaluatedOn | Full response     |
| `CurrentUserBetDto` | Id, BetType, UserId, TeamId, CreatedOn, UpdatedOn, EvaluatedOn         | Embedded in `FutureMatchDto` |
| `CreateBetDto`      | BetType, UserId, TeamId                                                | POST body          |
| `UpdateBetDto`      | BetType, UserId, TeamId, EvaluatedOn                                   | PUT body           |

### Service (`BetService`)

**Interface** (`IBetService`):
```csharp
Task<BetDto?> GetForMatchAsync(int matchId, string loginId);
Task<(BetDto? Bet, string? Error)> CreateForMatchAsync(int seasonId, int matchId, string loginId, CreateBetDto dto);
Task<(BetDto? Bet, string? Error)> UpdateForMatchAsync(int seasonId, int matchId, string loginId, UpdateBetDto dto);
Task<bool> DeleteForMatchAsync(int seasonId, int matchId, string loginId);
Task<bool> DeleteByIdAsync(Guid id, string loginId);
```

**Validation rules** in `BetService`:
- Match must exist in the given season
- Only one bet per user per match (create rejects duplicates)
- `TeamWin`: requires `teamId` (must be either `homeTeamId` or `awayTeamId` of the match); `userId` is set to null
- `UserGoal` / `UserPenalty`: requires `userId` (user must exist); `teamId` is optional (team must exist if provided)

**DI registration**: `builder.Services.AddScoped<IBetService, BetService>();` in `Program.cs`.

### API Endpoints (`BetsController`)

All endpoints require `[Authorize]`. The user is identified by JWT claim (`NameIdentifier` or `sub`).

| Method   | Route                                                  | Response  | Description          |
|----------|--------------------------------------------------------|-----------|----------------------|
| `GET`    | `/api/seasons/{seasonId}/matches/{matchId}/bet`        | 200 / 404 | Get current user's bet for a match |
| `POST`   | `/api/seasons/{seasonId}/matches/{matchId}/bet`        | 201 / 400 | Create a bet         |
| `PUT`    | `/api/seasons/{seasonId}/matches/{matchId}/bet`        | 200 / 400 / 404 | Update a bet    |
| `DELETE` | `/api/seasons/{seasonId}/matches/{matchId}/bet`        | 204 / 404 | Cancel bet by match  |
| `DELETE` | `/api/bets/{id:guid}`                                   | 204 / 404 | Delete bet by ID     |

### Future Matches Endpoint (bet integration)

`GET /api/matches/future?count=10` returns `FutureMatchDto[]`, which includes:
- Match info (teams, season, match number, hosted team)
- `UserMatches` — list of players registered for the match (`UserMatchInfoDto`)
- `Bet` — the current user's bet for that match (`CurrentUserBetDto?`, null if no bet)

The endpoint extracts `loginId` from JWT to look up bets. Bets are batch-loaded for all returned matches in a single query.

### Tests (`backend/tests/NHLStats.Api.Tests/Bets/BetsTests.cs`)

Integration tests using `WebApplicationFactory`:

1. **Create_bet_returns_201_and_payload** — POST TeamWin bet, verify 201 and response fields
2. **Update_bet_returns_200_and_updated_payload** — PUT changes teamId and evaluatedOn
3. **Delete_bet_by_id_returns_204** — DELETE by GUID, verify subsequent GET returns 404
4. **Cancel_match_bet_returns_204** — DELETE via match route

---

## Frontend

### Types (`frontend/src/types/bet.ts`)

```typescript
type BetSelection = 'home' | 'away'
type BetOutcome = 'pending' | 'won' | 'lost'
type BetType = 'teamWin' | 'userGoal' | 'userPenalty'
```

**`UserBet`** — localStorage-based bet record with full match context (teams, season, selection, stake, timestamps). Used by `BettingHistoryPage`.

**`MatchBet`** — localStorage-based simplified record for match-level betting. Stores betType, teamSelection or betOnUser info.

**`MatchBetDto`** — API response shape embedded in `FutureMatch` (from `CurrentUserBetDto` on the backend). Used on `BettingPage`.

### Types (`frontend/src/types/match.ts`)

`FutureMatch` interface includes `bet: MatchBetDto | null` — the user's existing bet for that match from the API.

### Services

**`bettingService.ts`** — localStorage-based service (keys: `nhlstats-bets-v1`, `nhlstats-match-bets-v2`):

| Method             | Description                                      |
|--------------------|--------------------------------------------------|
| `getUserBets(userId)` | Read user's bets sorted by most recent         |
| `upsertUserBet(input)` | Create or update a UserBet (idempotent by userId+matchId) |
| `removeBet(betId)`  | Delete a UserBet by id                           |
| `getMatchBet(userId, matchId)` | Find a single MatchBet                  |
| `upsertMatchBet(...)` | Create/update a MatchBet                       |
| `removeMatchBet(userId, matchId)` | Delete a MatchBet                     |

> **Note**: `BettingHistoryPage` still reads from localStorage via `bettingService`. `BettingPage` uses the real API. These two systems are **not connected** — the history page won't show bets placed via the API.

### Pages

**`BettingPage.tsx`** (`/betting-matches` route):
- Fetches future matches from `GET /api/matches/future`
- Displays expandable match cards with two-column layout (home team / away team)
- Bet options per match (radio buttons, one selection per match):
  - **Team Win**: "Bet on home/away team to win"
  - **User Goal**: "Who will score?" — lists other participants (excludes current user)
  - **User Penalty**: "Who will be penalized?" — lists other participants
- Visibility rules: If the user is participating in the match, team win options are restricted to the team they're hosting; goal/penalty options are hidden for participating users
- Actions: "Place Bet" (POST) or "Update Bet" (PUT) + "Cancel Bet" (DELETE)
- Initializes draft selections from existing API bets on load

**`BettingHistoryPage.tsx`** (`/betting-history` route):
- Reads bets from localStorage (`bettingService.getUserBets`)
- Fetches all seasons' matches to resolve outcomes
- Outcome resolution: compares `selectedTeamId` with match winner (higher score)
- Displays table: Match, Pick, Stake (€), Outcome (Won/Lost/Pending badge), Placed At, Remove action
- Shows summary: "{count} bets · {amount} € total stake"

### Routing (`App.tsx`)

```tsx
<Route path="/betting-matches" element={<ProtectedRoute><BettingPage /></ProtectedRoute>} />
<Route path="/betting-history" element={<ProtectedRoute><BettingHistoryPage /></ProtectedRoute>} />
```

Both routes are auth-protected.

### Navigation (`frontend/src/config/navConfig.ts`)

```typescript
{ to: '/betting-matches', labelKey: 'nav.bettingMatches', requiresAuth: true },
{ to: '/betting-history', labelKey: 'nav.bettingHistory', requiresAuth: true },
```

### i18n Keys (English)

Nav: `nav.bettingMatches` ("🎲 Match Betting"), `nav.betting` ("🎯 Betting"), `nav.bettingHistory` ("🧾 Betting History")

`betting.*` namespace includes: `title`, `futureTitle`, `historyTitle`, `historySubtitle`, `historyTable`, `historySummary`, `match`, `pick`, `stakeLabel`, `outcome`, `placedAtColumn`, `noMatches`, `noFutureMatches`, `noBetHistory`, `loadError`, `loginRequired`, `userIdMissing`, `noBetSelected`, `betPlaced`, `betError`, `placeBet`, `removeBet`, `matchNumber`, `unknownTeam`, `unknownUser`, `homeTeam`, `awayTeam`, `betOnHomeWin`, `betOnAwayWin`, `whoWillScore`, `whoWillBePenalized`, `noUsers`, `outcomeWon`, `outcomeLost`, `outcomePending`.

---

## Known Issues & Gaps

1. **Dual storage**: `BettingPage` uses the real API; `BettingHistoryPage` reads from localStorage. Bets placed via the API don't appear in history.
2. **No bet evaluation**: `EvaluatedOn` field exists but is never set automatically. Outcome in history is resolved client-side by comparing scores.
3. **No stake on API bets**: The `Bet` entity has no `stake`/amount field. Stakes only exist in the localStorage `UserBet` type.
4. **No admin management**: No admin UI to manage, evaluate, or view all bets.
5. **History outcome logic**: Only handles `TeamWin` outcome (compares `selectedTeamId` with match winner). `UserGoal` and `UserPenalty` outcomes are never resolved.
6. **Cancel Bet button text**: Hardcoded in English ("Bet canceled", "Failed to cancel bet") instead of using i18n.

---

## File Index

### Backend
- `backend/src/NHLStats.Domain/Entities/Bet.cs`
- `backend/src/NHLStats.Domain/Entities/BetType.cs`
- `backend/src/NHLStats.Domain/NhlStatsDbContext.cs` (Bets DbSet + configuration)
- `backend/src/NHLStats.Domain/Migrations/20260309170703_AddBetTable.cs`
- `backend/src/NHLStats.Application/DTOs/BetDto.cs`
- `backend/src/NHLStats.Application/Interfaces/IBetService.cs`
- `backend/src/NHLStats.Application/Services/BetService.cs`
- `backend/src/NHLStats.Application/DTOs/MatchDto.cs` (FutureMatchDto, CurrentUserBetDto)
- `backend/src/NHLStats.Application/Services/MatchService.cs` (GetFutureMatchesAsync)
- `backend/src/NHLStats.Api/Controllers/BetsController.cs`
- `backend/src/NHLStats.Api/Controllers/MatchesController.cs` (GetFuture)
- `backend/src/NHLStats.Api/Program.cs` (DI registration)
- `backend/tests/NHLStats.Api.Tests/Bets/BetsTests.cs`

### Frontend
- `frontend/src/types/bet.ts`
- `frontend/src/types/match.ts` (FutureMatch, MatchBetDto)
- `frontend/src/services/bettingService.ts`
- `frontend/src/pages/BettingPage.tsx`
- `frontend/src/pages/BettingHistoryPage.tsx`
- `frontend/src/config/navConfig.ts`
- `frontend/src/App.tsx` (routes)
- `frontend/src/i18n/locales/en.json` (betting.* keys)
- `frontend/src/i18n/locales/sk.json` (betting.* keys)
