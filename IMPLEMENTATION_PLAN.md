# NHL Stats 2.0 — Implementation Plan

A full-stack web application for tracking NHL (PS5/Xbox) human players' plus/minus points, goals, penalties, and monetary earnings.

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Backend** | .NET 10, ASP.NET Core Web API, Entity Framework Core |
| **Backend Testing** | xUnit, FluentAssertions, Moq, Testcontainers, Bogus (fake data) |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS |
| **Frontend Testing** | Vitest, React Testing Library, MSW (Mock Service Worker) |
| **Database** | SQLite |
| **Auth** | ASP.NET Identity + JWT |
| **Deployment** | Azure App Service (API), Azure Static Web Apps (SPA) |
| **CI/CD** | GitHub Actions |

---

## Development Methodology: TDD (Test-Driven Development)

### Red-Green-Refactor Cycle

1. **Red** — Write a failing test that defines expected behavior
2. **Green** — Write the minimum code to make the test pass
3. **Refactor** — Clean up the code while keeping tests green

### Testing Strategy

| Layer | Test Type | Tools | Focus |
|-------|-----------|-------|-------|
| **Domain** | Unit tests | xUnit, FluentAssertions | Entity logic, validations, calculations |
| **Application** | Unit tests | xUnit, Moq | Service logic, business rules |
| **API** | Integration tests | xUnit, Testcontainers, WebApplicationFactory | Full request/response cycle, auth |
| **Frontend** | Unit tests | Vitest, React Testing Library | Component behavior, hooks |
| **Frontend** | Integration tests | Vitest, MSW | API integration, user flows |

### TDD Workflow for Each Feature

```
1. Write API integration test (expected endpoint behavior) → RED
2. Write service unit test (business logic) → RED
3. Implement domain entity if needed
4. Implement service → GREEN (service test)
5. Implement controller → GREEN (integration test)
6. Refactor
7. Write frontend component test → RED
8. Implement component → GREEN
9. Refactor
```

---

## Database Schema

### Entities

| Entity | Purpose |
|--------|---------|
| `User` | Human players (Id, Name, IsActive) |
| `Team` | 32 NHL teams (Id, Name, ShortName) |
| `Season` | Seasons/tournaments (Id, Name, HostedTeamId, StartedOn, Status, ParentSeasonId for playoffs) |
| `SeasonUser` | Join table — which human players participate in which season (Id, SeasonId, UserId) |
| `Match` | Games within a season (Id, SeasonId, HomeTeamId, AwayTeamId, HomeScore, AwayScore, MatchDate) |
| `RosterPlayer` | In-game player per season (Id, FirstName, Surname, Position, TeamId, SeasonId, IsActive) |
| `PointReason` | Editable reasons table (Id, Name, IsPositive, IsActive) |
| `UserMatch` | User participation (Id, UserId, MatchId nullable, SeasonId, TotalPlus, TotalMinus) |
| `UserMatchPoint` | Point entries (Id, UserMatchId, PointReasonId, Count) |
| `UserMatchGoal` | Goals (Id, UserMatchId, RosterPlayerId, Count) |
| `UserMatchPenalty` | Penalties (Id, UserMatchId, RosterPlayerId, Count) |
| `MoneyConfig` | Rate history (Id, NegativePointValue, PositivePointValue, EffectiveFrom) |
| `Expense` | Group expenses (Id, Description, Amount, Date) |

### Key Design Decisions

- **UserMatch.MatchId nullable** — When null, represents aggregated historical data for that season (no specific match info)
- **RosterPlayer versioned per season** — Each season has its own roster; copy from previous season supported
- **MoneyConfig with EffectiveFrom** — Calculations use the rate active at match date
- **PointReason as database table** — Admin can add/edit reasons dynamically

### Default Seed Data

**8 Point Reasons:**
1. Penalty (negative)
2. Secondary Penalty (negative)
3. Not Scoring A Goal (negative)
4. Scoring 10 Goals (context-dependent)
5. Last Minute Action (negative)
6. Own Goal (negative)
7. Error In Defense (negative)
8. Prediction (negative)

**Money Config:** 50¢ per negative point, 25¢ per positive point

**32 NHL Teams:** All current NHL franchises

---

## Implementation Phases

### Phase 1: Project Scaffolding & Infrastructure (Completed)
**Status:** Completed — scaffold, tests, frontend setup, and smoke health test are present.
**Goal:** Set up the monorepo structure, development environment, and test infrastructure

- [x] Create folder structure: `backend/`, `frontend/`
- [x] Initialize .NET 10 Web API solution with layered architecture (Api, Application, Domain)
- [x] **Add test projects**: `NHLStats.Domain.Tests`, `NHLStats.Application.Tests`, `NHLStats.Api.Tests`
- [x] **Configure xUnit, FluentAssertions, Moq, Testcontainers, Bogus**
- [x] Initialize React + Vite + TypeScript project
- [x] **Configure Vitest and React Testing Library**
- [x] Configure Tailwind CSS
- [x] Add root development infrastructure for local backend/frontend workflows
- [x] Add root `.gitignore`, `README.md`
- [x] Configure EF Core with SQLite for development
- [x] **Write first smoke test** (API health check endpoint)

---

### Phase 2: Backend — Domain & Database (Completed)
**Status:** Completed — domain entities, EF Core configuration, migrations, and seed data are implemented.
**Goal:** Implement all entities, migrations, and seed data (TDD)

- [ ] **Write entity validation tests first** (e.g., User.Name required, Season dates valid)
- [x] Create all entity classes in Domain layer → make tests pass
- [ ] **Write relationship tests** (e.g., SeasonUser links Season and User correctly)
- [x] Configure entity relationships and constraints (EF Core Fluent API) → make tests pass
- [x] Create initial migration
- [ ] **Write seed data verification tests**
- [x] Implement seed data (32 NHL teams, 8 point reasons, default money config) → make tests pass

---

### Phase 3: Backend — Authentication (Completed)
**Status:** Completed — ASP.NET Identity + JWT fully implemented; 6 integration tests passing (10/10 total).
**Goal:** Implement ASP.NET Identity with JWT (TDD)

