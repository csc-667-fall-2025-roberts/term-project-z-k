import { Pool } from 'pg';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function showMigrationStatus() {
  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'crazy_eights',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
  });
  
  try {
    // Check if migrations table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'migrations'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Migrations table does not exist - database not initialized');
      console.log('   Run: npm run migrate:up');
      return;
    }

    // Get executed migrations
    const executedResult = await pool.query('SELECT name FROM migrations ORDER BY executed_at');
    const executedNames = executedResult.rows.map((row: any) => row.name);
    
    // Get all migration files
    const migrationFiles = fs.existsSync(MIGRATIONS_DIR) 
      ? fs.readdirSync(MIGRATIONS_DIR)
          .filter(file => file.endsWith('.sql') && !file.endsWith('_down.sql'))
          .sort()
      : [];

    console.log('📊 Migration Status:');
    console.log('===================');
    
    if (migrationFiles.length === 0) {
      console.log('No migration files found');
      return;
    }

    migrationFiles.forEach(file => {
      const isApplied = executedNames.includes(file);
      const status = isApplied ? '✅ Applied' : '❌ Pending';
      console.log(`${status} - ${file}`);
    });

    const pendingCount = migrationFiles.length - executedNames.length;
    if (pendingCount > 0) {
      console.log(`\n⚠️  ${pendingCount} migration(s) pending. Run: npm run migrate:up`);
    } else {
      console.log(`\n✓ All migrations applied`);
    }

  } catch (error) {
    console.error('Error checking migration status:', error);
  } finally {
    await pool.end();
  }
}

showMigrationStatus();
