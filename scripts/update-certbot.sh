#!/bin/bash

# Load environment variables from script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

# Default values
DOMAIN=${CERTBOT_DOMAIN:-"milsim.gato.click"}
EMAIL=${CERTBOT_EMAIL:-"admin@milsim.gato.click"}
PORT=${CERTBOT_PORT:-80}

echo "Updating SSL certificates for domain: $DOMAIN"
echo "Email: $EMAIL"
echo "Verification port: $PORT"

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "Error: certbot is not installed. Please install certbot first."
    echo "On Ubuntu/Debian: sudo apt-get install certbot"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Create temporary Express server for verification
cat > /tmp/certbot-verification-server.js << 'EOF'
const express = require('express');
const app = express();
const port = process.env.PORT || 80;

// Serve ACME challenges from .well-known directory
app.use('/.well-known/acme-challenge', express.static('/tmp/.well-known/acme-challenge'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', server: 'certbot-verification' });
});

// Start server
app.listen(port, '0.0.0.0', () => {
    console.log(`Certbot verification server running on port ${port}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    process.exit(0);
});
EOF

# Function to start verification server
start_verification_server() {
    echo "Starting temporary verification server on port $PORT..."
    
    # Create directory for ACME challenges
    mkdir -p /tmp/.well-known/acme-challenge
    
    # Start the server in background
    node /tmp/certbot-verification-server.js &
    SERVER_PID=$!
    
    # Wait a moment for server to start
    sleep 2
    
    # Check if server is running
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo "Error: Failed to start verification server"
        return 1
    fi
    
    echo "Verification server started with PID: $SERVER_PID"
    return 0
}

# Function to stop verification server
stop_verification_server() {
    if [ ! -z "$SERVER_PID" ] && kill -0 $SERVER_PID 2>/dev/null; then
        echo "Stopping verification server (PID: $SERVER_PID)..."
        kill $SERVER_PID
        wait $SERVER_PID 2>/dev/null
    fi
    
    # Clean up temporary files
    rm -f /tmp/certbot-verification-server.js
    rm -rf /tmp/.well-known
}

# Ensure cleanup on script exit
trap stop_verification_server EXIT

# Check if certificates need renewal
echo "Checking if certificates need renewal..."
certbot renew --dry-run

if [ $? -eq 0 ]; then
    echo "Certificates are up to date, no renewal needed."
    exit 0
fi

echo "Certificates need renewal or initial issuance."

# Start verification server
if ! start_verification_server; then
    echo "Failed to start verification server. Cannot proceed with certificate issuance."
    exit 1
fi

# Install certificates using standalone mode with our custom server
echo "Installing/updating certificates..."
certbot certonly \
    --standalone \
    --preferred-challenges http \
    --http-01-port $PORT \
    --domain $DOMAIN \
    --email $EMAIL \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring

CERTBOT_RESULT=$?

# Stop verification server
stop_verification_server

if [ $CERTBOT_RESULT -eq 0 ]; then
    echo "✅ Certificates successfully updated for $DOMAIN"
    echo "Certificate location: /etc/letsencrypt/live/$DOMAIN/"
    
    # List certificate files
    echo "Certificate files:"
    ls -la /etc/letsencrypt/live/$DOMAIN/
else
    echo "❌ Certificate update failed with exit code: $CERTBOT_RESULT"
    exit $CERTBOT_RESULT
fi