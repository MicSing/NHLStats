#!/usr/bin/env bash
set -euo pipefail

# Usage:
#  ./create_azure_sql.sh local
#  ./create_azure_sql.sh azure --resource-group nhlstats-rg-dev --location eastus --server-name nhlstats-sql-dev --admin-user nhlstats-sqladmin --admin-password 'P@ssw0rd!'

MODE=${1:-local}

if [ "$MODE" = "local" ]; then
  # Local, no-cost: run SQL Server in Docker with universal names
  DB_NAME=${2:-nhlstats-db}
  SA_PASSWORD=${3:-Your_password123}

  echo "Starting local SQL Server container (no cost)..."
  docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=${SA_PASSWORD}" -p 1433:1433 --name nhlstats-sql -d mcr.microsoft.com/mssql/server:2022-latest

  echo
  echo "Local SQL Server started as container 'nhlstats-sql'."
  echo "Example export command to set connection string locally (bash):"
  echo
  echo "export ConnectionStrings__DefaultConnection=\"Server=localhost,1433;Database=${DB_NAME};User Id=sa;Password=${SA_PASSWORD};TrustServerCertificate=True;\""
  echo
  echo "You can now run migrations:"
  echo "  cd backend && dotnet ef database update --project src/NHLStats.Domain --startup-project src/NHLStats.Api"
  exit 0
fi

if [ "$MODE" = "azure" ]; then
  # Defaults using universal names
  shift
  RESOURCE_GROUP=nhlstats-rg-dev
  LOCATION=eastus
  SERVER_NAME=nhlstats-sql-dev
  ADMIN_USER=nhlstats-sqladmin
  ADMIN_PASSWORD='YourStrongPasswordHere!'
  DB_NAME=nhlstats-db

  while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
      --resource-group)
        RESOURCE_GROUP="$2"; shift; shift;;
      --location)
        LOCATION="$2"; shift; shift;;
      --server-name)
        SERVER_NAME="$2"; shift; shift;;
      --admin-user)
        ADMIN_USER="$2"; shift; shift;;
      --admin-password)
        ADMIN_PASSWORD="$2"; shift; shift;;
      --db-name)
        DB_NAME="$2"; shift; shift;;
      *) echo "Unknown option: $1"; exit 1;;
    esac
  done

  echo "Creating resource group $RESOURCE_GROUP in $LOCATION..."
  az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

  echo "Creating SQL server $SERVER_NAME..."
  az sql server create --name "$SERVER_NAME" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --admin-user "$ADMIN_USER" --admin-password "$ADMIN_PASSWORD"

  echo "Creating database $DB_NAME..."
  az sql db create --resource-group "$RESOURCE_GROUP" --server "$SERVER_NAME" --name "$DB_NAME" --service-objective S0

  MY_IP=$(curl -s https://ipinfo.io/ip)
  echo "Adding firewall rule for current IP: $MY_IP"
  az sql server firewall-rule create --resource-group "$RESOURCE_GROUP" --server "$SERVER_NAME" -n AllowMyIP --start-ip-address "$MY_IP" --end-ip-address "$MY_IP"

  CONN="Server=tcp:${SERVER_NAME}.database.windows.net,1433;Initial Catalog=${DB_NAME};Persist Security Info=False;User ID=${ADMIN_USER};Password=${ADMIN_PASSWORD};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

  echo
  echo "Azure SQL created. Example export command to set connection string locally (bash):"
  echo
  echo "export ConnectionStrings__DefaultConnection=\"$CONN\""
  echo
  echo "You can now run migrations:"
  echo "  cd backend && dotnet ef database update --project src/NHLStats.Domain --startup-project src/NHLStats.Api"
  exit 0
fi

echo "Unknown mode: $MODE"
echo "Usage: $0 local [db-name] [sa-password]  OR  $0 azure [--resource-group <rg>] [--location <loc>] [--server-name <name>] [--admin-user <user>] [--admin-password <pwd>]"
exit 1
