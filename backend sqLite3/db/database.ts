import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";

const DB_PATH = path.join(__dirname, "../../../", "crazy_eights.db");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

class DatabaseManager {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma("foreign_keys = ON");
    this.initialize();
  }

  private initialize() {
    // Read and execute schema
    const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
    this.db.exec(schema);
    console.log("Database initialized successfully");
  }

  getDb(): Database.Database {
    return this.db;
  }

  close() {
    this.db.close();
  }
}

// Singleton instance
const dbManager = new DatabaseManager();
export const db = dbManager.getDb();

export default dbManager;