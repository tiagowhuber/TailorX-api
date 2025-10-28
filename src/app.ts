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
  res.json({ 
    message: "Hello from TailorX backend with TypeScript!",
    status: "running",
    timestamp: new Date().toISOString()
  });
});

// Mount API routes
app.use("/api", routes);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default app;
