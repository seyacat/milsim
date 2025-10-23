#!/bin/bash

echo "Building Milsim application (Backend + SolidJS Frontend)..."

# Build backend
echo "Building NestJS backend..."
npm run build

# Build SolidJS frontend
echo "Building SolidJS frontend..."
./build-solidjs.sh

# Copy SolidJS build to backend public directory
echo "Copying SolidJS build to backend public directory..."
rm -rf dist/public
mkdir -p dist/public
cp -r frontendSolidJS/dist/* dist/public/

echo "Build completed successfully!"
echo "Backend built in: dist/"
echo "Frontend built in: dist/public/"
echo "To start the application: npm run start:prod"