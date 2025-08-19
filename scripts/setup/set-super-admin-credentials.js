/*
  Set super-admin credentials script
  - Updates username and password for the super-admin user
  - Targets user with id=1 if exists; otherwise the first user with role 'super_admin'
  - Requires DATABASE_URL in environment (.env.local or process env)

  Usage:
    node scripts/setup/set-super-admin-credentials.js

  Optional env vars:
    SUPERADMIN_USERNAME=venorus SUPERADMIN_PASSWORD='Q1w2e3r4t5!' node scripts/setup/set-super-admin-credentials.js
*/

const { Client } = require('pg')
const bcrypt = require('bcrypt')
const path = require('path')
const fs = require('fs')

// Load env from .env.local if present
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env.local') })
} catch {}

const USERNAME = process.env.SUPERADMIN_USERNAME || 'venorus'
const PASSWORD = process.env.SUPERADMIN_PASSWORD || 'Q1w2e3r4t5!'
const BCRYPT_ROUNDS = 12

async function setSuperAdminCredentials() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set. Configure your database connection string and rerun.')
    process.exit(1)
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL })

  try {
    await client.connect()

    // Prefer user with id=1
    let userResult = await client.query('SELECT id, username FROM users WHERE id = 1')
    let targetUserId = null

    if (userResult.rows.length > 0) {
      targetUserId = userResult.rows[0].id
    } else {
      // Fallback to any super_admin
      const fallback = await client.query(
        `SELECT u.id, u.username
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE r.name = 'super_admin'
         ORDER BY u.id ASC
         LIMIT 1`
      )
      if (fallback.rows.length === 0) {
        console.error('ERROR: No super_admin user found. Create one first, then rerun this script.')
        process.exit(1)
      }
      targetUserId = fallback.rows[0].id
    }

    // Ensure username uniqueness
    const dup = await client.query('SELECT id FROM users WHERE username = $1 AND id <> $2', [USERNAME, targetUserId])
    if (dup.rows.length > 0) {
      console.error(`ERROR: Username "${USERNAME}" is already taken by user id=${dup.rows[0].id}. Choose another username or rename that user first.`)
      process.exit(1)
    }

    // Hash password
    const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS)

    // Update credentials
    await client.query(
      `UPDATE users
       SET username = $1,
           password_hash = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [USERNAME, passwordHash, targetUserId]
    )

    // Optional: write a confirmation file for operator
    const outPath = path.join(__dirname, '../.admin-credentials-confirmation.txt')
    const content = `Super Admin credentials updated
===============================
User ID: ${targetUserId}
Username: ${USERNAME}
Password: ${PASSWORD}
Timestamp: ${new Date().toISOString()}

NOTE: Remove this file after you record the credentials.`
    try {
      fs.writeFileSync(outPath, content, 'utf8')
    } catch {}

    console.log('✅ Super-admin credentials updated successfully:')
    console.log(`   - User ID: ${targetUserId}`)
    console.log(`   - Username: ${USERNAME}`)
    console.log('   - Password: (hidden)')
    console.log('   A confirmation file was written to scripts/.admin-credentials-confirmation.txt')
  } catch (err) {
    console.error('❌ Failed to update super-admin credentials:')
    console.error(err?.message || err)
    process.exit(1)
  } finally {
    try { await client.end() } catch {}
  }
}

if (require.main === module) {
  setSuperAdminCredentials()
}

module.exports = setSuperAdminCredentials