- [x] **Write auth integration tests first:**
  - [x] Test: Register returns 201 and creates user
  - [x] Test: Register with duplicate email returns 409
  - [x] Test: Login with valid credentials returns JWT
  - [x] Test: Login with invalid credentials returns 401
  - [x] Test: Protected endpoint without token returns 401
  - [x] Test: Protected endpoint with valid token returns 200
- [x] Add ASP.NET Identity entities (`ApplicationUser : IdentityUser`) → make tests pass
- [x] Configure JWT authentication (HmacSha256, issuer/audience/lifetime) → make tests pass
- [x] Create Auth controller (Register, Login, Me) → make tests pass
- [x] Add `[Authorize]` to protected endpoints (`/api/auth/me`) → make tests pass
- [x] EF migration regenerated clean (single `InitialCreate` with all domain + Identity tables)
- [x] Admin user seeded at startup from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars
- [x] `CustomWebApplicationFactory` with isolated temp-file SQLite for integration tests
- [x] Upgraded `Microsoft.AspNetCore.Mvc.Testing` to `10.0.0` (required for .NET 10 compatibility)

---

### Phase 4: Backend — Core CRUD APIs
**Status:** Completed — all 7 resource APIs implemented with 43 new integration tests (53 total passing).
**Goal:** Implement all admin management endpoints (TDD)

For each resource, follow this TDD cycle:
1. Write integration tests for all CRUD operations
2. Write service unit tests for business logic
3. Implement service → make unit tests pass
4. Implement controller → make integration tests pass

- [x] **Users**: 
  - [x] Tests: GET all, GET by id, POST create, PUT update, DELETE/deactivate
  - [x] Implement UserService and UsersController
- [x] **Teams**: 
  - [x] Tests: GET all, GET by id (read-only)
  - [x] Implement TeamsController
- [x] **Seasons**: 
  - [x] Tests: CRUD + assign users, get users for season
  - [x] Implement SeasonService and SeasonsController
- [x] **Matches**: 
  - [x] Tests: CRUD within a season, filter by season
  - [x] Implement MatchService and MatchesController
- [x] **PointReasons**: 
  - [x] Tests: CRUD, cannot delete if in use (deactivate only)
  - [x] Implement PointReasonService and PointReasonsController
- [x] **MoneyConfig**: 
  - [x] Tests: GET current, GET history, POST new (validates EffectiveFrom > previous)
  - [x] Implement MoneyConfigService and MoneyConfigController
- [x] **Expenses**: 
  - [x] Tests: CRUD for group expenses
  - [x] Implement ExpenseService and ExpensesController

---

### Phase 5: Backend — Roster Management
**Status:** Completed — RosterPlayerService, RosterController, and 16 integration tests all passing (69 total).
**Goal:** Implement per-season roster with CSV import and copy functionality (TDD)

- [x] **Write RosterPlayer tests first:**
  - [x] Test: GET roster for season returns only that season's players
  - [x] Test: POST creates player linked to season
  - [x] Test: CSV import creates multiple players
  - [x] Test: CSV import with invalid TeamShortName returns validation error
  - [x] Test: Copy from previous season duplicates all players to new season
  - [x] Test: Copy when no previous season returns error
- [x] Implement RosterPlayerService → make unit tests pass
- [x] Implement RosterController → make integration tests pass
- [x] **CSV Import**: `POST /api/seasons/{seasonId}/roster/import`
  - Format: `FirstName,Surname,Position,TeamShortName`
- [x] **Copy from previous season**: `POST /api/seasons/{seasonId}/roster/copy/{sourceSeasonId}`

---

### Phase 6: Backend — Match Scoring APIs
**Status:** Completed — UserMatchService, 4 controllers (UserMatches, Points, Goals, Penalties), and 17 integration tests all passing (86 total).
**Goal:** Implement point/goal/penalty tracking per user per match (TDD)

- [x] **Write UserMatch tests first:**
  - [x] Test: Create UserMatch with MatchId links to match
  - [x] Test: Create UserMatch with MatchId = null (aggregated) requires SeasonId
  - [x] Test: User must be in SeasonUser to create UserMatch
- [x] **Write UserMatchPoint tests:**
  - [x] Test: Add point entry increments TotalPlus or TotalMinus based on PointReason.IsPositive
  - [x] Test: Edit point entry recalculates totals
  - [x] Test: Delete point entry recalculates totals
- [x] **Write UserMatchGoal tests:**
  - [x] Test: Add goal with RosterPlayerId from correct season
  - [x] Test: Add goal with RosterPlayerId from wrong season returns error
- [x] **Write UserMatchPenalty tests:**
  - [x] Test: Add penalty with RosterPlayerId from correct season
- [x] **Write initialize-users tests:**
  - [x] Test: Initialize creates UserMatch for all SeasonUsers not already in match
- [x] Implement services → make unit tests pass
- [x] Implement controllers → make integration tests pass

---

### Phase 7: Backend — Stats & Calculations
**Status:** Completed — StatsService, SeasonStatsController, StatsController, and 17 integration tests all passing (103 total).
**Goal:** Implement aggregation and monetary calculation endpoints (TDD)

- [x] **Write money calculation tests first:**
  - [x] Test: Earnings uses rate active at match date, not current rate
  - [x] Test: Match before any MoneyConfig uses first config
  - [x] Test: Match after rate change uses new rate
  - [x] Test: Aggregated UserMatch (no MatchId) uses season start date for rate
- [x] **Write stats aggregation tests:**
  - [x] Test: Season stats sums all UserMatch totals for user in season
  - [x] Test: Top roster player for goals returns player with most goals
  - [x] Test: Top roster player for penalties returns player with most penalties
  - [x] Test: All-time earnings aggregates across all seasons
  - [x] Test: Balance = Total earnings − Total expenses
- [x] **Write weekly grouping tests:**
  - [x] Test: Matches on same date get same week number
  - [x] Test: Week numbers are sequential by date
