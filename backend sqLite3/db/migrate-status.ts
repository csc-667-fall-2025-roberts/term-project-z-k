//vibe coded using chat gpt and deepseek

import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";

const DB_PATH = path.join(__dirname, "../../../", "crazy_eights.db");
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

function showMigrationStatus() {
  const db = new Database(DB_PATH);
  
  try {
    // Check if migrations table exists
    const migrationsTableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'
    `).get();

    if (!migrationsTableExists) {
      console.log("❌ Migrations table does not exist - database not initialized");
      console.log("   Run: npm run migrate:up");
      return;
    }

    // Get executed migrations
    const executedMigrations = db.prepare("SELECT name FROM migrations ORDER BY executed_at")
      .all() as { name: string }[];
    
    const executedNames = executedMigrations.map(m => m.name);
    
    // Get all migration files
    const migrationFiles = fs.existsSync(MIGRATIONS_DIR) 
      ? fs.readdirSync(MIGRATIONS_DIR)
          .filter(file => file.endsWith('.sql') && !file.endsWith('_down.sql'))
          .sort()
      : [];

    console.log("📊 Migration Status:");
    console.log("===================");
    
    if (migrationFiles.length === 0) {
      console.log("No migration files found");
      return;
    }

    migrationFiles.forEach(file => {
      const isApplied = executedNames.includes(file);
      const status = isApplied ? "✅ Applied" : "❌ Pending";
      console.log(`${status} - ${file}`);
    });

    const pendingCount = migrationFiles.length - executedNames.length;
    if (pendingCount > 0) {
      console.log(`\n⚠️  ${pendingCount} migration(s) pending. Run: npm run migrate:up`);
    } else {
      console.log(`\n✓ All migrations applied`);
    }

  } catch (error) {
    console.error("Error checking migration status:", error);
  } finally {
    db.close();
  }
}

showMigrationStatus();