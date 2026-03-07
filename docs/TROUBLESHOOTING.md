# Troubleshooting

Solutions to common problems in NHL Stats 2.0 development and deployment.

## Backend Development Issues

### Port 5267 Already in Use

**Symptom:** 
```
System.IO.IOException: Failed to bind to address http://127.0.0.1:5267
```

**Solutions:**

```bash
# Find process using port
lsof -i :5267

# Kill process
kill -9 <PID>

# Or specify different port
dotnet run --project src/NHLStats.Api -- --urls http://localhost:5268
```

**For Windows:**
```powershell
netstat -ano | findstr :5267
taskkill /PID <PID> /F
```

### Database Connection Failed

**Symptom:**
```
System.Data.SQLite.SQLiteException (0x80004005): database is locked
SqliteException: SQLite Error 5: 'database is locked'.
```

**Causes & Solutions:**

1. **Database locked by another process:**
   ```bash
   # Restart the app
   # Kill test runners
   pkill -f "dotnet test"
   ```

2. **Corrupted database:**
   ```bash
   # Remove and let it regenerate
   rm ~/data/nhlstats.db
   dotnet run --project src/NHLStats.Api
   # Will auto-create and migrate
   ```

3. **Windows: File in use by Explorer:**
   - Close file browser window if it's showing the database
   - Try restarting

### Migration Issues

**Symptom:**
```
System.InvalidOperationException: The migration 'AddNewTable' has not been applied to the database.
```

**Solutions:**

```bash
# List all migrations
dotnet ef migrations list \
  --project src/NHLStats.Domain \
  --startup-project src/NHLStats.Api

# Remove last migration (if not applied yet)
dotnet ef migrations remove \
  --project src/NHLStats.Domain \
  --startup-project src/NHLStats.Api

# Reapply migrations
dotnet ef database update \
  --project src/NHLStats.Domain \
  --startup-project src/NHLStats.Api

# Start from scratch
dotnet ef database drop --force \
  --project src/NHLStats.Domain \
  --startup-project src/NHLStats.Api

dotnet ef database update \
  --project src/NHLStats.Domain \
  --startup-project src/NHLStats.Api
```

### Tests Failing: "No database"

**Symptom:**
```
System.InvalidOperationException: A DbContext instance cannot be used
```

**Solution:** 
Ensure `CustomWebApplicationFactory` configures in-memory SQLite:

```csharp
// In CustomWebApplicationFactory.cs
services.AddDbContext<NhlStatsDbContext>(options =>
{
    options.UseSqlite("Data Source=:memory:");
});

var sp = services.BuildServiceProvider();
using var scope = sp.CreateScope();
var dbContext = scope.ServiceProvider.GetRequiredService<NhlStatsDbContext>();
dbContext.Database.EnsureCreated();  // This is crucial
```

### EF Core Model Changes Not Reflecting

**Symptom:** Added a property to an Entity but it's not in the database.

**Solution:**

1. **Create migration:**
   ```bash
   dotnet ef migrations add AddNewProperty \
     --project src/NHLStats.Domain \
     --startup-project src/NHLStats.Api
   ```

2. **Apply migration:**
   ```bash
   dotnet ef database update \
     --project src/NHLStats.Domain \
     --startup-project src/NHLStats.Api
   ```

3. **Verify:**
   ```bash
   sqlite3 ~/data/nhlstats.db ".schema Users"
   ```

### "UseSetting" in Tests Not Working

**Symptom:**
```
ADMIN_EMAIL from environment variable, not test settings
```

**Solution:**

In test code, set before building factory:

```csharp
public class LoginTests : IAsyncLifetime
{
    private CustomWebApplicationFactory _factory;

    public async Task InitializeAsync()
    {
        // Set test config before factory creation
        _factory = new CustomWebApplicationFactory();
        var httpClient = _factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("ADMIN_EMAIL", "testadmin@test.com");
            builder.UseSetting("ADMIN_PASSWORD", "TestPass123");
        }).CreateClient();
    }
}
```

