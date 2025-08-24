#!/usr/bin/env node

/**
 * Production Health Check Script for venorus.net
 * Monitors application health, database, Redis, and system resources
 */

const fs = require('fs').promises;
const path = require('path');
const http = require('http');

class HealthMonitor {
  constructor() {
    this.logFile = '/opt/venorus/logs/health-check.log';
    this.dataDir = '/opt/venorus/logs/monitoring';
    this.healthEndpoint = 'http://localhost:3000/api/health';
    this.dbStatusEndpoint = 'http://localhost:3000/api/db-status';
    this.redisStatusEndpoint = 'http://localhost:3000/api/redis-status';
  }

  async log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data
    };

    try {
      await fs.mkdir(path.dirname(this.logFile), { recursive: true });
      await fs.appendFile(this.logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('Failed to write log:', error.message);
    }

    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
    if (Object.keys(data).length > 0) {
      console.log('Data:', JSON.stringify(data, null, 2));
    }
  }

  async httpRequest(url) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const req = http.get(url, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          
          try {
            const jsonData = JSON.parse(data);
            resolve({
              statusCode: res.statusCode,
              responseTime,
              data: jsonData
            });
          } catch (error) {
            resolve({
              statusCode: res.statusCode,
              responseTime,
              data: data,
              error: 'Invalid JSON response'
            });
          }
        });
      });

      req.on('error', (error) => {
        reject({
          error: error.message,
          responseTime: Date.now() - startTime
        });
      });

      req.setTimeout(5000, () => {
        req.destroy();
        reject({
          error: 'Request timeout',
          responseTime: Date.now() - startTime
        });
      });
    });
  }

  async checkApplicationHealth() {
    try {
      const result = await this.httpRequest(this.healthEndpoint);
      
      if (result.statusCode === 200) {
        await this.log('info', 'Application health check passed', {
          responseTime: result.responseTime,
          status: result.data.status
        });
        return { healthy: true, responseTime: result.responseTime };
      } else {
        await this.log('error', 'Application health check failed', {
          statusCode: result.statusCode,
          responseTime: result.responseTime
        });
        return { healthy: false, error: `HTTP ${result.statusCode}` };
      }
    } catch (error) {
      await this.log('error', 'Application health check error', error);
      return { healthy: false, error: error.error || error.message };
    }
  }

  async checkDatabaseHealth() {
    try {
      const result = await this.httpRequest(this.dbStatusEndpoint);
      
      if (result.statusCode === 200 && result.data.status !== 'disconnected') {
        await this.log('info', 'Database health check passed', {
          responseTime: result.responseTime,
          status: result.data.status
        });
        return { healthy: true, responseTime: result.responseTime };
      } else {
        await this.log('error', 'Database health check failed', {
          statusCode: result.statusCode,
          responseTime: result.responseTime,
          status: result.data?.status,
          error: result.data?.error
        });
        return { 
          healthy: false, 
          error: result.data?.error || `HTTP ${result.statusCode}` 
        };
      }
    } catch (error) {
      await this.log('error', 'Database health check error', error);
      return { healthy: false, error: error.error || error.message };
    }
  }

  async checkRedisHealth() {
    try {
      const result = await this.httpRequest(this.redisStatusEndpoint);
      
      if (result.statusCode === 200 && result.data.success && result.data.redis?.connected) {
        await this.log('info', 'Redis health check passed', {
          responseTime: result.responseTime,
          connected: result.data.redis.connected,
          cacheKeys: result.data.cache_stats?.total_keys
        });
        return { healthy: true, responseTime: result.responseTime };
      } else {
        await this.log('error', 'Redis health check failed', {
          statusCode: result.statusCode,
          responseTime: result.responseTime,
          connected: result.data?.redis?.connected
        });
        return { 
          healthy: false, 
          error: `Redis not connected or HTTP ${result.statusCode}` 
        };
      }
    } catch (error) {
      await this.log('error', 'Redis health check error', error);
      return { healthy: false, error: error.error || error.message };
    }
  }

  async checkSystemResources() {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Check memory usage
      const { stdout: memInfo } = await execAsync('free -m');
      const memLines = memInfo.split('\n');
      const memData = memLines[1].split(/\s+/);
      const totalMem = parseInt(memData[1]);
      const usedMem = parseInt(memData[2]);
      const memUsage = Math.round((usedMem / totalMem) * 100);

      // Check disk usage
      const { stdout: diskInfo } = await execAsync('df -h /');
      const diskLines = diskInfo.split('\n');
      const diskData = diskLines[1].split(/\s+/);
      const diskUsage = parseInt(diskData[4].replace('%', ''));

      // Check CPU load
      const { stdout: loadInfo } = await execAsync('cat /proc/loadavg');
      const loadAvg = parseFloat(loadInfo.split(' ')[0]);

      const systemHealth = {
        memory: { usage: memUsage, total: totalMem, used: usedMem },
        disk: { usage: diskUsage },
        cpu: { loadAvg }
      };

      const alerts = [];
      if (memUsage > 90) alerts.push(`High memory usage: ${memUsage}%`);
      if (diskUsage > 85) alerts.push(`High disk usage: ${diskUsage}%`);
      if (loadAvg > 2) alerts.push(`High CPU load: ${loadAvg}`);

      if (alerts.length > 0) {
        await this.log('warn', 'System resource alerts', { systemHealth, alerts });
      } else {
        await this.log('info', 'System resources healthy', systemHealth);
      }

      return { healthy: alerts.length === 0, systemHealth, alerts };
    } catch (error) {
      await this.log('error', 'System resource check failed', { error: error.message });
      return { healthy: false, error: error.message };
    }
  }

  async saveHealthData(healthData) {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const dataFile = path.join(this.dataDir, `health-${new Date().toISOString().split('T')[0]}.json`);
      
      let existingData = [];
      try {
        const fileContent = await fs.readFile(dataFile, 'utf8');
        existingData = JSON.parse(fileContent);
      } catch (error) {
        // File doesn't exist or is invalid, start fresh
      }

      existingData.push({
        timestamp: new Date().toISOString(),
        ...healthData
      });

      // Keep only last 1000 entries to prevent file from growing too large
      if (existingData.length > 1000) {
        existingData = existingData.slice(-1000);
      }

      await fs.writeFile(dataFile, JSON.stringify(existingData, null, 2));
    } catch (error) {
      await this.log('error', 'Failed to save health data', { error: error.message });
    }
  }

  async runHealthCheck() {
    await this.log('info', 'Starting health check');

    const [appHealth, dbHealth, redisHealth, systemHealth] = await Promise.all([
      this.checkApplicationHealth(),
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkSystemResources()
    ]);

    const overallHealth = {
      healthy: appHealth.healthy && dbHealth.healthy && redisHealth.healthy && systemHealth.healthy,
      application: appHealth,
      database: dbHealth,
      redis: redisHealth,
      system: systemHealth
    };

    await this.saveHealthData(overallHealth);

    const status = overallHealth.healthy ? 'HEALTHY' : 'UNHEALTHY';
    await this.log(overallHealth.healthy ? 'info' : 'error', `Health check completed: ${status}`, overallHealth);

    return overallHealth;
  }
}

// Run health check if script is executed directly
if (require.main === module) {
  const monitor = new HealthMonitor();
  monitor.runHealthCheck()
    .then(result => {
      process.exit(result.healthy ? 0 : 1);
    })
    .catch(error => {
      console.error('Health check failed:', error);
      process.exit(1);
    });
}

module.exports = HealthMonitor;