import express from "express";
import path from 'path';
import { auth, loggedIn } from "../middleware/auth";

const router = express.Router();

router.get("/", (request, response) => {
  response.redirect('/signup')
});

router.get("/signup", loggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/signup.html"));
});

router.get("/login", loggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/login.html"));
});

router.get("/lobby", auth, (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/lobby.html"));
});

router.get("/game/rooms/:id", auth, (req, res) => {
    res.sendFile(path.join(__dirname, "../../frontend/game.html"));
});

router.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "../../frontend/error.html"));
});

export default router;
