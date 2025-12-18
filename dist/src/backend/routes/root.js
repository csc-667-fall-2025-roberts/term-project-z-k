"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get("/", (request, response) => {
    response.redirect('/signup');
});
router.get("/signup", auth_1.loggedIn, (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../../frontend/signup.html"));
});
router.get("/login", auth_1.loggedIn, (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../../frontend/login.html"));
});
router.get("/lobby", auth_1.auth, (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../../frontend/lobby.html"));
});
router.get("/game/rooms/:id", auth_1.auth, (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../../frontend/game.html"));
});
router.use((req, res) => {
    res.status(404).sendFile(path_1.default.join(__dirname, "../../frontend/error.html"));
});
exports.default = router;
