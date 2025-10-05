#!/bin/bash

# Load environment variables from script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

# Default values
ENDPOINT=${UPTIME_ENDPOINT:-"http://127.0.0.1:6600/uptime"}
SHUTDOWN_THRESHOLD=${SHUTDOWN_THRESHOLD:-3600}  # 1 hour in seconds

echo "Checking uptime endpoint: $ENDPOINT"
echo "Shutdown threshold: $SHUTDOWN_THRESHOLD seconds"

# Make API call to get uptime information
response=$(curl -s "$ENDPOINT")

# Check if curl was successful
if [ $? -ne 0 ]; then
    echo "Error: Failed to connect to uptime endpoint"
    exit 1
fi

# Extract timeWithoutConnections from JSON response
time_without_connections=$(echo "$response" | grep -o '"timeWithoutConnections":[0-9]*' | cut -d':' -f2)

# Check if we got a valid number
if [ -z "$time_without_connections" ]; then
    echo "Error: Could not parse timeWithoutConnections from response"
    echo "Response: $response"
    exit 1
fi

echo "Time without connections: $time_without_connections seconds"

# Check if time without connections exceeds threshold
if [ "$time_without_connections" -gt "$SHUTDOWN_THRESHOLD" ]; then
    echo "WARNING: No connections for more than threshold ($SHUTDOWN_THRESHOLD seconds)"
    echo "Initiating EC2 instance shutdown..."
    
    # Shutdown the EC2 instance
    sudo shutdown -h now
else
    echo "OK: Connections are active or within threshold"
fi