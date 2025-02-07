#!/bin/bash

set -e

# Navigate to project directory
cd "$(dirname "$0")"

echo "Pulling latest changes..."
git pull origin master

# Build Go project
echo "Building Go project..."
cd go-gameserver
make build

# Restart the service
echo "Restarting service..."
sudo systemctl restart go-gameserver

echo "Deployment complete."
