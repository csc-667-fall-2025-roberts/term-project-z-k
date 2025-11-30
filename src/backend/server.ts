import * as path from "path";
import express from "express";
import morgan from "morgan";
import createHttpError from "http-errors";
import "./db/database";

import rootRoutes from "./routes/root";
import { testRouter } from "./routes/test";
import gameRoutes from "./routes/game"; 

const app = express();

const PORT = process.env.PORT || 3000;

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join("dist", "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use("/", rootRoutes);
app.use("/test", testRouter);
app.use("/api/game", gameRoutes);

// 404 handler
app.use((_request, _response, next) => {
  next(createHttpError(404));
});



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