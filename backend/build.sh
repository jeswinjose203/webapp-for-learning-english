#!/bin/bash
# Build script for Render deployment

set -e

echo "=== Installing backend dependencies ==="
pip install -r requirements.txt

echo "=== Building frontend ==="
cd ../frontend
npm install
npm run build

echo "=== Copying frontend to backend/static ==="
rm -rf ../backend/static
cp -r dist ../backend/static

echo "=== Build complete ==="
