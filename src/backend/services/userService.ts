import { db } from "../db/database";
import { User } from "../types/database";

export class UserService {
  static createUser(username: string, email: string | null, passwordHash: string): User {
    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(username, email, passwordHash);
    return this.getUserById(result.lastInsertRowid as number)!;
  }

  static getUserById(id: number): User | undefined {
    const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
    return stmt.get(id) as User | undefined;
  }

  static getUserByUsername(username: string): User | undefined {
    const stmt = db.prepare("SELECT * FROM users WHERE username = ?");
    return stmt.get(username) as User | undefined;
  }

  static updateLastLogin(userId: number): void {
    const stmt = db.prepare(`
      UPDATE users
      SET last_login = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(userId);
  }

  static updateStats(userId: number, won: boolean): void {
    const stmt = db.prepare(`
      UPDATE users
      SET wins = wins + ?,
          losses = losses + ?,
          total_games = total_games + 1
      WHERE id = ?
    `);
    stmt.run(won ? 1 : 0, won ? 0 : 1, userId);
  }

  static getAllUsers(): User[] {
    const stmt = db.prepare("SELECT * FROM users");
    return stmt.all() as User[];
  }

  static deleteUser(userId: number): void {
    const stmt = db.prepare("DELETE FROM users WHERE id = ?");
    stmt.run(userId);
  }
}