## Frontend Development Issues

### Port 5173 Already in Use

**Symptom:**
```
Port 5173 is in use.
```

**Solutions:**

```bash
# Kill process using port
lsof -i :5173
kill -9 <PID>

# Or use different port
npm run dev -- --port 5174
```

### Module Not Found Errors

**Symptom:**
```
Module not found: Error: Can't resolve './Utils'
```

**Causes & Solutions:**

1. **Case sensitivity (macOS/Linux):**
   ```typescript
   // ✗ Wrong case
   import { helper } from './utils/helper';  // File is Utils

   // ✓ Correct
   import { helper } from './Utils/helper';
   ```

2. **Missing file:**
   ```bash
   # Check file exists
   ls -la src/services/apiClient.ts
   
   # If missing, check import path
   grep -r "apiClient" src/
   ```

3. **Missing dependency:**
   ```bash
   npm install
   npm list  # See installed packages
   ```

### API Calls returning 404

**Symptom:**
```
GET http://localhost:5173/api/seasons 404 (Not Found)
```

**Causes & Solutions:**

1. **Backend not running:**
   ```bash
   # Check backend
   curl http://localhost:5267/health
   
   # If fails, start backend
   cd backend && dotnet run --project src/NHLStats.Api
   ```

2. **Proxy not configured:**
   Check `frontend/vite.config.ts`:
   ```typescript
   server: {
     proxy: {
       '/api': {
         target: 'http://localhost:5267',  ✓ Must match backend port
         changeOrigin: true,
       },
     },
   }
   ```

3. **Endpoint doesn't exist:**
   ```bash
   # List available endpoints
   curl http://localhost:5267/openapi/v1.json
   
   # Or check swagger UI
   # (if enabled)
   ```

### CORS Errors in Browser

**Symptom:**
```
Access to XMLHttpRequest blocked by CORS policy
Origin 'http://localhost:5173' is not allowed by Access-Control-Allow-Origin
```

**Causes & Solutions:**

1. **AllowedOrigins not set:**
   ```bash
   # In backend .env or appsettings
   export AllowedOrigins="http://localhost:5173"
   
   # Or in appsettings.Development.json
   {
     "AllowedOrigins": "http://localhost:5173"
   }
   ```

2. **Backend not restarted after config change:**
   ```bash
   # Restart backend
   Ctrl+C
   dotnet run --project src/NHLStats.Api
   ```

3. **Frontend making request to wrong URL:**
   ```typescript
   // ✗ Wrong: direct to backend port
   const response = await fetch('http://localhost:5267/api/seasons');
   
   // ✓ Correct: use vite proxy
   const response = await fetch('/api/seasons');
   // Vite dev server proxies to :5267
   ```

### Tests Failing: "Can't find handler"

**Symptom:**
```
[MSW] Warning: captured a request without a matching request handler:
POST http://localhost:3000/api/auth/login
```

**Solution:**

Add handler to `src/mocks/handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ token: 'test-token' });
  }),
];
```

### React Testing Library: "Unable to find element"

**Symptom:**
```
Unable to find a label with the text of /email/i
```

**Causes & Solutions:**

1. **Label text doesn't match:**
   ```typescript
   // In component:
   <label>Email Address</label>  // Has "Address"
   
   // In test:
   screen.getByLabelText(/email/i)  // ✗ Doesn't match
   screen.getByLabelText(/email address/i)  // ✓ Matches
   ```

2. **Element not rendered:**
   ```typescript
   // ✗ Element not yet rendered
   screen.getByLabelText(/email/i)
   
   // ✓ Wait for element
   await screen.findByLabelText(/email/i)
   ```

3. **Wrong query method:**
   ```typescript
   // ✓ Recommended: Use semantic queries
   screen.getByRole('textbox', { name: /email/i })
   screen.getByRole('button', { name: /submit/i })
   
   // ✗ Avoid: Implementation details
   screen.getByTestId('email-input')
   ```

