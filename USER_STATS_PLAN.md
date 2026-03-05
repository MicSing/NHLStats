# User Stats Page — Implementation Plan

## Overview

Add a `/user-stats` page with per-user penalty analysis, minus-point pie chart, match trend line, and best/worst match highlights. Enhance the Season page "Up Next" with opponent head-to-head history (only for seasons sharing the same hosted team). Empty states show "No data yet"; h2h loads with a spinner.

---

## Phase 1 — Backend: `GET /api/seasons/{id}/users` Endpoint

### 1.1 Write Tests
- [ ] Add test in `backend/tests/NHLStats.Api.Tests/Seasons/` (or existing season test file)
- [ ] Seed a season with 2–3 `SeasonUser` entries, assert `GET /api/seasons/{id}/users` returns correct `UserDto[]`
- [ ] Test empty season returns empty array
- [ ] Test non-existent season returns 404

### 1.2 Implement
- [ ] Add `Task<IEnumerable<UserDto>?> GetSeasonUsersAsync(int seasonId)` to `ISeasonService`
- [ ] Implement in `SeasonService`: query `SeasonUsers` where `SeasonId == seasonId`, join `User`, project to `UserDto`; return `null` if season not found
- [ ] Add `[HttpGet("{id:int}/users")]` to `SeasonsController`
- [ ] Verify tests pass

---

## Phase 2 — Backend: New DTOs

### 2.1 Add DTOs to `StatsDtos.cs`
- [ ] `PointReasonBreakdownItemDto(int PointReasonId, string PointReasonName, bool IsPositive, int TotalCount)`
- [ ] `UserPointReasonBreakdownDto(int UserId, string UserName, IEnumerable<PointReasonBreakdownItemDto> Items)`
- [ ] `HeadToHeadUserResultDto(int UserId, string UserName, int TotalPlus, int TotalMinus)`
- [ ] `HeadToHeadMatchDto(int MatchId, int SeasonId, string SeasonName, DateTime MatchDate, string HomeTeamName, string HomeTeamShortName, string AwayTeamName, string AwayTeamShortName, int HomeScore, int AwayScore, CompletionType CompletionType, IEnumerable<HeadToHeadUserResultDto> UserResults)`
- [ ] `UserMatchSummaryDto(int MatchId, DateTime MatchDate, string OpponentName, string OpponentShortName, int HomeScore, int AwayScore, bool IsHome, int TotalPlus, int TotalMinus, int GoalCount)`

---

## Phase 3 — Backend: User Point-Reason Breakdown Endpoint

### 3.1 Write Tests
- [ ] Add tests in `backend/tests/NHLStats.Api.Tests/Stats/StatsTests.cs`
- [ ] `PointReasonBreakdown_ReturnsGroupedByReason`: seed user with `UserMatchPoint` entries for Penalty (id 1), Secondary Penalty (id 2), Prediction (id 8), and positive Penalty (id 9). Assert response groups correctly by `PointReasonId` with correct `isPositive` and `totalCount`
- [ ] `PointReasonBreakdown_FiltersBySeason`: seed points across 2 seasons, request with `?seasonId=X`, assert only that season's points returned
- [ ] `PointReasonBreakdown_EmptyUser`: seed user with no points, assert returns valid DTO with empty items
- [ ] `PointReasonBreakdown_AllSeasons`: request without seasonId, assert points from all seasons are summed

### 3.2 Implement
- [ ] Add `Task<UserPointReasonBreakdownDto?> GetUserPointReasonBreakdownAsync(int userId, int? seasonId)` to `IStatsService`
- [ ] Implement in `StatsService`: query `UserMatchPoints` where `UserMatch.UserId == userId` (and optionally `UserMatch.SeasonId == seasonId`), group by `PointReasonId`, join `PointReason` for `Name`/`IsPositive`, sum `Count`
- [ ] Add `[HttpGet("users/{userId:int}/point-reasons")]` to `StatsController` with optional `[FromQuery] int? seasonId`
- [ ] Verify tests pass

---

## Phase 4 — Backend: Head-to-Head Endpoint

