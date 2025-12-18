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
const http_errors_1 = __importDefault(require("http-errors"));
require("./db/database");
const root_1 = __importDefault(require("./routes/root"));
const test_1 = require("./routes/test");
const game_1 = __importDefault(require("./routes/game"));
const user_1 = __importDefault(require("./routes/user"));
const express_session_1 = __importDefault(require("express-session"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, morgan_1.default)("dev"));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.static(path.join(__dirname, "../frontend")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use((0, express_session_1.default)({
    secret: 'your-secret-key-change-this', // Change this to a random string
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        secure: true,
        sameSite: 'strict'
    }
}));
app.use("/", root_1.default);
app.use("/test", test_1.testRouter);
app.use("/api/game", game_1.default);
app.use("/api/user", user_1.default);
// 404 handler
app.use((_request, _response, next) => {
    next((0, http_errors_1.default)(404));
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
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
