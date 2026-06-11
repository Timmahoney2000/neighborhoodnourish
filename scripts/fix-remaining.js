/**
 * fix-remaining.js
 *
 * Fixes the 9 remaining entries that were missing coordinates:
 * - Adds addresses + coords to real pantries
 * - Deletes entries that are junk or out-of-state
 *
 * Usage: node fix-remaining.js
 */

const fs   = require("fs");
const path = require("path");

const DATA_PATH   = path.join(__dirname, "data", "nj_food_pantries.json");
const BACKUP_PATH = path.join(__dirname, "data", "nj_food_pantries.backup.json");

function main() {
  console.log("📂 Loading data…");
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(data, null, 2));
  console.log(`   ✅ Backed up`);

  // ── ATLANTIC ────────────────────────────────────────────────────────────────
  // "Community FoodBank of NJ – Atlantic County Mobile Pantries"
  // No fixed address — skip coords, leave as-is. Nothing to fix.

  // ── BERGEN ─────────────────────────────────────────────────────────────────
  // "Astoria Food Pantry" — this is in Astoria, Queens, NY. Delete it.
  data.pantries_by_county["Bergen"] = data.pantries_by_county["Bergen"].filter(
    p => p.name !== "Astoria Food Pantry"
  );
  console.log("   🗑️  Deleted: Astoria Food Pantry (Queens, NY — not NJ)");

  // ── BURLINGTON ──────────────────────────────────────────────────────────────
  // "RCBC Food Pantry" — Rowan College at Burlington County, Mount Laurel
  const rcbc = data.pantries_by_county["Burlington"].find(p => p.name === "RCBC Food Pantry");
  if (rcbc) {
    rcbc.address = "300 College Drive";
    rcbc.city    = "Mount Laurel";
    rcbc.state   = "NJ";
    rcbc.zip     = "08054";
    rcbc.lat     = 39.9561;
    rcbc.lng     = -74.9157;
    console.log("   ✅ Fixed: RCBC Food Pantry");
  }

  // "Spanish American Social Cultural Association" — Willingboro
  const sasa = data.pantries_by_county["Burlington"].find(
    p => p.name === "Spanish American Social Cultural Association"
  );
  if (sasa) {
    sasa.address = "249 John F Kennedy Way";
    sasa.city    = "Willingboro";
    sasa.state   = "NJ";
    sasa.zip     = "08046";
    sasa.lat     = 40.0268;
    sasa.lng     = -74.8674;
    console.log("   ✅ Fixed: Spanish American Social Cultural Association");
  }

  // ── MERCER ──────────────────────────────────────────────────────────────────
  // "Princeton Moblie Food Pantry" — fix typo in name + add address + coords
  const pmfp = data.pantries_by_county["Mercer"].find(
    p => p.name === "Princeton Moblie Food Pantry"
  );
  if (pmfp) {
    pmfp.name    = "Princeton Mobile Food Pantry";
    pmfp.address = "237 N Harrison St";
    pmfp.city    = "Princeton";
    pmfp.state   = "NJ";
    pmfp.zip     = "08540";
    pmfp.phone   = "(609) 955-6067";
    pmfp.website = "https://www.pmfpantry.org";
    pmfp.lat     = 40.3574;
    pmfp.lng     = -74.6580;
    console.log("   ✅ Fixed: Princeton Mobile Food Pantry (+ corrected name typo)");
  }

  // ── MIDDLESEX ───────────────────────────────────────────────────────────────
  // "Matawan Community Food Pantry" — 201 Broad St, Matawan
  const matawan = data.pantries_by_county["Middlesex"].find(
    p => p.name === "Matawan Community Food Pantry"
  );
  if (matawan) {
    matawan.address = "201 Broad St";
    matawan.city    = "Matawan";
    matawan.state   = "NJ";
    matawan.zip     = "07747";
    matawan.phone   = "(732) 566-2663";
    matawan.hours   = "Last Saturday of the month 8:00am - 12:00pm";
    matawan.lat     = 40.4165;
    matawan.lng     = -74.2290;
    console.log("   ✅ Fixed: Matawan Community Food Pantry");
  }

  // ── OCEAN ───────────────────────────────────────────────────────────────────
  // "* Formerly Care and Share we changed the name." — junk note, delete it
  data.pantries_by_county["Ocean"] = data.pantries_by_county["Ocean"].filter(
    p => p.name !== "* Formerly Care and Share we changed the name."
  );
  console.log("   🗑️  Deleted: '* Formerly Care and Share' (note, not a pantry)");

  // ── PASSAIC ─────────────────────────────────────────────────────────────────
  // "Center for Food Action – Upper Passaic Appointment Distribution"
  // No fixed address — skip coords, leave as-is.

  // ── WARREN ──────────────────────────────────────────────────────────────────
  // "New Life Food Pantry" — 56 Main Street, Helmetta NJ
  // Note: Helmetta is actually in Middlesex County, but this pantry is listed
  // under Warren in the source data so we leave it there and just add coords.
  const newLife = data.pantries_by_county["Warren"].find(
    p => p.name === "New Life Food Pantry"
  );
  if (newLife) {
    newLife.address = "56 Main Street";
    newLife.city    = "Helmetta";
    newLife.state   = "NJ";
    newLife.zip     = "08828";
    newLife.phone   = "732-521-0169";
    newLife.hours   = "Tues 10:00am - 12:00pm, Thurs 12:00pm - 2:00pm (by appointment)";
    newLife.website = "https://www.newlifefoodpantry.org";
    newLife.lat     = 40.3775;
    newLife.lng     = -74.4206;
    console.log("   ✅ Fixed: New Life Food Pantry");
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  console.log(`\n✅ Done! Saved to ${DATA_PATH}`);
  console.log(`   Total local pantries: ${
    Object.values(data.pantries_by_county).reduce((sum, arr) => sum + arr.length, 0)
  }`);
}

main();