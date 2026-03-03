#!/bin/sh
set -e

# Support both Docker (/app/backend) and direct Railway runs (./backend)
if [ -d "/app/backend" ]; then
  cd /app/backend
elif [ -d "backend" ]; then
  cd backend
else
  echo "backend directory not found"
  exit 1
fi

npm ci --omit=dev
npm start
