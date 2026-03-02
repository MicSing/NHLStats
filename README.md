# NHLStats 2.0

Phase 1 scaffolding: local development helpers.

Local quickstart

1. Start SQL Server container:

```bash
docker-compose up -d
```

2. Backend (dotnet):

```bash
cd backend
dotnet restore
dotnet run --project src/NHLStats.Api
```

3. Frontend:

```bash
cd frontend
npm install
npm run dev
```

Notes:
- Default SQL Server SA password in docker-compose is `Your_password123` — change for production.
- The backend exposes a `/health` endpoint for smoke checks.
