#!/bin/bash

# Setup PostgreSQL SSL Certificate for TWC Cloud
# This script downloads and configures the SSL certificate for PostgreSQL connection

set -e

SERVER_USER="root"
SERVER_HOST="109.73.195.215"

echo "=== Setting up PostgreSQL SSL Certificate ==="

ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
    # Create certificate directory
    mkdir -p /home/app/.cloud-certs
    cd /home/app/.cloud-certs
    
    # Download TWC Cloud root certificate
    # Note: This is a placeholder URL - you need to get the actual certificate from TWC
    cat > root.crt << 'EOF'
-----BEGIN CERTIFICATE-----
# This is a placeholder for the actual TWC Cloud root certificate
# You need to obtain the actual certificate from your TWC Cloud provider
# The certificate should be in PEM format
-----END CERTIFICATE-----
EOF
    
    # Set proper permissions
    chmod 644 root.crt
    
    # Test SSL connection (commented out until certificate is properly configured)
    # export PGSSLROOTCERT=/home/app/.cloud-certs/root.crt
    # psql 'postgresql://gen_user:%5C%24.V%5Cw%3C_r2%5C1%7Dr@1bb84d1fbea33d62faf51337.twc1.net:5432/default_db?sslmode=verify-full' -c '\l'
    
    echo "SSL certificate setup completed"
    echo "Note: You need to replace the placeholder certificate with the actual TWC Cloud root certificate"
ENDSSH

echo "SSL certificate setup script completed"
echo "IMPORTANT: Replace the placeholder certificate with the actual TWC Cloud root certificate"