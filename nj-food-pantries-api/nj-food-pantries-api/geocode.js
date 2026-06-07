/**
 * geocode.js
 *
 * Adds lat/lng coordinates to every pantry entry in nj_food_pantries.json
 * using the free Nominatim geocoding API (no key required).
 *
 * Nominatim requires a 1-second delay between requests — 622 entries
 * will take roughly 10-12 minutes. Safe to re-run: already-geocoded
 * entries are skipped.
 *
 * Usage:
 *   node geocode.js
 */

const fs   = require("fs");
const path = require("path");

const DATA_PATH   = path.join(__dirname, "data", "nj_food_pantries.json");
const BACKUP_PATH = path.join(__dirname, "data", "nj_food_pantries.backup.json");

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DELAY_MS      = 1100;   // Nominatim rate limit: max 1 req/sec

// ── Helpers ────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Geocode a single address string using Nominatim.
 * Returns { lat, lng } or null on failure.
 */
async function geocode(address, city, state, zip) {
  // Build the most specific query we can from available fields
  const parts = [address, city, state, zip].filter(Boolean);
  if (parts.length < 2) return null;

  const q = parts.join(", ");

  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=us`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":    "NeighborhoodNourish/1.0 (community food resource app)",
        "Accept-Language": "en",
      }
    });

    if (!res.ok) {
      console.warn(`   ⚠️  Nominatim HTTP ${res.status} for: ${q}`);
      return null;
    }

    const json = await res.json();

    if (!json.length) {
      // Try a less specific query: just city + state
      return await geocodeFallback(city, state, zip);
    }

    return {
      lat: parseFloat(json[0].lat),
      lng: parseFloat(json[0].lon),
    };
  } catch (err) {
    console.warn(`   ⚠️  Geocode error for "${q}": ${err.message}`);
    return null;
  }
}

/**
 * Fallback: geocode by city + state + zip only (less precise but better than nothing).
 */
async function geocodeFallback(city, state, zip) {
  const parts = [city, state, zip].filter(Boolean);
  if (!parts.length) return null;

  const q   = parts.join(", ");
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=us`;

  try {
    const res  = await fetch(url, {
      headers: {
        "User-Agent": "NeighborhoodNourish/1.0 (community food resource app)",
        "Accept-Language": "en",
      }
    });
    const json = await res.json();
    if (!json.length) return null;
    return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
  } catch {
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {

  // 1. Load data
  console.log("📂 Loading data…");
  if (!fs.existsSync(DATA_PATH)) {
    console.error("❌ data/nj_food_pantries.json not found.");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(data, null, 2));
  console.log(`   ✅ Backed up to ${BACKUP_PATH}`);

  // 2. Collect all entries that need geocoding
  const toGeocode = [];

  // Local pantries
  Object.entries(data.pantries_by_county || {}).forEach(([county, pantries]) => {
    pantries.forEach((p, idx) => {
      if (!p.lat || !p.lng) {
        toGeocode.push({ type: "local", county, idx, entry: p });
      }
    });
  });

  // Regional food banks
  (data.regional_food_banks || []).forEach((p, idx) => {
    if (!p.lat || !p.lng) {
      toGeocode.push({ type: "regional", idx, entry: p });
    }
  });

  const total   = toGeocode.length;
  const skipped = Object.values(data.pantries_by_county || {})
    .flat().filter(p => p.lat && p.lng).length +
    (data.regional_food_banks || []).filter(p => p.lat && p.lng).length;

  console.log(`\n📍 ${total} entries to geocode, ${skipped} already have coordinates.`);
  console.log(`   Estimated time: ~${Math.ceil(total * DELAY_MS / 60000)} minutes\n`);

  // 3. Geocode each entry with rate limiting
  let succeeded = 0;
  let failed    = 0;

  for (let i = 0; i < toGeocode.length; i++) {
    const { type, county, idx, entry } = toGeocode[i];

    process.stdout.write(`   [${i + 1}/${total}] ${entry.name} (${entry.city || "?"})… `);

    const coords = await geocode(entry.address, entry.city, entry.state || "NJ", entry.zip);

    if (coords) {
      // Write coords back into the data object
      if (type === "local") {
        data.pantries_by_county[county][idx].lat = coords.lat;
        data.pantries_by_county[county][idx].lng = coords.lng;
      } else {
        data.regional_food_banks[idx].lat = coords.lat;
        data.regional_food_banks[idx].lng = coords.lng;
      }
      process.stdout.write(`✅ (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})\n`);
      succeeded++;
    } else {
      process.stdout.write(`❌ not found\n`);
      failed++;
    }

    // Save progress every 50 entries so we don't lose work if interrupted
    if ((i + 1) % 50 === 0) {
      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
      console.log(`   💾 Progress saved (${i + 1}/${total})`);
    }

    // Respect Nominatim rate limit
    if (i < toGeocode.length - 1) await sleep(DELAY_MS);
  }

  // 4. Final save
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

  console.log(`\n✅ Done!`);
  console.log(`   Geocoded: ${succeeded}`);
  console.log(`   Failed:   ${failed}`);
  console.log(`   Saved to: ${DATA_PATH}`);
}

main();