
import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";

const DB_PATH = path.join(__dirname, "../../../", "crazy_eights.db");
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

// Create migrations table if it doesn't exist
function createMigrationsTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Get all executed migrations
function getExecutedMigrations(db: Database.Database): string[] {
  const stmt = db.prepare("SELECT name FROM migrations ORDER BY executed_at");
  const rows = stmt.all() as { name: string }[];
  return rows.map(row => row.name);
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
function executeMigration(db: Database.Database, migrationFile: string, direction: 'up' | 'down') {
  const migrationPath = path.join(MIGRATIONS_DIR, migrationFile);
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  // Split SQL by statements
  const statements = sql.split(';').filter(stmt => stmt.trim());
  
  db.transaction(() => {
    for (const statement of statements) {
      if (statement.trim()) {
        db.exec(statement);
      }
    }
    
    if (direction === 'up') {
      const stmt = db.prepare("INSERT INTO migrations (name) VALUES (?)");
      stmt.run(migrationFile);
      console.log(`✓ Applied migration: ${migrationFile}`);
    } else {
      const stmt = db.prepare("DELETE FROM migrations WHERE name = ?");
      stmt.run(migrationFile);
      console.log(`✓ Reverted migration: ${migrationFile}`);
    }
  })();
}

// Run migrations
function runMigrations(direction: 'up' | 'down') {
  const db = new Database(DB_PATH);
  
  try {
    createMigrationsTable(db);
    const executedMigrations = getExecutedMigrations(db);
    const migrationFiles = getMigrationFiles();
    
    if (direction === 'up') {
      // Apply pending migrations
      const pendingMigrations = migrationFiles.filter(file => !executedMigrations.includes(file));
      
      if (pendingMigrations.length === 0) {
        console.log("No pending migrations.");
        return;
      }
      
      console.log(`Applying ${pendingMigrations.length} migration(s):`);
      for (const migrationFile of pendingMigrations) {
        executeMigration(db, migrationFile, 'up');
      }
      
    } else {
      // Revert the last migration
      if (executedMigrations.length === 0) {
        console.log("No migrations to revert.");
        return;
      }
      
      const lastMigration = executedMigrations[executedMigrations.length - 1];
      const migrationFile = migrationFiles.find(file => file === lastMigration);
      
      if (migrationFile) {
        console.log(`Reverting migration: ${lastMigration}`);
        executeMigration(db, migrationFile, 'down');
      } else {
        console.log(`Warning: Migration file ${lastMigration} not found`);
      }
    }
    
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Main execution
const direction = process.argv[2] as 'up' | 'down';

if (direction !== 'up' && direction !== 'down') {
  console.log("Usage: ts-node migrate.ts [up|down]");
  process.exit(1);
}

runMigrations(direction);