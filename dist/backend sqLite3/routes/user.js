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
        if (err.code.includes('SQLITE_CONSTRAINT')) {
            if (err.message.includes('users.email')) {
                return res.status(409).json({
                    error: 'Email already exists'
                });
            }
            else if (err.message.includes('users.username')) {
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
        const users = await userService_1.UserService.getAllUsers();
        return res.status(200).json({
            users: users,
            user_count: users.length
        });
    }
    catch (err) {
        return res.status(500).json({
            error: 'Failed to fetch users'
        });
    }
});
// User login
router.post("/login", async (req, res) => {
    try {
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
        return res.status(200).json({
            id: user.id,
            username: user.username,
            email: user.email,
            message: 'Successfully logged in'
        });
    }
    catch (err) {
        return res.status(500).json({
            error: 'Failed to login'
        });
    }
});
exports.default = router;
