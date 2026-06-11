/**
 * cleanup.js
 *
 * Removes junk entries (text fragments, footnotes, COVID notices)
 * that were incorrectly parsed from the Kean pantry list.
 *
 * Usage:
 *   node cleanup.js
 */

const fs   = require("fs");
const path = require("path");

const DATA_PATH   = path.join(__dirname, "data", "nj_food_pantries.json");
const BACKUP_PATH = path.join(__dirname, "data", "nj_food_pantries.backup.json");

// ── Junk detection ─────────────────────────────────────────────────────────────
// An entry is junk if it has no address AND no city AND its name matches
// any of these patterns.

const JUNK_PATTERNS = [
  // Sentence fragments / instructions
  /^you are not registered/i,
  /^card;/i,
  /^towns:/i,
  /^lawnside,/i,
  /^\*we provide/i,
  /^takeout as well/i,
  /^northern burlington/i,
  /^\*on wednesday/i,
  /^\*except otherwise/i,
  /^\*located in the burlington/i,
  /^pine hill/i,
  /^\d{5},\s*\d{5}/,               // ZIP code lists like "08034, 08053"
  /^proof of residency/i,
  /^twenty-eight days/i,
  /^documentation, which/i,
  /^stamp program/i,
  /^low income per/i,
  /^covid hours/i,
  /^covid-19/i,
  /^income, social security/i,
  /^princeton hours:/i,
  /^counties st george/i,
  /^jewish family and vocational service of$/i,
  /^monroe township/i,
  /^dunellen,/i,
  /^am - \d+:\d+/i,               // Time fragments like "am - 1:00 pm"
  /^sea, deal,/i,
  /^staff serving/i,
  /^township, tinton/i,
  /^registered recipients only/i,
  /^manasquan/i,
  /^twp west belmar/i,
  /^boonton and surrounding/i,
  /^church of boonton/i,
  /^\*formerly care/i,
  /^beachwood and pine/i,
  /^without regard to religious/i,
  /^heights, manchester/i,
  /^lavallette,/i,
  /^\*covid/i,
  /^due to the covid/i,
  /^unnamed food resource$/i,
];

function isJunk(entry) {
  // Must have no address AND no city to be considered for deletion
  if (entry.address || entry.city) return false;

  return JUNK_PATTERNS.some(pattern => pattern.test(entry.name || ""));
}

// ── Main ───────────────────────────────────────────────────────────────────────

function main() {
  console.log("📂 Loading data…");

  if (!fs.existsSync(DATA_PATH)) {
    console.error("❌ data/nj_food_pantries.json not found.");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(data, null, 2));
  console.log(`   ✅ Backed up to ${BACKUP_PATH}`);

  let totalRemoved = 0;

  Object.entries(data.pantries_by_county).forEach(([county, pantries]) => {
    const before = pantries.length;
    const cleaned = pantries.filter(p => {
      if (isJunk(p)) {
        console.log(`   🗑️  [${county}] "${p.name}"`);
        return false;
      }
      return true;
    });

    const removed = before - cleaned.length;
    totalRemoved += removed;
    data.pantries_by_county[county] = cleaned;
  });

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

  console.log(`\n✅ Done! Removed ${totalRemoved} junk entries.`);
  console.log(`   Total local pantries remaining: ${
    Object.values(data.pantries_by_county).reduce((sum, arr) => sum + arr.length, 0)
  }`);
}

main();