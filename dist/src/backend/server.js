"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const express_1 = __importDefault(require("express"));
const morgan_1 = __importDefault(require("morgan"));
require("./db/database");
const root_1 = __importDefault(require("./routes/root"));
const test_1 = require("./routes/test");
const game_1 = __importDefault(require("./routes/game"));
const user_1 = __importDefault(require("./routes/user"));
const chat_1 = __importDefault(require("./routes/chat"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const express_session_1 = __importDefault(require("express-session"));
const connect_pg_simple_1 = __importDefault(require("connect-pg-simple"));
const pg_1 = __importDefault(require("pg"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const PgStore = (0, connect_pg_simple_1.default)(express_session_1.default);
const pgPool = new pg_1.default.Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'crazy_eights',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
});
// Configure the session middleware
app.use((0, express_session_1.default)({
    store: new PgStore({
        pool: pgPool,
        tableName: 'session', // Name of your session table
    }),
    secret: 'testtestset', // Replace with a strong, unique secret
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        sameSite: 'lax',
    },
}));
app.use((0, morgan_1.default)("dev"));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.static(path.join(__dirname, "../frontend")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use("/test", test_1.testRouter);
app.use("/api/game", game_1.default);
app.use("/api/user", user_1.default);
app.use("/api/chat", chat_1.default);
app.use("/", root_1.default);
// Create HTTP server and attach socket.io for real-time events
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: true,
        methods: ["GET", "POST"]
    }
});
// Expose io via app.locals for routes to emit events
app.locals.io = io;
io.on('connection', (socket) => {
    console.log('socket connected:', socket.id);
    socket.on('joinGame', ({ gameId }) => {
        const room = `game:${gameId}`;
        socket.join(room);
        console.log(`socket ${socket.id} joined ${room}`);
    });
    socket.on('leaveGame', ({ gameId }) => {
        const room = `game:${gameId}`;
        socket.leave(room);
        console.log(`socket ${socket.id} left ${room}`);
    });
    socket.on('joinChat', ({ roomId }) => {
        const room = `chat:room:${roomId}`;
        socket.join(room);
        console.log(`socket ${socket.id} joined chat ${room}`);
    });
    socket.on('leaveChat', ({ roomId }) => {
        const room = `chat:room:${roomId}`;
        socket.leave(room);
        console.log(`socket ${socket.id} left chat ${room}`);
    });
    socket.on('disconnect', () => {
        console.log('socket disconnected:', socket.id);
    });
});
// Error handler
app.use((error, _request, response, _next) => {
    response.status(error.status || 500);
    response.json({
        error: {
            message: error.message,
            status: error.status || 500
        }
    });
});
httpServer.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
