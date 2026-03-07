# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NHL Stats 2.0 is a full-stack web app for tracking NHL (PlayStation/Xbox) player stats: plus/minus points, goals, penalties, and monetary earnings.

- **Backend**: ASP.NET Core Web API (.NET 10), Entity Framework Core, SQLite
- **Frontend**: React 18 + Vite + TypeScript, Tailwind CSS, Recharts, i18next
- **Auth**: ASP.NET Identity + JWT
- **Deployment**: Azure App Service (API) + Azure Static Web Apps (frontend)

---

## Commands

### Backend

```bash
# Restore and run the API (runs on http://localhost:5267)
cd backend
dotnet restore
dotnet run --project src/NHLStats.Api

# Run all backend tests
dotnet test

# Run a specific test project
dotnet test tests/NHLStats.Api.Tests
dotnet test tests/NHLStats.Application.Tests
dotnet test tests/NHLStats.Domain.Tests

# Run a single test by name
dotnet test --filter "FullyQualifiedName~TestMethodName"

# Add an EF Core migration
dotnet ef migrations add MigrationName --project src/NHLStats.Domain --startup-project src/NHLStats.Api

# Build for production
dotnet build --configuration Release
```

### Frontend

```bash
cd frontend

npm install          # Install dependencies
npm run dev          # Dev server at http://localhost:5173 (proxies /api to :5267)
npm test             # Run Vitest tests
npm run test:watch   # Vitest watch mode
npm run lint         # ESLint
npm run build        # Production build → dist/
npm run preview      # Preview production build
```

---

## Architecture

### Backend: Clean/Layered Architecture

Three projects in `backend/src/`:

1. **`NHLStats.Domain`** — Entities, `NhlStatsDbContext`, EF Core migrations, seed data (32 NHL teams, default point reasons, money config). DB migrates automatically on startup.
2. **`NHLStats.Application`** — Business logic services (`UserService`, `SeasonService`, `MatchService`, etc.) with interfaces. DTOs live here.
3. **`NHLStats.Api`** — ASP.NET Core controllers (15 total). `Program.cs` wires up DI, JWT, CORS, and EF Core. Controllers depend on service interfaces only.

Test projects mirror the source layers under `backend/tests/`. Integration tests use `WebApplicationFactory` and `Testcontainers`.

### Frontend: React + Context + Services

- **Routing**: React Router v7. Public routes at `/`, admin routes under `/admin/*` protected by `ProtectedRoute`.
- **State**: React Context for auth (`AuthContext`), theme (`ThemeContext`), and toasts (`ToastContext`). No Redux.
- **API**: Axios client in `services/apiClient.ts` with JWT interceptor. Vite proxy forwards `/api` to the backend in dev.
- **Testing**: Vitest + React Testing Library. MSW (`src/mocks/`) intercepts API calls in tests.
- **i18n**: i18next wired up in `src/i18n/`.

### Authentication Flow

1. Login/register via `POST /api/auth/login` or `/register`
2. Backend returns JWT
3. Frontend stores it in `AuthContext`; Axios interceptor attaches it to all requests
4. Backend endpoints protected with `[Authorize]`; admin-only endpoints check role

### Key Domain Entities

| Entity | Purpose |
|--------|---------|
| `Season` | Tournament; `ParentSeasonId` links playoff seasons |
| `Match` | Game within a season; tracks home/away team and score |
| `UserMatch` | A player's stats entry for a match (nullable `MatchId` allows historical data) |
| `UserMatchPoint` | Individual +/− point entries linked to `PointReason` |
| `MoneyConfig` | Effective-dated payout rates for positive/negative points |
| `RosterPlayer` | NHL roster players scoped to a season (supports CSV import) |

### Configuration

- **Backend**: `Jwt:Secret`, `Jwt:Issuer`, `Jwt:Audience` from config; `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars seed the admin user; SQLite DB at `$HOME/data/nhlstats.db`.
- **Frontend**: `VITE_API_BASE_URL` env var for production API URL.

---

## Development Methodology

The project follows **TDD (Red-Green-Refactor)**. Write a failing test first, then implement the minimum code to pass it. The `IMPLEMENTATION_PLAN.md` tracks overall progress by phase, and `USER_STATS_PLAN.md` details the stats feature work breakdown.

Backend assertions use **FluentAssertions** (e.g., `result.Should().BeTrue()`). Frontend tests use **React Testing Library** with user-event for interactions.
