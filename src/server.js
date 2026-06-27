const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const pantriesRouter = require("./routes/pantries");
const resourceRouter = require("./routes/resources");

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Middleware

app.use(helmet());

const allowedOrigins = process.env.FRONTEND_ORIGIN
? [process.env.FRONTEND_ORIGIN]
: ["http://localhost:5500", "http://127.0.0.1:5500",
 "http://localhost:3000", "http://127.0.0.1:3000",
 "http://localhost:8080", "http://127.0.0.1:8080",
  "https://neighborhoodnourish.org",
  "https://www.neighborhoodnourish.org",
  "https://neighborhoodnourish.vercel.app",
  "https://neighborhoodnourish-8k0df1rdb-tims-projects-43918398.vercel.app",
  "https://neighborhoodnourish.org",
  "https://www.neighborhoodnourish.org",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith("-tims-projects-43918398.vercel.app")
    ) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin "${origin}" is not allowed`));
  },
  methods: ["GET"],
  allowedHeaders: ["Content-Type"],
}));
   

app.use(express.json());

// Rate limiting: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowsMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later."},
});
app.use(limiter);

// Routes

app.use("/api/pantries", pantriesRouter);
app.use("/api/resources", resourceRouter);

// Health Check
// useful for uptime monitors and deployment checks without touching real data

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Root

app.get("/", (req, res) => {
  res.json({
    name: "NJ Food Pantries API",
    version: "1.0.0",
    description: "A REST API for finding food pantries across New Jersey.",
    endpoints: {
      "GET /api/pantries": "All pantries + regional food banks",
      "GET /api/pantries/regional": "Regional/statewide food banks only",
      "GET /api/pantries/counties": "List all available counties",
      "GET /api/pantries/county/:name": "Pantries in a specific county",
      "GET /api/pantries/search": "Search pantries by keyword (q=)",
      "GET /api/resources": "Additional statewide resources & locators",
      "GET /health": "Server health check",
    },
     query_params: {
      "api/pantries": "?county=Bergen | ?city=Hackensack | ?has_hours=true", 
 "/api/pantries/search": "?q=salvation (searches name, city, notes)", 
   },
   notes: "all county names are case-insensitive. Replace spaces with underscores or hyphens (e.g. Cape_May or cape-may).",
  });
});

// 404 Handler

app.use((req,res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// Error Handler

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error," });
});

// Start

app.listen(PORT, () => {
  console.log(`✅  NJ Food Pantries API running on http://localhost:${PORT}`);
});

module.exports = app;