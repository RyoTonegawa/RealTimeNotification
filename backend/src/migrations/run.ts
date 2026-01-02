/* eslint-disable no-console */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

async function run() {
  const databaseUrl =
    process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/app?sslmode=disable';
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const sql = readFileSync(join(__dirname, '../../migrations/001_init.sql'), 'utf-8');
  await client.query(sql);
  await client.end();
  console.log('Migration applied');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
