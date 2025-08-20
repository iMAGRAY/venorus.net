#!/bin/bash

# Comprehensive Monitoring Setup for MedSIP Production
# This script sets up application health monitoring, alerting, and logging

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

setup_health_monitoring() {
    log "Setting up application health monitoring..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Create monitoring scripts directory
        mkdir -p /opt/monitoring/scripts
        mkdir -p /opt/monitoring/logs
        mkdir -p /opt/monitoring/data
        
        # Create comprehensive health check script
        cat > /opt/monitoring/scripts/health-check.sh << 'EOF'
#!/bin/bash

# MedSIP Health Check Script
# Monitors application, database, Redis, and system resources

set -e

LOG_FILE="/opt/monitoring/logs/health-check.log"
DATA_DIR="/opt/monitoring/data"
TIMESTAMP=$(date +'%Y-%m-%d %H:%M:%S')
HEALTH_ENDPOINT="http://localhost:3000/api/health"

# Logging function
log_message() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

# Check application health
check_application() {
    log_message "Checking application health..."
    
    if curl -f -s --max-time 10 "$HEALTH_ENDPOINT" > "$DATA_DIR/health-response.json"; then
        log_message "✅ Application is responding"
        
        # Parse health response
        if command -v jq >/dev/null 2>&1; then
            STATUS=$(jq -r '.status' "$DATA_DIR/health-response.json" 2>/dev/null || echo "unknown")
            UPTIME=$(jq -r '.uptime' "$DATA_DIR/health-response.json" 2>/dev/null || echo "unknown")
            
            log_message "Status: $STATUS, Uptime: ${UPTIME}s"
            
            # Check if status is healthy
            if [ "$STATUS" = "healthy" ]; then
                echo "0" > "$DATA_DIR/app-status"
            else
                echo "1" > "$DATA_DIR/app-status"
                log_message "⚠️ Application status: $STATUS"
            fi
        else
            echo "0" > "$DATA_DIR/app-status"
        fi
    else
        log_message "❌ Application is not responding"
        echo "2" > "$DATA_DIR/app-status"
        return 1
    fi
}

# Check system resources
check_system_resources() {
    log_message "Checking system resources..."
    
    # Memory usage
    MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    echo "$MEMORY_USAGE" > "$DATA_DIR/memory-usage"
    
    # Disk usage
    DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    echo "$DISK_USAGE" > "$DATA_DIR/disk-usage"
    
    # Load average
    LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    echo "$LOAD_AVG" > "$DATA_DIR/load-average"
    
    log_message "Memory: ${MEMORY_USAGE}%, Disk: ${DISK_USAGE}%, Load: $LOAD_AVG"
    
    # Check thresholds
    if (( $(echo "$MEMORY_USAGE > 90" | bc -l) )); then
        log_message "⚠️ High memory usage: ${MEMORY_USAGE}%"
        echo "1" > "$DATA_DIR/memory-alert"
    else
        echo "0" > "$DATA_DIR/memory-alert"
    fi
    
    if [ "$DISK_USAGE" -gt 85 ]; then
        log_message "⚠️ High disk usage: ${DISK_USAGE}%"
        echo "1" > "$DATA_DIR/disk-alert"
    else
        echo "0" > "$DATA_DIR/disk-alert"
    fi
}

# Check service status
check_services() {
    log_message "Checking service status..."
    
    # Check MedSIP service
    if systemctl is-active --quiet medsip; then
        log_message "✅ MedSIP service is running"
        echo "0" > "$DATA_DIR/service-status"
    else
        log_message "❌ MedSIP service is not running"
        echo "1" > "$DATA_DIR/service-status"
    fi
    
    # Check Nginx
    if systemctl is-active --quiet nginx; then
        log_message "✅ Nginx is running"
        echo "0" > "$DATA_DIR/nginx-status"
    else
        log_message "❌ Nginx is not running"
        echo "1" > "$DATA_DIR/nginx-status"
    fi
}

# Check Redis connectivity
check_redis() {
    log_message "Checking Redis connectivity..."
    
    if redis-cli -h 94.141.162.221 -p 6379 --user default --pass '&J.~&kXF3y~F0#' ping | grep -q PONG 2>/dev/null; then
        log_message "✅ Redis is accessible"
        echo "0" > "$DATA_DIR/redis-status"
    else
        log_message "❌ Redis is not accessible"
        echo "1" > "$DATA_DIR/redis-status"
    fi
}

# Generate status report
generate_report() {
    cat > "$DATA_DIR/status-report.json" << JSONEOF
{
  "timestamp": "$TIMESTAMP",
  "application": {
    "status": $(cat "$DATA_DIR/app-status" 2>/dev/null || echo "2"),
    "health_endpoint": "$HEALTH_ENDPOINT"
  },
  "services": {
    "medsip": $(cat "$DATA_DIR/service-status" 2>/dev/null || echo "1"),
    "nginx": $(cat "$DATA_DIR/nginx-status" 2>/dev/null || echo "1")
  },
  "external": {
    "redis": $(cat "$DATA_DIR/redis-status" 2>/dev/null || echo "1")
  },
  "system": {
    "memory_usage": $(cat "$DATA_DIR/memory-usage" 2>/dev/null || echo "0"),
    "disk_usage": $(cat "$DATA_DIR/disk-usage" 2>/dev/null || echo "0"),
    "load_average": "$(cat "$DATA_DIR/load-average" 2>/dev/null || echo "0")",
    "memory_alert": $(cat "$DATA_DIR/memory-alert" 2>/dev/null || echo "0"),
    "disk_alert": $(cat "$DATA_DIR/disk-alert" 2>/dev/null || echo "0")
  }
}
JSONEOF
}

# Main execution
main() {
    log_message "Starting health check..."
    
    # Create data directory if it doesn't exist
    mkdir -p "$DATA_DIR"
    
    # Run checks
    check_application || true
    check_system_resources
    check_services
    check_redis
    
    # Generate report
    generate_report
    
    log_message "Health check completed"
    
    # Return exit code based on critical services
    APP_STATUS=$(cat "$DATA_DIR/app-status" 2>/dev/null || echo "2")
    SERVICE_STATUS=$(cat "$DATA_DIR/service-status" 2>/dev/null || echo "1")
    
    if [ "$APP_STATUS" = "0" ] && [ "$SERVICE_STATUS" = "0" ]; then
        exit 0
    else
        exit 1
    fi
}

main "$@"
EOF

        chmod +x /opt/monitoring/scripts/health-check.sh
        
        echo "✅ Health monitoring script created"
ENDSSH
}