- [x] Implement StatsService with calculation logic → make tests pass
- [x] Implement StatsController (SeasonStatsController + StatsController) → make integration tests pass

---

### Phase 8: Frontend — Project Setup & Auth
**Status:** Completed — React Router, AuthContext, LoginPage, ProtectedRoute, and 23 frontend tests all passing.
**Goal:** Set up React app with routing and authentication (TDD)

- [x] **Write auth tests first:**
  - [x] Test: AuthContext provides user state and login/logout functions
  - [x] Test: Login form submits credentials and stores JWT
  - [x] Test: Login form shows error on invalid credentials
  - [x] Test: Protected route redirects to login when not authenticated
  - [x] Test: Protected route renders content when authenticated
  - [x] Test: API client includes auth header when token exists
- [x] Configure React Router
- [x] Create auth context and JWT token management → make tests pass
- [x] Build Login page → make tests pass
- [x] Implement protected routes → make tests pass
- [x] Set up API client (fetch with auth headers) → make tests pass
- [x] Configure Tailwind with dark theme, cyan/orange accents

---

### Phase 9: Frontend — Admin Panel
**Status:** Completed — all 6 admin pages implemented with 51 new tests (74 total frontend tests passing).
**Goal:** Build admin management pages (auth-gated) (TDD)

For each admin page, follow this TDD cycle:
1. Write component render tests (displays data correctly)
2. Write interaction tests (form submit, button clicks)
3. Write API integration tests with MSW
4. Implement component → make tests pass

- [x] **Shared infrastructure**:
  - [x] TypeScript types for all resources (User, Season, Team, RosterPlayer, PointReason, MoneyConfig, Expense)
  - [x] Expanded MSW handlers for all admin API endpoints
  - [x] `renderWithProviders` test utility (AuthProvider + MemoryRouter)
  - [x] `AdminLayout` component (dark sidebar with NavLinks + logout)
  - [x] `Modal` component (reusable accessible dialog)
  - [x] Nested `/admin/*` routes in `App.tsx` using `<Outlet>`
- [x] **Users management**:
  - [x] Tests: Renders user list, add form submits, edit form populates, deactivate calls API
  - [x] Implement UsersPage
- [x] **Seasons management**:
  - [x] Tests: Renders season list, assign users dropdown, create/edit forms
  - [x] Implement SeasonsPage
- [x] **Roster management**:
  - [x] Tests: Renders roster table, CSV upload triggers import, copy button calls API
  - [x] Implement RosterPage
- [x] **Point Reasons management**:
  - [x] Tests: Renders reasons list, add/edit forms, deactivate toggle
  - [x] Implement PointReasonsPage
- [x] **Money Config management**:
  - [x] Tests: Renders current config card, history table, add form with date picker
  - [x] Implement MoneyConfigPage
- [x] **Expenses management**:
  - [x] Tests: Renders expenses list, total row, CRUD operations
  - [x] Implement ExpensesPage

---

### Phase 10: Frontend — Season & Match Pages
**Status:** Completed — SeasonSelector, SeasonPage, MatchPage implemented with 24 new tests (98 total frontend tests passing).
**Goal:** Build the core match tracking UI (TDD)

- [x] **Write Season selector tests:**
  - [x] Test: Dropdown renders all seasons
  - [x] Test: Selecting season updates URL/state
- [x] Implement SeasonSelector → make tests pass

- [x] **Write Season overview page tests:**
  - [x] Test: Groups matches by week with visual separation
  - [x] Test: Shows aggregated entries section when data exists
  - [x] Test: User stats table shows correct totals
  - [x] Test: Top roster player columns show correct players
- [x] Implement SeasonPage → make tests pass

- [x] **Write Match detail page tests:**
  - [x] Test: Renders all user entries for match
  - [x] Test: Point entry form submits with PointReason and count
  - [x] Test: Goal form shows season roster in dropdown
  - [x] Test: Penalty form shows season roster in dropdown
  - [x] Test: Edit controls hidden when not authenticated
  - [x] Test: Edit controls visible when authenticated
- [x] Implement MatchPage → make tests pass 

---

### Phase 11: Frontend — Charts Dashboard
**Status:** Completed — recharts installed; PlusMinusChart, TopScorersChart, PenaltyLeadersChart, EarningsChart, and DashboardPage implemented with 15 new tests (113 total frontend tests passing).
**Goal:** Build cross-season visualizations (TDD)

- [x] Install Recharts
- [x] **Write chart component tests:**
  - [x] Test: PlusMinusChart renders with correct data points
  - [x] Test: TopScorersChart renders bars for each user
  - [x] Test: PenaltyLeadersChart renders bars for each user
  - [x] Test: EarningsChart renders cumulative line
  - [x] Test: Season filter updates chart data
  - [x] Test: Charts handle empty data gracefully
- [x] Implement chart components → make tests pass
- [x] Implement DashboardPage composing all charts

---

### Phase 12: Frontend — Earnings & Expenses Page
**Status:** Completed — EarningsExpensesPage implemented with 7 tests all passing (120 total frontend tests passing).
**Goal:** Build the financial summary page (TDD)

- [x] **Write earnings table tests:**
  - [x] Test: Renders row for each user with Plus, Minus, Earnings, Payouts, Net
  - [x] Test: Totals row sums all users
  - [x] Test: Handles users with no data
- [x] **Write expenses table tests:**
  - [x] Test: Renders all expenses with description, amount, date
  - [x] Test: Total expenses row shows sum
- [x] **Write balance summary tests:**
  - [x] Test: Shows Total collected, Total expenses, Remaining
  - [x] Test: Remaining = Total collected − Total expenses
- [x] Implement EarningsExpensesPage → make tests pass

---

### Phase 13: Azure Deployment Setup
**Status:** Completed — SQLite on App Service; GitHub Actions CI/CD; Static Web Apps SPA config; resource provisioning script.
**Goal:** Configure Azure resources and CI/CD (SQLite-only)

