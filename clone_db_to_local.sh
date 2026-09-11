#!/bin/bash
set -e

# Ensure Docker is in PATH if installed in standard Mac locations
if ! command -v docker &> /dev/null; then
  export PATH="$HOME/.docker/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"
fi

LOCAL_CONN_STR="Server=localhost,1433;Database=sqldb-nhlstats;User Id=sa;Password=LocalPass123!;TrustServerCertificate=True;Encrypt=False;"

echo "=== 1. Spúšťam SQL Server v Dockeri ==="
docker compose up -d db

echo "Čakám na inicializáciu SQL Servera..."
sleep 5

BACKUP_DIR="$1"
if [ -z "$BACKUP_DIR" ]; then
  echo "=== 2. Exportujem dáta z produkčnej Azure databázy ==="
  ./backup_database.sh
  # Najdi najnovsi backup priecinok
  BACKUP_DIR=$(ls -td db_backups/backup_* 2>/dev/null | head -n 1)
fi

if [ -z "$BACKUP_DIR" ] || [ ! -d "$BACKUP_DIR" ]; then
  echo "Chyba: Nepodarilo sa nájsť zálohu databázy v db_backups/"
  exit 1
fi

echo "Používam zálohu z: $BACKUP_DIR"

echo "=== 3. Aplikujem EF Core migrácie na lokálnu databázu ==="
dotnet ef database update -s backend/src/NHLStats.Api -p backend/src/NHLStats.Domain --connection "$LOCAL_CONN_STR"

echo "=== 4. Importujem dáta do lokálnej databázy ==="
dotnet run --project backend/scripts/DataImporter/DataImporter.csproj -- "$BACKUP_DIR" "$LOCAL_CONN_STR"

echo "=== 5. Nastavujem lokálny ConnectionStrings:DefaultConnection vo user-secrets ==="
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "$LOCAL_CONN_STR" --project backend/src/NHLStats.Api

echo "=== Databáza bola úspešne naklonovaná do lokálneho Dockeru! ==="
