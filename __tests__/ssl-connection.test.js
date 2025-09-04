#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

console.log('=== DIRECT SSL CONNECTION TEST ===\n');

// Validate environment
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const TWC_HOSTNAME = process.env.TWC_DB_HOSTNAME || '1bb84d1fbea33d62faf51337.twc1.net';

// Test different SSL configurations
async function testSSLConfig(name, sslConfig) {
  console.log(`Testing: ${name}`);
  console.log('SSL Config:', JSON.stringify(sslConfig, null, 2));
  
  const config = {
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig
  };
  
  const pool = new Pool(config);
  
  try {
    const startTime = Date.now();
    const result = await pool.query('SELECT 1 as test, NOW() as time');
    const duration = Date.now() - startTime;
    
    console.log(`✅ SUCCESS (${duration}ms)`);
    console.log('Result:', result.rows[0]);
    console.log('');
    
    await pool.end();
    return true;
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
    console.log('Error code:', error.code);
    console.log('');
    
    try { await pool.end(); } catch {}
    return false;
  }
}

async function runTests() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@')); // Hide password
  console.log('');
  
  // Test 1: No SSL
  await testSSLConfig('No SSL', false);
  
  // Test 2: TWC Cloud certificate (if exists) - SECURE APPROACH
  const caCertPath = path.join(process.cwd(), '.ssl-certs', 'twc-ca.pem');
  if (fs.existsSync(caCertPath)) {
    try {
      const caCert = fs.readFileSync(caCertPath, 'utf8');
      await testSSLConfig('TWC Cloud CA (Secure)', {
        rejectUnauthorized: true,
        ca: caCert,
        checkServerIdentity: (host, cert) => {
          if (host === TWC_HOSTNAME) {
            return undefined;
          }
          throw new Error(`Hostname verification failed for ${host}`);
        }
      });
    } catch (error) {
      console.log('❌ Failed to read TWC CA certificate:', error.message);
    }
  } else {
    console.log('❌ TWC CA certificate not found at:', caCertPath);
  }
  
  // Test 3: System default SSL
  await testSSLConfig('System Default SSL', true);
  
  // Test 4: Permissive SSL (INSECURE - for debugging only)
  console.log('⚠️  WARNING: Testing insecure SSL configuration for debugging purposes only');
  await testSSLConfig('Permissive SSL (INSECURE)', {
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined
  });
  
  console.log('=== TEST COMPLETED ===');
}

runTests().catch(console.error);