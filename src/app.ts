import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import routes from "./routes";

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from TailorX backend with TypeScript!");
});

// Mount API routes
app.use("/api", routes);

export default app;
