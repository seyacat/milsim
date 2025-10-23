#!/bin/bash

echo "Building SolidJS frontend..."
cd frontendSolidJS
npm install
npm run build
cd ..
echo "SolidJS frontend built successfully!"