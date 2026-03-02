## Plan: Earnings Rework, Payouts, Per-User Goals/Penalties, Match UX & Admin Layout Wiring

Full-stack changes: fix earnings formula, add payouts, add per-user goal/penalty stats endpoint, refactor MatchPage into components, improve season pre-selection, and wire up `AdminLayout` for `/admin/*` routes.

### Steps

#### Backend — Earnings Formula & MoneyConfig Fix

1. **Fix `CalculateEarnings` in StatsService.cs** — Change to `Math.Max(0m, totalMinus * config.NegativePointValue - totalPlus * config.PositivePointValue)`. `NegativePointValue` will be stored as positive (e.g. `0.50`). Earnings = how much user owes, floored at 0. Apply in both `GetSeasonStatsAsync` and `GetAllTimeEarningsAsync`.

2. **Update MoneyConfig seed & add data migration** — In NhlStatsDbContext.cs change seed from `-0.50m` to `0.50m`. Add a new EF migration with SQL: `UPDATE MoneyConfigs SET NegativePointValue = ABS(NegativePointValue)`.

#### Backend — UserPayout Entity & CRUD

3. **Create `UserPayout` entity** — New Entities/UserPayout.cs: `Id`, `UserId` (FK→User), `SeasonId` (FK→Season), `Amount` (decimal), `PaidOn` (DateTime). Register `DbSet<UserPayout>` in NhlStatsDbContext.cs, configure cascade deletes, add migration.

4. **Add `IUserPayoutService` + `UserPayoutService`** — CRUD: `GetBySeasonAsync`, `CreateAsync`, `UpdateAsync`, `DeleteAsync`. DTOs: `UserPayoutDto`, `CreateUserPayoutDto(UserId, Amount, PaidOn)`, `UpdateUserPayoutDto(Amount, PaidOn)`. Register as scoped in Program.cs.

5. **Add `UserPayoutsController`** — Route `api/seasons/{seasonId}/payouts`. `[Authorize]` on write operations.

#### Backend — Per-User Goals & Penalties Endpoint

6. **Add `GetUserSeasonTotalsAsync` to StatsService.cs** — Query `UserMatchGoals` and `UserMatchPenalties` for the season, group by `UserMatch.UserId`, sum `Count`. New DTO `UserSeasonTotalsDto(UserId, UserName, TotalGoals, TotalPenalties)` in StatsDto.cs. Add to IStatsService. Expose as `GET /api/seasons/{seasonId}/stats/user-totals` in StatsController.cs.

#### Frontend — Wire Up AdminLayout for `/admin/*` Routes

7. **Restructure routes in App.tsx** — Split routing into two layout groups:
   - Public routes under `<Route element={<PublicLayout />}>`: `/login`, `/dashboard`, `/earnings`, `/seasons`, `/seasons/:seasonId`, `/seasons/:seasonId/matches/:matchId`.
   - Admin routes under `<Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>`: nested child routes for `users`, `seasons`, `roster`, `point-reasons`, `money-config`, `expenses`, `matches`, and the new `payouts`. This uses `AdminLayout`'s `<Outlet />` for page content with the sidebar.
   - Remove individual `<ProtectedRoute>` wrappers from each admin route since the parent handles auth.

8. **Update AdminLayout.tsx** — Add `{ to: '/admin/matches', label: 'Matches' }` and `{ to: '/admin/payouts', label: 'Payouts' }` to the `navItems` array (currently missing both).

#### Frontend — Component Extraction & Match UX

9. **Extract `MatchHeaderEditor`** — New components/MatchHeaderEditor.tsx. Authenticated view: `homeScore`/`awayScore` as number inputs, `completionType` as `<select>` (Reg=1, OT=2, SO=3), `matchDate` as `<input type="date">`. "Save" calls PUT. Read-only for visitors.

10. **Extract `UserMatchCard`** — New components/UserMatchCard.tsx. Tabbed layout (Goals | Penalties | Points), compact chips with ✕ delete, collapsible "+" forms. Points tab: green **"+ Point"** (positive reasons) / red **"− Point"** (negative reasons), count defaults to 1.

11. **Slim down MatchPage.tsx** — Compose `MatchHeaderEditor` + `UserMatchCard`. On "Initialize Users" success, auto-set `matchDate` to today if currently `null`.

#### Frontend — Season Pre-selection & Stats

12. **Pre-select latest season** — In DashboardPage.tsx, SeasonPage.tsx, and EarningsExpensesPage.tsx, after fetching seasons sort by `startedOn` descending and default to `seasons[0].id`. "All seasons" stays available.

13. **Add goals & penalties to season stats table** — In SeasonPage.tsx, fetch `GET /api/seasons/{id}/stats/user-totals`, merge by `userId`, add Goals/Penalties columns. New type `UserSeasonTotals` in stats.ts.

#### Frontend — Admin Payouts Page

14. **Create PayoutsPage.tsx** — Season selector + table (User, Amount, Paid On) with add/edit/delete. Add payout types to types/. Route already handled via step 7.

### Further Considerations

1. **PublicLayout admin links** — PublicLayout.tsx currently shows admin nav links in the top bar when authenticated. After wiring `AdminLayout`, these links should stay so authenticated users can navigate to admin from public pages, but consider whether the styling/grouping needs adjustment since admin pages will now render inside a different layout.
