import { db } from "../db/database";
import { User } from "../types/database";
import bcrypt from 'bcrypt';

export class UserService {
  static async createUser(username: string, email: string | null, passwordHash: string): Promise<User> {
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [username, email, passwordHash]
    );
    return result.rows[0] as User;
  }

  static async getUserById(id: number): Promise<User | undefined> {
    const result = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] as User | undefined;
  }

  static async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0] as User | undefined;
  }

  static async updateLastLogin(userId: number): Promise<void> {
    await db.query(
      `UPDATE users
       SET last_login = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId]
    );
  }

  static async updateStats(userId: number, won: boolean): Promise<void> {
    await db.query(
      `UPDATE users
       SET wins = wins + $1,
           losses = losses + $2,
           total_games = total_games + 1
       WHERE id = $3`,
      [won ? 1 : 0, won ? 0 : 1, userId]
    );
  }

  static async getAllUsers(): Promise<User[]> {
    const result = await db.query(
      `SELECT id, username, email, created_at, last_login, wins, losses, total_games
       FROM users`
    );
    return result.rows as User[];
  }

  static async deleteUser(userId: number): Promise<void> {
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
  }

  static async validateLogin(usernameOrEmail: string, password: string): Promise<Omit<User, 'password_hash'> | null> {
    const result = await db.query(
      `SELECT * FROM users 
       WHERE username = $1 OR email = $1`,
      [usernameOrEmail]
    );

    const user = result.rows[0] as User | undefined;

    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return null;
    }

    const { password_hash, ...publicUser } = user;
    return publicUser;
  }
}
