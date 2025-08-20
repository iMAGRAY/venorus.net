# Venorus.net Deployment Guide

## Server Information
- **Server**: 109.73.195.215
- **User**: root
- **Domain**: venorus.net
- **App Directory**: /opt/venorus-net

## Prerequisites
- SSH access to the server
- DNS for venorus.net pointing to 109.73.195.215
- .env.production file configured

## Manual Deployment Steps

### 1. Connect to Server
```bash
ssh root@109.73.195.215
```

### 2. System Setup
```bash
# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y curl git nginx nodejs npm postgresql-client redis-tools

# Verify Node.js version
node --version  # Should be >= 18
```

### 3. Application Deployment
```bash
# Create application directory
mkdir -p /opt/venorus-net
cd /opt/venorus-net

# Clone repository
git clone https://github.com/iMAGRAY/venorus.git .

# Install dependencies
npm ci --production

# Build application
npm run build
```

### 4. Environment Configuration
```bash
# Upload .env.production from local machine
# scp .env.production root@109.73.195.215:/opt/venorus-net/.env

# Set proper permissions
chmod 600 .env
```

### 5. Systemd Service Setup
```bash
# Create service file
cat > /etc/systemd/system/venorus-net.service << 'EOF'
[Unit]
Description=Venorus.net Next.js Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/venorus-net
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=venorus-net

[Install]
WantedBy=multi-user.target
EOF
```

### 6. Nginx Configuration
```bash
# Create Nginx site configuration
cat > /etc/nginx/sites-available/venorus.net << 'EOF'
server {
    listen 80;
    server_name venorus.net www.venorus.net;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name venorus.net www.venorus.net;
    
    # SSL Configuration (will be configured by certbot)
    # ssl_certificate /etc/letsencrypt/live/venorus.net/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/venorus.net/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    location /_next/static {
        alias /opt/venorus-net/.next/static;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location /health {
        access_log off;
        proxy_pass http://localhost:3000/api/health;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/venorus.net /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Restart Nginx
systemctl restart nginx
systemctl enable nginx
```

### 7. Start Services
```bash
# Reload systemd and start application
systemctl daemon-reload
systemctl enable venorus-net
systemctl start venorus-net

# Check status
systemctl status venorus-net --no-pager
systemctl status nginx --no-pager
```

### 8. SSL Certificate Setup (After DNS Configuration)
```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificates
certbot --nginx -d venorus.net -d www.venorus.net \
  --email admin@venorus.net \
  --agree-tos \
  --non-interactive

# Setup auto-renewal
crontab -l | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | crontab -
```

### 9. Verification
```bash
# Check if application is running
curl http://localhost:3000

# Check external access (after DNS setup)
curl -I http://venorus.net

# View logs
journalctl -u venorus-net -f
tail -f /var/log/nginx/access.log
```

## Post-Deployment Checklist

- [ ] Application builds successfully
- [ ] Systemd service starts and runs
- [ ] Nginx configuration is valid
- [ ] HTTP redirects to HTTPS
- [ ] SSL certificates are installed
- [ ] Database connections work
- [ ] Redis connections work  
- [ ] Static files are served correctly
- [ ] Logs are being written properly

## Troubleshooting

### Application Won't Start
```bash
# Check application logs
journalctl -u venorus-net -n 50

# Check Node.js version
node --version

# Test application manually
cd /opt/venorus-net
npm start
```

### Nginx Issues
```bash
# Test configuration
nginx -t

# Check error logs
tail -f /var/log/nginx/error.log

# Restart nginx
systemctl restart nginx
```

### SSL Issues
```bash
# Check certificate status
certbot certificates

# Renew certificates
certbot renew --dry-run
```

## Important Notes

1. **DNS Setup**: Point venorus.net and www.venorus.net to 109.73.195.215
2. **Environment Variables**: Ensure .env.production has correct database and Redis credentials  
3. **Security**: Change default passwords and keys in production environment
4. **Monitoring**: Set up log monitoring and health checks
5. **Backups**: Configure regular database and application backups