"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const database_1 = require("../db/database");
const bcrypt_1 = __importDefault(require("bcrypt"));
class UserService {
    static async createUser(username, email, passwordHash) {
        const result = await database_1.db.query(`INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING *`, [username, email, passwordHash]);
        return result.rows[0];
    }
    static async getUserById(id) {
        const result = await database_1.db.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0];
    }
    static async getUserByUsername(username) {
        const result = await database_1.db.query('SELECT * FROM users WHERE username = $1', [username]);
        return result.rows[0];
    }
    static async updateLastLogin(userId) {
        await database_1.db.query(`UPDATE users
       SET last_login = CURRENT_TIMESTAMP
       WHERE id = $1`, [userId]);
    }
    static async updateStats(userId, won) {
        await database_1.db.query(`UPDATE users
       SET wins = wins + $1,
           losses = losses + $2,
           total_games = total_games + 1
       WHERE id = $3`, [won ? 1 : 0, won ? 0 : 1, userId]);
    }
    static async getAllUsers() {
        const result = await database_1.db.query(`SELECT id, username, email, created_at, last_login, wins, losses, total_games
       FROM users`);
        return result.rows;
    }
    static async deleteUser(userId) {
        await database_1.db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    static async validateLogin(usernameOrEmail, password) {
        const result = await database_1.db.query(`SELECT * FROM users 
       WHERE username = $1 OR email = $1`, [usernameOrEmail]);
        const user = result.rows[0];
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
