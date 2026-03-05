#!/bin/bash
set -e

APP_NAME="t-sn-nhlstats-api"
SCM_HOST="${APP_NAME}-fbauashxadh8d4a7.scm.polandcentral-01.azurewebsites.net"
DEST=~/Downloads

echo "Fetching Azure access token..."
TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)

OUTPUT="$DEST/nhlstats-$(date +%F-%H%M%S).db"
echo "Downloading DB to $OUTPUT ..."
curl -f -H "Authorization: Bearer $TOKEN" \
  "https://$SCM_HOST/api/vfs/data/nhlstats.db" \
  -o "$OUTPUT"

echo "Done: $OUTPUT"
