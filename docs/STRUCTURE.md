# Documentation Structure

This guide explains where to find information for different aspects of the NHL Stats 2.0 project.

## Documentation Organization

### Getting Started
- **[SETUP.md](SETUP.md)** — How to set up your local development environment. Start here if you're new to the project.
- **[ENVIRONMENT.md](ENVIRONMENT.md)** — All environment variables for backend, frontend, and Azure deployment.

### Understanding the System
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — High-level system design, Clean Architecture layers, frontend state management, and deployment topology.
- **[FEATURES.md](FEATURES.md)** — Overview of core features (Authentication, Seasons, Matches, Stats, Earnings, Admin).
- **[DATABASE.md](DATABASE.md)** — Database schema, entities, relationships, and migrations.

### Development
- **[API.md](API.md)** — Complete REST API reference with endpoints organized by domain.
- **[TESTING.md](TESTING.md)** — Testing strategy and how to run tests for backend and frontend.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Developer contribution guidelines, TDD workflow, and PR process.

### Operations
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Production deployment on Azure App Service and Static Web Apps, CI/CD pipeline.
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** — Common issues and solutions.

## Quick References

### Tech Stack
- **Backend:** ASP.NET Core 10, Entity Framework Core, SQLite
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Recharts
- **Auth:** ASP.NET Identity + JWT
- **Testing:** xUnit (backend), Vitest (frontend), MSW (mocking)
- **Deployment:** Azure App Service, Azure Static Web Apps, GitHub Actions

### Key Directories
- `backend/src/NHLStats.Api/` — Web API controllers
- `backend/src/NHLStats.Application/` — Business logic services
- `backend/src/NHLStats.Domain/` — Entities, DbContext, migrations
- `backend/tests/` — All backend tests
- `frontend/src/` — React components, pages, services, context
- `frontend/src/mocks/` — MSW mock handlers
- `.github/workflows/` — CI/CD workflows

### Common Commands

**Backend:**
```bash
cd backend
dotnet restore
dotnet run --project src/NHLStats.Api          # Start API (port 5267)
dotnet test                                     # Run all tests
dotnet ef migrations add MigrationName --project src/NHLStats.Domain --startup-project src/NHLStats.Api
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev                                     # Dev server (port 5173)
npm test                                        # Run tests
npm run build                                   # Production build
```

## Document Purpose Guide

| Document | Purpose | Audience |
|----------|---------|----------|
| SETUP.md | First-time local setup | New developers |
| ENVIRONMENT.md | Configuration reference | All developers, DevOps |
| ARCHITECTURE.md | System design understanding | Senior developers, architects |
| FEATURES.md | Business feature overview | All developers, product |
| DATABASE.md | Data model and migrations | Backend developers |
| API.md | Endpoint reference | Frontend developers, integrators |
| TESTING.md | Testing patterns and practices | All developers, QA |
| CONTRIBUTING.md | Workflow and standards | All developers |
| DEPLOYMENT.md | Release and DevOps processes | DevOps, senior developers |
| TROUBLESHOOTING.md | Problem-solving reference | All developers |

## Contributing to Documentation

When updating documentation:
1. Keep files focused and concise
2. Include code examples and commands
3. Use actual file paths from the repo
4. Link between related documents
5. Update modification timestamp
6. Ensure examples are tested and correct

Last Updated: March 2026
