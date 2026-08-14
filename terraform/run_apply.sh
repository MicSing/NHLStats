#!/bin/bash
export PATH="/opt/homebrew/bin:$PATH"
# Generate a random secure password
PASSWORD="StrongPass!123_$(cat /dev/urandom | env LC_CTYPE=C tr -dc 'a-zA-Z0-9' | fold -w 8 | head -n 1)"
echo "Admin password generated: $PASSWORD"
./terraform apply -auto-approve -var="admin_password=$PASSWORD"
