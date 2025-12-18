"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const database_1 = require("../db/database");
const bcrypt_1 = __importDefault(require("bcrypt"));
class UserService {
    static createUser(username, email, passwordHash) {
        const stmt = database_1.db.prepare(`
      INSERT INTO users (username, email, password_hash)
      VALUES (?, ?, ?)
    `);
        const result = stmt.run(username, email, passwordHash);
        return this.getUserById(result.lastInsertRowid);
    }
    static getUserById(id) {
        const stmt = database_1.db.prepare("SELECT * FROM users WHERE id = ?");
        return stmt.get(id);
    }
    static getUserByUsername(username) {
        const stmt = database_1.db.prepare("SELECT * FROM users WHERE username = ?");
        return stmt.get(username);
    }
    static updateLastLogin(userId) {
        const stmt = database_1.db.prepare(`
      UPDATE users
      SET last_login = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
        stmt.run(userId);
    }
    static updateStats(userId, won) {
        const stmt = database_1.db.prepare(`
      UPDATE users
      SET wins = wins + ?,
          losses = losses + ?,
          total_games = total_games + 1
      WHERE id = ?
    `);
        stmt.run(won ? 1 : 0, won ? 0 : 1, userId);
    }
    static getAllUsers() {
        const stmt = database_1.db.prepare(`
        SELECT id, username, email, created_at, last_login, wins, losses, total_games
        FROM users
    `);
        return stmt.all();
    }
    static deleteUser(userId) {
        const stmt = database_1.db.prepare("DELETE FROM users WHERE id = ?");
        stmt.run(userId);
    }
    static async validateLogin(usernameOrEmail, password) {
        const user = database_1.db.prepare(`
        SELECT * FROM users 
        WHERE username = ? OR email = ?
    `).get(usernameOrEmail, usernameOrEmail);
        if (!user) {
            return null;
        }
        const isValid = await bcrypt_1.default.compare(password, user.password_hash);
        if (!isValid) {
            return null;
        }
        const { password_hash, ...publicUser } = user;
        return publicUser;
    }
}
exports.UserService = UserService;
