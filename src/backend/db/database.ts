import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

import pkg from "pg";
const { Pool: PgPool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

dotenv.config();

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

class DatabaseManager {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'crazy_eights',
      password: process.env.DB_PASSWORD || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432'),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async initialize() {
    try {
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
      await this.pool.query(schema);
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  getPool(): Pool {
    return this.pool;
  }

  async query(text: string, params?: any[]) {
    return await this.pool.query(text, params);
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async close() {
    await this.pool.end();
  }
}

// Singleton instance
const dbManager = new DatabaseManager();

// Initialize immediately
(async () => {
  try {
    await dbManager.initialize();
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
})();

export const db = dbManager.getPool();
export default dbManager;
