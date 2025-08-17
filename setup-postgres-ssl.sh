#!/bin/bash

# PostgreSQL SSL Certificate Setup for TWC Cloud
# This script helps obtain and configure the PostgreSQL SSL certificate

set -e

SERVER_USER="root"
SERVER_HOST="109.73.195.215"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

setup_postgres_ssl_dirs() {
    log "Setting up PostgreSQL SSL directories..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Create SSL certificate directories
        mkdir -p /home/app/.cloud-certs
        mkdir -p /opt/medsip/ssl
        
        # Set proper permissions
        chown -R root:root /home/app/.cloud-certs
        chmod 755 /home/app/.cloud-certs
        
        echo "✅ SSL directories created"
ENDSSH
}

download_twc_certificate() {
    log "Attempting to download TWC Cloud SSL certificate..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        cd /home/app/.cloud-certs
        
        # Try to download TWC Cloud root certificate
        # Note: This URL is a placeholder - you need the actual TWC certificate URL
        
        # Method 1: Download from TWC if they provide a download link
        # wget -O root.crt https://twc.cloud/certificates/root.crt
        
        # Method 2: Extract from SSL connection
        echo | openssl s_client -servername 1bb84d1fbea33d62faf51337.twc1.net -connect 1bb84d1fbea33d62faf51337.twc1.net:5432 -starttls postgres 2>/dev/null | openssl x509 -outform PEM > temp_cert.pem 2>/dev/null || true
        
        # Method 3: Use OpenSSL to get the certificate chain
        openssl s_client -showcerts -servername 1bb84d1fbea33d62faf51337.twc1.net -connect 1bb84d1fbea33d62faf51337.twc1.net:5432 -starttls postgres < /dev/null 2>/dev/null | sed -n '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/p' > full_chain.pem 2>/dev/null || true
        
        # Check if we got any certificates
        if [ -s "full_chain.pem" ]; then
            # Extract root certificate (usually the last one in the chain)
            csplit -s -f cert_ full_chain.pem '/-----BEGIN CERTIFICATE-----/' {*}
            
            # Find the root certificate (last one)
            LAST_CERT=$(ls cert_* | tail -1)
            if [ -n "$LAST_CERT" ] && [ -s "$LAST_CERT" ]; then
                cp "$LAST_CERT" root.crt
                echo "✅ Root certificate extracted from chain"
            fi
            
            # Cleanup
            rm -f cert_* temp_cert.pem full_chain.pem
        else
            echo "⚠️ Could not automatically download certificate"
            echo "Creating placeholder certificate file"
            
            # Create placeholder that needs manual replacement
            cat > root.crt << 'EOF'
-----BEGIN CERTIFICATE-----
# PLACEHOLDER CERTIFICATE - REPLACE WITH ACTUAL TWC CLOUD ROOT CERTIFICATE
# 
# To get the actual certificate:
# 1. Contact TWC Cloud support for the root certificate
# 2. Or use: openssl s_client -showcerts -connect your-db-host:5432 -starttls postgres
# 3. Copy the root certificate from the chain
# 
# This file should contain the TWC Cloud root CA certificate in PEM format
-----END CERTIFICATE-----
EOF
        fi
        
        # Set proper permissions
        chmod 644 root.crt
        
        echo "Certificate file created at /home/app/.cloud-certs/root.crt"
ENDSSH
}

