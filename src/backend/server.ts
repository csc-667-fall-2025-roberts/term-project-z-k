import * as path from "path";
import express from "express";
import morgan from "morgan";
import createHttpError from "http-errors";
import "./db/database";

import rootRoutes from "./routes/root";
import { testRouter } from "./routes/test";
import gameRoutes from "./routes/game";
import userRoutes from "./routes/user";

import session from "express-session";
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';

const app = express();

const PORT = process.env.PORT || 3000;

const PgStore = connectPgSimple(session);

const pgPool = new pg.Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'crazy_eights',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Configure the session middleware
app.use(session({
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

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../frontend")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use("/test", testRouter);
app.use("/api/game", gameRoutes);
app.use("/api/user", userRoutes);
app.use("/", rootRoutes);



// Error handler
app.use((error: any, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
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