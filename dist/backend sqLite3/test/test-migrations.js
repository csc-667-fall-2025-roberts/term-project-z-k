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
// Migration test script
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
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
    db;
    constructor() {
        // Use test database
        if (fs.existsSync(DB_PATH)) {
            fs.unlinkSync(DB_PATH);
        }
        this.db = new better_sqlite3_1.default(DB_PATH);
        this.db.pragma("foreign_keys = ON");
    }
    createMigrationsTable() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    }
    getExecutedMigrations() {
        const stmt = this.db.prepare("SELECT name FROM migrations ORDER BY executed_at");
        const rows = stmt.all();
        return rows.map(row => row.name);
    }
    getMigrationFiles() {
        if (!fs.existsSync(MIGRATIONS_DIR)) {
            return [];
        }
        return fs.readdirSync(MIGRATIONS_DIR)
            .filter(file => file.endsWith('.sql') && !file.endsWith('_down.sql'))
            .sort();
    }
    executeMigration(migrationFile, direction) {
        let sql;
        if (direction === 'up') {
            const migrationPath = path.join(MIGRATIONS_DIR, migrationFile);
            sql = fs.readFileSync(migrationPath, 'utf-8');
        }
        else {
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
            }
            else {
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
      `).all();
            const expectedTables = ['users', 'rooms', 'room_members', 'games', 'hands', 'turn_log', 'discard_pile', 'chat_messages'];
            const createdTables = tables.map(t => t.name);
            console.log(`\n${colors.yellow}Verifying tables...${colors.reset}`);
            for (const expectedTable of expectedTables) {
                if (createdTables.includes(expectedTable)) {
                    console.log(`${colors.green}✓ Table exists: ${expectedTable}${colors.reset}`);
                }
                else {
                    throw new Error(`Table missing: ${expectedTable}`);
                }
            }
            // Step 5: Verify indexes
            const indexes = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='index'
      `).all();
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
      `).all();
            if (finalTables.length === expectedTables.length) {
                console.log(`\n${colors.green}✅ All migration tests passed!${colors.reset}`);
            }
            else {
                throw new Error(`Table count mismatch: expected ${expectedTables.length}, got ${finalTables.length}`);
            }
        }
        catch (error) {
            console.log(`\n${colors.red}❌ Migration test failed: ${error.message}${colors.reset}`);
            process.exit(1);
        }
        finally {
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