- [x] Create Azure App Service (Linux, .NET 10) for backend API
  - Free tier (F1) — run `backend/scripts/create_azure_resources.sh`
  - `WEBSITE_RUN_FROM_PACKAGE=0` ensures writable filesystem
  - SQLite DB lives at `/home/data/nhlstats.db` (Azure Files persistent volume)
  - **DB is never in the deploy package → data survives every deployment**
- [x] Create Azure Static Web Apps for frontend
  - `frontend/public/staticwebapp.config.json` — SPA routing fallback to `index.html`
- [x] Configure environment variables via App Service application settings
  - `Jwt__Secret`, `Jwt__Issuer`, `Jwt__Audience`, `Jwt__ExpiryMinutes`
  - `ADMIN_EMAIL`, `ADMIN_PASSWORD` (seeds admin on first startup)
  - `AllowedOrigins` (set to Static Web Apps hostname for CORS)
- [x] Set up GitHub Actions workflows:
  - `.github/workflows/backend.yml` — restore → build → test → publish → deploy to App Service
  - `.github/workflows/frontend.yml` — install → test → build → deploy to Static Web Apps (PR preview environments included)
- [x] Configure CORS on backend for frontend domain (set via `AllowedOrigins` app setting)

**Required GitHub Secrets:**
| Secret | Description |
|--------|-------------|
| `AZURE_WEBAPP_NAME` | App Service name (e.g. `nhlstats-api`) |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | Publishing profile XML from portal or CLI |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Deployment token from Static Web Apps |
| `VITE_API_BASE_URL` | Backend URL (e.g. `https://nhlstats-api.azurewebsites.net`) |

---

### Phase 14: Custom Domain & SSL
**Goal:** Set up public domain access

- [ ] Register/configure custom domain in Azure
- [ ] Bind custom domain to App Service (API subdomain, e.g., `api.nhlstats.example.com`)
- [ ] Bind custom domain to Static Web Apps (main domain, e.g., `nhlstats.example.com`)
- [ ] Enable managed SSL certificates
- [ ] Test end-to-end in production

---

### Phase 15: Polish & Future Enhancements ✅
**Goal:** Refinements and additional features

- [x] Add loading states and error handling throughout frontend
- [x] Add pagination for large lists
- [x] Add search/filter on admin tables
- [x] Mobile-responsive design improvements

---

### Phase 16: Betting System Rewrite, Season Page Enhancement & Points Management
**Status:** Not started
**Goal:** Complete rewrite of the betting system with real odds calculation, cash-backed bets, and proper win/loss tracking. Extend `UserMatchPoint` with stored cash amounts. Rework the Season Page to show inline match details for non-admins with hover tooltips. Add a new admin Points Management page for bulk point review/editing.

#### Sub-phase 16.1: Database & Entity Changes

##### Step 16.1.1 — Add `InProgress` CompletionType
- [ ] Add `InProgress = 4` to `CompletionType` enum in `backend/src/NHLStats.Domain/Entities/CompletionType.cs`
- [ ] Update `MatchService.NormalizeMatchDate()` to treat `InProgress` like other non-None types (keeps the date)
- [ ] Update frontend `CompletionType` enum in `frontend/src/types/match.ts`
- [ ] Update `normalizeCompletionType()` in `SeasonPage.tsx` to handle the new value
- [ ] Update `CompletionBadge` component with InProgress variant (pulsing dot or "LIVE" indicator)

##### Step 16.1.2 — Extend `UserMatchPoint` with `Amount` and `CreatedOn`
- [ ] Add `decimal? Amount` (nullable) and `DateTime? CreatedOn` (nullable) to `UserMatchPoint`
- [ ] EF migration adds the two columns as nullable (no default needed — backfill handles existing rows)

##### Step 16.1.2b — Backfill existing `UserMatchPoint.Amount` via SQL data migration
- [ ] In the **same EF migration** (after `AddColumn`), execute raw SQL to backfill using SQLite-compatible correlated UPDATE:
  ```sql
  UPDATE UserMatchPoints
  SET Amount = (
      SELECT CASE
          WHEN pr.PointType = 0 THEN UserMatchPoints."Count" * mc.NegativePointValue
          WHEN pr.PointType = 1 THEN UserMatchPoints."Count" * mc.PositivePointValue
          ELSE 0
      END
      FROM PointReasons pr,
           UserMatches um,
           Matches m,
           MoneyConfigs mc
      WHERE pr.Id = UserMatchPoints.PointReasonId
        AND um.Id = UserMatchPoints.UserMatchId
        AND m.Id = um.MatchId
        AND mc.Id = (
            SELECT mc2.Id FROM MoneyConfigs mc2
            WHERE mc2.EffectiveFrom <= COALESCE(m.MatchDate, datetime('now'))
            ORDER BY mc2.EffectiveFrom DESC
            LIMIT 1
        )
  ),
  CreatedOn = (
      SELECT m.MatchDate
      FROM UserMatches um
      INNER JOIN Matches m ON m.Id = um.MatchId
      WHERE um.Id = UserMatchPoints.UserMatchId
  )
  WHERE EXISTS (SELECT 1 FROM UserMatches um WHERE um.Id = UserMatchPoints.UserMatchId);
  ```
- [ ] For rows where match has no date (`MatchDate IS NULL`), use the latest `MoneyConfig` (fallback)
- [ ] For matches with no `MoneyConfig` at all, default: negative = `Count * 0.50`, positive = `Count * 1.00`
- [ ] After backfill, a second `AlterColumn` makes `Amount` non-nullable with default `0`
- [ ] `CreatedOn` remains nullable (old points without match dates stay null; new points always set it)

##### Step 16.1.3 — Rewrite `Bet` entity
- [ ] Modify `Bet` entity to add: `decimal Amount` (stake), `decimal Odds`
- [ ] Add `BetStatus` enum: `Pending = 0, Won = 1, Lost = 2, Cancelled = 3` — replaces `IsWon` bool
- [ ] Create `backend/src/NHLStats.Domain/Entities/BetStatus.cs`
- [ ] Keep `EvaluatedOn` (timestamp of evaluation)
- [ ] Keep unique index on `(MatchId, CreatedBy)` — one bet per user per match
- [ ] EF migration

