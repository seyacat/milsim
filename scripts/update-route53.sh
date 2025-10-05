#!/bin/bash

# Load environment variables from script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
source "$SCRIPT_DIR/.env"
set +a

# Check if subdomain is set
if [ -z "$SUBDOMAIN" ]; then
    echo "Error: SUBDOMAIN not set in .env file"
    exit 1
fi

# Get public IP address
echo "Getting public IP address..."
PUBLIC_IP=$(curl -s http://checkip.amazonaws.com)

if [ -z "$PUBLIC_IP" ]; then
    echo "Error: Could not retrieve public IP address"
    exit 1
fi

echo "Current public IP: $PUBLIC_IP"

# Extract domain and subdomain parts
DOMAIN=$(echo "$SUBDOMAIN" | cut -d'.' -f2-)
HOSTNAME=$(echo "$SUBDOMAIN" | cut -d'.' -f1)

echo "Updating Route53 record for $SUBDOMAIN to point to $PUBLIC_IP"

# Create JSON for Route53 change
CHANGE_BATCH=$(cat << EOF
{
    "Changes": [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "$SUBDOMAIN.",
                "Type": "A",
                "TTL": 300,
                "ResourceRecords": [
                    {
                        "Value": "$PUBLIC_IP"
                    }
                ]
            }
        }
    ]
}
EOF
)

# Update Route53 record
aws route53 change-resource-record-sets \
    --hosted-zone-id $(aws route53 list-hosted-zones-by-name --dns-name "$DOMAIN" --query "HostedZones[0].Id" --output text) \
    --change-batch "$CHANGE_BATCH"

if [ $? -eq 0 ]; then
    echo "Successfully updated Route53 record for $SUBDOMAIN to $PUBLIC_IP"
else
    echo "Error: Failed to update Route53 record"
    exit 1
fi