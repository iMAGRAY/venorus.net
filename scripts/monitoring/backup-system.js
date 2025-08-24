#!/usr/bin/env node

/**
 * Automated Backup System for venorus.net
 * Handles PostgreSQL, Redis, and file backups with rotation
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class BackupSystem {
  constructor() {
    this.backupDir = '/opt/venorus/backups';
    this.logFile = '/opt/venorus/logs/backup.log';
    this.maxBackups = 7; // Keep 7 days of backups
    
    // Database configuration from environment
    this.dbConfig = {
      host: process.env.POSTGRESQL_HOST || 'localhost',
      port: process.env.POSTGRESQL_PORT || 5432,
      user: process.env.POSTGRESQL_USER || 'postgres',
      database: process.env.POSTGRESQL_DBNAME || 'venorus',
      password: process.env.POSTGRESQL_PASSWORD
    };
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

  async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'postgresql'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'redis'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'files'), { recursive: true });
      await this.log('info', 'Backup directories ensured');
    } catch (error) {
      await this.log('error', 'Failed to create backup directories', { error: error.message });
      throw error;
    }
  }

  async backupPostgreSQL() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, 'postgresql', `venorus-db-${timestamp}.sql`);
    
    try {
      await this.log('info', 'Starting PostgreSQL backup');
      
      // Set password via environment variable
      const env = { ...process.env, PGPASSWORD: this.dbConfig.password };
      
      const pgDumpCmd = `pg_dump -h ${this.dbConfig.host} -p ${this.dbConfig.port} -U ${this.dbConfig.user} -d ${this.dbConfig.database} --no-password --verbose --clean --if-exists --create > ${backupFile}`;
      
      const { stdout, stderr } = await execAsync(pgDumpCmd, { env });
      
      // Compress the backup
      await execAsync(`gzip ${backupFile}`);
      const compressedFile = `${backupFile}.gz`;
      
      // Verify backup file exists and has content
      const stats = await fs.stat(compressedFile);
      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }

      await this.log('info', 'PostgreSQL backup completed', {
        file: compressedFile,
        size: Math.round(stats.size / 1024) + ' KB'
      });

      return compressedFile;
    } catch (error) {
      await this.log('error', 'PostgreSQL backup failed', { error: error.message });
      throw error;
    }
  }

  async backupRedis() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, 'redis', `redis-${timestamp}.rdb`);
    
    try {
      await this.log('info', 'Starting Redis backup');
      
      // Create Redis backup using BGSAVE
      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = process.env.REDIS_PORT || 6379;
      const redisPassword = process.env.REDIS_PASSWORD;
      
      let redisCmd = `redis-cli -h ${redisHost} -p ${redisPort}`;
      if (redisPassword) {
        redisCmd += ` -a "${redisPassword}"`;
      }
      
      // Trigger background save
      await execAsync(`${redisCmd} BGSAVE`);
      
      // Wait for save to complete
      let saveInProgress = true;
      while (saveInProgress) {
        const { stdout } = await execAsync(`${redisCmd} INFO persistence`);
        saveInProgress = stdout.includes('rdb_bgsave_in_progress:1');
        if (saveInProgress) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Copy the RDB file
      const rdbSource = '/var/lib/redis/dump.rdb'; // Default Redis dump location
      try {
        await execAsync(`cp ${rdbSource} ${backupFile}`);
        
        // Compress the backup
        await execAsync(`gzip ${backupFile}`);
        const compressedFile = `${backupFile}.gz`;
        
        const stats = await fs.stat(compressedFile);
        await this.log('info', 'Redis backup completed', {
          file: compressedFile,
          size: Math.round(stats.size / 1024) + ' KB'
        });

        return compressedFile;
      } catch (copyError) {
        // If we can't copy the RDB file, create a backup using SAVE command
        await this.log('warn', 'Could not copy RDB file, using SAVE command instead');
        
        const { stdout } = await execAsync(`${redisCmd} --rdb ${backupFile} --scan`);
        await execAsync(`gzip ${backupFile}`);
        
        const compressedFile = `${backupFile}.gz`;
        const stats = await fs.stat(compressedFile);
        
        await this.log('info', 'Redis backup completed (alternative method)', {
          file: compressedFile,
          size: Math.round(stats.size / 1024) + ' KB'
        });

        return compressedFile;
      }
    } catch (error) {
      await this.log('error', 'Redis backup failed', { error: error.message });
      throw error;
    }
  }

  async backupFiles() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, 'files', `files-${timestamp}.tar.gz`);
    
    try {
      await this.log('info', 'Starting files backup');
      
      // Backup important application files (excluding node_modules, .next, logs)
      const sourceDir = '/opt/venorus';
      const excludePatterns = [
        'node_modules',
        '.next',
        'logs',
        'backups',
        '.git',
        'coverage',
        'dist',
        'out'
      ];
      
      const excludeArgs = excludePatterns.map(pattern => `--exclude='${pattern}'`).join(' ');
      const tarCmd = `tar -czf ${backupFile} -C ${sourceDir} ${excludeArgs} .`;
      
      await execAsync(tarCmd);
      
      const stats = await fs.stat(backupFile);
      await this.log('info', 'Files backup completed', {
        file: backupFile,
        size: Math.round(stats.size / (1024 * 1024)) + ' MB'
      });

      return backupFile;
    } catch (error) {
      await this.log('error', 'Files backup failed', { error: error.message });
      throw error;
    }
  }

  async cleanOldBackups() {
    try {
      await this.log('info', 'Cleaning old backups');
      
      const backupTypes = ['postgresql', 'redis', 'files'];
      let totalCleaned = 0;
      
      for (const type of backupTypes) {
        const typeDir = path.join(this.backupDir, type);
        
        try {
          const files = await fs.readdir(typeDir);
          
          // Sort files by modification time (newest first)
          const fileStats = await Promise.all(
            files.map(async file => ({
              name: file,
              path: path.join(typeDir, file),
              mtime: (await fs.stat(path.join(typeDir, file))).mtime
            }))
          );
          
          fileStats.sort((a, b) => b.mtime - a.mtime);
          
          // Keep only the newest maxBackups files
          const filesToDelete = fileStats.slice(this.maxBackups);
          
          for (const file of filesToDelete) {
            await fs.unlink(file.path);
            totalCleaned++;
            await this.log('info', `Deleted old backup: ${file.name}`);
          }
        } catch (error) {
          await this.log('warn', `Failed to clean ${type} backups`, { error: error.message });
        }
      }
      
      await this.log('info', 'Backup cleanup completed', { filesDeleted: totalCleaned });
    } catch (error) {
      await this.log('error', 'Backup cleanup failed', { error: error.message });
    }
  }

  async verifyBackup(backupFile) {
    try {
      const stats = await fs.stat(backupFile);
      
      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }
      
      // Test if compressed file is valid
      if (backupFile.endsWith('.gz')) {
        await execAsync(`gzip -t ${backupFile}`);
      } else if (backupFile.endsWith('.tar.gz')) {
        await execAsync(`tar -tzf ${backupFile} > /dev/null`);
      }
      
      await this.log('info', 'Backup verification passed', {
        file: path.basename(backupFile),
        size: Math.round(stats.size / 1024) + ' KB'
      });
      
      return true;
    } catch (error) {
      await this.log('error', 'Backup verification failed', {
        file: path.basename(backupFile),
        error: error.message
      });
      return false;
    }
  }

  async runBackup() {
    await this.log('info', 'Starting automated backup process');
    
    try {
      await this.ensureBackupDirectory();
      
      const results = {
        postgresql: null,
        redis: null,
        files: null,
        success: true,
        errors: []
      };
      
      // Run backups in parallel for better performance
      const backupPromises = [
        this.backupPostgreSQL().then(file => ({ type: 'postgresql', file })).catch(error => ({ type: 'postgresql', error })),
        this.backupRedis().then(file => ({ type: 'redis', file })).catch(error => ({ type: 'redis', error })),
        this.backupFiles().then(file => ({ type: 'files', file })).catch(error => ({ type: 'files', error }))
      ];
      
      const backupResults = await Promise.all(backupPromises);
      
      for (const result of backupResults) {
        if (result.error) {
          results.success = false;
          results.errors.push(`${result.type}: ${result.error.message}`);
          results[result.type] = { error: result.error.message };
        } else {
          const verified = await this.verifyBackup(result.file);
          results[result.type] = { 
            file: result.file, 
            verified,
            size: (await fs.stat(result.file)).size
          };
          if (!verified) {
            results.success = false;
            results.errors.push(`${result.type}: Backup verification failed`);
          }
        }
      }
      
      // Clean old backups regardless of current backup status
      await this.cleanOldBackups();
      
      const status = results.success ? 'SUCCESS' : 'PARTIAL_SUCCESS';
      await this.log(results.success ? 'info' : 'warn', `Backup process completed: ${status}`, results);
      
      return results;
    } catch (error) {
      await this.log('error', 'Backup process failed', { error: error.message });
      throw error;
    }
  }
}

// Run backup if script is executed directly
if (require.main === module) {
  const backup = new BackupSystem();
  backup.runBackup()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Backup failed:', error);
      process.exit(1);
    });
}

module.exports = BackupSystem;