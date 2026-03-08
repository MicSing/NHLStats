# Deployment

Production deployment for NHL Stats 2.0 on Azure cloud platform.

## Deployment Architecture

```
GitHub Repository
  ↓ Push to main
GitHub Actions CI/CD
  ├─→ Backend tests
  ├─→ Build backend
  └─→ Frontend tests & build
  
  ↓ Tests pass
  
  ├─ Backend artifact → Azure App Service
  │  └─ ASP.NET Core API (port 5267)
  │     └─ SQLite database
  │
  └─ Frontend artifact → Azure Static Web Apps
     └─ React SPA
        └─ Serves from CDN globally
```

## Prerequisites

### Azure Account

- **Azure subscription** — https://azure.microsoft.com/free
- **Owner/Contributor access** to subscription
- **Permissions:**
  - Create App Service
  - Create Storage Account
  - Create Static Web Apps
  - Create Key Vault

### Azure CLI

```bash
brew install azure-cli

# Login to Azure
az login

# Verify subscription
az account show
```

### GitHub Secrets

Set these in GitHub repo (Settings → Secrets and variables → Actions):

| Secret | Value | Get From |
|--------|-------|----------|
| `AZURE_SUBSCRIPTION_ID` | UUID | `az account show --query id -o tsv` |
| `AZURE_TENANT_ID` | UUID | `az account show --query tenantId -o tsv` |
| `AZURE_CLIENT_ID` | App ID | Service principal |
| `AZURE_WEBAPP_NAME` | App name | Azure portal |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Token | Azure portal |

### Create Service Principal

```bash
# Create service principal
az ad sp create-for-rbac \
  --name "nhl-stats-github" \
  --role contributor \
  --scopes /subscriptions/{subscription-id}

# Output:
# {
#   "clientId": "...",
#   "clientSecret": "...",
#   "subscriptionId": "...",
#   "tenantId": "..."
# }

# Use clientId as AZURE_CLIENT_ID in GitHub secrets
```

## Backend Deployment (Azure App Service)

### 1. Create App Service

```bash
# Variables
RESOURCE_GROUP="nhl-stats-rg"
LOCATION="eastus"
APP_NAME="nhl-stats-api"
PLAN_NAME="nhl-stats-plan"

# Create resource group
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION

# Create App Service plan (Free tier for dev, B1 for prod)
az appservice plan create \
  --name $PLAN_NAME \
  --resource-group $RESOURCE_GROUP \
  --sku FREE \
  --is-linux

# Create App Service
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan $PLAN_NAME \
  --name $APP_NAME \
  --runtime "DOTNETCORE|10.0"
```

### 2. Configure App Settings

```bash
APP_NAME="nhl-stats-api"
RESOURCE_GROUP="nhl-stats-rg"

# Set app settings (configuration)
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings \
    "Jwt__Secret=$(openssl rand -base64 32)" \
    "Jwt__Issuer=NHLStats" \
    "Jwt__Audience=NHLStatsClient" \
    "Jwt__ExpiryMinutes=60" \
    "AllowedOrigins=https://nhl-stats.net,https://app.nhl-stats.net" \
    "ADMIN_EMAIL=admin@nhl-stats.net" \
    "ADMIN_PASSWORD=$(openssl rand -base64 16)" \
    "WEBSITES_PORT=5267"

# Verify settings
az webapp config appsettings list \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME
```

### 3. Configure Database Connection

SQLite database stored in App Service file system:

```bash
# Create directory for database
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME
# In SSH:
mkdir -p /home/data
exit

# Or use Azure Storage for persistent volume (recommended)
```

### 4. Setup GitHub Actions Deployment

Edit `.github/workflows/backend.yml`:

```yaml
deploy:
  needs: build-and-test
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/download-artifact@v4
      with:
        name: backend-publish
        path: ./publish

    - uses: azure/login@v2
      with:
        client-id: ${{ secrets.AZURE_CLIENT_ID }}
        tenant-id: ${{ secrets.AZURE_TENANT_ID }}
        subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

    - uses: azure/webapps-deploy@v3
      with:
        app-name: ${{ secrets.AZURE_WEBAPP_NAME }}
        package: ./publish
```

### 5. Manual Backend Deployment

```bash
# Publish locally
cd backend
dotnet publish -c Release -o publish

# Deploy using Azure CLI
az webapp up \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --location eastus \
  --sku FREE \
  --runtime "DOTNETCORE|10.0"

# Or deploy specific artifact
az swa deploy \
  --app-name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --source-location ./publish
```

