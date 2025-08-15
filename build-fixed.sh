#!/bin/bash

# Clean dist directory
rm -rf dist

# Create dist directory
mkdir -p dist

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Compile TypeScript (continue even with errors) and rename .js to .mjs
./node_modules/.bin/tsc
find dist -name "*.js" -type f -exec sh -c 'mv "$1" "${1%.js}.mjs"' _ {} \;

# Fix imports if the fix-imports.js exists
if [ -f "fix-imports.js" ]; then
    node fix-imports.js
fi

# Copy production dependencies to dist
cp package.json dist/
cd dist && npm install --production --silent && cd ..

echo "Build completed. Deployment package ready in dist/"