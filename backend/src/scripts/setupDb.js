/**
 * Apply SMARTSCAN schema + seed against Supabase.
 * Reads credentials from backend/.env only — never pass secrets on the CLI.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runSqlFile(client, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`Running ${path.basename(filePath)}...`);
  await client.query(sql);
  console.log(`OK: ${path.basename(filePath)}`);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL missing in backend/.env');
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in backend/.env');
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to Supabase Postgres');

  const root = path.join(__dirname, '../../../database');
  await runSqlFile(client, path.join(root, 'schema.sql'));
  await runSqlFile(client, path.join(root, 'migration_pin_requests.sql'));

  await client.end();
  console.log('Schema applied. Running seed...');

  require('./seed.js');
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
