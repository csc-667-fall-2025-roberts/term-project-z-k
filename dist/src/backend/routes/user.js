"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userService_1 = require("../services/userService");
const bcrypt_1 = __importDefault(require("bcrypt"));
const router = express_1.default.Router();
// Create new user
router.post("/", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !password || !email) {
            return res.status(400).json({
                error: 'Username, email, and password are required'
            });
        }
        if (password.length < 8) {
            return res.status(400).json({
                error: 'Password must be longer'
            });
        }
        const saltRounds = 10;
        const password_hash = await bcrypt_1.default.hash(password, saltRounds);
        const new_user = await userService_1.UserService.createUser(username, email, password_hash);
        res.status(201).json({
            id: new_user.id,
            username: new_user.username,
            message: 'Successfully created user'
        });
    }
    catch (err) {
        if (err.code === '23505') {
            if (err.message.includes('users_email') || err.message.includes('email')) {
                return res.status(409).json({
                    error: 'Email already exists'
                });
            }
            else if (err.message.includes('users_username') || err.message.includes('username')) {
                return res.status(409).json({
                    error: 'Username already exists'
                });
            }
        }
    }
});
// Get all users
router.get("/", async (req, res) => {
    try {
        res.json({
            username: req.session.username,
            userId: req.session.userId
        });
    }
    catch (err) {
        return res.status(500).json({
            error: 'Failed to fetch user'
        });
    }
});
// User login
router.post("/login", async (req, res) => {
    try {
        console.log(req.session);
        const { usernameOrEmail, password } = req.body;
        if (!usernameOrEmail || !password) {
            return res.status(400).json({
                error: 'Invalid username, email, or password'
            });
        }
        const user = await userService_1.UserService.validateLogin(usernameOrEmail, password);
        if (!user) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }
        req.session.userId = user.id;
        req.session.username = user.username;
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    reject(err);
                }
                else {
                    console.log('Session saved:', req.session);
                    resolve();
                }
            });
        });
        return res.status(200).json({
            id: user.id,
            username: user.username,
            email: user.email,
            message: 'Successfully logged in'
        });
    }
    catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({
            error: 'Failed to login'
        });
    }
});
exports.default = router;
// Logout route — destroy server session and clear cookie
router.post('/logout', (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destroy error:', err);
                return res.status(500).json({ error: 'Failed to logout' });
            }
            // Clear cookie (default name is connect.sid)
            res.clearCookie('connect.sid');
            return res.json({ message: 'Successfully logged out' });
        });
    }
    catch (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Failed to logout' });
    }
});