setup_alerting() {
    log "Setting up alerting system..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Install required packages
        apt update
        apt install -y jq bc mailutils

        # Create alerting script
        cat > /opt/monitoring/scripts/alert-manager.sh << 'EOF'
#!/bin/bash

# Alert Manager for MedSIP
# Sends alerts when issues are detected

set -e

DATA_DIR="/opt/monitoring/data"
LOG_FILE="/opt/monitoring/logs/alerts.log"
ALERT_STATE_FILE="/opt/monitoring/data/alert-state"

# Email settings (configure as needed)
ALERT_EMAIL="admin@venorus.net"
FROM_EMAIL="monitoring@venorus.net"

log_alert() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

send_email_alert() {
    local subject="$1"
    local message="$2"
    
    # For now, just log the alert (email can be configured later)
    log_alert "ALERT: $subject"
    log_alert "Message: $message"
    
    # Uncomment when email is configured
    # echo "$message" | mail -s "$subject" -r "$FROM_EMAIL" "$ALERT_EMAIL"
}

send_webhook_alert() {
    local message="$1"
    
    # Example webhook (replace with actual webhook URL)
    # curl -X POST -H "Content-Type: application/json" \
    #      -d "{\"text\":\"$message\"}" \
    #      "YOUR_WEBHOOK_URL"
    
    log_alert "Webhook: $message"
}

check_and_alert() {
    if [ ! -f "$DATA_DIR/status-report.json" ]; then
        log_alert "No status report found"
        return
    fi
    
    # Read current status
    APP_STATUS=$(jq -r '.application.status' "$DATA_DIR/status-report.json")
    SERVICE_STATUS=$(jq -r '.services.medsip' "$DATA_DIR/status-report.json")
    MEMORY_ALERT=$(jq -r '.system.memory_alert' "$DATA_DIR/status-report.json")
    DISK_ALERT=$(jq -r '.system.disk_alert' "$DATA_DIR/status-report.json")
    MEMORY_USAGE=$(jq -r '.system.memory_usage' "$DATA_DIR/status-report.json")
    DISK_USAGE=$(jq -r '.system.disk_usage' "$DATA_DIR/status-report.json")
    
    # Read previous alert state
    if [ -f "$ALERT_STATE_FILE" ]; then
        source "$ALERT_STATE_FILE"
    else
        PREV_APP_STATUS="0"
        PREV_SERVICE_STATUS="0"
        PREV_MEMORY_ALERT="0"
        PREV_DISK_ALERT="0"
    fi
    
    # Check application status
    if [ "$APP_STATUS" != "0" ] && [ "$PREV_APP_STATUS" = "0" ]; then
        send_email_alert "MedSIP Application Down" "The MedSIP application is not responding or unhealthy. Please check the service immediately."
        send_webhook_alert "🚨 MedSIP Application Down - Immediate attention required!"
    elif [ "$APP_STATUS" = "0" ] && [ "$PREV_APP_STATUS" != "0" ]; then
        send_email_alert "MedSIP Application Recovered" "The MedSIP application has recovered and is now responding normally."
        send_webhook_alert "✅ MedSIP Application Recovered"
    fi
    
    # Check service status
    if [ "$SERVICE_STATUS" != "0" ] && [ "$PREV_SERVICE_STATUS" = "0" ]; then
        send_email_alert "MedSIP Service Down" "The MedSIP systemd service has stopped. Attempting automatic restart."
        # Attempt restart
        systemctl restart medsip
        send_webhook_alert "🔧 MedSIP Service restarted automatically"
    fi
    
    # Check resource alerts
    if [ "$MEMORY_ALERT" = "1" ] && [ "$PREV_MEMORY_ALERT" = "0" ]; then
        send_email_alert "High Memory Usage Alert" "Memory usage is at ${MEMORY_USAGE}%. Consider investigating memory leaks or scaling resources."
        send_webhook_alert "⚠️ High Memory Usage: ${MEMORY_USAGE}%"
    fi
    
    if [ "$DISK_ALERT" = "1" ] && [ "$PREV_DISK_ALERT" = "0" ]; then
        send_email_alert "High Disk Usage Alert" "Disk usage is at ${DISK_USAGE}%. Please free up space or expand storage."
        send_webhook_alert "⚠️ High Disk Usage: ${DISK_USAGE}%"
    fi
    
    # Save current state
    cat > "$ALERT_STATE_FILE" << STATEEOF
PREV_APP_STATUS="$APP_STATUS"
PREV_SERVICE_STATUS="$SERVICE_STATUS"
PREV_MEMORY_ALERT="$MEMORY_ALERT"
PREV_DISK_ALERT="$DISK_ALERT"
STATEEOF
}

main() {
    check_and_alert
}

main "$@"
EOF

        chmod +x /opt/monitoring/scripts/alert-manager.sh
        
        echo "✅ Alert manager created"
ENDSSH
}

