import { Pool } from 'pg';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Create migrations table if it doesn't exist
async function createMigrationsTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Get all executed migrations
async function getExecutedMigrations(pool: Pool): Promise<string[]> {
  const result = await pool.query('SELECT name FROM migrations ORDER BY executed_at');
  return result.rows.map((row: any) => row.name);
}

// Get all migration files
function getMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  return files;
}

// Execute a migration
async function executeMigration(pool: Pool, migrationFile: string, direction: 'up' | 'down') {
  const migrationPath = path.join(MIGRATIONS_DIR, migrationFile);
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Split SQL by statements (PostgreSQL can handle multiple statements)
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await client.query(statement);
      }
    }
    
    if (direction === 'up') {
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [migrationFile]);
      console.log(`✓ Applied migration: ${migrationFile}`);
    } else {
      await client.query('DELETE FROM migrations WHERE name = $1', [migrationFile]);
      console.log(`✓ Reverted migration: ${migrationFile}`);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Run migrations
async function runMigrations(direction: 'up' | 'down') {
  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'crazy_eights',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
  });
  
  try {
    await createMigrationsTable(pool);
    const executedMigrations = await getExecutedMigrations(pool);
    const migrationFiles = getMigrationFiles();
    
    if (direction === 'up') {
      // Apply pending migrations
      const pendingMigrations = migrationFiles.filter(file => !executedMigrations.includes(file));
      
      if (pendingMigrations.length === 0) {
        console.log('No pending migrations.');
        return;
      }
      
      console.log(`Applying ${pendingMigrations.length} migration(s):`);
      for (const migrationFile of pendingMigrations) {
        await executeMigration(pool, migrationFile, 'up');
      }
      
    } else {
      // Revert the last migration
      if (executedMigrations.length === 0) {
        console.log('No migrations to revert.');
        return;
      }
      
      const lastMigration = executedMigrations[executedMigrations.length - 1];
      const migrationFile = migrationFiles.find(file => file === lastMigration);
      
      if (migrationFile) {
        console.log(`Reverting migration: ${lastMigration}`);
        await executeMigration(pool, migrationFile, 'down');
      } else {
        console.log(`Warning: Migration file ${lastMigration} not found`);
      }
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Main execution
const direction = process.argv[2] as 'up' | 'down';

if (direction !== 'up' && direction !== 'down') {
  console.log('Usage: ts-node migrate.ts [up|down]');
  process.exit(1);
}

runMigrations(direction);
