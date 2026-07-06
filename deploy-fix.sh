#!/bin/bash

# Navigate to front-end directory
cd /Users/martinhalla/websites/ISCZ-web-development/provider-plus-node-react-active-dev/front-end

# Add the deployment fix files
git add .npmrc nixpacks.toml railway.json

# Commit the changes
git commit -m "Fix Railway deployment - npm dependency conflicts

- Ensure .npmrc with legacy-peer-deps flag is included
- Ensure nixpacks.toml configuration is present
- Configure Node.js 18.x and serve for production"

# Push to production branch
git push origin production

echo "Deployment fix pushed to production branch"