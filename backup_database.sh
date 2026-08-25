#!/bin/bash
set -e

TIMESTAMP=$(date +"%Y_%m_%d_%H%M%S")
BACKUP_DIR="db_backups/backup_${TIMESTAMP}"

# Read connection string: 1) from argument, 2) from env var, 3) from dotnet user-secrets
if [ -n "$1" ]; then
  CONN_STR="$1"
elif [ -n "$ConnectionStrings__DefaultConnection" ]; then
  CONN_STR="$ConnectionStrings__DefaultConnection"
else
  CONN_STR=$(dotnet user-secrets list --project backend/src/NHLStats.Api 2>/dev/null | grep "ConnectionStrings:DefaultConnection = " | sed 's/^ConnectionStrings:DefaultConnection = //' || true)
fi

if [ -z "$CONN_STR" ] || [[ "$CONN_STR" == *"YOUR_DB_PASSWORD"* ]]; then
  echo "Chyba: Nie je nastavený connection string s heslom."
  echo "Použitie: ./backup_database.sh \"<connection_string>\""
  echo "alebo nastavte: dotnet user-secrets set \"ConnectionStrings:DefaultConnection\" \"...\" --project backend/src/NHLStats.Api"
  exit 1
fi

echo "=== Spúšťam zálohu databázy do ${BACKUP_DIR} ==="
dotnet run --project backend/scripts/DataExporter/DataExporter.csproj -- "$CONN_STR" "$BACKUP_DIR"

echo "=== Záloha úspešne vytvorená v ${BACKUP_DIR} ==="
