
// Migration test script
import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";

const DB_PATH = path.join(__dirname, "../../../", "crazy_eights_test.db");
const MIGRATIONS_DIR = path.join(__dirname, "../db/migrations");

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

class MigrationTester {
  private db: Database.Database;

  constructor() {
    // Use test database
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }
    this.db = new Database(DB_PATH);
    this.db.pragma("foreign_keys = ON");
  }

  private createMigrationsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private getExecutedMigrations(): string[] {
    const stmt = this.db.prepare("SELECT name FROM migrations ORDER BY executed_at");
    const rows = stmt.all() as { name: string }[];
    return rows.map(row => row.name);
  }

  private getMigrationFiles(): string[] {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      return [];
    }
    
    return fs.readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql') && !file.endsWith('_down.sql'))
      .sort();
  }

  private executeMigration(migrationFile: string, direction: 'up' | 'down') {
    let sql: string;
    
    if (direction === 'up') {
      const migrationPath = path.join(MIGRATIONS_DIR, migrationFile);
      sql = fs.readFileSync(migrationPath, 'utf-8');
    } else {
      const downMigrationFile = migrationFile.replace('.sql', '_down.sql');
      const downMigrationPath = path.join(MIGRATIONS_DIR, downMigrationFile);
      
      if (!fs.existsSync(downMigrationPath)) {
        throw new Error(`Down migration file not found: ${downMigrationFile}`);
      }
      
      sql = fs.readFileSync(downMigrationPath, 'utf-8');
    }
    
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    this.db.transaction(() => {
      for (const statement of statements) {
        if (statement.trim()) {
          this.db.exec(statement);
        }
      }
      
      if (direction === 'up') {
        const stmt = this.db.prepare("INSERT INTO migrations (name) VALUES (?)");
        stmt.run(migrationFile);
      } else {
        const stmt = this.db.prepare("DELETE FROM migrations WHERE name = ?");
        stmt.run(migrationFile);
      }
    })();
  }

  testMigrations() {
    console.log(`\n${colors.blue}🧪 Testing Migrations${colors.reset}`);
    console.log(`${colors.blue}=======================${colors.reset}`);

    try {
      // Step 1: Create migrations table
      this.createMigrationsTable();
      console.log(`${colors.green}✓ Created migrations table${colors.reset}`);

      // Step 2: Get migration files
      const migrationFiles = this.getMigrationFiles();
      if (migrationFiles.length === 0) {
        throw new Error("No migration files found");
      }
      console.log(`${colors.green}✓ Found ${migrationFiles.length} migration files${colors.reset}`);

      // Step 3: Apply all migrations
      console.log(`\n${colors.yellow}Applying migrations...${colors.reset}`);
      for (const migrationFile of migrationFiles) {
        this.executeMigration(migrationFile, 'up');
        console.log(`${colors.green}✓ Applied: ${migrationFile}${colors.reset}`);
      }

      // Step 4: Verify all tables were created
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'
      `).all() as { name: string }[];

      const expectedTables = ['users', 'rooms', 'room_members', 'games', 'hands', 'turn_log', 'discard_pile', 'chat_messages'];
      const createdTables = tables.map(t => t.name);

      console.log(`\n${colors.yellow}Verifying tables...${colors.reset}`);
      for (const expectedTable of expectedTables) {
        if (createdTables.includes(expectedTable)) {
          console.log(`${colors.green}✓ Table exists: ${expectedTable}${colors.reset}`);
        } else {
          throw new Error(`Table missing: ${expectedTable}`);
        }
      }

      // Step 5: Verify indexes
      const indexes = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='index'
      `).all() as { name: string }[];

      console.log(`\n${colors.yellow}Verifying indexes...${colors.reset}`);
      console.log(`${colors.green}✓ Found ${indexes.length} indexes${colors.reset}`);

      // Step 6: Test rollback (revert last migration)
      console.log(`\n${colors.yellow}Testing rollback...${colors.reset}`);
      const lastMigration = migrationFiles[migrationFiles.length - 1];
      this.executeMigration(lastMigration, 'down');
      console.log(`${colors.green}✓ Reverted: ${lastMigration}${colors.reset}`);

      // Step 7: Re-apply the migration
      console.log(`\n${colors.yellow}Re-applying migration...${colors.reset}`);
      this.executeMigration(lastMigration, 'up');
      console.log(`${colors.green}✓ Re-applied: ${lastMigration}${colors.reset}`);

      // Step 8: Final verification
      const finalTables = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'
      `).all() as { name: string }[];

      if (finalTables.length === expectedTables.length) {
        console.log(`\n${colors.green}✅ All migration tests passed!${colors.reset}`);
      } else {
        throw new Error(`Table count mismatch: expected ${expectedTables.length}, got ${finalTables.length}`);
      }

    } catch (error: any) {
      console.log(`\n${colors.red}❌ Migration test failed: ${error.message}${colors.reset}`);
      process.exit(1);
    } finally {
      this.db.close();
      // Clean up test database
      if (fs.existsSync(DB_PATH)) {
        fs.unlinkSync(DB_PATH);
      }
    }
  }
}

// Run the tests
const tester = new MigrationTester();
tester.testMigrations();