### Verify Backend Deployment

```bash
# Get deployment logs
az webapp log tail \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP

# Test health endpoint
curl https://$APP_NAME.azurewebsites.net/health

# Expected response:
# {"status":"Healthy"}
```

## Frontend Deployment (Azure Static Web Apps)

### 1. Create Storage Account

```bash
STORAGE_ACCOUNT="nhlstatsapp"
RESOURCE_GROUP="nhl-stats-rg"

az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location eastus \
  --sku Standard_LRS
```

### 2. Create Static Web App

```bash
STATIC_APP_NAME="nhl-stats-web"

az staticwebapp create \
  --name $STATIC_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --location eastus \
  --source https://github.com/username/nhl-stats-2.0 \
  --branch main \
  --app-location "frontend/dist" \
  --build-script "npm run build" \
  --repository-token $GITHUB_PAT

# Note: Requires GitHub Personal Access Token (PAT)
```

### 3. Configure Static Web App

Create `frontend/staticwebapp.config.json`:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html"
  },
  "routes": [
    {
      "route": "/api/*",
      "rewrite": "https://nhl-stats-api.azurewebsites.net/api/*"
    }
  ],
  "responseOverrides": {
    "404": {
      "rewrite": "/index.html"
    }
  }
}
```

### 4. Configure API Proxy

Update `frontend/vite.config.ts` for production:

```typescript
export default defineConfig({
  // ...
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5267',  // Dev only
        changeOrigin: true,
      },
    },
  },
});
```

Frontend `src/services/apiClient.ts`:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});
```

### 5. Setup GitHub Actions Deployment for Frontend

Create `.github/workflows/frontend.yml`:

```yaml
name: Frontend CI/CD

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'
      - '.github/workflows/frontend.yml'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install dependencies
        working-directory: frontend
        run: npm install

      - name: Build
        working-directory: frontend
        env:
          VITE_API_BASE_URL: https://nhl-stats-api.azurewebsites.net
        run: npm run build

      - name: Deploy to Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "frontend/dist"
          build_location: "frontend"
          build_script: "npm run build"
          skip_app_build: false
```

### Verify Frontend Deployment

```bash
# Get deployment URL
az staticwebapp show \
  --name $STATIC_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "defaultHostname" -o tsv

# Should output: nhl-stats-web.azurestaticapps.net
# Visit: https://nhl-stats-web.azurestaticapps.net
```

## Database Management

### Backup SQLite Database

```bash
# SSH into App Service
az webapp ssh \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP

# In SSH terminal:
sqlite3 /home/data/nhlstats.db ".backup '/home/backup/nhlstats.backup'"
exit

# Download backup
az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --src /path/to/backup.zip
```

### Run Migrations in Production

Migrations run automatically on app startup (via `Program.cs`).

To manually run:

```bash
# SSH into App Service
az webapp ssh \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP

# In SSH:
dotnet NHLStats.Api.dll # Runs migrations and seeding
```

## Environment Configuration

### Backend Environment Variables (App Settings)

```
Jwt__Secret=<cryptographically-strong-key>
Jwt__Issuer=NHLStats
Jwt__Audience=NHLStatsClient
Jwt__ExpiryMinutes=60
AllowedOrigins=https://frontend.nhl-stats.net,https://app.nhl-stats.net
ADMIN_EMAIL=admin@nhl-stats.net
ADMIN_PASSWORD=<secure-password>
ASPNETCORE_ENVIRONMENT=Production
WEBSITES_PORT=5267
```

### Frontend Environment Variables (Build time)

```bash
# Set in GitHub Actions workflow or build command
export VITE_API_BASE_URL=https://nhl-stats-api.azurewebsites.net
npm run build
```

## Monitoring & Logging

### Application Insights

```bash
# Create Application Insights instance
az monitor app-insights component create \
  --app $APP_NAME \
  --location eastus \
  --resource-group $RESOURCE_GROUP

# Get instrumentation key
az monitor app-insights component show \
  --app $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query instrumentationKey -o tsv

# Set in App Service
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings "APPINSIGHTS_INSTRUMENTATIONKEY=<key>"
```

### View Logs

```bash
# Real-time logs
az webapp log tail \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP

# Download log files
az webapp log download \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --log-file logs.zip
```

## SSL/HTTPS Certificate

