/**
 * fetch-overpass.js
 *
 * Reads a locally downloaded Overpass JSON file and merges the results
 * into your existing nj_food_pantries.json format.
 *
 * Usage:
 *   node fetch-overpass.js
 *
 * Input:   data/overpass_results.json  (downloaded from Overpass)
 * Output:  data/nj_food_pantries.json  (merged, backup created first)
 */

const fs   = require("fs");
const path = require("path");

const DATA_PATH      = path.join(__dirname, "data", "nj_food_pantries.json");
const BACKUP_PATH    = path.join(__dirname, "data", "nj_food_pantries.backup.json");
const OVERPASS_PATH  = path.join(__dirname, "data", "overpass_results.json");


// ── County Bounding Boxes ──────────────────────────────────────────────────────

const COUNTY_BOUNDS = [
  { county: "Atlantic",   s: 39.45, n: 39.80, w: -74.97, e: -74.42 },
  { county: "Bergen",     s: 40.74, n: 41.07, w: -74.25, e: -73.89 },
  { county: "Burlington", s: 39.68, n: 40.14, w: -75.06, e: -74.42 },
  { county: "Camden",     s: 39.71, n: 39.99, w: -75.24, e: -74.87 },
  { county: "Cape_May",   s: 38.90, n: 39.35, w: -75.10, e: -74.62 },
  { county: "Cumberland", s: 39.10, n: 39.55, w: -75.25, e: -74.72 },
  { county: "Essex",      s: 40.67, n: 40.88, w: -74.35, e: -74.07 },
  { county: "Gloucester", s: 39.55, n: 39.87, w: -75.38, e: -74.98 },
  { county: "Hudson",     s: 40.63, n: 40.85, w: -74.15, e: -74.01 },
  { county: "Hunterdon",  s: 40.43, n: 40.79, w: -75.19, e: -74.72 },
  { county: "Mercer",     s: 40.14, n: 40.43, w: -75.00, e: -74.52 },
  { county: "Middlesex",  s: 40.27, n: 40.66, w: -74.62, e: -74.10 },
  { county: "Monmouth",   s: 40.10, n: 40.55, w: -74.47, e: -73.98 },
  { county: "Morris",     s: 40.72, n: 41.06, w: -74.92, e: -74.35 },
  { county: "Ocean",      s: 39.65, n: 40.22, w: -74.73, e: -74.03 },
  { county: "Passaic",    s: 40.87, n: 41.18, w: -74.55, e: -74.07 },
  { county: "Salem",      s: 39.38, n: 39.74, w: -75.56, e: -75.06 },
  { county: "Somerset",   s: 40.43, n: 40.79, w: -74.72, e: -74.35 },
  { county: "Sussex",     s: 41.00, n: 41.36, w: -74.92, e: -74.42 },
  { county: "Union",      s: 40.55, n: 40.75, w: -74.38, e: -74.07 },
  { county: "Warren",     s: 40.72, n: 41.06, w: -75.19, e: -74.82 },
];

function assignCounty(lat, lng) {
  const match = COUNTY_BOUNDS.find(
    c => lat >= c.s && lat <= c.n && lng >= c.w && lng <= c.e
  );
  return match ? match.county : null;
}


// ── OSM → Our Schema ───────────────────────────────────────────────────────────

function osmToEntry(element) {
  const tags = element.tags || {};
  const lat  = element.lat ?? element.center?.lat;
  const lng  = element.lon ?? element.center?.lon;

  const name    = tags.name || tags["operator"] || "Unnamed Food Resource";
  const address = [tags["addr:housenumber"], tags["addr:street"]]
    .filter(Boolean).join(" ") || null;
  const city    = tags["addr:city"]      || null;
  const state   = tags["addr:state"]     || "NJ";
  const zip     = tags["addr:postcode"]  || null;
  const phone   = tags["phone"]          || tags["contact:phone"]   || null;
  const website = tags["website"]        || tags["contact:website"] || null;
  const hours   = tags["opening_hours"]  || null;
  const notes   = [
    tags["description"],
    tags["note"],
    tags["social_facility:for"] ? `Serves: ${tags["social_facility:for"]}` : null,
  ].filter(Boolean).join(" ") || null;

  return { name, address, city, state, zip, phone, hours, website, notes, lat, lng };
}


// ── Deduplication ──────────────────────────────────────────────────────────────

function normalize(str) {
  return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildExistingSet(existing) {
  const set = new Set();

  Object.values(existing.pantries_by_county || {}).forEach(pantries => {
    pantries.forEach(p => set.add(normalize(p.name) + normalize(p.city)));
  });

  (existing.regional_food_banks || []).forEach(p => {
    set.add(normalize(p.name) + normalize(p.city));
  });

  return set;
}


// ── Main ───────────────────────────────────────────────────────────────────────

function main() {

  // 1. Load existing pantry data
  console.log("📂 Loading existing data…");
  let existing = { pantries_by_county: {}, regional_food_banks: [], additional_resources: [] };

  if (fs.existsSync(DATA_PATH)) {
    existing = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    fs.writeFileSync(BACKUP_PATH, JSON.stringify(existing, null, 2));
    console.log(`   ✅ Backed up to ${BACKUP_PATH}`);
  } else {
    console.log("   ⚠️  No existing file found — will create a new one.");
  }

  const existingSet = buildExistingSet(existing);

  // 2. Load Overpass results
  console.log("📂 Loading Overpass results…");

  if (!fs.existsSync(OVERPASS_PATH)) {
    console.error(`   ❌ Could not find ${OVERPASS_PATH}`);
    console.error("   Download the Overpass JSON and save it as data/overpass_results.json");
    process.exit(1);
  }

  const overpassData = JSON.parse(fs.readFileSync(OVERPASS_PATH, "utf8"));
  const elements     = overpassData.elements || [];
  console.log(`   ✅ Loaded ${elements.length} raw elements`);

  // 3. Convert and assign counties
  let added   = 0;
  let skipped = 0;

  elements.forEach(element => {
    const entry = osmToEntry(element);
    const key   = normalize(entry.name) + normalize(entry.city);
    const lat   = entry.lat;
    const lng   = entry.lng;

    if (existingSet.has(key)) { skipped++; return; }
    if (!lat || !lng)          { skipped++; return; }

    const county = assignCounty(lat, lng);
    if (!county) { skipped++; return; }

    // Strip lat/lng before storing — not part of your schema
    const { lat: _lat, lng: _lng, ...entryWithoutCoords } = entry;

    if (!existing.pantries_by_county[county]) {
      existing.pantries_by_county[county] = [];
    }

    existing.pantries_by_county[county].push(entryWithoutCoords);
    existingSet.add(key);
    added++;
  });

  console.log(`   ✅ Added ${added} new entries, skipped ${skipped} duplicates/unlocatable`);

  // 4. Sort counties alphabetically
  existing.pantries_by_county = Object.keys(existing.pantries_by_county)
    .sort()
    .reduce((acc, k) => { acc[k] = existing.pantries_by_county[k]; return acc; }, {});

  // 5. Write merged data
  fs.writeFileSync(DATA_PATH, JSON.stringify(existing, null, 2));
  console.log(`\n✅ Done! Wrote merged data to ${DATA_PATH}`);
  console.log(`   Total counties: ${Object.keys(existing.pantries_by_county).length}`);
  console.log(`   Total local pantries: ${
    Object.values(existing.pantries_by_county).reduce((sum, arr) => sum + arr.length, 0)
  }`);
}

main();