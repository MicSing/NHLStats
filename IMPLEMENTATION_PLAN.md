# NHL Stats 2.0 — Implementation Plan

A full-stack web application for tracking NHL (PS5/Xbox) human players' plus/minus points, goals, penalties, and monetary earnings.

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Backend** | .NET 10, ASP.NET Core Web API, Entity Framework Core |
| **Backend Testing** | xUnit, FluentAssertions, Moq, Testcontainers (SQL Server), Bogus (fake data) |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS |
| **Frontend Testing** | Vitest, React Testing Library, MSW (Mock Service Worker) |
| **Database** | Azure SQL (production) / SQLite (single-instance demo) |
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

**Money Config:** −50¢ per negative point, +25¢ per positive point

**32 NHL Teams:** All current NHL franchises

---

## Implementation Phases

### Phase 1: Project Scaffolding & Infrastructure (Completed)
**Status:** Completed — scaffold, tests, docker-compose, frontend setup, and smoke health test are present.
**Goal:** Set up the monorepo structure, development environment, and test infrastructure

- [x] Create folder structure: `backend/`, `frontend/`
- [x] Initialize .NET 10 Web API solution with layered architecture (Api, Application, Domain)
- [x] **Add test projects**: `NHLStats.Domain.Tests`, `NHLStats.Application.Tests`, `NHLStats.Api.Tests`
- [x] **Configure xUnit, FluentAssertions, Moq, Testcontainers, Bogus**
- [x] Initialize React + Vite + TypeScript project
- [x] **Configure Vitest and React Testing Library**
- [x] Configure Tailwind CSS
- [x] Add root `docker-compose.yml` for local development (SQL Server container)
- [x] Add root `.gitignore`, `README.md`
- [x] Configure EF Core with Azure SQL / LocalDB for development
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
**Goal:** Build admin management pages (auth-gated) (TDD)

For each admin page, follow this TDD cycle:
1. Write component render tests (displays data correctly)
2. Write interaction tests (form submit, button clicks)
3. Write API integration tests with MSW
4. Implement component → make tests pass

- [ ] **Users management**:
  - [ ] Tests: Renders user list, add form submits, edit form populates, deactivate calls API
  - [ ] Implement UsersPage
- [ ] **Seasons management**:
  - [ ] Tests: Renders season list, assign users dropdown, create/edit forms
  - [ ] Implement SeasonsPage
- [ ] **Roster management**:
  - [ ] Tests: Renders roster table, CSV upload triggers import, copy button calls API
  - [ ] Implement RosterPage
- [ ] **Point Reasons management**:
  - [ ] Tests: Renders reasons list, add/edit forms, deactivate toggle
  - [ ] Implement PointReasonsPage
- [ ] **Money Config management**:
  - [ ] Tests: Renders history table, add form with date picker
  - [ ] Implement MoneyConfigPage
- [ ] **Expenses management**:
  - [ ] Tests: Renders expenses list, CRUD operations
  - [ ] Implement ExpensesPage

---

### Phase 10: Frontend — Season & Match Pages
**Goal:** Build the core match tracking UI (TDD)

- [ ] **Write Season selector tests:**
  - [ ] Test: Dropdown renders all seasons
  - [ ] Test: Selecting season updates URL/state
- [ ] Implement SeasonSelector → make tests pass

- [ ] **Write Season overview page tests:**
  - [ ] Test: Groups matches by week with visual separation
  - [ ] Test: Shows aggregated entries section when data exists
  - [ ] Test: User stats table shows correct totals
  - [ ] Test: Top roster player columns show correct players
- [ ] Implement SeasonPage → make tests pass

- [ ] **Write Match detail page tests:**
  - [ ] Test: Renders all user entries for match
  - [ ] Test: Point entry form submits with PointReason and count
  - [ ] Test: Goal form shows season roster in dropdown
  - [ ] Test: Penalty form shows season roster in dropdown
  - [ ] Test: Edit controls hidden when not authenticated
  - [ ] Test: Edit controls visible when authenticated
- [ ] Implement MatchPage → make tests pass

---

### Phase 11: Frontend — Charts Dashboard
**Goal:** Build cross-season visualizations (TDD)

