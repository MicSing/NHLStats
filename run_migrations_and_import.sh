#!/bin/bash
set -e

echo "=== Inštalujem dotnet-ef CLI nástroj ==="
dotnet tool install --global dotnet-ef || true
export PATH="$PATH:$HOME/.dotnet/tools"

echo "=== Obnovujem NuGet balíčky ==="
dotnet restore backend/NHLStats.sln

CONN_STR="Server=tcp:sql-nhlstats-db-9201.database.windows.net,1433;Initial Catalog=sqldb-nhlstats;Persist Security Info=False;User ID=nhladmin;Password=<AZURE_SQL_PASSWORD>;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
export ConnectionStrings__DefaultConnection="$CONN_STR"

echo "=== Čistím databázu (Odstraňujem všetky tabuľky z nevydareného pokusu) ==="
dotnet run --project backend/scripts/DropTables/DropTables.csproj -- "$CONN_STR"

echo "=== Odstraňujem staré SQLite migrácie ==="
rm -rf backend/src/NHLStats.Domain/Migrations

echo "=== Vytváram novú SQL Server migráciu ==="
dotnet ef migrations add InitialCreate -s backend/src/NHLStats.Api -p backend/src/NHLStats.Domain

echo "=== Aplikujem migráciu na Azure SQL ==="
dotnet ef database update -s backend/src/NHLStats.Api -p backend/src/NHLStats.Domain

echo "=== Spúšťam import dát (DataImporter) ==="
dotnet run --project backend/scripts/DataImporter/DataImporter.csproj -- "db_backups/json_export" "$CONN_STR"

echo "=== Hotovo! ==="