### TypeScript Errors: "Cannot find module"

**Symptom:**
```
Cannot find module '@testing-library/react' or its declarations
```

**Solutions:**

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Or install missing package
npm install --save-dev @testing-library/react

# Rebuild TypeScript
npm run build
```

### Vitest Tests Not Running

**Symptom:**
```
No tests found
```

**Causes & Solutions:**

1. **Test file not named correctly:**
   ```bash
   # Vitest looks for *.test.ts, *.test.tsx, *.spec.ts, *.spec.tsx
   
   # ✗ Wrong
   UserForm.ts
   
   # ✓ Correct
   UserForm.test.tsx
   ```

2. **Test file in wrong location:**
   ```bash
   # Vitest finds tests if configured in vitest.config.ts
   
   # Check config
   cat frontend/vitest.config.ts
   ```

3. **No test functions:**
   ```typescript
   // ✗ No test
   import { render } from '@testing-library/react';
   
   // ✓ Has test
   import { render } from '@testing-library/react';
   
   it('should render', () => {
     render(<LoginPage />);
   });
   ```

### localStorage Errors in Tests

**Symptom:**
```
ReferenceError: localStorage is not defined
```

**Solution:**

Use JSDOM (already configured in `vitest.config.ts`):

```typescript
// vitest.config.ts should have
environment: 'jsdom'

// Or in test file at top:
/// <reference types="vitest/globals" />
```

## Deployment Issues

### Backend: "502 Bad Gateway"

**Symptom:**
```
HTTP 502 Bad Gateway when accessing API
```

**Causes & Solutions:**

1. **App Service hasn't started:**
   ```bash
   # Wait 1-2 minutes after deployment
   # Check status
   az webapp show --name $APP_NAME --resource-group $RG --query "state"
   ```

2. **Runtime not installed:**
   ```bash
   # Verify runtime
   az webapp show --name $APP_NAME --resource-group $RG --query "linuxFxVersion"
   
   # Should be: DOTNETCORE|10.0
   ```

3. **Missing environment variables:**
   ```bash
   # Check settings
   az webapp config appsettings list --name $APP_NAME --resource-group $RG
   
   # Ensure has:
   # - Jwt__Secret
   # - ASPNETCORE_ENVIRONMENT=Production
   ```

4. **Database migration failed:**
   ```bash
   # Check logs
   az webapp log tail --name $APP_NAME --resource-group $RG
   
   # Look for migration errors
   ```

**Fix:**

```bash
# Restart app
az webapp restart --name $APP_NAME --resource-group $RG

# Or redeploy
az webapp up --name $APP_NAME --resource-group $RG
```

### Frontend: Blank Page

**Symptom:**
```
Blank page, no errors in console
```

**Causes & Solutions:**

1. **React failed to render:**
   ```bash
   # Check browser console (F12)
   # Look for JavaScript errors
   ```

2. **index.html not deployed:**
   ```bash
   # Verify deployment
   az storage blob list --account-name $SA --container web --auth-mode login
   
   # Should contain index.html
   ```

3. **API calls failing silently:**
   ```typescript
   // Add error handling
   try {
     const response = await fetch('/api/seasons');
     if (!response.ok) throw new Error('API failed');
     const data = await response.json();
   } catch (error) {
     console.error('Failed to load seasons:', error);
   }
   ```

### Frontend: 404 on Routes

**Symptom:**
```
GET /dashboard returns 404
```

**Cause:** Single-Page App (SPA) routing not configured

**Solution:**

Add to `staticwebapp.config.json`:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html"
  },
  "responseOverrides": {
    "404": {
      "rewrite": "/index.html"
    }
  }
}
```

Then redeploy:

```bash
az swa deploy --app-name $STATIC_APP_NAME
```

### JWT Token Expiring Too Fast

**Symptom:**
```
401 Unauthorized after a few minutes
```

**Cause:** JWT expiry set too short

**Solution:**

Increase expiry in App Settings:

```bash
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RG \
  --settings "Jwt__ExpiryMinutes=1440"  # 24 hours
```

### Database Lock on Azure

**Symptom:**
```
SQLiteException: database is locked
```

**Causes & Solutions:**

1. **Multiple App Service instances accessing same database:**
   ```bash
   # Check instance count
   az appservice plan show --name $PLAN --resource-group $RG
   
   # Reduce to 1 instance for SQLite
   az appservice plan update --name $PLAN --resource-group $RG --number-of-workers 1
   ```

2. **Migrate to Azure SQL Database:**
   ```csharp
   // In Program.cs
   options.UseSqlServer(sqlServerConn);  // Instead of SQLite
   ```

### Deployment Timeout

**Symptom:**
```
Deployment exceeded max duration
```

**Solutions:**

```bash
# Increase timeout in GitHub Actions
# .github/workflows/backend.yml

- name: Deploy to Azure Web App
  uses: azure/webapps-deploy@v3
  with:
    app-name: ${{ secrets.AZURE_WEBAPP_NAME }}
    package: ./publish
    timeout-minutes: 15  # Increase from default
```

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `dotnet: command not found` | .NET not installed | Install from dotnet.microsoft.com |
| `npm: command not found` | Node.js not installed | Install from nodejs.org |
| `error TS2307: Cannot find module` | Missing @types package | `npm install --save-dev @types/package-name` |
| `ReferenceError: $ is not defined` | jQuery not loaded | Ensure jQuery in script tag |
| `Unexpected token <` | HTML response instead of JSON | Check API endpoint returns JSON |
| `ENOENT: no such file or directory` | File missing | Check relative paths |
| `403 Forbidden` | Not authorized | Check auth token, role |
| `Invalid JWT` | Token expired/malformed | Generate new token |
| `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | SSL certificate issue | Update Node certificates |

## Getting More Help

### Debug Mode

**Backend:**
```bash
export ASPNETCORE_ENVIRONMENT=Development
dotnet run --project src/NHLStats.Api

# More verbose output, exception details
```

**Frontend:**
```bash
VITE_LOG_LEVEL=debug npm run dev

# More console logs
```

### Inspect Network Traffic

**Browser DevTools:**
1. Open DevTools (F12)
2. Go to Network tab
3. Make request and inspect

**Command line:**
```bash
# View all HTTP requests
curl -v http://localhost:5267/api/seasons

# Verbose details
curl -vvv http://localhost:5267/api/seasons

# With authentication
curl -H "Authorization: Bearer $TOKEN" http://localhost:5267/api/seasons
```

### Database Inspection

```bash
# SQLite command line
sqlite3 ~/data/nhlstats.db

# List tables
.tables

# Show schema for table
.schema Users

# Run query
SELECT * FROM Seasons;

# Exit
.quit
```

### Logs

**Backend logs:**
```bash
# Docker
docker logs container_name

# Azure App Service
az webapp log tail --name $APP_NAME --resource-group $RG

# Log file
tail -f /var/log/app/trace.log
```

**Frontend console:**
```javascript
// Open browser console (F12)
console.log, console.error, console.warn
```

### Issue Reproduction

When reporting an issue:

1. **Describe steps to reproduce**
   - Exactly what you did
   - What happened
   - What should have happened

2. **Include error message**
   - Full error text
   - Stack trace if available

3. **Include environment**
   - OS and version
   - .NET version
   - Node version
   - Browser (for frontend)

4. **Include relevant files/code**
   - Code snippet
   - Configuration from logs
   - Test case to reproduce

5. **Include attempts to fix**
   - What you've already tried
   - What worked/didn't work

## Resources

- **Microsoft Docs**: https://docs.microsoft.com
- **Entity Framework**: https://docs.microsoft.com/ef
- **React**: https://react.dev
- **Azure CLI**: https://learn.microsoft.com/cli/azure
- **SQLite**: https://www.sqlite.org
- **GitHub Actions**: https://docs.github.com/actions

Last Updated: March 2026
