/**
 * parse-kean.js
 *
 * Parses the Kean University NJ food pantry list and merges it into
 * your existing nj_food_pantries.json format.
 *
 * Usage:
 *   node parse-kean.js
 *
 * Input:   data/kean_pantries.txt   (paste the raw text from the Kean page)
 * Output:  data/nj_food_pantries.json (merged, backup created first)
 */

const fs   = require("fs");
const path = require("path");

const DATA_PATH   = path.join(__dirname, "data", "nj_food_pantries.json");
const BACKUP_PATH = path.join(__dirname, "data", "nj_food_pantries.backup.json");
const INPUT_PATH  = path.join(__dirname, "data", "kean_pantries.txt");

// ── County name normalizer ─────────────────────────────────────────────────────
// Maps display names to your JSON county keys

const COUNTY_KEY_MAP = {
  "atlantic":    "Atlantic",
  "bergen":      "Bergen",
  "burlington":  "Burlington",
  "camden":      "Camden",
  "cape may":    "Cape_May",
  "cumberland":  "Cumberland",
  "essex":       "Essex",
  "gloucester":  "Gloucester",
  "hudson":      "Hudson",
  "hunterdon":   "Hunterdon",
  "mercer":      "Mercer",
  "middlesex":   "Middlesex",
  "monmouth":    "Monmouth",
  "morris":      "Morris",
  "ocean":       "Ocean",
  "passaic":     "Passaic",
  "salem":       "Salem",
  "somerset":    "Somerset",
  "sussex":      "Sussex",
  "union":       "Union",
  "warren":      "Warren",
};

// ── Parser ─────────────────────────────────────────────────────────────────────

