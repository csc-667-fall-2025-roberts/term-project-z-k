"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const DB_PATH = path.join(__dirname, "../../../", "crazy_eights.db");
const MIGRATIONS_DIR = path.join(__dirname, "migrations");
// Create migrations table if it doesn't exist
function createMigrationsTable(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
// Get all executed migrations
function getExecutedMigrations(db) {
    const stmt = db.prepare("SELECT name FROM migrations ORDER BY executed_at");
    const rows = stmt.all();
    return rows.map(row => row.name);
}
// Get all migration files
function getMigrationFiles() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        return [];
    }
    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(file => file.endsWith('.sql'))
        .sort();
    return files;
}
// Execute a migration
function executeMigration(db, migrationFile, direction) {
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
        }
        else {
            const stmt = db.prepare("DELETE FROM migrations WHERE name = ?");
            stmt.run(migrationFile);
            console.log(`✓ Reverted migration: ${migrationFile}`);
        }
    })();
}
// Run migrations
function runMigrations(direction) {
    const db = new better_sqlite3_1.default(DB_PATH);
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
        }
        else {
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
            }
            else {
                console.log(`Warning: Migration file ${lastMigration} not found`);
            }
        }
    }
    catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
    finally {
        db.close();
    }
}
// Main execution
const direction = process.argv[2];
if (direction !== 'up' && direction !== 'down') {
    console.log("Usage: ts-node migrate.ts [up|down]");
    process.exit(1);
}
runMigrations(direction);
