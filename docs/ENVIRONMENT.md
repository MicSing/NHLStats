# Environment Variables

Complete reference for all environment variables used in NHL Stats 2.0.

## Backend Environment Variables

All backend configuration comes from multiple sources in this order (highest to lowest priority):

1. **Environment variables** (OS-level)
2. **appsettings.{Environment}.json** (e.g., `appsettings.Development.json`)
3. **appsettings.json** (default)

### Core Configuration

| Variable | Type | Default | Purpose | Example |
|----------|------|---------|---------|---------|
| `ADMIN_EMAIL` | string | `admin@nhlstats.local` | Initial admin user email | `admin@example.com` |
| `ADMIN_PASSWORD` | string | `P@ssw0rd!` | Initial admin user password | `MySecurePass123!` |
| `AllowedOrigins` | string (comma-separated) | `http://localhost:5173` | CORS allowed origins | `http://localhost:5173,https://app.example.com` |

### JWT Configuration

Located in `Jwt` section of appsettings:

```json
{
  "Jwt": {
    "Secret": "REPLACE_WITH_SECURE_VALUE_IN_PRODUCTION",
    "Issuer": "NHLStats",
    "Audience": "NHLStatsClient",
    "ExpiryMinutes": 60
  }
}
```

| Variable | Type | Default | Purpose | Requirements |
|----------|------|---------|---------|--------------|
| `Jwt:Secret` | string | `dev-secret-please-change` | Signing key for JWT tokens | **Min 32 chars** for production |
| `Jwt:Issuer` | string | `NHLStats` | Token issuer claim | Matches validation in Program.cs |
| `Jwt:Audience` | string | `NHLStatsClient` | Token audience claim | Matches frontend token validation |
| `Jwt:ExpiryMinutes` | integer | `60` | Token expiration time | Minutes until token expires |

### Database Configuration

SQLite connection string is auto-configured:

```
Data Source=$HOME/data/nhlstats.db
```

| Component | Location | Purpose |
|-----------|----------|---------|
| Database file | `$HOME/data/nhlstats.db` | SQLite database (auto-migrated on startup) |
| Schema | `backend/src/NHLStats.Domain/Entities/` | Entity definitions |
| Migrations | `backend/src/NHLStats.Domain/Migrations/` | EF Core migration history |

## Backend Environment Setup

### Development Environment

**In `backend/src/NHLStats.Api/appsettings.Development.json`:**

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "Microsoft.EntityFrameworkCore": "Information"
    }
  },
  "Jwt": {
    "Secret": "dev-super-secret-key-at-least-32-characters-long",
    "Issuer": "NHLStats",
    "Audience": "NHLStatsClient",
    "ExpiryMinutes": 60
  },
  "AllowedOrigins": "http://localhost:5173"
}
```

**Via environment variables:**

```bash
export ADMIN_EMAIL=dev@example.com
export ADMIN_PASSWORD=DevPass123!
dotnet run --project src/NHLStats.Api
```

### Production Environment

**All sensitive values must be set via environment variables or Azure Key Vault:**

```bash
# Azure App Service: Settings → Configuration → Application settings
Jwt__Secret=<your-secure-32-char-key>
Jwt__Issuer=NHLStats
Jwt__Audience=NHLStatsClient
Jwt__ExpiryMinutes=60
AllowedOrigins=https://your-app.azurewebsites.net,https://frontend.app.com
ADMIN_EMAIL=admin@your-org.com
ADMIN_PASSWORD=<secure-password>
```

**Never** commit passwords or secrets to Git. Use Azure Key Vault in production.

## Frontend Environment Variables

Frontend configuration is set at build time via environment variables or `.env` files.

### Development Environment

**In `frontend/.env.local` (not in Git):**

```env
VITE_API_BASE_URL=http://localhost:5267
```

Default is `/api` which proxies to backend via Vite dev server.

### Production Build

**Set before building:**

```bash
export VITE_API_BASE_URL=https://api.your-domain.com
npm run build
```

This embeds the API URL into the built JavaScript.

### Frontend Environment Variables Reference

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| `VITE_API_BASE_URL` | string | `/api` | Backend API base URL (dev proxy to :5267) |
| `VITE_APP_TITLE` | string | `NHL Stats 2.0` | Page title in browser |
| `VITE_LOG_LEVEL` | string | `info` | Console logging level (off, error, warn, info, debug) |

### Frontend Runtime Configuration

Frontend services read API URL from compile-time constant in `src/services/apiClient.ts`:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
```

## Azure Deployment Environment Variables

### Backend (Azure App Service)

**Application Settings (Configuration):**

```
Jwt__Secret=<from-key-vault>
Jwt__Issuer=NHLStats
Jwt__Audience=NHLStatsClient
Jwt__ExpiryMinutes=60
AllowedOrigins=https://<frontend-domain>
ADMIN_EMAIL=<admin-email>
ADMIN_PASSWORD=<from-key-vault>
WEBSITES_PORT=5267
```

