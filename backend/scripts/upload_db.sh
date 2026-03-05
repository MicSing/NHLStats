#!/bin/bash
set -e

if [[ -z "$1" ]]; then
  echo "Usage: $0 <path-to-nhlstats.db>"
  exit 1
fi

LOCAL_DB="$1"

if [[ ! -f "$LOCAL_DB" ]]; then
  echo "Error: file not found: $LOCAL_DB"
  exit 1
fi

APP_NAME="t-sn-nhlstats-api"
RG="sn-nhlstats-rg"
SCM_HOST="${APP_NAME}-fbauashxadh8d4a7.scm.polandcentral-01.azurewebsites.net"

echo "Fetching Azure access token..."
TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)

echo "Stopping app..."
az webapp stop -g "$RG" -n "$APP_NAME"

echo "Uploading $LOCAL_DB to production..."
BODY_FILE=$(mktemp)
HTTP_STATUS=$(curl -s -o "$BODY_FILE" -w "%{http_code}" \
  -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "If-Match: *" \
  -H "X-CSRF-Token: 1" \
  -T "$LOCAL_DB" \
  "https://$SCM_HOST/api/vfs/data/nhlstats.db")

BODY=$(cat "$BODY_FILE")
rm -f "$BODY_FILE"

if [[ -n "$BODY" ]]; then
  echo "Server response: $BODY"
fi

echo "Starting app..."
az webapp start -g "$RG" -n "$APP_NAME"

if [[ "$HTTP_STATUS" == "200" || "$HTTP_STATUS" == "201" || "$HTTP_STATUS" == "204" ]]; then
  echo "Done. DB replaced successfully (HTTP $HTTP_STATUS)."
else
  echo "Warning: unexpected HTTP status $HTTP_STATUS — verify the upload manually."
  exit 1
fi