##### Step 16.1.4 — Betting balance (computed, not stored)
- [ ] Betting balance = `Σ(positive point cash) + Σ(won bet profits: Amount × Odds) - Σ(lost bet amounts) - Σ(pending bet amounts)` — cancelled bets don't affect balance
- [ ] Max bet cap: `odds × betAmount ≤ (Σ(negative point cash) - Σ(user payouts))`
- [ ] Create `BettingBalanceService` method to calculate from data

---

#### Sub-phase 16.2: Backend — Point Cash Management

##### Step 16.2.1 — Auto-calculate cash on point creation
- [ ] Modify `UserMatchService.AddPointAsync()`: lookup effective `MoneyConfig` for the match date
- [ ] Compute `Amount = Count × config.NegativePointValue` or `config.PositivePointValue` depending on `PointReason.PointType`
- [ ] Neutral points get `Amount = 0`. Default negative = -0.5 if no config
- [ ] Update DTOs: `UserMatchPointDto` gets `Amount` and `CreatedOn` fields
- [ ] `CreateUserMatchPointDto` gets optional `Amount?` override
- [ ] `UpdateUserMatchPointDto` gets optional `Amount?` override

##### Step 16.2.2 — Bulk point update endpoint (admin)
- [ ] `GET /api/admin/points?seasonId=X&pointType=Positive|Negative&page=1&size=50` — paginated list of all points with filters
- [ ] `PUT /api/admin/points/bulk` — accept array of `{ id, amount }` to update multiple point amounts at once
- [ ] Returns updated point records
- [ ] New `PointManagementService` or extend `UserMatchService`

##### Step 16.2.3 — Points Management DTOs
- [ ] `PointListItemDto`: Id, UserMatchId, UserName, MatchNumber, SeasonName, PointReasonName, PointType, Count, Amount, CreatedOn
- [ ] `BulkUpdatePointDto`: array of `{ Id, Amount }`

---

#### Sub-phase 16.3: Backend — Odds Calculation Engine

##### Step 16.3.1 — SQL views for probability factors
- [ ] Create migration with raw SQL views:
  - **`vw_team_win_factors`**: For each unplayed match, computes per-team: streak win rate (last 10), season win rate, home/away win rate, H2H win rate, all-time win rate. Joins `Matches`, `Seasons`, `Teams`.
  - **`vw_user_goal_factors`**: For each active user × unplayed match, computes: streak scoring rate (last 10), season scoring rate, home/away scoring rate, H2H scoring rate, all-time scoring rate. Joins `UserMatchGoals`, `UserMatches`, `Matches`.
  - **`vw_user_penalty_factors`**: Same structure as goal view but using `UserMatchPenalties`.
- [ ] Views handle NULL/zero-data fallback (use 0.5 when no history for a factor)
- [ ] Weight formula applied in the view: `P = 0.30*streak + 0.30*season + 0.15*homeAway + 0.15*h2h + 0.10*allTime`

**Team Win probability formula:**
```
P = 0.30 × streakRate + 0.30 × seasonRate + 0.15 × homeAwayRate + 0.15 × h2hRate + 0.10 × allTimeRate
```
- **streakRate**: wins in team's last 10 completed matches / 10
- **seasonRate**: wins in current season / total season matches
- **homeAwayRate**: home win rate (if team is home) or away win rate (if away)
- **h2hRate**: win rate against this specific opponent across all history
- **allTimeRate**: total wins / total matches all time
- Fallback: 0.5 when no data exists for a factor

**User Goal/Penalty probability formula (same structure):**
- **streakRate**: matches where user had ≥1 goal/penalty in last 10 matches / 10
- **seasonRate**: matches with goals/penalties this season / total matches this season
- **homeAwayRate**: scoring/penalty rate at home vs away
- **h2hRate**: scoring/penalty rate against upcoming opponent
- **allTimeRate**: all-time matches with goals/penalties / total matches

**Odds formula:** `Odds = (0.85 / P) - 1` (15% house margin, net profit multiplier)

##### Step 16.3.2 — `MatchOdds` table (pre-computed storage)
- [ ] New entity `MatchOdds`:
  - `Id` (int PK), `MatchId` (FK), `BetType` (TeamWin/UserGoal/UserPenalty), `TargetId` (int? — TeamId or UserId depending on type), `Probability` (decimal), `Odds` (decimal), `ComputedOn` (DateTime)
  - Unique index on `(MatchId, BetType, TargetId)`
- [ ] Create `backend/src/NHLStats.Domain/Entities/MatchOdds.cs`
- [ ] EF Core maps this to table (writable storage, NOT a view)

##### Step 16.3.3 — `BettingOddsService` (compute + store)
- [ ] New service: `IBettingOddsService` / `BettingOddsService`
- [ ] **`RecalculateForMatchAsync(int matchId)`**: Reads from the three SQL views for that match, applies odds formula `Odds = (0.85 / P) - 1`, upserts rows into `MatchOdds` table
- [ ] **`RecalculateAllUpcomingAsync()`**: Recalculates odds for all unplayed/non-InProgress matches
- [ ] **`GetMatchOddsAsync(int matchId)`**: Simple read from `MatchOdds` table → returns DTOs
- [ ] Odds floor: minimum odds of 0.05 (avoid division by zero when P ≈ 0.85+)

##### Step 16.3.4 — Recalculation triggers
- [ ] Call `RecalculateAllUpcomingAsync()` when:
  - A match is completed (in `MatchService.UpdateAsync` hook, after bet evaluation)
  - A new match is created (in `MatchService.CreateAsync` / `BatchCreateAsync`)
  - On application startup (ensure odds exist for all upcoming matches)
- [ ] Call `RecalculateForMatchAsync(matchId)` when individual match data changes

##### Step 16.3.5 — Odds endpoint
- [ ] `GET /api/betting/matches/{matchId}/odds` reads from `MatchOdds` table, returns:
  ```json
  {
    "teamWin": { "homeTeamId": 1, "homeOdds": 0.85, "awayTeamId": 2, "awayOdds": 1.20 },
    "userGoal": [{ "userId": 1, "userName": "Player1", "odds": 0.70 }],
    "userPenalty": [{ "userId": 1, "userName": "Player1", "odds": 0.55 }],
    "computedOn": "2026-04-12T10:30:00Z"
  }
  ```