test_ssl_connection() {
    log "Testing PostgreSQL SSL connection..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        cd /opt/medsip
        
        # Test connection with SSL
        export PGSSLROOTCERT=/home/app/.cloud-certs/root.crt
        
        echo "Testing SSL connection to PostgreSQL..."
        
        # Test with require mode first
        if psql "postgresql://gen_user:%5C%24.V%5Cw%3C_r2%5C1%7Dr@1bb84d1fbea33d62faf51337.twc1.net:5432/default_db?sslmode=require" -c '\l' > /dev/null 2>&1; then
            echo "✅ SSL connection successful with sslmode=require"
            
            # Now test with verify-full if certificate is valid
            if psql "postgresql://gen_user:%5C%24.V%5Cw%3C_r2%5C1%7Dr@1bb84d1fbea33d62faf51337.twc1.net:5432/default_db?sslmode=verify-full" -c '\l' > /dev/null 2>&1; then
                echo "✅ SSL connection successful with sslmode=verify-full"
                echo "✅ Certificate validation working"
                
                # Update .env to use verify-full
                sed -i 's/sslmode=require/sslmode=verify-full/g' .env
                echo "✅ Updated .env to use sslmode=verify-full"
                
                # Restart application
                systemctl restart medsip
                echo "✅ Application restarted with SSL verification"
                
            else
                echo "⚠️ verify-full mode failed - certificate may need manual configuration"
                echo "Keeping sslmode=require for now"
            fi
        else
            echo "❌ SSL connection failed"
            echo "Check certificate configuration"
            exit 1
        fi
ENDSSH
}

update_environment() {
    log "Updating environment configuration..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        cd /opt/medsip
        
        # Ensure SSL environment variables are set
        if ! grep -q "PGSSLROOTCERT" .env; then
            echo "PGSSLROOTCERT=/home/app/.cloud-certs/root.crt" >> .env
        fi
        
        if ! grep -q "PGSSLMODE" .env; then
            echo "PGSSLMODE=require" >> .env
        fi
        
        echo "✅ Environment variables updated"
ENDSSH
}

create_certificate_instructions() {
    log "Creating certificate instructions..."
    
    cat > postgres-ssl-manual-setup.md << 'EOF'
# Manual PostgreSQL SSL Certificate Setup

## Current Status
The automatic certificate download may not work. Here's how to manually configure it:

## Method 1: Contact TWC Cloud Support
1. Contact TWC Cloud support
2. Request the root CA certificate for SSL connections
3. Save it as `/home/app/.cloud-certs/root.crt` on the server

## Method 2: Extract Certificate Manually
1. Connect to your server: `ssh root@109.73.195.215`
2. Run this command to extract the certificate:
```bash
openssl s_client -showcerts -servername 1bb84d1fbea33d62faf51337.twc1.net \
  -connect 1bb84d1fbea33d62faf51337.twc1.net:5432 -starttls postgres < /dev/null 2>/dev/null \
  | sed -n '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/p' > /tmp/certs.pem
```
3. Open `/tmp/certs.pem` and copy the ROOT certificate (usually the last one)
4. Save it as `/home/app/.cloud-certs/root.crt`

## Method 3: Use psql to test
```bash
# Test different SSL modes
psql "postgresql://gen_user:%5C%24.V%5Cw%3C_r2%5C1%7Dr@1bb84d1fbea33d62faf51337.twc1.net:5432/default_db?sslmode=require" -c '\l'
```

## Verify Setup
After placing the certificate:
1. Test connection: `./setup-postgres-ssl.sh`
2. Check application: `curl http://109.73.195.215/api/health`
3. Restart if needed: `systemctl restart medsip`

## Current Environment
- SSL Mode: require (not verify-full yet)
- Certificate Path: /home/app/.cloud-certs/root.crt
- Database: 1bb84d1fbea33d62faf51337.twc1.net:5432
EOF

    log "✅ Instructions created: postgres-ssl-manual-setup.md"
}

main() {
    log "Starting PostgreSQL SSL setup..."
    
    # Setup directories
    setup_postgres_ssl_dirs
    
    # Try to download certificate
    download_twc_certificate
    
    # Update environment
    update_environment
    
    # Test connection
    test_ssl_connection
    
    # Create manual instructions
    create_certificate_instructions
    
    log "🎉 PostgreSQL SSL setup completed!"
    log "If automatic setup failed, see: postgres-ssl-manual-setup.md"
}

# Run if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi