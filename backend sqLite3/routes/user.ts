import express, { Request, Response } from "express";
import { UserService } from "../services/userService";
import { RoomService } from "../services/roomService";
import { GameService } from "../services/gameService";
import bcrypt from 'bcrypt';

const router = express.Router();

// Create new user
router.post("/", async (req: Request, res: Response) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !password || !email) {
            return res.status(400).json({
                error: 'Username, email, and password are required'
            })
        }

        if (password.length < 8) {
            return res.status(400).json({
                error: 'Password must be longer'
            })
        }
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);
        
        const new_user = await UserService.createUser(username, email, password_hash)
        res.status(201).json({
            id: new_user.id,
            username: new_user.username,
            message: 'Successfully created user'
        })
    } catch (err: any) {
        if (err.code.includes('SQLITE_CONSTRAINT')) {
            if (err.message.includes('users.email')) {
                return res.status(409).json({
                    error: 'Email already exists'
                })
            } else if (err.message.includes('users.username')) {
                return res.status(409).json({
                    error: 'Username already exists'
                })
            }
        }
    }
})

// Get all users
router.get("/", async (req: Request, res: Response) => {
    try {
        const users = await UserService.getAllUsers();

        return res.status(200).json({
            users: users,
            user_count: users.length
        });
    } catch (err: any) {
        return res.status(500).json({
            error: 'Failed to fetch users'
        })
    }
})

// User login
router.post("/login", async (req: Request, res: Response) => {
    try {
        const { usernameOrEmail, password } = req.body;

        if (!usernameOrEmail || !password) {
            return res.status(400).json({
                error: 'Invalid username, email, or password'
            })
        }

        const user = await UserService.validateLogin(usernameOrEmail, password);

        if (!user) {
            return res.status(401).json({
                error: 'Invalid credentials'
            })
        }

        return res.status(200).json({
            id: user.id,
            username: user.username,
            email: user.email,
            message: 'Successfully logged in'
        })
    } catch (err: any) {
        return res.status(500).json({
            error: 'Failed to login'
        })
    }
})


export default router;