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
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
async function showMigrationStatus() {
    const pool = new pg_1.Pool({
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
        const executedNames = executedResult.rows.map((row) => row.name);
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
        }
        else {
            console.log(`\n✓ All migrations applied`);
        }
    }
    catch (error) {
        console.error('Error checking migration status:', error);
    }
    finally {
        await pool.end();
    }
}
showMigrationStatus();