### 4.1 Write Tests
- [ ] `HeadToHead_ReturnsMatchesWhereTeamIsHomeOrAway`: seed 2 matches — one where opponent is home, one where opponent is away. Assert both returned
- [ ] `HeadToHead_OnlyMatchesFromSeasonsWithSameHostedTeam`: seed 3 seasons — 2 with `HostedTeamId = A`, 1 with `HostedTeamId = B`. Seed opponent matches in all 3. Request with `hostedTeamId=A`, assert only matches from the 2 matching seasons appear
- [ ] `HeadToHead_ExcludesUnplayedMatches`: seed a match with `MatchDate = null`, assert it is excluded
- [ ] `HeadToHead_IncludesUserResults`: seed matches with `UserMatch` entries, assert `userResults` array has correct per-user +/−
- [ ] `HeadToHead_OrderedByDateDescending`: seed matches on different dates, assert newest first

### 4.2 Implement
- [ ] Add `Task<IEnumerable<HeadToHeadMatchDto>> GetHeadToHeadAsync(int teamId, int hostedTeamId)` to `IStatsService`
- [ ] Implement in `StatsService`: query `Matches` where `(HomeTeamId == teamId || AwayTeamId == teamId) && MatchDate != null && Season.HostedTeamId == hostedTeamId`. Include `HomeTeam`, `AwayTeam`, `Season`, `UserMatches.User`. Project to `HeadToHeadMatchDto` ordered by `MatchDate` descending
- [ ] Add `[HttpGet("head-to-head/{teamId:int}")]` to `StatsController` with `[FromQuery] int hostedTeamId`
- [ ] Verify tests pass

---

## Phase 5 — Backend: User Match History Endpoint

### 5.1 Write Tests
- [ ] `MatchHistory_ReturnsPerMatchSummary`: seed user with 3 matches, each with different +/−/goals. Assert 3 `UserMatchSummaryDto` items with correct values
- [ ] `MatchHistory_ResolvesOpponentFromHostedTeam`: seed season with `HostedTeamId`, seed match where hosted team is home — assert `opponentName` is away team; seed match where hosted team is away — assert `opponentName` is home team
- [ ] `MatchHistory_FiltersBySeason`: seed matches across 2 seasons, request with `?seasonId=X`, assert only that season's matches
- [ ] `MatchHistory_GoalCountSumsCorrectly`: seed `UserMatchGoal` entries (multiple roster players), assert `goalCount` is their sum
- [ ] `MatchHistory_ExcludesUnplayedMatches`: seed match with `MatchDate = null`, assert excluded
- [ ] `MatchHistory_OrderedByDateAscending`: for chart display, assert matches ordered by `MatchDate` ascending

### 5.2 Implement
- [ ] Add `Task<IEnumerable<UserMatchSummaryDto>> GetUserMatchHistoryAsync(int userId, int? seasonId)` to `IStatsService`
- [ ] Implement in `StatsService`: query `UserMatches` where `UserId == userId && Match != null && Match.MatchDate != null` (optionally `SeasonId == seasonId`). Include `Match.HomeTeam`, `Match.AwayTeam`, `Match.Season`, `Goals`. Determine opponent from `Season.HostedTeamId`. Sum goals per match. Project to `UserMatchSummaryDto` ordered by `MatchDate` ascending
- [ ] Add `[HttpGet("users/{userId:int}/match-history")]` to `StatsController` with optional `[FromQuery] int? seasonId`
- [ ] Verify tests pass

---

## Phase 6 — Frontend: Types & API

### 6.1 Add TypeScript Types
- [ ] Add to `frontend/src/types/stats.ts`:
  - `PointReasonBreakdownItem { pointReasonId, pointReasonName, isPositive, totalCount }`
  - `UserPointReasonBreakdown { userId, userName, items: PointReasonBreakdownItem[] }`
  - `HeadToHeadUserResult { userId, userName, totalPlus, totalMinus }`
  - `HeadToHeadMatch { matchId, seasonId, seasonName, matchDate, homeTeamName, homeTeamShortName, awayTeamName, awayTeamShortName, homeScore, awayScore, completionType, userResults: HeadToHeadUserResult[] }`
  - `UserMatchSummary { matchId, matchDate, opponentName, opponentShortName, homeScore, awayScore, isHome, totalPlus, totalMinus, goalCount }`

---

## Phase 7 — Frontend: Chart Components

### 7.1 `PenaltyPointedChart`
- [ ] Create `frontend/src/components/charts/PenaltyPointedChart.tsx`
- [ ] Recharts `BarChart` with `ResponsiveContainer`
- [ ] Input: `PointReasonBreakdownItem[]`
- [ ] Group items by reason name (e.g. "Penalty", "Secondary Penalty") — for each name show two bars: negative count (red) and positive/pointed count (green)
- [ ] Render centered "No data yet" text when items array is empty

