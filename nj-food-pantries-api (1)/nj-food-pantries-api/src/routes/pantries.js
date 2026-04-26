const express = require("express");
const router = express.Router();
const data = require("../../data/nj_food_pantries.json");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalize a county name for matching:
 * "cape-may" | "Cape May" | "cape_may" → "cape_may"
 */
function normalizeCounty(str) {
  return str.toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Flatten all per-county pantries into a single array,
 * each entry tagged with { county }.
 */
function getAllLocalPantries() {
  return Object.entries(data.pantries_by_county).flatMap(([county, pantries]) =>
    pantries.map((p) => ({ ...p, county }))
  );
}

/**
 * Simple full-text search across name, city, notes, address.
 */
function matchesQuery(pantry, q) {
  const term = q.toLowerCase();
  return ["name", "city", "address", "notes"].some(
    (field) => pantry[field] && pantry[field].toLowerCase().includes(term)
  );
}

/**
 * Build a paginated response envelope.
 */
function paginate(items, page, limit) {
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const results = items.slice(start, start + limit);
  return { total, page, limit, total_pages: totalPages, results };
}

// ── GET /api/pantries ─────────────────────────────────────────────────────────
// Query params: county, city, has_hours, page, limit
router.get("/", (req, res) => {
  const { county, city, has_hours, page = 1, limit = 50 } = req.query;

  let local = getAllLocalPantries();
  let regional = data.regional_food_banks;

  // Filters
  if (county) {
    const key = normalizeCounty(county);
    local = local.filter((p) => normalizeCounty(p.county) === key);
    regional = regional.filter((p) =>
      (p.counties_served || []).some(
        (c) => normalizeCounty(c) === key
      )
    );
  }

  if (city) {
    const c = city.toLowerCase();
    local = local.filter((p) => p.city && p.city.toLowerCase().includes(c));
    regional = regional.filter((p) => p.city && p.city.toLowerCase().includes(c));
  }

  if (has_hours === "true") {
    local = local.filter((p) => !!p.hours);
    regional = regional.filter((p) => !!p.hours);
  }

  const allResults = [...regional, ...local];
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit)));

  res.json(paginate(allResults, pageNum, limitNum));
});

// ── GET /api/pantries/regional ────────────────────────────────────────────────
router.get("/regional", (req, res) => {
  res.json({
    total: data.regional_food_banks.length,
    results: data.regional_food_banks,
  });
});

// ── GET /api/pantries/counties ────────────────────────────────────────────────
router.get("/counties", (req, res) => {
  const counties = Object.keys(data.pantries_by_county).map((county) => ({
    county,
    display_name: county.replace(/_/g, " "),
    pantry_count: data.pantries_by_county[county].length,
  }));

  res.json({
    total: counties.length,
    counties,
  });
});

// ── GET /api/pantries/search ──────────────────────────────────────────────────
// Query params: q (required), county, page, limit
router.get("/search", (req, res) => {
  const { q, county, page = 1, limit = 50 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({
      error: "Query param `q` is required and must be at least 2 characters.",
    });
  }

  let local = getAllLocalPantries();
  let regional = data.regional_food_banks;

  // Optional county pre-filter
  if (county) {
    const key = normalizeCounty(county);
    local = local.filter((p) => normalizeCounty(p.county) === key);
    regional = regional.filter((p) =>
      (p.counties_served || []).some((c) => normalizeCounty(c) === key)
    );
  }

  const allResults = [...regional, ...local].filter((p) => matchesQuery(p, q));

  if (allResults.length === 0) {
    return res.status(404).json({ message: `No pantries found matching "${q}".`, results: [] });
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit)));

  res.json({ query: q, ...paginate(allResults, pageNum, limitNum) });
});

// ── GET /api/pantries/county/:name ────────────────────────────────────────────
router.get("/county/:name", (req, res) => {
  const key = normalizeCounty(req.params.name);

  // Find matching county key (case-insensitive)
  const matchedKey = Object.keys(data.pantries_by_county).find(
    (k) => normalizeCounty(k) === key
  );

  if (!matchedKey) {
    const available = Object.keys(data.pantries_by_county).map((k) =>
      k.replace(/_/g, " ")
    );
    return res.status(404).json({
      error: `County "${req.params.name}" not found.`,
      available_counties: available,
    });
  }

  const pantries = data.pantries_by_county[matchedKey].map((p) => ({
    ...p,
    county: matchedKey,
  }));

  // Also include regional food banks that serve this county
  const regional = data.regional_food_banks.filter((p) =>
    (p.counties_served || []).some((c) => normalizeCounty(c) === key)
  );

  res.json({
    county: matchedKey.replace(/_/g, " "),
    local_pantry_count: pantries.length,
    regional_food_bank_count: regional.length,
    regional_food_banks: regional,
    local_pantries: pantries,
  });
});

module.exports = router;
