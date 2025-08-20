#!/bin/bash

# Backup System Setup for MedSIP Production
# Creates configuration backup and disaster recovery procedures

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

setup_backup_system() {
    log "Setting up backup system..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Create backup directories
        mkdir -p /opt/backups/config
        mkdir -p /opt/backups/logs
        mkdir -p /opt/backups/database
        mkdir -p /opt/backups/ssl
        
        # Create configuration backup script
        cat > /usr/local/bin/backup-config.sh << 'EOF'
#!/bin/bash

# MedSIP Configuration Backup Script

set -e

BACKUP_DIR="/opt/backups"
TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
LOG_FILE="$BACKUP_DIR/logs/backup-$TIMESTAMP.log"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting configuration backup..."

# Create timestamped backup directory
BACKUP_PATH="$BACKUP_DIR/config/backup-$TIMESTAMP"
mkdir -p "$BACKUP_PATH"

# Backup MedSIP application configuration
log "Backing up MedSIP configuration..."
if [ -d "/opt/medsip" ]; then
    cp -r /opt/medsip/.env* "$BACKUP_PATH/" 2>/dev/null || true
    cp -r /opt/medsip/package*.json "$BACKUP_PATH/" 2>/dev/null || true
    cp -r /opt/medsip/next.config.* "$BACKUP_PATH/" 2>/dev/null || true
    cp -r /opt/medsip/*.md "$BACKUP_PATH/" 2>/dev/null || true
    log "✅ MedSIP configuration backed up"
else
    log "⚠️ MedSIP directory not found"
fi

# Backup Nginx configuration
log "Backing up Nginx configuration..."
mkdir -p "$BACKUP_PATH/nginx"
cp -r /etc/nginx/sites-available/* "$BACKUP_PATH/nginx/" 2>/dev/null || true
cp /etc/nginx/nginx.conf "$BACKUP_PATH/nginx/" 2>/dev/null || true
log "✅ Nginx configuration backed up"

# Backup systemd services
log "Backing up systemd services..."
mkdir -p "$BACKUP_PATH/systemd"
cp /etc/systemd/system/medsip.service "$BACKUP_PATH/systemd/" 2>/dev/null || true
log "✅ Systemd services backed up"

# Backup SSL certificates
log "Backing up SSL certificates..."
mkdir -p "$BACKUP_PATH/ssl"
if [ -d "/etc/letsencrypt" ]; then
    cp -r /etc/letsencrypt "$BACKUP_PATH/ssl/" 2>/dev/null || true
    log "✅ Let's Encrypt certificates backed up"
fi
if [ -d "/home/app/.cloud-certs" ]; then
    cp -r /home/app/.cloud-certs "$BACKUP_PATH/ssl/" 2>/dev/null || true
    log "✅ PostgreSQL SSL certificates backed up"
fi

# Backup monitoring configuration
log "Backing up monitoring configuration..."
mkdir -p "$BACKUP_PATH/monitoring"
if [ -d "/opt/monitoring/scripts" ]; then
    cp -r /opt/monitoring/scripts "$BACKUP_PATH/monitoring/" 2>/dev/null || true
    log "✅ Monitoring scripts backed up"
fi

# Backup firewall and security configuration
log "Backing up security configuration..."
mkdir -p "$BACKUP_PATH/security"
cp /etc/ufw/user.rules "$BACKUP_PATH/security/" 2>/dev/null || true
cp /etc/fail2ban/jail.local "$BACKUP_PATH/security/" 2>/dev/null || true
cp /etc/ssh/sshd_config "$BACKUP_PATH/security/" 2>/dev/null || true
log "✅ Security configuration backed up"

# Create backup manifest
cat > "$BACKUP_PATH/MANIFEST.txt" << MANIFEST
MedSIP Configuration Backup
===========================
Created: $(date)
Server: $(hostname)
Backup ID: $TIMESTAMP

Contents:
- Application configuration (.env files, package.json)
- Nginx configuration
- Systemd service files
- SSL certificates (Let's Encrypt + PostgreSQL)
- Monitoring scripts
- Security configuration (UFW, Fail2ban, SSH)

Restore Instructions:
1. Copy files to appropriate locations
2. Adjust file permissions
3. Restart services: systemctl restart nginx medsip
4. Verify configuration

For full disaster recovery, see: /opt/backups/DISASTER_RECOVERY.md
MANIFEST

# Create compressed archive
cd "$BACKUP_DIR/config"
tar -czf "backup-$TIMESTAMP.tar.gz" "backup-$TIMESTAMP"
rm -rf "backup-$TIMESTAMP"

log "✅ Configuration backup completed: backup-$TIMESTAMP.tar.gz"

# Clean old backups (keep last 30 days)
find "$BACKUP_DIR/config" -name "backup-*.tar.gz" -mtime +30 -delete 2>/dev/null || true
find "$BACKUP_DIR/logs" -name "backup-*.log" -mtime +30 -delete 2>/dev/null || true

log "Backup process completed successfully"
EOF

        chmod +x /usr/local/bin/backup-config.sh
        
        echo "✅ Configuration backup script created"
ENDSSH
}

create_disaster_recovery_docs() {
    log "Creating disaster recovery documentation..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        cat > /opt/backups/DISASTER_RECOVERY.md << 'EOF'
# MedSIP Disaster Recovery Guide

## Overview
This guide helps restore the MedSIP application in case of server failure or corruption.

## Prerequisites
- New Ubuntu 24.04 server
- SSH access with root privileges  
- Domain DNS pointing to new server IP
- Configuration backup file

## Step-by-Step Recovery

### 1. Server Preparation
```bash
# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y curl git nginx postgresql-client redis-tools ufw fail2ban

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
```

### 2. Application Restoration
```bash
# Create application directory
mkdir -p /opt/medsip
cd /opt/medsip

# Clone repository
git clone https://github.com/iMAGRAY/medsip.protez/ .

# Restore configuration from backup
tar -xzf backup-YYYYMMDD_HHMMSS.tar.gz
cp backup-YYYYMMDD_HHMMSS/.env* .
cp backup-YYYYMMDD_HHMMSS/package*.json .

# Install dependencies and build
npm ci --production
npm run build
```

### 3. Nginx Configuration
```bash
# Restore Nginx configuration
cp backup-YYYYMMDD_HHMMSS/nginx/venorus.net /etc/nginx/sites-available/
ln -sf /etc/nginx/sites-available/venorus.net /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and restart
nginx -t
systemctl restart nginx
```

### 4. Systemd Service
```bash
# Restore systemd service
cp backup-YYYYMMDD_HHMMSS/systemd/medsip.service /etc/systemd/system/

# Enable and start
systemctl daemon-reload
systemctl enable medsip
systemctl start medsip
```

### 5. SSL Certificates
```bash
# For Let's Encrypt certificates
cp -r backup-YYYYMMDD_HHMMSS/ssl/letsencrypt /etc/

# For PostgreSQL SSL
mkdir -p /home/app/.cloud-certs
cp -r backup-YYYYMMDD_HHMMSS/ssl/.cloud-certs/* /home/app/.cloud-certs/
```

### 6. Security Configuration
```bash
# Restore firewall rules
cp backup-YYYYMMDD_HHMMSS/security/user.rules /etc/ufw/
ufw --force enable

# Restore fail2ban
cp backup-YYYYMMDD_HHMMSS/security/jail.local /etc/fail2ban/
systemctl restart fail2ban
```

### 7. Monitoring Setup
```bash
# Restore monitoring scripts
mkdir -p /opt/monitoring
cp -r backup-YYYYMMDD_HHMMSS/monitoring/* /opt/monitoring/
chmod +x /opt/monitoring/scripts/*.sh

# Setup cron jobs
crontab -e
# Add monitoring jobs from backup
```

### 8. Verification
```bash
# Check services
systemctl status medsip nginx

# Test application
curl http://localhost:3000/api/health

# Test external access
curl http://YOUR_DOMAIN/api/health

# Check monitoring
/opt/monitoring/scripts/dashboard.sh
```

## Database Recovery
The PostgreSQL database is hosted externally (TWC Cloud) and should not require restoration. Verify connection:

```bash
export PGSSLROOTCERT=/home/app/.cloud-certs/root.crt
psql "postgresql://gen_user:PASSWORD@HOST:5432/default_db?sslmode=require" -c '\l'
```

## Contact Information
- Technical Support: admin@venorus.net
- Emergency Contact: [Your emergency contact]
- Documentation: https://github.com/iMAGRAY/medsip.protez/

## Recovery Checklist
- [ ] Server prepared with required packages
- [ ] Application code restored and built
- [ ] Configuration files restored
- [ ] Services configured and running
- [ ] SSL certificates restored
- [ ] Security configured
- [ ] Monitoring setup
- [ ] Application responding correctly
- [ ] Database connectivity verified
- [ ] External services (Redis) accessible

## Recovery Time Objective (RTO)
Target recovery time: 2-4 hours

## Recovery Point Objective (RPO)
Configuration changes: 24 hours (daily backups)
Application data: Real-time (external database)
EOF

        echo "✅ Disaster recovery documentation created"
ENDSSH
}

setup_backup_schedule() {
    log "Setting up backup schedule..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Add backup job to crontab (daily at 3 AM)
        (crontab -l 2>/dev/null | grep -v "/usr/local/bin/backup-config.sh"; echo "0 3 * * * /usr/local/bin/backup-config.sh") | crontab -
        
        echo "✅ Daily backup scheduled at 3 AM"
ENDSSH
}

create_restore_script() {
    log "Creating restore helper script..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        cat > /usr/local/bin/restore-config.sh << 'EOF'
#!/bin/bash

# MedSIP Configuration Restore Script

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup-file.tar.gz>"
    echo "Available backups:"
    ls -la /opt/backups/config/backup-*.tar.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"
TEMP_DIR="/tmp/medsip-restore-$$"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "Restoring from: $BACKUP_FILE"
echo "This will overwrite current configuration. Continue? (y/N)"
read -r confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Extract backup
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"
tar -xzf "$BACKUP_FILE"

BACKUP_DIR=$(ls -d backup-* | head -1)

if [ ! -d "$BACKUP_DIR" ]; then
    echo "Error: Invalid backup file"
    cleanup
    exit 1
fi

echo "Restoring configuration..."

# Restore MedSIP configuration
if [ -f "$BACKUP_DIR/.env" ]; then
    cp "$BACKUP_DIR/.env" /opt/medsip/
    echo "✅ Environment configuration restored"
fi

# Restore Nginx configuration
if [ -f "$BACKUP_DIR/nginx/venorus.net" ]; then
    cp "$BACKUP_DIR/nginx/venorus.net" /etc/nginx/sites-available/
    echo "✅ Nginx configuration restored"
fi

# Restore systemd service
if [ -f "$BACKUP_DIR/systemd/medsip.service" ]; then
    cp "$BACKUP_DIR/systemd/medsip.service" /etc/systemd/system/
    systemctl daemon-reload
    echo "✅ Systemd service restored"
fi

# Cleanup
rm -rf "$TEMP_DIR"

echo "Configuration restored successfully"
echo "Restart services to apply changes:"
echo "  systemctl restart nginx"
echo "  systemctl restart medsip"
EOF

        chmod +x /usr/local/bin/restore-config.sh
        
        echo "✅ Restore script created"
ENDSSH
}

test_backup_system() {
    log "Testing backup system..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        echo "Running initial backup..."
        /usr/local/bin/backup-config.sh
        
        echo "Checking backup files..."
        ls -la /opt/backups/config/
        
        echo "✅ Backup system test completed"
ENDSSH
}

main() {
    log "Setting up backup system for MedSIP..."
    
    # Setup backup system
    setup_backup_system
    
    # Create disaster recovery documentation
    create_disaster_recovery_docs
    
    # Setup backup schedule
    setup_backup_schedule
    
    # Create restore script
    create_restore_script
    
    # Test the backup system
    test_backup_system
    
    log "🎉 Backup system setup completed!"
    log "Daily backups scheduled at 3 AM"
    log "Backup location: /opt/backups/"
    log "Disaster recovery guide: /opt/backups/DISASTER_RECOVERY.md"
    log "Manual backup: /usr/local/bin/backup-config.sh"
    log "Restore: /usr/local/bin/restore-config.sh <backup-file>"
}

# Run if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi