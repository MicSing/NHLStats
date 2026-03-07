# Local Development Setup

Complete guide for setting up NHL Stats 2.0 on your local machine.

## System Requirements

- **Git** — Version control
- **.NET 10 SDK** — https://dotnet.microsoft.com/download
- **Node.js 18+** — https://nodejs.org
- **npm 9+** — Comes with Node.js
- **macOS/Linux/Windows** — All supported

## Prerequisites Check

Verify your system is ready:

```bash
# Check .NET
dotnet --version                           # Should be 10.0.x

# Check Node.js
node --version                             # Should be v18+
npm --version                              # Should be 9+

# Check Git
git --version                              # Should be recent
```

If any are missing, install from links above.

## Clone the Repository

```bash
# Clone
git clone https://github.com/singent/nhl-stats-2.0.git
cd "NHLStats 2.0"

# Navigate to workspace
cd /path/to/NHLStats\ 2.0
```

## Backend Setup

### 1. Restore Dependencies

```bash
cd backend
dotnet restore
```

This downloads all NuGet packages required by the project.

### 2. Configure Environment Variables

Create `.env` file in `backend/src/NHLStats.Api/` (optional, for overrides):

```bash
export ADMIN_EMAIL=admin@example.com
export ADMIN_PASSWORD=SecurePassword123!
export Jwt__Secret=your-super-secret-key-min32chars-long
```

Or set in `appsettings.Development.json`:

```bash
cd backend/src/NHLStats.Api
cp appsettings.json appsettings.Development.json
```

Edit `appsettings.Development.json`:

```json
{
  "Jwt": {
    "Secret": "dev-secret-key-at-least-32-characters-long",
    "Issuer": "NHLStats",
    "Audience": "NHLStatsClient",
    "ExpiryMinutes": 60
  }
}
```

### 3. Run Database Migrations

The database automatically initializes on first startup. SQLite database creates at `$HOME/data/nhlstats.db`.

```bash
# To manually apply migrations
cd backend
dotnet ef database update --project src/NHLStats.Domain --startup-project src/NHLStats.Api
```

### 4. Start the Backend

```bash
cd backend
dotnet run --project src/NHLStats.Api
```

Expected output:
```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5267
info: Microsoft.Hosting.Lifetime[0]
      Application started.
```

**API is available at:** http://localhost:5267
**Health check:** http://localhost:5267/health

Verify with:
```bash
curl http://localhost:5267/health
# Should return: {"status":"Healthy"}
```

## Frontend Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

This installs React, Vite, Tailwind, Recharts, and all dev tools.

### 2. Start Development Server

```bash
npm run dev
```

Expected output:
```
VITE v7.3.1  ready in 234 ms

➜  Local:   http://localhost:5173/
➜  press h + enter to show help
```

**Frontend is available at:** http://localhost:5173

### 3. Verify API Proxy

Vite automatically proxies `/api` requests to `http://localhost:5267`. Verify in browser console:

```javascript
// In browser console:
fetch('/api/health').then(r => r.json()).then(console.log)
// Should log: {status: "Healthy"}
```

## Complete Local Verification

### 1. Verify Backend

```bash
# Terminal 1: Backend running
curl http://localhost:5267/health
# Expected: {"status":"Healthy"}

# Create a user (register)
curl -X POST http://localhost:5267/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Password123"}'

# Login
curl -X POST http://localhost:5267/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Password123"}'
# Expected: {"token":"eyJ0..."}
```

### 2. Verify Frontend

1. Open http://localhost:5173 in browser
2. Check browser console for no errors
3. Click "Login" — should navigate to login page
4. Register new account
5. Verify you can see dashboard after login

### 3. Verify Database

```bash
# Check SQLite database exists
ls -lah ~/data/nhlstats.db

# Or inspect with sqlite3
sqlite3 ~/data/nhlstats.db ".tables"
# Should list: AspNetRoleClaims, AspNetRoles, AspNetUserClaims, etc.
```

## Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
dotnet test

# Run specific test project
dotnet test tests/NHLStats.Api.Tests

# Run single test by name
dotnet test --filter "FullyQualifiedName~LoginTests"

# Run with coverage
dotnet test /p:CollectCoverage=true /p:CoverageFormat=opencover
```

### Frontend Tests

```bash
cd frontend

# Run once
npm test

# Watch mode (auto-rerun on file change)
npm run test:watch

# With UI
npm test -- --ui
```

## Stopping Services

```bash
# Press Ctrl+C in each terminal to stop

# Or if running in background:
kill $(lsof -t -i:5267)   # Stop backend
kill $(lsof -t -i:5173)   # Stop frontend
```

## Troubleshooting Setup

### Port Already in Use

**Port 5267 (backend) in use:**
```bash
# macOS/Linux: Find and kill
lsof -t -i:5267 | xargs kill -9

# Windows: Use Resource Monitor or
netstat -ano | findstr :5267
taskkill /PID <PID> /F
```

**Port 5173 (frontend) in use:**
```bash
# Same as above with port 5173
```

### .NET Installation Issues

```bash
# Verify .NET
dotnet --info

# Update .NET
dotnet nuget add source https://api.nuget.org/v3/index.json -n nuget.org
dotnet restore --force
```

### Node.js Not Found

```bash
# Verify Node path
which node
which npm

# Update npm
npm install -g npm@latest

# Clear npm cache
npm cache clean --force
```

### Database Lock Issues

```bash
# Remove locked database and let it regenerate
rm ~/data/nhlstats.db
# Restart backend to recreate
```

### Can't Connect Backend from Frontend

1. Verify backend is running: `curl http://localhost:5267/health`
2. Check Vite proxy config in `frontend/vite.config.ts`
3. Clear browser cache: DevTools → Application → Clear Site Data
4. Check browser console for CORS errors
5. Restart both services

## Connection Verification Checklist

- [ ] Backend running on port 5267
- [ ] Frontend running on port 5173
- [ ] `/health` endpoint responds
- [ ] Can register new account
- [ ] Can login with credentials
- [ ] Can see dashboard after login
- [ ] No errors in browser console
- [ ] Database file exists at `~/data/nhlstats.db`

## Next Steps

After setup:

1. **Read the documentation:**
   - [ARCHITECTURE.md](ARCHITECTURE.md) — Understand the system design
   - [FEATURES.md](FEATURES.md) — See what the app does
   - [TESTING.md](TESTING.md) — Learn the test structure

2. **Make your first change:**
   - Follow [CONTRIBUTING.md](CONTRIBUTING.md) workflow
   - Create a feature branch
   - Write a test
   - Implement the feature
   - Create a pull request

3. **Deploy (when ready):**
   - See [DEPLOYMENT.md](DEPLOYMENT.md)

Last Updated: March 2026
