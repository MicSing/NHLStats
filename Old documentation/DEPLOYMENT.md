# NHLStats Deployment Guide

Guide for deploying NHLStats to production and staging environments.

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Docker Deployment](#docker-deployment)
7. [Monitoring & Logging](#monitoring--logging)
8. [Backup & Recovery](#backup--recovery)
9. [Security Checklist](#security-checklist)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│              Load Balancer / CDN                │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
┌───────▼────────┐  ┌────────▼────────┐
│   Frontend     │  │   Backend API   │
│   (Static)     │  │   (.NET App)    │
│   Nginx/S3     │  │   App Service   │
└────────────────┘  └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   PostgreSQL    │
                    │   Database      │
                    └─────────────────┘
```

### Deployment Environments

| Environment | Purpose | URL Pattern |
|-------------|---------|-------------|
| **Development** | Local development | `http://localhost:3000` / `http://localhost:5000` |
| **Staging** | Pre-production testing | `https://staging.nhlstats.example.com` |
| **Production** | Live application | `https://nhlstats.example.com` |

---

## Environment Configuration

### Backend Configuration

#### appsettings.json (Base Configuration)

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.EntityFrameworkCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "EnableSwagger": false,
  "ConnectionStrings": {
    "Primary": ""
  }
}
```

#### appsettings.Production.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Warning",
      "Microsoft.AspNetCore": "Error"
    }
  },
  "EnableSwagger": false,
  "AllowedHosts": "nhlstats.example.com"
}
```

### Environment Variables

**Required for Production**:

```bash
# Database
export ConnectionStrings__Primary="Host=db.example.com;Database=nhlstats;Username=app_user;Password=<secure-password>"

# ASP.NET Core
export ASPNETCORE_ENVIRONMENT=Production
export ASPNETCORE_URLS="http://0.0.0.0:5000"

# Optional
export EnableSwagger=false
```

### Frontend Configuration

#### Production Environment File (`.env.production`)

```env
VITE_API_BASE_URL=https://api.nhlstats.example.com
VITE_APP_VERSION=1.0.0
VITE_ENABLE_ANALYTICS=true
```

#### Build-Time Variables

Set during build process:

```bash
export VITE_API_BASE_URL=https://api.nhlstats.example.com
npm run build
```

---

## Database Setup

### Production Database Requirements

- **PostgreSQL 14+**
- **Minimum Resources**: 2 vCPU, 4 GB RAM, 20 GB SSD
- **Recommended**: 4 vCPU, 8 GB RAM, 50 GB SSD
- **Backup**: Automated daily backups with 7-day retention

### Initial Setup

#### 1. Create Database and User

```sql
-- Connect as superuser
CREATE DATABASE nhlstats;

-- Create application user
CREATE USER app_user WITH PASSWORD '<secure-password>';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE nhlstats TO app_user;

-- Connect to nhlstats database
\c nhlstats

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO app_user;
```

#### 2. Apply Migrations

**Option A: Using SQL Scripts**

```bash
# Apply all migration scripts in order
for file in Backend/db/migrations/*.sql; do
  psql -U app_user -d nhlstats -f "$file"
done
```

**Option B: Using EF Core**

```bash
cd Backend/src/Api
dotnet ef database update --connection "Host=<db-host>;Database=nhlstats;Username=app_user;Password=<password>"
```

#### 3. Verify Schema

```bash
psql -U app_user -d nhlstats -c "\dt"
# Should list all tables: users, teams, season_phases, players, matches, etc.
```

### Database Connection String Formats

**Production (SSL)**:
```
Host=db.example.com;Database=nhlstats;Username=app_user;Password=<password>;SSL Mode=Require;Trust Server Certificate=false
```

**Staging**:
```
Host=staging-db.example.com;Database=nhlstats_staging;Username=app_user;Password=<password>
```

**Connection Pooling** (Recommended):
```
Host=db.example.com;Database=nhlstats;Username=app_user;Password=<password>;Pooling=true;Minimum Pool Size=5;Maximum Pool Size=20
```

---

## Backend Deployment

### Prerequisites

- **.NET 10.0 Runtime** installed on server
- **PostgreSQL** accessible from app server
- **Firewall** configured to allow traffic on port 5000 (or configured port)
- **SSL Certificate** for HTTPS (recommended)

### Deployment Steps

#### 1. Build Application

```bash
cd Backend/src/Api

# Restore dependencies
dotnet restore

# Build in Release mode
dotnet build --configuration Release

# Publish application
dotnet publish --configuration Release --output /app/publish
```

#### 2. Configure Systemd Service (Linux)

Create `/etc/systemd/system/nhlstats-api.service`:

```ini
[Unit]
Description=NHLStats API
After=network.target postgresql.service

[Service]
Type=notify
WorkingDirectory=/app/publish
ExecStart=/usr/bin/dotnet /app/publish/Api.dll
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=nhlstats-api
User=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=ASPNETCORE_URLS=http://0.0.0.0:5000
Environment=ConnectionStrings__Primary=Host=localhost;Database=nhlstats;Username=app_user;Password=<password>

[Install]
WantedBy=multi-user.target
```

#### 3. Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable nhlstats-api

# Start service
sudo systemctl start nhlstats-api

# Check status
sudo systemctl status nhlstats-api

# View logs
sudo journalctl -u nhlstats-api -f
```

#### 4. Configure Reverse Proxy (Nginx)

Create `/etc/nginx/sites-available/nhlstats-api`:

```nginx
upstream nhlstats_api {
    server localhost:5000;
}

server {
    listen 80;
    server_name api.nhlstats.example.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.nhlstats.example.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.nhlstats.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.nhlstats.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Proxy Configuration
    location / {
        proxy_pass http://nhlstats_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection keep-alive;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://nhlstats_api;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/nhlstats-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 5. Obtain SSL Certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d api.nhlstats.example.com
```

### Health Checks

```bash
# Check API health
curl https://api.nhlstats.example.com/health

# Expected response:
# {"status":"Healthy"}
```

---

## Frontend Deployment

### Build for Production

```bash
cd Frontend

# Install dependencies
npm ci --production=false

# Build application
npm run build
```

Output: `Frontend/dist/` directory containing static files

### Deployment Options

#### Option 1: Static File Hosting (S3 + CloudFront)

**AWS S3 Upload**:

```bash
# Install AWS CLI
aws configure

# Sync build to S3
aws s3 sync dist/ s3://nhlstats-frontend/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

**S3 Bucket Policy**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::nhlstats-frontend/*"
    }
  ]
}
```

#### Option 2: Nginx Static Hosting

**Nginx Configuration** (`/etc/nginx/sites-available/nhlstats-frontend`):

```nginx
server {
    listen 80;
    server_name nhlstats.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name nhlstats.example.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/nhlstats.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nhlstats.example.com/privkey.pem;
    
    root /var/www/nhlstats/dist;
    index index.html;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    
    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Deploy files:

```bash
sudo mkdir -p /var/www/nhlstats
sudo cp -r dist/* /var/www/nhlstats/
sudo chown -R www-data:www-data /var/www/nhlstats
sudo chmod -R 755 /var/www/nhlstats
```

---

## Docker Deployment

### Dockerfile for Backend

`Backend/Dockerfile`:

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files
COPY ["src/Api/Api.csproj", "src/Api/"]
COPY ["src/Application/Application.csproj", "src/Application/"]
COPY ["src/Domain/Domain.csproj", "src/Domain/"]

# Restore dependencies
RUN dotnet restore "src/Api/Api.csproj"

# Copy source code
COPY . .

# Build application
WORKDIR "/src/src/Api"
RUN dotnet build "Api.csproj" -c Release -o /app/build

# Publish application
FROM build AS publish
RUN dotnet publish "Api.csproj" -c Release -o /app/publish

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Expose port
EXPOSE 5000

# Set environment
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "Api.dll"]
```

### Dockerfile for Frontend

`Frontend/Dockerfile`:

```dockerfile
FROM node:18-alpine AS build
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production image with nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

`Frontend/nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Docker Compose

`docker-compose.yml`:

```yaml
version: '3.8'

services:
  db:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: nhlstats
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./Backend
      dockerfile: Dockerfile
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ConnectionStrings__Primary: "Host=db;Database=nhlstats;Username=app_user;Password=${DB_PASSWORD}"
    ports:
      - "5000:5000"
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  frontend:
    build:
      context: ./Frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
```

### Deploy with Docker Compose

```bash
# Set environment variables
export DB_PASSWORD=<secure-password>

# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Stop services
docker-compose down
```

---

## Monitoring & Logging

### Application Logging

#### Structured Logging Configuration

Update `appsettings.Production.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    },
    "Console": {
      "FormatterName": "json",
      "FormatterOptions": {
        "TimestampFormat": "yyyy-MM-dd'T'HH:mm:ss.fffK"
      }
    }
  }
}
```

#### Log Aggregation

**Option 1: File Logging + Log Rotation**

Install Serilog (planned):

```bash
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Sinks.File
```

**Option 2: Centralized Logging (ELK Stack, Datadog, etc.)**

### Health Monitoring

#### Health Check Endpoint

Already implemented: `GET /health`

**Uptime Monitoring**:
- Use services like Pingdom, UptimeRobot, or New Relic
- Configure to check `https://api.nhlstats.example.com/health` every 1-5 minutes
- Alert on failures

### Performance Monitoring

**Metrics to Track**:
- API response times
- Database query performance
- Error rates
- Request throughput
- Server CPU/Memory/Disk usage

**Tools** (Planned):
- Application Insights (Azure)
- Prometheus + Grafana
- Datadog

---

## Backup & Recovery

### Database Backups

#### Automated Daily Backups

```bash
#!/bin/bash
# /usr/local/bin/backup-nhlstats-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/nhlstats"
BACKUP_FILE="$BACKUP_DIR/nhlstats_$DATE.sql.gz"

mkdir -p "$BACKUP_DIR"

# Create backup
pg_dump -U app_user -h localhost nhlstats | gzip > "$BACKUP_FILE"

# Keep only last 7 days
find "$BACKUP_DIR" -name "nhlstats_*.sql.gz" -mtime +7 -delete

# Upload to S3 (optional)
aws s3 cp "$BACKUP_FILE" s3://nhlstats-backups/
```

#### Cron Job

```bash
# Add to crontab
sudo crontab -e

# Run daily at 2 AM
0 2 * * * /usr/local/bin/backup-nhlstats-db.sh
```

#### Restore from Backup

```bash
# Decompress and restore
gunzip -c /backups/nhlstats/nhlstats_20260301_020000.sql.gz | psql -U app_user -d nhlstats
```

### Application Backups

- **Source Code**: Stored in Git repository
- **Configuration**: Encrypted environment files in secure storage
- **Static Assets**: Frontend build artifacts

---

## Security Checklist

### Pre-Deployment Security

- [ ] All secrets stored in environment variables, not code
- [ ] HTTPS enforced on all endpoints
- [ ] Database connections use SSL
- [ ] Strong database passwords (16+ characters, alphanumeric + symbols)
- [ ] Firewall configured (allow only necessary ports)
- [ ] Security headers enabled (HSTS, CSP, X-Frame-Options, etc.)
- [ ] Swagger/OpenAPI disabled in production
- [ ] Debug mode disabled (`ASPNETCORE_ENVIRONMENT=Production`)
- [ ] CORS configured to allow only specific origins
- [ ] Rate limiting enabled (planned)
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (parameterized queries via EF Core)
- [ ] XSS protection (React auto-escapes, but verify custom HTML)

### Post-Deployment Security

- [ ] Regular security updates applied
- [ ] SSL certificates auto-renewed (Let's Encrypt)
- [ ] Access logs monitored for suspicious activity
- [ ] Database backups tested regularly
- [ ] Vulnerability scanning performed (npm audit, dotnet list package --vulnerable)
- [ ] Penetration testing (if applicable)

---

## Troubleshooting

### Application Won't Start

**Check service status**:
```bash
sudo systemctl status nhlstats-api
sudo journalctl -u nhlstats-api -n 50
```

**Common Issues**:
- Database connection failure → Check connection string and DB accessibility
- Port already in use → Change port or kill existing process
- Missing environment variables → Verify systemd service file

### Database Connection Issues

**Test connection**:
```bash
psql -U app_user -h <db-host> -d nhlstats -c "SELECT 1;"
```

**Check PostgreSQL logs**:
```bash
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### High CPU/Memory Usage

**Check resource usage**:
```bash
top
htop
```

**Database queries**:
```sql
-- Check long-running queries
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 seconds';
```

### SSL Certificate Issues

**Renew Let's Encrypt certificate**:
```bash
sudo certbot renew
sudo systemctl reload nginx
```

**Check certificate expiry**:
```bash
sudo certbot certificates
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Code reviewed and approved
- [ ] All tests passing
- [ ] Database migrations tested on staging
- [ ] Configuration files prepared
- [ ] Environment variables documented
- [ ] SSL certificates obtained
- [ ] Backup strategy configured
- [ ] Monitoring tools set up

### Deployment

- [ ] Database backed up
- [ ] Database migrations applied
- [ ] Backend deployed and started
- [ ] Frontend built and deployed
- [ ] Health checks passing
- [ ] SSL working correctly
- [ ] API accessible via HTTPS
- [ ] Frontend loads correctly
- [ ] Logs being written

### Post-Deployment

- [ ] Smoke tests performed
- [ ] Performance verified
- [ ] Error logs monitored
- [ ] Backups verified
- [ ] Team notified of deployment
- [ ] Documentation updated

---

## Rollback Procedure

### Quick Rollback

1. **Stop new version**:
   ```bash
   sudo systemctl stop nhlstats-api
   ```

2. **Restore previous version**:
   ```bash
   sudo cp -r /app/publish.backup /app/publish
   ```

3. **Rollback database** (if migrations applied):
   ```bash
   gunzip -c /backups/nhlstats/pre-deployment.sql.gz | psql -U app_user -d nhlstats
   ```

4. **Start service**:
   ```bash
   sudo systemctl start nhlstats-api
   ```

5. **Verify**:
   ```bash
   curl https://api.nhlstats.example.com/health
   ```

---

For additional help, see:
- [Development Guide](DEVELOPMENT.md)
- [Architecture Guide](ARCHITECTURE.md)
- [API Reference](API.md)