setup_cron_jobs() {
    log "Setting up monitoring cron jobs..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Add monitoring jobs to crontab
        crontab -l 2>/dev/null | grep -v "/opt/monitoring" | crontab -
        
        (crontab -l 2>/dev/null; cat << CRONEOF
# MedSIP Monitoring Jobs
*/5 * * * * /opt/monitoring/scripts/health-check.sh
*/5 * * * * /opt/monitoring/scripts/alert-manager.sh
0 0 * * * /usr/bin/find /opt/monitoring/logs -name "*.log" -mtime +30 -delete
CRONEOF
        ) | crontab -
        
        echo "✅ Monitoring cron jobs configured"
        echo "  - Health checks every 5 minutes"
        echo "  - Alert checks every 5 minutes"
        echo "  - Log cleanup daily"
ENDSSH
}

create_dashboard_script() {
    log "Creating monitoring dashboard..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        cat > /opt/monitoring/scripts/dashboard.sh << 'EOF'
#!/bin/bash

# Simple monitoring dashboard for MedSIP

DATA_DIR="/opt/monitoring/data"

print_header() {
    echo "============================================"
    echo "    MedSIP Production Monitoring"
    echo "    $(date)"
    echo "============================================"
}

print_application_status() {
    echo ""
    echo "📱 APPLICATION STATUS"
    echo "--------------------"
    
    if [ -f "$DATA_DIR/status-report.json" ]; then
        APP_STATUS=$(jq -r '.application.status' "$DATA_DIR/status-report.json")
        case $APP_STATUS in
            "0") echo "Status: ✅ HEALTHY" ;;
            "1") echo "Status: ⚠️  UNHEALTHY" ;;
            "2") echo "Status: ❌ DOWN" ;;
            *) echo "Status: ❓ UNKNOWN" ;;
        esac
        
        if [ -f "$DATA_DIR/health-response.json" ]; then
            echo "Response Time: $(jq -r '.responseTime // "N/A"' "$DATA_DIR/health-response.json")ms"
            echo "Uptime: $(jq -r '.uptime // "N/A"' "$DATA_DIR/health-response.json")s"
        fi
    else
        echo "Status: ❌ NO DATA"
    fi
}

