const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const pantriesRouter = require("./routes/pantries");
const resourcesRouter = require("./routes/resources");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security & middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
app.use(limiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/pantries", pantriesRouter);
app.use("/api/resources", resourcesRouter);

// ── Root ──────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    name: "NJ Food Pantries API",
    version: "1.0.0",
    description: "A REST API for finding food pantries across New Jersey.",
    endpoints: {
      "GET /api/pantries":             "All pantries + regional food banks",
      "GET /api/pantries/regional":    "Regional/statewide food banks only",
      "GET /api/pantries/counties":    "List all available counties",
      "GET /api/pantries/county/:name":"Pantries in a specific county",
      "GET /api/pantries/search":      "Search pantries by keyword (q=)",
      "GET /api/resources":            "Additional statewide resources & locators",
    },
    query_params: {
      "/api/pantries":        "?county=Bergen  |  ?city=Hackensack  |  ?has_hours=true",
      "/api/pantries/search": "?q=salvation    (searches name, city, notes)",
    },
    notes: "All county names are case-insensitive. Replace spaces with underscores or hyphens (e.g., Cape_May or cape-may).",
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error." });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  NJ Food Pantries API running on http://localhost:${PORT}`);
});

module.exports = app;
