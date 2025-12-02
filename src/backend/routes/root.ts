import express from "express";
import path from 'path';
import { auth } from "../middleware/auth";

const router = express.Router();

router.get("/", auth, (request, response) => {
  response.render("root", { gamesListing: ["a", "b", "c", "etc"] });
});

router.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/signup.html"));
});

router.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/login.html"));
});

router.get("/lobby", auth, (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/lobby.html"));
});

router.get("/game/:id", (req, res) => {
    res.sendFile(path.join(__dirname, "../../frontend/game.html"));
});

router.get("/error", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/error.html"));
});

export default router;