print_services_status() {
    echo ""
    echo "🔧 SERVICES STATUS"
    echo "------------------"
    
    if [ -f "$DATA_DIR/status-report.json" ]; then
        MEDSIP_STATUS=$(jq -r '.services.medsip' "$DATA_DIR/status-report.json")
        NGINX_STATUS=$(jq -r '.services.nginx' "$DATA_DIR/status-report.json")
        
        echo -n "MedSIP Service: "
        [ "$MEDSIP_STATUS" = "0" ] && echo "✅ Running" || echo "❌ Stopped"
        
        echo -n "Nginx: "
        [ "$NGINX_STATUS" = "0" ] && echo "✅ Running" || echo "❌ Stopped"
    fi
}

print_external_status() {
    echo ""
    echo "🌐 EXTERNAL SERVICES"
    echo "-------------------"
    
    if [ -f "$DATA_DIR/status-report.json" ]; then
        REDIS_STATUS=$(jq -r '.external.redis' "$DATA_DIR/status-report.json")
        
        echo -n "Redis: "
        [ "$REDIS_STATUS" = "0" ] && echo "✅ Connected" || echo "❌ Disconnected"
    fi
}

print_system_status() {
    echo ""
    echo "💻 SYSTEM RESOURCES"
    echo "-------------------"
    
    if [ -f "$DATA_DIR/status-report.json" ]; then
        MEMORY_USAGE=$(jq -r '.system.memory_usage' "$DATA_DIR/status-report.json")
        DISK_USAGE=$(jq -r '.system.disk_usage' "$DATA_DIR/status-report.json")
        LOAD_AVG=$(jq -r '.system.load_average' "$DATA_DIR/status-report.json")
        
        echo "Memory Usage: ${MEMORY_USAGE}%"
        echo "Disk Usage: ${DISK_USAGE}%"
        echo "Load Average: $LOAD_AVG"
    fi
}

print_recent_alerts() {
    echo ""
    echo "🚨 RECENT ALERTS"
    echo "---------------"
    
    if [ -f "/opt/monitoring/logs/alerts.log" ]; then
        tail -5 "/opt/monitoring/logs/alerts.log" | while IFS= read -r line; do
            echo "$line"
        done
    else
        echo "No alerts logged"
    fi
}

main() {
    clear
    print_header
    print_application_status
    print_services_status
    print_external_status
    print_system_status
    print_recent_alerts
    echo ""
    echo "============================================"
    echo "Refresh: watch -n 30 /opt/monitoring/scripts/dashboard.sh"
    echo "Logs: tail -f /opt/monitoring/logs/health-check.log"
    echo "============================================"
}

main "$@"
EOF

        chmod +x /opt/monitoring/scripts/dashboard.sh
        
        echo "✅ Monitoring dashboard created"
        echo "  Run: /opt/monitoring/scripts/dashboard.sh"
ENDSSH
}

test_monitoring() {
    log "Testing monitoring system..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        echo "Running initial health check..."
        /opt/monitoring/scripts/health-check.sh
        
        echo "Running alert manager..."
        /opt/monitoring/scripts/alert-manager.sh
        
        echo "Displaying dashboard..."
        /opt/monitoring/scripts/dashboard.sh
ENDSSH
}

main() {
    log "Setting up comprehensive monitoring for MedSIP..."
    
    # Setup health monitoring
    setup_health_monitoring
    
    # Setup alerting
    setup_alerting
    
    # Setup cron jobs
    setup_cron_jobs
    
    # Create dashboard
    create_dashboard_script
    
    # Test the system
    test_monitoring
    
    log "🎉 Monitoring system setup completed!"
    log "Dashboard: ssh root@109.73.195.215 '/opt/monitoring/scripts/dashboard.sh'"
    log "Health checks run every 5 minutes"
    log "Logs: /opt/monitoring/logs/"
}

# Run if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi