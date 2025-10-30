import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";

const app = express();

// Database initialization flag
let dbInitialized = false;

// Initialize database connection
const initializeDatabase = async () => {
  if (dbInitialized) return;
  
  try {
    const { sequelize } = require("./models");
    await sequelize.authenticate();
    console.log('Database connection established.');
    dbInitialized = true;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

// Lazy load routes to avoid circular dependencies
let routes: any = null;
const getRoutes = () => {
  if (!routes) {
    routes = require("./routes").default;
  }
  return routes;
};

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://tailorxsewing.netlify.app'
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, '')); // Remove trailing slash
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    const originWithoutSlash = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(originWithoutSlash)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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

// Mount API routes with lazy loading and database initialization
app.use("/api", async (req, res, next) => {
  try {
    // Initialize database on first API request
    await initializeDatabase();
    // Load and use routes
    getRoutes()(req, res, next);
  } catch (error) {
    console.error('API initialization error:', error);
    res.status(500).json({ 
      error: 'Database connection failed',
      message: 'Unable to connect to database'
    });
  }
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, _next: any) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default app;