### 7.2 `MinusPointsPieChart`
- [ ] Create `frontend/src/components/charts/MinusPointsPieChart.tsx`
- [ ] Recharts `PieChart` with `ResponsiveContainer`
- [ ] Input: `PointReasonBreakdownItem[]` (pre-filtered to `isPositive === false`)
- [ ] Each slice = one negative `PointReason`, colour-coded with legend and labels showing count
- [ ] Render centered "No data yet" when empty

### 7.3 `UserWeekTrendChart`
- [ ] Create `frontend/src/components/charts/UserWeekTrendChart.tsx`
- [ ] Recharts `ComposedChart` with `ResponsiveContainer`
- [ ] Input: `UserMatchSummary[]`
- [ ] `Line` for `totalPlus` (green) and `totalMinus` (red), `Bar` for `goalCount` (blue)
- [ ] X-axis: match dates (formatted). Tooltip showing opponent, score, +/−, goals
- [ ] Render centered "No data yet" when empty

---

## Phase 8 — Frontend: User Stats Page

### 8.1 Create `UserStatsPage`
- [ ] Create `frontend/src/pages/UserStatsPage.tsx`
- [ ] **Selectors row**: reuse `SeasonSelector` (with "All seasons" option) + User dropdown
  - When season selected → fetch users from `GET /api/seasons/{id}/users`
  - When "All seasons" → fetch users from `GET /api/users`
  - Auto-select first user when user list changes
- [ ] **Data fetching**: when user + season selection changes:
  - Fetch `GET /api/stats/users/{userId}/point-reasons?seasonId={optional}`
  - Fetch `GET /api/stats/users/{userId}/match-history?seasonId={optional}`
- [ ] **Top row** (2-column grid): `PenaltyPointedChart` + `MinusPointsPieChart`
- [ ] **Middle row**: `UserWeekTrendChart` (full width)
- [ ] **Bottom row** (2-column grid): "Best Match" card (highest `totalPlus`) + "Worst Match" card (highest `totalMinus`)
  - Show opponent logo (via `teamLogoUrl`), opponent name, score, date, +/− values
  - Show "No data yet" if no matches

### 8.2 Register Route & Navigation
- [ ] Add `import UserStatsPage` and route `<Route path="/user-stats" element={<UserStatsPage />} />` in `App.tsx` inside `PublicLayout`
- [ ] Add `{ to: '/user-stats', label: '📈 Player Stats' }` to `publicNavItems` in `navConfig.ts`

---

## Phase 9 — Frontend: Season Page Head-to-Head Enhancement

### 9.1 Enhance "Up Next" Section in `SeasonPage.tsx`
- [ ] Add state: `h2hMatches: HeadToHeadMatch[]`, `loadingH2H: boolean`, `h2hExpanded: boolean`
- [ ] After identifying the "Up Next" match, if the current season has a `hostedTeamId`:
  - Determine opponent team ID (the team in the match that isn't `hostedTeamId`)
  - Fetch `GET /api/stats/head-to-head/{opponentTeamId}?hostedTeamId={season.hostedTeamId}`
  - Set `loadingH2H = true` while fetching, `false` when done
- [ ] If no `hostedTeamId` on the season → skip h2h section entirely
- [ ] Render below the "Up Next" card:
  - While loading: a small spinner inside a "Previous meetings" container
  - When loaded & empty: "No previous meetings" message
  - When loaded & has data: collapsible section (toggle via `h2hExpanded`) showing each past match:
    - Team logos via `teamLogoUrl`, score, `CompletionBadge`, date
    - Per-user +/− in a compact sub-table or inline badges

---

## Phase 10 — Backend: Integration Tests for Seasons/{id}/users

### 10.1 Write Tests
- [x] Add test file `backend/tests/NHLStats.Api.Tests/Seasons/SeasonUsersTests.cs`
- [x] `GetSeasonUsers_ReturnsAssignedUsers`: seed season with 2 users, assert returns 2 `UserDto`
- [x] `GetSeasonUsers_EmptySeason_ReturnsEmptyArray`: season with no users, assert `[]`
- [x] `GetSeasonUsers_NonExistentSeason_Returns404`: assert 404 for invalid season ID
- [x] Verify tests pass

---

## Definition of Done (per phase)

- All tests written before implementation (TDD)
- All tests green
- No regressions in existing test suite
- Code compiles with no warnings