---

#### Sub-phase 16.4: Backend — Betting Service Rewrite

##### Step 16.4.1 — Rewrite `BetService`
- [ ] `PlaceBetAsync(matchId, loginId, dto)`: validates balance, max cap, match is not InProgress/completed, reads odds from `MatchOdds` table at placement time, stores bet with locked-in odds
- [ ] `UpdateBetAsync(matchId, loginId, dto)`: recalculate odds if target changed, validate new amount, adjust balance
- [ ] `CancelBetAsync(matchId, loginId)`: only if match not InProgress/completed, sets status to Cancelled (refund to balance)
- [ ] `GetUserBetsForSeasonAsync(loginId, seasonId)`: betting history with outcomes
- [ ] `GetBettingBalanceAsync(loginId)`: compute available balance

##### Step 16.4.2 — Auto-evaluate bets on match completion
- [ ] Hook into `MatchService.UpdateAsync()`: when `CompletionType` changes from `None`/`InProgress` to `RegularTime`/`Overtime`/`Shootout`, call `BetService.EvaluateMatchBetsAsync(matchId)`
- [ ] Evaluation logic:
  - **TeamWin**: compare `Bet.TeamId` with winning team (higher score)
  - **UserGoal**: check if `Bet.UserId` has ≥1 goal in `UserMatchGoal` for that match
  - **UserPenalty**: check if `Bet.UserId` has ≥1 penalty in `UserMatchPenalty` for that match
- [ ] Set `BetStatus` (Won/Lost) and `EvaluatedOn` on each bet