```bash
# Add custom domain
az webapp config hostname add \
  --resource-group $RESOURCE_GROUP \
  --webapp-name $APP_NAME \
  --hostname api.nhl-stats.net

# Create managed SSL certificate
az webapp config ssl bind \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --certificate-thumbprint <thumbprint> \
  --ssl-type SNI

# Or use Azure App Service Managed Certificate (free)
az webapp config ssl create \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --certificate-name $APP_NAME
```

## Cost Optimization

### Development

- **App Service Plan**: FREE tier (~$0/month)
- **Static Web Apps**: FREE tier for first 1 GB bandwidth (~$0/month)
- **Database**: SQLite (included, no extra cost)

### Production

- **App Service Plan**: Standard B1 (~$12/month) for small workload
- **Static Web Apps**: Standard (~$9/month)
- **Database**: SQLite backups and storage (~$0-$5/month depending on retention)
- **Total**: ~$36-71/month

**Cost reduction strategies:**
- Use App Service with Auto-scale (disable if low traffic)
- Archive old seasons to separate storage
- Use CDN for static assets
- Monitor resource usage with Azure Cost Analysis

## Scaling

### Horizontal Scaling (App Service)

```bash
# Scale out (add instances)
az appservice plan update \
  --name $PLAN_NAME \
  --resource-group $RESOURCE_GROUP \
  --sku B2  # Upgraded plan
  --number-of-workers 3

# Monitor traffic and auto-scale
az monitor autoscale create \
  --resource-group $RESOURCE_GROUP \
  --resource-name $APP_NAME \
  --resource-type "Microsoft.Web/sites" \
  --min-count 1 \
  --max-count 5 \
  --resource-group-name $RESOURCE_GROUP
```

### Database Reliability (SQLite)

For SQLite in production:

- Keep a single writer instance.
- Store the DB in persistent storage (`/home/data/nhlstats.db` on Linux App Service).
- Run scheduled backups to Blob Storage.

## Rollback Deployment

```bash
# List deployment slots
az webapp deployment slot list \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME

# Swap to previous version
az webapp deployment slot swap \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --slot staging

# Or redeploy previous artifact
az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --src previous-version.zip
```

## Zero-Downtime Deployment

Use App Service deployment slots:

```bash
# Create staging slot
az webapp deployment slot create \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --slot staging

# Deploy to staging
az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --slot staging \
  --src publish.zip

# Test staging
curl https://$APP_NAME-staging.azurewebsites.net/health

# Swap to prod when ready
az webapp deployment slot swap \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --slot staging
```

## Troubleshooting Deployments

### App Service won't start

```bash
# Check logs
az webapp log tail \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP

# Common issues:
# - Database migration failed
# - Missing environment variables
# - Incorrect runtime version
# - Port binding issue

# Solutions:
# Set ASPNETCORE_ENVIRONMENT=Development to see detailed errors
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings "ASPNETCORE_ENVIRONMENT=Development"
```

### Static Web App shows 404

```bash
# Verify staticwebapp.config.json exists
# Rebuild frontend
cd frontend
npm run build

# Check dist/ folder has index.html
ls -la dist/index.html

# Redeploy
az swa deploy --app-name $STATIC_APP_NAME
```

### API calls returning 401

```bash
# Verify JWT configuration
az webapp config appsettings list \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP | grep -i jwt

# Verify CORS AllowedOrigins includes frontend URL
# Restart app service
az webapp restart \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME
```

## Domain Setup

### Custom Domain DNS

1. **Point domain to Azure:**
   ```
   api.nhl-stats.net → nhl-stats-api.azurewebsites.net
   app.nhl-stats.net → nhl-stats-web.azurestaticapps.net
   ```

2. **Add DNS records (in your registrar):**
   ```
   Type: CNAME
   Name: api
   Value: nhl-stats-api.azurewebsites.net
   
   Type: CNAME
   Name: app
   Value: nhl-stats-web.azurestaticapps.net
   ```

3. **Verify in Azure:**
   ```bash
   az webapp config hostname add \
     --resource-group $RESOURCE_GROUP \
     --webapp-name $APP_NAME \
     --hostname api.nhl-stats.net
   ```

## Security Hardening

- [ ] Enable HTTPS redirect
- [ ] Set strong CORS policy
- [ ] Rotate JWT secret
- [ ] Enable Azure DDoS Protection
- [ ] Enable Azure Firewall
- [ ] Implement Web Application Firewall (WAF)
- [ ] Audit logging enabled
- [ ] Database backups enabled
- [ ] Secrets in Key Vault (not env vars)

See [ENVIRONMENT.md](ENVIRONMENT.md) for more security details.

Last Updated: March 2026