**Connection strings:**
```
DefaultConnection=Data Source=/home/data/nhlstats.db
```

### Frontend (Azure Static Web Apps)

**Environment file in `.github/workflows/frontend.yml`:**

```yaml
env:
  VITE_API_BASE_URL: https://nhl-stats-api.azurewebsites.net
```

**Build settings in `staticwebapp.config.json`:**

```json
{
  "navigationFallback": {
    "rewrite": "/index.html"
  },
  "auth": {
    "identityProviders": {
      "azureActiveDirectory": {
        "registration": {
          "openIdIssuer": "https://login.microsoftonline.com/<tenant-id>/v2.0"
        }
      }
    }
  }
}
```

## GitHub Actions Secrets

For CI/CD to work, set these secrets in GitHub repo settings (Settings → Secrets and variables):

| Secret | Purpose | Example |
|--------|---------|---------|
| `AZURE_SUBSCRIPTION_ID` | Azure subscription | `00000000-0000-0000-0000-000000000000` |
| `AZURE_TENANT_ID` | Azure tenant | `00000000-0000-0000-0000-000000000000` |
| `AZURE_CLIENT_ID` | Service principal | `00000000-0000-0000-0000-000000000000` |
| `AZURE_WEBAPP_NAME` | Backend app name | `nhl-stats-api` |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Frontend deploy token | `generated-by-azure` |

## Configuration Precedence

### Backend

1. **Environment variables** (highest priority)
   ```bash
   export Jwt__Secret="my-secret" && dotnet run
   ```

2. **appsettings.{ASPNETCORE_ENVIRONMENT}.json**
   ```bash
   ASPNETCORE_ENVIRONMENT=Production dotnet run
   # Reads appsettings.Production.json
   ```

3. **appsettings.json** (default)

### Frontend

1. **Environment variables** (at build time)
   ```bash
   VITE_API_BASE_URL=https://api.com npm run build
   ```

2. **.env.local** file (highest precedence)
   ```env
   VITE_API_BASE_URL=http://localhost:5267
   ```

3. **.env** file (committed to repo, lowest precedence)

4. **Hardcoded defaults** in code (lowest precedence)

## Local Development Configuration Example

**Setup script (save as `setup.sh`):**

```bash
#!/bin/bash

# Backend
cd backend/src/NHLStats.Api
mkdir -p data

# Create appsettings.Development.json
cat > appsettings.Development.json << 'EOF'
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug"
    }
  },
  "Jwt": {
    "Secret": "dev-secret-key-at-least-32-characters-for-testing",
    "Issuer": "NHLStats",
    "Audience": "NHLStatsClient",
    "ExpiryMinutes": 60
  },
  "AllowedOrigins": "http://localhost:5173"
}
EOF

# Frontend
cd ../../frontend
cat > .env.local << 'EOF'
VITE_API_BASE_URL=http://localhost:5267
EOF

echo "✓ Development configuration created"
```

Run it:

```bash
bash setup.sh
```

## Troubleshooting Environment Variables

### Backend not starting

```bash
# Check environment
dotnet --info

# Check specific environment variable
echo $Jwt__Secret

# Or use .env file
export $(cat .env | xargs)
dotnet run --project src/NHLStats.Api
```

### CORS errors in browser

Check `AllowedOrigins` matches frontend URL:

```bash
# If frontend at http://localhost:5173, backend needs:
export AllowedOrigins="http://localhost:5173"
```

### API calls failing in production

Verify these are set in Azure:

```bash
az webapp config appsettings list --name $WEBAPP_NAME --resource-group $RG
# Should show all Jwt__ and AllowedOrigins settings
```

### Frontend can't connect to API

Check `VITE_API_BASE_URL` was set at build time:

```bash
# Check built app
grep -r "api.your-domain.com" dist/

# If not present, rebuild with correct value
export VITE_API_BASE_URL=https://your-api.com
npm run build
```

## Secret Management Best Practices

1. **Never commit secrets** — Use `.env` files with `.env` in `.gitignore`
2. **Use Azure Key Vault** — For production secrets
3. **Rotate periodically** — JWT secret every 90 days
4. **Use strong passwords** — Min 12 chars, mix of upper/lower/numbers/symbols
5. **Audit access** — Monitor who accesses secrets
6. **Different per environment** — Dev ≠ Staging ≠ Production

## Docker Environment Variables

If using Docker:

```bash
docker run \
  -e Jwt__Secret="my-secret" \
  -e ADMIN_EMAIL="admin@docker.local" \
  -e AllowedOrigins="http://docker-frontend:3000" \
  -p 5267:5267 \
  nhl-stats-api:latest
```

Or with `.env` file:

```bash
docker run --env-file .env -p 5267:5267 nhl-stats-api:latest
```

Last Updated: March 2026
