const express = require("express");
const router  = express.Router();
const data    = require("../../data/nj_food_pantries.json");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Haversine formula — returns distance in miles between two lat/lng points.
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R    = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;  // FIX: was "la2"
  const dLng = (lng2 - lng1) * Math.PI / 180;  // FIX: was "dLang"
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
    pantries.map((p) => ({ ...p, county }))  // FIX: was [...p, county] (array spread, not object)
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
  const total      = items.length;
  const totalPages = Math.ceil(total / limit);
  const start      = (page - 1) * limit;
  const results    = items.slice(start, start + limit);
  return { total, page, limit, total_pages: totalPages, results };
}

/**
 * Attach distance_miles to each entry and sort ascending.
 * Entries without coords sort to the bottom.
 */
function sortByDistance(arr, userLat, userLng) {
  return arr
    .map(p => ({
      ...p,
      distance_miles: p.lat && p.lng
        ? parseFloat(haversineDistance(userLat, userLng, p.lat, p.lng).toFixed(1))
        : null,
    }))
    .sort((a, b) => {
      if (a.distance_miles === null) return 1;
      if (b.distance_miles === null) return -1;
      return a.distance_miles - b.distance_miles;
    });
}


// ── GET /api/pantries ─────────────────────────────────────────────────────────

router.get("/", (req, res) => {
  const { county, city, has_hours, page = 1, limit = 50 } = req.query;

  let local    = getAllLocalPantries();
  let regional = data.regional_food_banks;

  if (county) {
    const key = normalizeCounty(county);
    local    = local.filter((p) => normalizeCounty(p.county) === key);
    regional = regional.filter((p) =>
      (p.counties_served || []).some((c) => normalizeCounty(c) === key)
    );
  }

  // City filtering applies to local pantries only — regionals serve whole counties
  if (city) {
    const c = city.toLowerCase();
    local = local.filter((p) => p.city && p.city.toLowerCase().includes(c));
  }

  if (has_hours === "true") {
    local    = local.filter((p) => p.hours && p.hours.trim().length > 0);
    regional = regional.filter((p) => p.hours && p.hours.trim().length > 0);
  }

  const allResults = [...regional, ...local];
  const pageNum    = Math.max(1, parseInt(page));
  const limitNum   = Math.min(200, Math.max(1, parseInt(limit)));

  res.json(paginate(allResults, pageNum, limitNum));  // FIX: was "pagenate"
});


// ── GET /api/pantries/regional ────────────────────────────────────────────────

router.get("/regional", (req, res) => {
  res.json({
    total:   data.regional_food_banks.length,  // FIX: was "_length" (string, not property)
    results: data.regional_food_banks,
  });
});


// ── GET /api/pantries/counties ────────────────────────────────────────────────

router.get("/counties", (req, res) => {  // FIX: was "/counties/:name" (wrong route)
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

router.get("/search", (req, res) => {
  const { q, county, page = 1, limit = 50 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({
      error: "Query param `q` is required and must be at least 2 characters.",
    });
  }

  let local    = getAllLocalPantries();
  let regional = data.regional_food_banks;

  if (county) {
    const key = normalizeCounty(county);
    local    = local.filter((p) => normalizeCounty(p.county) === key);
    regional = regional.filter((p) =>
      (p.counties_served || []).some((c) => normalizeCounty(c) === key)
    );
  }

  const allResults = [...regional, ...local].filter((p) => matchesQuery(p, q));
  const pageNum    = Math.max(1, parseInt(page));
  const limitNum   = Math.min(200, Math.max(1, parseInt(limit)));

  // Empty results are a 200, not a 404
  if (allResults.length === 0) {
    return res.json({
      query: q,
      message: `No pantries found matching "${q}".`,  // FIX: was "mathicng"
      ...paginate([], pageNum, limitNum),
    });
  }

  res.json({ query: q, ...paginate(allResults, pageNum, limitNum) });
});


// ── GET /api/pantries/county/:name ────────────────────────────────────────────

router.get("/county/:name", (req, res) => {
  const key        = normalizeCounty(req.params.name);
  const userLat    = parseFloat(req.query.lat);
  const userLng    = parseFloat(req.query.lng);
  const hasCoords  = !isNaN(userLat) && !isNaN(userLng);

  const matchedKey = Object.keys(data.pantries_by_county).find(
    (k) => normalizeCounty(k) === key
  );

  if (!matchedKey) {
    const available = Object.keys(data.pantries_by_county).map((k) =>
      k.replace(/_/g, " ")
    );
    return res.status(404).json({
      error:             `County "${req.params.name}" not found.`,
      available_counties: available,
    });
  }

  let pantries = data.pantries_by_county[matchedKey].map((p) => ({
    ...p,
    county: matchedKey,
  }));

  let regional = data.regional_food_banks.filter((p) =>
    (p.counties_served || []).some((c) => normalizeCounty(c) === key)
  );

  // Sort by distance if user coords were provided
  if (hasCoords) {
    pantries = sortByDistance(pantries, userLat, userLng);
    regional = sortByDistance(regional, userLat, userLng);
  }

  res.json({
    county:                   matchedKey.replace(/_/g, " "),
    local_pantry_count:       pantries.length,
    regional_food_bank_count: regional.length,
    regional_food_banks:      regional,
    local_pantries:           pantries,
  });
});


module.exports = router;