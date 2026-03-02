## Plan: Season Matches Admin Page (Final)

Build an admin matches page with CRUD, atomic bulk-create, explicit match numbering, `CompletionType` in DB, status badges, searchable dropdowns, and smart "Up Next" ordering on the season page.

### Steps

1. **Add `CompletionType` enum, `MatchNumber`, and update `Match` entity** — Create `CompletionType` enum (`None = 0`, `RegularTime = 1`, `Overtime = 2`, `Shootout = 3`) alongside Match.cs. Update the entity: change `MatchDate` to `DateTime?`, add `CompletionType CompletionType` (default `None`), add `int MatchNumber`. Configure a unique composite index on `(SeasonId, MatchNumber)` in NhlStatsDbContext.cs. Generate a new EF migration.

2. **Update Match DTOs and service** — Slim `CreateMatchDto` to `HomeTeamId` + `AwayTeamId` (no date, no scores — `MatchNumber` is auto-assigned). `UpdateMatchDto` gets `HomeTeamId`, `AwayTeamId`, `DateTime? MatchDate`, `HomeScore`, `AwayScore`, `CompletionType`. `MatchDto` includes all fields plus `MatchNumber`. In MatchService.cs: on create, query `MAX(MatchNumber)` for the season and assign `+1`; set `MatchDate = null`, scores `0`, `CompletionType = None`. Order matches by `MatchNumber` instead of `MatchDate` in all queries.

3. **Add atomic batch-create endpoint** — `POST /api/seasons/{seasonId}/matches/batch` in MatchesController.cs accepting `CreateMatchDto[]`. In `MatchService`: validate all team IDs upfront, compute starting `MatchNumber` from current max, assign sequential numbers, add all entities, single `SaveChangesAsync`. Return 400 on any validation error (nothing persisted) or the created `MatchDto[]` on success.

4. **Update backend tests** — In MatchesTests.cs: test create returns auto-assigned `MatchNumber` and null date, update sets `CompletionType` and date, batch create assigns sequential numbers, batch rolls back entirely on invalid team ID.

5. **Update weekly stats for null dates** — In StatsService.cs, filter out `MatchDate == null` matches from the weekly grouping so only played matches appear in week groups.

6. **Update frontend types** — In match.ts: add `CompletionType` enum (`None`, `RegularTime`, `Overtime`, `Shootout`). Add `matchNumber: number` and make `matchDate: string | null` on `Match`. Slim `CreateMatchDto` to `{ homeTeamId, awayTeamId }`. Define `UpdateMatchDto` with `homeTeamId`, `awayTeamId`, `matchDate`, `homeScore`, `awayScore`, `completionType`.

7. **Update `SeasonPage` with "Up Next" and "Upcoming"** — In SeasonPage.tsx, add a second fetch to `GET /api/seasons/{id}/matches` for the full match list. Split matches client-side: played (`matchDate != null`) stay in existing weekly grouping; unplayed (`matchDate == null`) are sorted by `matchNumber`. Render **"Up Next"** section between weekly matches and aggregated entries showing the first unplayed match prominently (highlighted card with match number, team names). Below it, an **"Upcoming"** section listing remaining unplayed matches. Each match row shows a `CompletionType` badge: grey "Not Played" / green "REG" / yellow "OT" / orange "SO".

8. **Add admin route, nav entry, and `AdminMatchesPage`** — Add `/admin/matches` protected route in App.tsx. Add "Matches" to admin nav items in PublicLayout.tsx. Create `frontend/src/pages/admin/AdminMatchesPage.tsx` with `SeasonSelector` at top. Table columns: `#` (match number), home vs away, score (or "—"), date (or "TBD"), status badge. Each row links to `/seasons/:seasonId/matches/:matchId`. Edit/Delete buttons per row. "New Match" + "Bulk Create" buttons. Pattern from AdminSeasonsPage.tsx.

9. **Create match form modals** — **Create modal**: home team + away team (both searchable dropdowns from `GET /api/teams`). No date, scores, or match number — all auto-handled. **Edit modal**: home team, away team, optional date picker, home score, away score, `CompletionType` dropdown. Follow modal pattern from AdminSeasonsPage.tsx.

10. **Build bulk-create sheet view** — `BulkMatchCreator` component with a grid: each row has home team (searchable) + away team (searchable). Add/remove rows. **Soft warning at 82 rows** ("This exceeds a full NHL regular season — continue?"), no hard cap. "Create All" posts to `POST .../matches/batch`. On error → message shown, nothing created. On success → reload. Pattern from AdminRosterPage.tsx.

11. **Create reusable `SearchableSelect` component** — New `frontend/src/components/SearchableSelect.tsx`. Text input filtering a dropdown, keyboard navigation (↑↓, Enter, Escape), clear button. Props: `options: {value, label}[]`, `value`, `onChange`, `placeholder`. Used in: team selectors (match forms + bulk sheet), point-reason picker, goal/penalty player picker.

12. **Enhance `MatchPage` with searchable dropdowns and badge** — In MatchPage.tsx, replace the three `<select>` elements (point reason, goal player, penalty player) with `SearchableSelect`. Add match number and `CompletionType` badge to the header. Show "Not played yet" when `matchDate` is null. No restriction on "Initialize Users" — purely informational badge.
