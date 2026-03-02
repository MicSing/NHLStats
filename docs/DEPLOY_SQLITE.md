# Deploying NHLStats API with SQLite (single-instance)

This document describes a minimal approach to deploy the `NHLStats.Api` using SQLite as a single-instance demo database, and how to back up the DB to Azure Blob Storage.

Prerequisites
- Azure CLI installed and logged in: `az login`
- `dotnet` CLI installed
- `git` access to the repo
- (Optional) `gzip` and `curl` available locally

Overview
- Use Azure App Service (Free tier) for the API and Azure Static Web Apps for the frontend.
- Place the SQLite DB at the App Service persistent path (`/home/data/nhlstats.db` on Linux).
- Do not mount the app as a read-only package (avoid `WEBSITE_RUN_FROM_PACKAGE=1`).
- Periodically back up the DB file to Azure Blob Storage.

Steps — create resources

```bash
# Variables (customize)
RG=my-rg
LOCATION=westeurope
APP_PLAN=my-nhlstats-plan
APP_NAME=my-nhlstats-api
STORAGE_ACCOUNT=mynhlstatsstorage$RANDOM
CONTAINER=backups

# 1) Create resource group
az group create -n $RG -l $LOCATION

# 2) Create Storage account (for backups)
az storage account create -n $STORAGE_ACCOUNT -g $RG -l $LOCATION --sku Standard_LRS --kind StorageV2
az storage container create --name $CONTAINER --account-name $STORAGE_ACCOUNT

# 3) Create App Service plan (Free tier)
az appservice plan create -g $RG -n $APP_PLAN --sku F1 --is-linux

# 4) Create the Web App (Linux)
az webapp create -g $RG -p $APP_PLAN -n $APP_NAME --runtime "DOTNET|10.0"

# 5) Ensure app settings allow writable filesystem (disable run-from-package)
az webapp config appsettings set -g $RG -n $APP_NAME --settings WEBSITE_RUN_FROM_PACKAGE=0
```

Build & deploy the API

You can use GitHub Actions or deploy manually. Example manual flow:

```bash
# from repo root
cd backend/src/NHLStats.Api
# publish
dotnet publish -c Release -o ./publish
# create a zip package
cd publish
zip -r ../app.zip .
cd ../..
# deploy zip
az webapp deploy --resource-group $RG --name $APP_NAME --src-path backend/src/NHLStats.Api/app.zip
```

Notes on DB file handling
- The app's `Program.cs` places the SQLite DB at `$HOME/data/nhlstats.db` and creates the `data` folder at startup. This is the recommended path on App Service (persistent across restarts for that app instance).
- Ensure your deployment does not overwrite files under `/home/data`. If you include a DB file inside your package, it may overwrite the running DB on deploy.
- If you need to ship an initial DB, prefer adding seed logic that runs on first start rather than packaging the DB file.

Backup the SQLite DB (manual download + upload)

Use the Kudu VFS API to download the DB from the running app, then upload to the storage account. This can be run from your local machine.

1) Get publishing profile (contains user/password for Kudu)

```bash
az webapp deployment list-publishing-profiles -g $RG -n $APP_NAME --xml > publish.xml
# inspect publish.xml to find the <publishProfile> entry for "MSDeploy" or "FTP" and extract userName and userPWD
```

2) Download DB from Kudu VFS:

```bash
USER="<publish_user>"
PWD="<publish_password>"
APP=$APP_NAME
curl -u $USER:$PWD "https://$APP.scm.azurewebsites.net/api/vfs/home/data/nhlstats.db" -o nhlstats.db
```

3) Compress and upload to blob storage

```bash
gzip -c nhlstats.db > nhlstats.db.gz
# get storage connection string
AZ_CONN=$(az storage account show-connection-string -n $STORAGE_ACCOUNT -g $RG -o tsv)
az storage blob upload --connection-string "$AZ_CONN" --container-name $CONTAINER --name "nhlstats-$(date +%F-%H%M%S).db.gz" --file nhlstats.db.gz
```

Automating backups

- Add a GitHub Action or Azure DevOps pipeline that runs the above steps on a schedule (download via Kudu + upload to blob).
- Alternatively run a small background job in the App Service that uses the Azure Storage SDK and an app setting `AZURE_STORAGE_CONNECTION_STRING` to upload the DB periodically.

Restore

- Download the desired backup blob and upload it back to the app's `/home/data/nhlstats.db` via Kudu VFS (PUT). Be careful when restoring to a running instance — stop the app, upload file, then start it.

Security & cost notes

- Blob Storage has no unlimited free tier; however small backups are inexpensive (use Cool/Archive tiers and lifecycle rules).
- Protect the storage connection string and the app's publish credentials. Use Key Vault or pipeline secrets for automation.

Troubleshooting

- If the DB is not persisted after deploy, check `WEBSITE_RUN_FROM_PACKAGE` app setting and remove it or set it to `0`.
- If you see file permission issues, ensure your app writes to `/home` (Linux) or `D:\home` (Windows) locations.

---

If you want, I can add a GitHub Action workflow that:
- builds the API, deploys it, and
- runs a scheduled job to fetch the DB via Kudu and upload it to Blob Storage.