- [ ] Install Recharts
- [ ] **Write chart component tests:**
  - [ ] Test: PlusMinusChart renders with correct data points
  - [ ] Test: TopScorersChart renders bars for each user
  - [ ] Test: PenaltyLeadersChart renders bars for each user
  - [ ] Test: EarningsChart renders cumulative line
  - [ ] Test: Season filter updates chart data
  - [ ] Test: Charts handle empty data gracefully
- [ ] Implement chart components → make tests pass
- [ ] Implement DashboardPage composing all charts

---

### Phase 12: Frontend — Earnings & Expenses Page
**Goal:** Build the financial summary page (TDD)

- [ ] **Write earnings table tests:**
  - [ ] Test: Renders row for each user with Plus, Minus, Earnings, Payouts, Net
  - [ ] Test: Totals row sums all users
  - [ ] Test: Handles users with no data
- [ ] **Write expenses table tests:**
  - [ ] Test: Renders all expenses with description, amount, date
  - [ ] Test: Total expenses row shows sum
- [ ] **Write balance summary tests:**
  - [ ] Test: Shows Total collected, Total expenses, Remaining
  - [ ] Test: Remaining = Total collected − Total expenses
- [ ] Implement EarningsExpensesPage → make tests pass

---

### Phase 13: Azure Deployment Setup
**Goal:** Configure Azure resources and CI/CD

- [ ] Create Azure SQL Database
- [ ] Create Azure App Service (Linux, .NET 10) for backend API
- [ ] Create Azure Static Web Apps for frontend
- [ ] Configure connection strings and environment variables
- [ ] Set up GitHub Actions workflow:
  - Build and deploy backend to App Service
  - Build and deploy frontend to Static Web Apps
- [ ] Configure CORS on backend for frontend domain

---

### Phase 14: Custom Domain & SSL
**Goal:** Set up public domain access

- [ ] Register/configure custom domain in Azure
- [ ] Bind custom domain to App Service (API subdomain, e.g., `api.nhlstats.example.com`)
- [ ] Bind custom domain to Static Web Apps (main domain, e.g., `nhlstats.example.com`)
- [ ] Enable managed SSL certificates
- [ ] Test end-to-end in production

---

### Phase 15: Polish & Future Enhancements
**Goal:** Refinements and additional features

- [ ] Add loading states and error handling throughout frontend
- [ ] Add pagination for large lists
- [ ] Add search/filter on admin tables
- [ ] Mobile-responsive design improvements
- [ ] Add more charts based on usage
- [ ] Consider adding export functionality (CSV/PDF reports)
- [ ] Add audit logging for admin actions

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
├── docker-compose.yml
├── .gitignore
├── README.md
└── IMPLEMENTATION_PLAN.md
```

---

## Getting Started (After Implementation)

### Local Development

```bash
# Start database
docker-compose up -d

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
- `ConnectionStrings__DefaultConnection` — SQL connection string
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

**Optional: SQLite for single-instance demos**

- Use SQLite when you want a zero-cost, single-instance demo without provisioning Azure SQL. This is suitable for internal demos or small groups only.
- Constraints: file-based DB, no multi-instance scaling, limited concurrency. Store the DB file under the App Service persistent area (for example: `HOME/data/nhlstats.db`) so it survives restarts and redeploys.
- Back up the SQLite file regularly (for example compress and upload to Azure Blob Storage) to avoid data loss during deployments.

**Deployment notes (Phase 13 alternative)**

When using SQLite instead of Azure SQL for the backend in Phase 13:

- Deploy the API to Azure App Service (Free tier for demo). Configure the app so the SQLite file is placed in the App Service persistent path (`/home/data/nhlstats.db` on Linux or `D:\\home\\data\\nhlstats.db` on Windows).
- Avoid `WEBSITE_RUN_FROM_PACKAGE=1` or any read-only package mount for the app content, since the SQLite DB must be writable. If you use zip-deploy, ensure the DB file is not overwritten by deployments or add a post-deploy restore step.
- Add a small post-deploy or scheduled task to copy the DB file to Azure Blob Storage (compressed) for backups. Use lifecycle rules on the storage account (Cool/Archive) to minimize cost.
- For reliability consider switching to Azure SQL when you require scaling, multi-instance deployments, or managed backups.

**Local dev with SQLite**

- The project supports using SQLite for development and demos. By default the API will place the DB at `HOME/data/nhlstats.db` when no SQL connection string is provided. To reset to seeded data, remove the DB file before starting the app.