##### Step 16.4.2b — Admin re-evaluate bets for a match
- [ ] `POST /api/admin/matches/{matchId}/re-evaluate-bets` (admin-only)
- [ ] Re-runs evaluation for UserGoal and UserPenalty bets on an already-completed match
- [ ] Use case: admin completes match first, adds goals/penalties later, then re-evaluates
- [ ] Only re-evaluates bets with `BetType = UserGoal` or `UserPenalty`; TeamWin stays unchanged (score doesn't change after completion)
- [ ] Updates `BetStatus` and `EvaluatedOn` on affected bets

##### Step 16.4.3 — Lock bets on InProgress
- [ ] When match moves to `InProgress`, all existing bets for that match become immutable
- [ ] Reject new bets / updates / deletes for InProgress or completed matches

##### Step 16.4.4 — Betting balance computation
- [ ] `GetBettingBalanceAsync(userId/loginId)`:
  - Sum all positive point `Amount` values for the user across all matches
  - Sum all won bet net profits: `Σ(Bet.Amount × Bet.Odds)` where `BetStatus = Won`
  - Subtract pending bet amounts: `Σ(Bet.Amount)` where `BetStatus = Pending`
  - Subtract lost bet amounts: `Σ(Bet.Amount)` where `BetStatus = Lost`
  - Cancelled bets don't affect balance (refunded)
  - Balance = `Σ(positive point cash) + Σ(won bet net profit) - Σ(pending bet amounts) - Σ(lost bet amounts)`

##### Step 16.4.5 — Max bet validation
- [ ] When placing a bet: `odds × amount ≤ maxWinCap`
- [ ] `maxWinCap = Σ(negative point cash for user across all matches) - Σ(user payouts amount)`
- [ ] This limits the house's exposure to each user's total negative balance minus what they've already been paid

---

#### Sub-phase 16.5: Backend — API Endpoints

##### Step 16.5.1 — Betting endpoints (rewrite `BetsController`)
- [ ] `GET /api/betting/balance` — current user's available betting balance + max win cap
- [ ] `GET /api/betting/matches` — upcoming bettable matches with odds (replaces future matches for betting context)
- [ ] `GET /api/betting/matches/{matchId}/odds` — detailed odds for a match
- [ ] `POST /api/betting/matches/{matchId}/bet` — place bet (body: `{ betType, userId?, teamId?, amount }`)
- [ ] `PUT /api/betting/matches/{matchId}/bet` — update bet
- [ ] `DELETE /api/betting/matches/{matchId}/bet` — cancel bet
- [ ] `GET /api/betting/history?seasonId=X` — user's bet history with outcomes, odds, amounts won/lost

##### Step 16.5.2 — Points management endpoints (admin)
- [ ] `GET /api/admin/points?seasonId=X&pointType=Positive|Negative&page=1&size=50` — paginated list of all points
- [ ] `PUT /api/admin/points/bulk` — bulk update amounts
- [ ] New `PointsManagementController`

##### Step 16.5.3 — Enhanced weekly match data
- [ ] Extend `WeeklyMatchUserDto` to include betting info per user per match:
  - `BetResult` (won/lost/none), `BetAmount`, `BetWonAmount`
- [ ] Extend the weekly stats endpoint or create a new one that includes this data

---

#### Sub-phase 16.6: Frontend — Season Page Rework

##### Step 16.6.1 — Role-based match interaction
- [ ] Detect admin role from `AuthContext`
- [ ] **Admin**: Show small "Edit" button on each match card → links to `/seasons/{id}/matches/{matchId}` (current MatchPage)
- [ ] **Admin on completed match**: Show "Re-evaluate Bets" button (calls `POST /api/admin/matches/{matchId}/re-evaluate-bets`). Visible only on completed matches. Confirms with a toast on success.
- [ ] **Non-admin**: Match card is clickable and expands inline (no navigation)

##### Step 16.6.2 — Inline match expansion (non-admin)
- [ ] Expandable section shows a table with columns:
  - User Name | + (positive points) | − (negative points) | Goals | Penalties | Bet result + amount
- [ ] Data source: extend `WeeklyMatchUserDto` or fetch additional data when match is expanded

##### Step 16.6.3 — Hover tooltips on expanded match
- [ ] **Hover on +/−**: Popover showing point reason breakdown (e.g., "Win: 2, Assist: 1")
- [ ] **Hover on Goals**: Popover showing roster player names who scored
- [ ] **Hover on Penalties**: Popover showing roster player names penalized
- [ ] **Hover on Bet**: Popover showing odds and amount bet
- [ ] Data: fetch per-match details on expand (point reasons, goals, penalties, bet info)

##### Step 16.6.4 — InProgress badge
- [ ] New `CompletionBadge` variant for `InProgress` (pulsing dot or "LIVE" indicator)

---

#### Sub-phase 16.7: Frontend — Betting Page Rewrite

##### Step 16.7.1 — Balance header card
- [ ] Prominently display user's betting balance at the **top of the page** (fetched from `GET /api/betting/balance`)
- [ ] Show: **Available Balance (€)** and **Max Win Cap (€)**
- [ ] Styled as a sticky/always-visible card so the user always knows their budget
- [ ] Balance refreshes after every bet action (place, update, cancel)
- [ ] When balance is 0, show a message and disable bet placement across all matches

##### Step 16.7.2 — Expandable match list
- [ ] Fetch upcoming matches from `GET /api/betting/matches`
- [ ] Each match shown as a compact card (similar to season page style)
- [ ] Click to expand → shows betting options

##### Step 16.7.3 — Betting options UI
- [ ] **Team Win**: Two buttons (Home / Away) with odds displayed next to each
- [ ] **User Goal**: List of active users (excluding current user) with odds next to each
- [ ] **User Penalty**: Same list with penalty odds
- [ ] One bet per match — radio-button behavior across all three types

##### Step 16.7.4 — Amount input & validation
- [ ] Input box for bet amount next to the selected option
- [ ] Validate: amount ≤ available balance, odds × amount ≤ max win cap
- [ ] Display potential winnings: `amount × odds`
- [ ] Disable "Place Bet" button when amount is empty, 0, or exceeds balance

##### Step 16.7.5 — Bet management
- [ ] Already bet: show current bet, amount, odds
- [ ] "Update" — change selection or amount
- [ ] "Cancel" — delete the bet (refund, balance updates)
- [ ] Locked indicator when match is InProgress

---

#### Sub-phase 16.8: Frontend — Betting History Page Rewrite

##### Step 16.8.1 — Season selector
- [ ] Season dropdown at the top (reuse `SeasonSelector` component)
- [ ] Default to current/latest season

##### Step 16.8.2 — Bet history table
- [ ] Fetch from `GET /api/betting/history?seasonId=X`
- [ ] Columns: Match (teams), Bet Type, Bet Target (team/user name), Odds, Amount Bet, Won/Lost/Pending badge, Amount Won/Lost
- [ ] Color coding: green for won, red for lost, gray for pending

##### Step 16.8.3 — Summary stats
- [ ] Total bets placed, total won, total lost, net profit/loss
- [ ] Win rate percentage

---

#### Sub-phase 16.9: Frontend — Points Management Page (Admin)

##### Step 16.9.1 — Page setup
- [ ] New route: `/admin/points`
- [ ] Add to admin nav in `navConfig.ts`
- [ ] Protected by admin role

##### Step 16.9.2 — Points list with filters
- [ ] Season selector (filter by season, default to all)
- [ ] Point type toggle: Positive / Negative / All
- [ ] Table columns: User Name, Match #, Season, Point Reason, Count, Amount (€), Awarded On
- [ ] Pagination

##### Step 16.9.3 — Bulk editing
- [ ] Checkbox column for multi-select
- [ ] "Select All" on current page/filtered results
- [ ] Bulk action: "Update Amount" — apply a new amount to all selected points
- [ ] Individual inline edit for amount

---

#### Phase 16 — Files to Modify

**Backend — Modify:**
- `backend/src/NHLStats.Domain/Entities/CompletionType.cs` — add `InProgress = 4`
- `backend/src/NHLStats.Domain/Entities/UserMatchPoint.cs` — add `Amount`, `CreatedOn`
- `backend/src/NHLStats.Domain/Entities/Bet.cs` — add `Amount`, `Odds`, `BetStatus`
- `backend/src/NHLStats.Domain/NhlStatsDbContext.cs` — new `BetStatus`, updated configs, `MatchOdds` DbSet
- `backend/src/NHLStats.Application/Services/BetService.cs` — full rewrite
- `backend/src/NHLStats.Application/Services/MatchService.cs` — hook bet evaluation into `UpdateAsync`
- `backend/src/NHLStats.Application/Services/UserMatchService.cs` — auto-calculate cash on `AddPointAsync`, bulk point update
- `backend/src/NHLStats.Application/DTOs/BetDto.cs` — rewrite with new fields
- `backend/src/NHLStats.Application/DTOs/UserMatchDto.cs` — add `Amount`/`CreatedOn` to point DTOs
- `backend/src/NHLStats.Application/DTOs/StatsDto.cs` — extend `WeeklyMatchUserDto` with bet info
- `backend/src/NHLStats.Api/Controllers/BetsController.cs` — rewrite with new routes
- `backend/src/NHLStats.Api/Program.cs` — register new services

**Backend — Create:**
- `backend/src/NHLStats.Domain/Entities/BetStatus.cs` — new enum
- `backend/src/NHLStats.Domain/Entities/MatchOdds.cs` — pre-computed odds entity
- `backend/src/NHLStats.Application/Interfaces/IBettingOddsService.cs` — new interface
- `backend/src/NHLStats.Application/Services/BettingOddsService.cs` — reads SQL views, writes to `MatchOdds` table
- `backend/src/NHLStats.Application/Interfaces/IBettingBalanceService.cs` — new interface
- `backend/src/NHLStats.Application/Services/BettingBalanceService.cs` — balance computation
- `backend/src/NHLStats.Application/DTOs/BettingOddsDto.cs` — odds response DTOs
- `backend/src/NHLStats.Api/Controllers/PointsManagementController.cs` — admin points CRUD
- EF migration(s) with raw SQL for `vw_team_win_factors`, `vw_user_goal_factors`, `vw_user_penalty_factors` views + `MatchOdds` table

**Frontend — Modify:**
- `frontend/src/types/match.ts` — add `InProgress` to `CompletionType`
- `frontend/src/types/bet.ts` — rewrite types for new API shape
- `frontend/src/pages/SeasonPage.tsx` — role-based match rendering, expandable matches
- `frontend/src/pages/BettingPage.tsx` — full rewrite
- `frontend/src/pages/BettingHistoryPage.tsx` — full rewrite
- `frontend/src/services/bettingService.ts` — rewrite to use API (drop localStorage)
- `frontend/src/config/navConfig.ts` — add admin points page
- `frontend/src/App.tsx` — add new routes
- `frontend/src/components/CompletionBadge.tsx` — InProgress variant
- `frontend/src/i18n/locales/en.json` — new i18n keys
- `frontend/src/i18n/locales/sk.json` — new i18n keys

**Frontend — Create:**
- `frontend/src/pages/admin/PointsManagementPage.tsx` — admin points page
- `frontend/src/services/bettingOddsService.ts` (or inline in bettingService)

**Tests — Modify/Create:**
- `backend/tests/NHLStats.Api.Tests/Bets/BetsTests.cs` — rewrite for new API
- New test files for odds calculation, balance computation, bet evaluation
- Frontend tests for new pages

---

#### Phase 16 — Verification

1. **Unit tests**: Odds calculation edge cases (no data, all wins, all losses, no H2H, single match)
2. **Unit tests**: Balance computation (positive points only, with won/lost bets, with cancelled bets)
3. **Unit tests**: Max bet cap validation
4. **Integration tests**: Place bet → complete match → verify auto-evaluation
5. **Integration tests**: InProgress locking (reject bet placement/update on InProgress match)
6. **Integration tests**: Points bulk update endpoint
7. **Frontend tests**: Season page expansion (admin vs non-admin rendering)
8. **Frontend tests**: Betting page amount validation
9. **Manual test**: Full flow — add points → verify cash stored → place bet → complete match → check history
10. **Manual test**: Verify existing data migration (backfill point amounts)

---

#### Phase 16 — Key Decisions

| Decision | Detail |
|----------|--------|
| **Betting balance** | Computed from data (not stored on User) — `Σ(positive cash) + Σ(won bet profits) - Σ(pending amounts) - Σ(lost amounts)` |
| **BetStatus enum** | Replaces `IsWon` bool: `Pending`, `Won`, `Lost`, `Cancelled` — cleaner state machine |
| **One bet per match per user** | Unchanged from current implementation |
| **Odds locked at placement** | Stored on bet, even if future calculations would differ |
| **Auto-evaluation** | On match completion (CompletionType set to RegularTime/Overtime/Shootout) |
| **Re-evaluation** | Admin can re-evaluate UserGoal/UserPenalty bets after adding goals/penalties post-completion |
| **InProgress** | Freezes all betting on the match (no create/update/delete) |
| **Match date normalization** | InProgress keeps the date (like other completed types) |
| **Streak window** | Last 10 matches for short-term form factor |
| **House margin** | 15% (0.85 factor in odds formula) |
| **Odds format** | Net profit multiplier (e.g. 0.70 means bet 1€, win 0.70€ profit) |
| **Negative point default** | -0.5€ when no MoneyConfig exists |
| **Pre-computed odds** | SQL views for probability factors → `MatchOdds` table for instant reads |
| **Data migration** | Three-phase: add nullable columns → backfill via raw SQL → make `Amount` non-nullable |
| **Scope excluded** | Admin bet management UI, notifications, real-time odds updates |

---

## Folder Structure

```
NHLStats 2.0/
├── backend/
│   ├── src/
│   │   ├── NHLStats.Api/           # Controllers, Middleware, Program.cs
│   │   ├── NHLStats.Application/   # Services, DTOs, Interfaces
│   │   └── NHLStats.Domain/        # Entities, Enums, DbContext
│   ├── tests/
│   │   ├── NHLStats.Domain.Tests/      # Entity unit tests
│   │   ├── NHLStats.Application.Tests/  # Service unit tests
│   │   └── NHLStats.Api.Tests/          # Integration tests
│   └── NHLStats.sln
├── frontend/
│   ├── src/
│   │   ├── components/             # Reusable UI components
│   │   ├── pages/                  # Route pages
│   │   ├── features/               # Feature-specific components
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── services/               # API client
│   │   ├── context/                # Auth context, etc.
│   │   └── types/                  # TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts
├── .gitignore
├── README.md
└── IMPLEMENTATION_PLAN.md
```

---

## Getting Started (After Implementation)

### Local Development

```bash
# Backend
cd backend
dotnet restore
dotnet ef database update --project src/NHLStats.Domain
dotnet run --project src/NHLStats.Api

# Frontend
cd frontend
npm install
npm run dev
```

### Environment Variables

**Backend:**
- `ConnectionStrings__DefaultConnection` — SQLite connection string (`Data Source=...`)
- `Jwt__Secret` — JWT signing key
- `Jwt__Issuer` — JWT issuer
- `Jwt__Audience` — JWT audience

**Frontend:**
- `VITE_API_BASE_URL` — Backend API URL

---

## Notes

- All write operations require authentication
- Anonymous users can view charts, season stats, and match details (read-only)
- Money calculations always use the rate active at the match date
- Roster is versioned per season; can copy from previous season or import fresh CSV
- Historical aggregated data uses UserMatch with MatchId = null

---

**SQLite deployment notes**

- The backend uses SQLite only.
- Deploy the API to Azure App Service and keep the DB file under a persistent writable path (`/home/data/nhlstats.db` on Linux or `D:\\home\\data\\nhlstats.db` on Windows).
- Avoid read-only deployment layouts for the DB path and back up the SQLite file regularly.

**Local dev with SQLite**

- The project supports using SQLite for development and demos. By default the API will place the DB at `HOME/data/nhlstats.db` when no SQL connection string is provided. To reset to seeded data, remove the DB file before starting the app.

