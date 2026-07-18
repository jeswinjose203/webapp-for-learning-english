#!/bin/bash
# Build script for Render deployment

set -e

echo "=== Installing backend dependencies ==="
pip install -r requirements.txt

echo "=== Installing frontend dependencies ==="
cd ../frontend
npm install --production=false

echo "=== Building frontend ==="
npm run build

echo "=== Copying frontend to backend/static ==="
rm -rf ../backend/static
cp -r dist ../backend/static

echo "=== Build complete ==="