function parseKeanText(text) {
  const results = {};   // { countyKey: [entries] }
  let currentCounty = null;

  // Split into lines and clean up
  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);

  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Detect county header ───────────────────────────────────────────────────
    // County headers appear as "Bergen County", "Union County", etc.
    const countyMatch = line.match(/^([A-Za-z ]+)\s+County\s*$/i);
    if (countyMatch) {
      const key = COUNTY_KEY_MAP[countyMatch[1].toLowerCase().trim()];
      if (key) {
        currentCounty = key;
        if (!results[currentCounty]) results[currentCounty] = [];
      }
      i++;
      continue;
    }

    // ── Skip preamble and non-entry lines ──────────────────────────────────────
    if (!currentCounty) { i++; continue; }

    // ── Try to parse an entry ──────────────────────────────────────────────────
    // Each entry follows this pattern (fields may be missing):
    //   Name (line by itself, or split across 2 lines)
    //   Address: ...
    //   Hours: ...
    //   Contact: ...
    //   Serves: ...   (optional)
    //   Requirements: ...  (optional, rolled into notes)

    // The name is any line that doesn't start with a known field label
    const fieldLabels = /^(address|hours|contact|serves|requirements)\s*:/i;

    if (!fieldLabels.test(line)) {
      // This looks like a name — collect it (may span 2 lines)
      let name = line;

      // Peek ahead: if next line also isn't a field label and isn't a county
      // header, it's a continuation of the name
      if (
        i + 1 < lines.length &&
        !fieldLabels.test(lines[i + 1]) &&
        !lines[i + 1].match(/^([A-Za-z ]+)\s+County\s*$/i)
      ) {
        name += " " + lines[i + 1];
        i++;
      }

      // Now collect the fields that follow
      let address  = null;
      let city     = null;
      let state    = "NJ";
      let zip      = null;
      let hours    = null;
      let phone    = null;
      let notes    = null;
      const notesParts = [];

      i++;
      while (i < lines.length) {
        const fl = lines[i];

        // Stop if we hit another name (non-field, non-county line after fields)
        // or a county header
        if (fl.match(/^([A-Za-z ]+)\s+County\s*$/i)) break;

        const addrMatch  = fl.match(/^address\s*:\s*(.+)/i);
        const hoursMatch = fl.match(/^hours\s*:\s*(.+)/i);
        const contMatch  = fl.match(/^contact\s*:\s*(.+)/i);
        const servMatch  = fl.match(/^serves\s*:\s*(.+)/i);
        const reqMatch   = fl.match(/^requirements\s*:\s*(.+)/i);

        if (addrMatch) {
          // Address line: "380 S. VanBrunt St Englewood, NJ 07631"
          // or split across multiple lines ending with city, state zip
          let addrRaw = addrMatch[1];

          // Peek ahead for continuation lines (no field label)
          while (
            i + 1 < lines.length &&
            !fieldLabels.test(lines[i + 1]) &&
            !lines[i + 1].match(/^([A-Za-z ]+)\s+County\s*$/i)
          ) {
            i++;
            addrRaw += " " + lines[i];
          }

          // Parse city, state, zip from end of address
          const cityStateZip = addrRaw.match(/(.+?),?\s+NJ\s+(\d{5})?/i);
          if (cityStateZip) {
            zip = cityStateZip[2] || null;
            // Everything before ", NJ" is street + city
            const beforeNJ = cityStateZip[1].trim();
            // Last "word group" before NJ is likely the city
            const parts = beforeNJ.split(/\s{2,}|(?<=[a-z]),\s*/i);
            if (parts.length >= 2) {
              city    = parts[parts.length - 1].trim();
              address = parts.slice(0, -1).join(" ").trim();
            } else {
              // Fallback: split on last comma
              const ci = beforeNJ.lastIndexOf(",");
              if (ci > -1) {
                address = beforeNJ.slice(0, ci).trim();
                city    = beforeNJ.slice(ci + 1).trim();
              } else {
                address = beforeNJ;
              }
            }
          } else {
            address = addrRaw.trim();
          }

        } else if (hoursMatch) {
          let h = hoursMatch[1];
          // Hours can span multiple lines
          while (
            i + 1 < lines.length &&
            !fieldLabels.test(lines[i + 1]) &&
            !lines[i + 1].match(/^([A-Za-z ]+)\s+County\s*$/i)
          ) {
            i++;
            h += " " + lines[i];
          }
          hours = h.trim();

        } else if (contMatch) {
          phone = contMatch[1].replace(/\s+/g, "").trim();

        } else if (servMatch) {
          notesParts.push("Serves: " + servMatch[1].trim());

        } else if (reqMatch) {
          notesParts.push("Requirements: " + reqMatch[1].trim());

        } else if (!fieldLabels.test(fl)) {
          // Non-field line after fields started = next entry name; stop
          break;
        }

        i++;
      }

      notes = notesParts.join(" ") || null;

      // Only add if we got at least a name
      if (name && name.length > 2) {
        results[currentCounty].push({
          name:    name.trim(),
          address: address,
          city:    city,
          state:   state,
          zip:     zip,
          phone:   phone,
          hours:   hours === "Please call" ? null : hours,
          website: null,
          notes:   notes,
        });
      }

      continue;
    }

    i++;
  }

  return results;
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

  // 1. Check input file exists
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`❌ Input file not found: ${INPUT_PATH}`);
    console.error("   Copy the text from https://www.kean.edu/media/food-pantries-nj");
    console.error("   and save it as data/kean_pantries.txt");
    process.exit(1);
  }

  // 2. Load and back up existing data
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

  // 3. Parse Kean text
  console.log("🔍 Parsing Kean pantry list…");
  const rawText = fs.readFileSync(INPUT_PATH, "utf8");
  const parsed  = parseKeanText(rawText);

  const countyCount = Object.keys(parsed).length;
  const totalRaw    = Object.values(parsed).reduce((s, a) => s + a.length, 0);
  console.log(`   ✅ Parsed ${totalRaw} entries across ${countyCount} counties`);

  // 4. Merge, deduplicating against existing data
  let added   = 0;
  let skipped = 0;

  Object.entries(parsed).forEach(([county, entries]) => {
    if (!existing.pantries_by_county[county]) {
      existing.pantries_by_county[county] = [];
    }

    entries.forEach(entry => {
      const key = normalize(entry.name) + normalize(entry.city);

      if (existingSet.has(key)) {
        skipped++;
        return;
      }

      existing.pantries_by_county[county].push(entry);
      existingSet.add(key);
      added++;
    });
  });

  console.log(`   ✅ Added ${added} new entries, skipped ${skipped} duplicates`);

  // 5. Sort counties alphabetically
  existing.pantries_by_county = Object.keys(existing.pantries_by_county)
    .sort()
    .reduce((acc, k) => { acc[k] = existing.pantries_by_county[k]; return acc; }, {});

  // 6. Write merged data
  fs.writeFileSync(DATA_PATH, JSON.stringify(existing, null, 2));
  console.log(`\n✅ Done! Wrote merged data to ${DATA_PATH}`);
  console.log(`   Total counties: ${Object.keys(existing.pantries_by_county).length}`);
  console.log(`   Total local pantries: ${
    Object.values(existing.pantries_by_county).reduce((sum, arr) => sum + arr.length, 0)
  }`);
}

main();