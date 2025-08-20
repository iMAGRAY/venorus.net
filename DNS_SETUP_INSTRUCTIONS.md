# DNS Setup Instructions for venorus.net

## Overview
Complete DNS configuration instructions to point venorus.net to your MedSIP production server.

## Server Information
- **Production Server IP**: `109.73.195.215`
- **Domain**: `venorus.net`
- **Subdomain**: `www.venorus.net`

## DNS Records Required

### 1. Primary A Record
```
Type: A
Name: @
Value: 109.73.195.215
TTL: 3600 (1 hour)
```

### 2. WWW Subdomain
```
Type: CNAME
Name: www
Value: venorus.net
TTL: 3600 (1 hour)
```

### 3. Optional Mail Record (if email is needed)
```
Type: MX
Name: @
Value: mail.venorus.net
Priority: 10
TTL: 3600
```

## DNS Provider Configuration

### For Common DNS Providers:

#### Cloudflare
1. Log into Cloudflare dashboard
2. Select your domain `venorus.net`
3. Go to DNS > Records
4. Add A record:
   - Type: A
   - Name: @ (or leave blank)
   - IPv4 address: 109.73.195.215
   - Proxy status: DNS only (gray cloud)
   - TTL: Auto
5. Add CNAME record:
   - Type: CNAME
   - Name: www
   - Target: venorus.net
   - Proxy status: DNS only (gray cloud)
   - TTL: Auto

#### Route 53 (AWS)
1. Open Route 53 console
2. Select hosted zone for `venorus.net`
3. Create record:
   - Record name: (leave blank)
   - Record type: A
   - Value: 109.73.195.215
   - TTL: 300
4. Create record:
   - Record name: www
   - Record type: CNAME
   - Value: venorus.net
   - TTL: 300

#### GoDaddy
1. Log into GoDaddy account
2. Go to DNS Management for venorus.net
3. Add A record:
   - Type: A
   - Host: @
   - Points to: 109.73.195.215
   - TTL: 1 Hour
4. Add CNAME record:
   - Type: CNAME
   - Host: www
   - Points to: venorus.net
   - TTL: 1 Hour

#### Namecheap
1. Log into Namecheap account
2. Go to Domain List > Manage
3. Advanced DNS tab
4. Add A record:
   - Type: A Record
   - Host: @
   - Value: 109.73.195.215
   - TTL: Automatic
5. Add CNAME record:
   - Type: CNAME Record
   - Host: www
   - Value: venorus.net
   - TTL: Automatic

## Verification Steps

### 1. DNS Propagation Check
Wait 10-30 minutes after making changes, then verify:

```bash
# Check A record
dig venorus.net A
# Should return: 109.73.195.215

# Check WWW CNAME
dig www.venorus.net CNAME
# Should return: venorus.net

# Check from multiple locations
nslookup venorus.net 8.8.8.8
nslookup venorus.net 1.1.1.1
```

### 2. Online DNS Checker
Use online tools to verify DNS propagation:
- https://www.whatsmydns.net/#A/venorus.net
- https://dnschecker.org/
- https://www.dnswatch.info/

### 3. Test HTTP Access
Once DNS propagates:
```bash
# Test HTTP access
curl -I http://venorus.net
curl -I http://www.venorus.net

# Should return HTTP 200 or 301 redirect
```

## SSL Certificate Setup

**IMPORTANT**: Only proceed with SSL setup AFTER DNS is fully propagated.

### After DNS Propagation (usually 10-30 minutes):

1. **Connect to server**:
   ```bash
   ssh root@109.73.195.215
   ```

2. **Run SSL setup script**:
   ```bash
   ./setup-ssl-auto.sh
   ```

3. **Or manual SSL setup**:
   ```bash
   certbot --nginx -d venorus.net -d www.venorus.net
   ```

## Troubleshooting

### Common Issues:

#### DNS Not Propagating
- Check TTL settings (lower values propagate faster)
- Clear local DNS cache: `ipconfig /flushdns` (Windows) or `sudo systemctl restart systemd-resolved` (Linux)
- Wait longer (can take up to 48 hours in some cases)

#### SSL Certificate Fails
- Ensure DNS is fully propagated first
- Check that port 80 is accessible: `telnet venorus.net 80`
- Verify Nginx is running: `systemctl status nginx`

#### Connection Refused
- Verify server firewall allows ports 80 and 443
- Check if services are running:
  ```bash
  systemctl status nginx
  systemctl status medsip
  ```

### DNS Propagation Timeline:
- **Immediate**: Some DNS servers
- **10-30 minutes**: Most DNS servers
- **2-4 hours**: Global propagation
- **24-48 hours**: Complete propagation (rare cases)

## Post-DNS Setup Checklist

After DNS is configured and propagated:

- [ ] DNS records point to 109.73.195.215
- [ ] Both venorus.net and www.venorus.net resolve correctly
- [ ] HTTP access works: http://venorus.net
- [ ] SSL certificates installed: https://venorus.net
- [ ] Application accessible via domain
- [ ] Health check responds: https://venorus.net/health
- [ ] Monitoring dashboard shows all green
- [ ] Backup system tested

## Final Verification Commands

Run these on the server after DNS setup:

```bash
# Check DNS resolution from server
nslookup venorus.net

# Test local access
curl http://localhost:3000/api/health

# Test domain access
curl http://venorus.net/api/health

# Check SSL (after certificate installation)
curl https://venorus.net/api/health

# Monitor logs
tail -f /opt/monitoring/logs/health-check.log
```

## Support

For DNS configuration help:
- Contact your DNS provider support
- Check provider-specific documentation
- Use DNS testing tools mentioned above

For server/application issues:
- Check monitoring dashboard: `/opt/monitoring/scripts/dashboard.sh`
- Review logs: `journalctl -u medsip -f`
- Contact technical support

---

**Next Steps After DNS Setup:**
1. Install SSL certificates (./setup-ssl-auto.sh)
2. Configure PostgreSQL SSL certificate (./setup-postgres-ssl.sh)
3. Verify all monitoring and backup systems
4. Perform final testing and optimization