# Azure SQL — Local Development Setup

This guide shows two supported local development flows and a convention for universal resource names.

Goals
- Use a consistent naming convention for resource group, SQL server and database.
- Default to a no-cost local development setup (Dockerized SQL Server) so you can start quickly without cloud expenses.
- Provide an option to provision Azure SQL when you want a cloud dev database.

Naming conventions (defaults)
- Resource group: `nhlstats-rg-dev`
- SQL Server (Azure): `nhlstats-sql-dev`
- Database: `nhlstats-db`
- Admin user: `nhlstats-sqladmin`

Important: Do NOT check-in real credentials. Use environment variables or Azure Key Vault for secrets.

Prerequisites
- Docker for local no-cost setup (recommended)
- Azure CLI and an Azure subscription if you want the cloud option (`az login`)

Local (no-cost) — recommended for daily development

This starts a local SQL Server container and prints the connection string to export into your environment.

```bash
cd backend
./scripts/create_azure_sql.sh local

# example export (script prints the exact command)
export ConnectionStrings__DefaultConnection="Server=localhost,1433;Database=nhlstats-db;User Id=sa;Password=Your_password123;TrustServerCertificate=True;"

# apply migrations
dotnet ef database update --project src/NHLStats.Domain --startup-project src/NHLStats.Api
```

Azure (cloud) — optional, incurs cost

Use these defaults to keep resource names universal. The helper script can provision resources for you.

```bash
cd backend
./scripts/create_azure_sql.sh azure --resource-group nhlstats-rg-dev --location eastus --server-name nhlstats-sql-dev --admin-user nhlstats-sqladmin --admin-password 'YourStrongPasswordHere!'

# script prints an export command; run that to set the connection string
export ConnectionStrings__DefaultConnection="Server=tcp:nhlstats-sql-dev.database.windows.net,1433;Initial Catalog=nhlstats-db;Persist Security Info=False;User ID=nhlstats-sqladmin;Password=...;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

dotnet ef database update --project src/NHLStats.Domain --startup-project src/NHLStats.Api
```

Notes & tips
- The repository includes `./scripts/create_azure_sql.sh` which defaults to `local` (no-cost) if you run `./scripts/create_azure_sql.sh local`.
- Use the `azure` option only when you want a cloud-hosted dev DB and accept any associated costs.
- For CI/CD and production use, prefer managed identities or Key Vault to store connection strings.

Would you like me to also add a GitHub Actions workflow that runs `dotnet ef database update` against the Azure database (using a service principal), or a Bicep template to provision resources declaratively?
