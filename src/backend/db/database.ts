
import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

class DatabaseManager {
  private pool: Pool;
  private initialized: boolean = false;

constructor() {
  console.log('=== DATABASE CONFIG DEBUG ===');
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  console.log('DATABASE_URL value:', process.env.DATABASE_URL);
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_NAME:', process.env.DB_NAME);
  console.log('DB_USER:', process.env.DB_USER);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('============================');

  const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'crazy_eights',
        password: process.env.DB_PASSWORD || 'postgres',
        port: parseInt(process.env.DB_PORT || '5432'),
      };

  console.log('Pool config:', JSON.stringify(poolConfig, null, 2));

    this.pool = new Pool({
      ...poolConfig,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increased timeout for Render
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    this.pool.on('connect', () => {
      console.log('Database client connected');
    });
  }

  async initialize() {
    if (this.initialized) {
      console.log('Database already initialized');
      return;
    }

    try {
      // Test connection first
      const client = await this.pool.connect();
      console.log('Database connection successful');
      client.release();

      // Run schema if schema.sql exists
      if (fs.existsSync(SCHEMA_PATH)) {
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
        await this.pool.query(schema);
        console.log('Database schema initialized successfully');
      } else {
        console.log('No schema.sql found, skipping schema initialization');
      }

      this.initialized = true;
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

  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
const dbManager = new DatabaseManager();

// Export initialization promise so server can wait for it
export const initializeDatabase = async () => {
  try {
    await dbManager.initialize();
    console.log('Database initialization complete');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
};

export const db = dbManager.getPool();
export default dbManager;

/*
import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

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
*/
