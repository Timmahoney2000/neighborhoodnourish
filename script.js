/* ============================================================
   Neighborhood Nourish — script.js
   ============================================================ */
 
 
// ── 1. Config ──────────────────────────────────────────────────────────────────
const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "https://neighborhoodnourish.vercel.app/api"
? "http://localhost:3000/api"
: "https://neighborhoodnourish.vercel.app/api";
 
// Approximate ZIP-code → NJ county mapping.
const ZIP_COUNTY_MAP = [
  { prefixes: ["070", "071", "072", "073"], county: "Essex" },
  { prefixes: ["075", "076", "077"],        county: "Bergen" },
  { prefixes: ["078"],                      county: "Passaic" },
  { prefixes: ["079"],                      county: "Morris" },
  { prefixes: ["080", "081"],               county: "Burlington" },
  { prefixes: ["084", "085", "086"],        county: "Camden" },
  { prefixes: ["087"],                      county: "Middlesex" },
  { prefixes: ["088", "089"],               county: "Union" },
  { prefixes: ["082"],                      county: "Ocean" },
  { prefixes: ["074"],                      county: "Sussex" },
  { prefixes: ["078"],                      county: "Warren" },
  { prefixes: ["076"],                      county: "Hudson" },
  { prefixes: ["077"],                      county: "Monmouth" },
  { prefixes: ["083"],                      county: "Atlantic" },
  { prefixes: ["082"],                      county: "Cape_May" },
  { prefixes: ["083"],                      county: "cumberland" },
  { prefixes: ["085"],                      county: "Gloucester" },
  { prefixes: ["088"],                      county: "Somerset" },
  { prefixes: ["079"],                      county: "Hunterdon" },
  { prefixes: ["086"],                      county: "Mercer" },
];
 
 
// ── 2. DOM References ──────────────────────────────────────────────────────────
 
const searchBtn      = document.getElementById("searchBtn");
const useLocationBtn = document.getElementById("useLocationBtn");
const zipInput       = document.getElementById("zipInput");
const resultsList    = document.getElementById("resultsList");
const noResults      = document.getElementById("noResults");
const filterChips    = document.querySelectorAll(".filter-chip"); // FIX: querySelectorAll not getElementById
const yearSpan       = document.getElementById("year");
 
 
// ── 3. State ───────────────────────────────────────────────────────────────────
 
let allResults   = [];
let activeFilters = new Set();
 
 
// ── 4. Utility Helpers ─────────────────────────────────────────────────────────
 
function countyFromZip(zip) {
  const prefix = zip.slice(0, 3);
  const match = ZIP_COUNTY_MAP.find(entry => entry.prefixes.includes(prefix));
  return match ? match.county : null;
}
 
function inferType(pantry) {
  const haystack = [pantry.name, pantry.notes, pantry.type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
 
  if (haystack.includes("meal") || haystack.includes("soup kitchen") || haystack.includes("hot food")) {
    return "meals";
  }
  return "pantry";
}
 
function isOpenNow(pantry) {
  if (!pantry.hours) return false;
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const today = days[new Date().getDay()];
  return pantry.hours.toLowerCase().includes(today);
}
 
function setEmptyState(visible) {
  noResults.setAttribute("aria-hidden", visible ? "false" : "true");
}
 
function updateResultsHeading(count) {
  const heading = document.getElementById("results-heading");
  heading.textContent = count > 0
    ? `Nearby Locations (${count})`
    : "Nearby Locations";
}
 
 
// ── 5. Loading State ───────────────────────────────────────────────────────────
 
function showLoading() {
  resultsList.innerHTML = `
    <li class="result-card result-card--loading" aria-label="Loading results">
    <div class="spinner" aria-hidden="true"></div>
    <div>
      <div class="result-card__name">Searching…</div>
      <p class="result-card__meta">Finding food resources near you.</p>
      </div>
    </li>`;
  setEmptyState(false);
}
 
function clearLoading() {
  resultsList.innerHTML = "";
}
 
 
// ── 6. Render Results ──────────────────────────────────────────────────────────
 
function renderResults(data) {
  clearLoading();
 
  if (!data || data.length === 0) {
    setEmptyState(true);
    updateResultsHeading(0);
    return;
  }
 
  setEmptyState(false);
  updateResultsHeading(data.length);
 
  const fragment = document.createDocumentFragment();
 
  data.forEach(loc => {
    const li = document.createElement("li");
    li.className = "result-card";
 
    const type      = inferType(loc);
    const typeLabel = type === "meals" ? "🍲 Hot Meals" : "📦 Food Pantry";
    const openNow   = isOpenNow(loc);
    const openBadge = openNow
      ? `<span class="result-card__badge result-card__badge--open">Open Now</span>`
      : "";
 
    // FIX: loc.address and loc.city are separate fields, not loc.address.city
    const address = [loc.address, loc.city]
      .filter(Boolean)
      .join(", ");
 
    const phone = loc.phone
      ? `<p class="result-card__meta">📞 <a href="tel:${loc.phone}">${loc.phone}</a></p>`
      : "";
 
    const hours = loc.hours
      ? `<p class="result-card__meta">🕐 ${loc.hours}</p>`
      : "";
 
    const notes = loc.notes
      ? `<p class="result-card__meta result-card__notes">${loc.notes}</p>`
      : "";
 
    // FIX: class= not class-
    li.innerHTML = `
      <h3 class="result-card__name">${loc.name}</h3>
      ${address ? `<p class="result-card__meta">📍 ${address}</p>` : ""}
      ${phone}
      ${hours}
      ${notes}
      <div class="result-card__footer">
        <span class="result-card__badge">${typeLabel}</span>
        ${openBadge}
      </div>
    `;
 
    li.dataset.type   = type;
    li.dataset.isOpen = openNow ? "true" : "false";
 
    fragment.appendChild(li);
  });
 
  resultsList.appendChild(fragment);
}
 
 
// ── 7. Client-Side Filtering ───────────────────────────────────────────────────
 
function applyFilters() {
  const cards = resultsList.querySelectorAll(".result-card");
 
  if (activeFilters.size === 0) {
    cards.forEach(card => card.hidden = false);
    const visible = [...cards].filter(c => !c.hidden).length;
    updateResultsHeading(visible);
    setEmptyState(visible === 0 && allResults.length > 0);
    return;
  }
 
  let visibleCount = 0;
 
  cards.forEach(card => {
    const type   = card.dataset.type;
    const isOpen = card.dataset.isOpen === "true";
 
    const passesType = !activeFilters.has("meals") && !activeFilters.has("pantry")
                       || activeFilters.has(type);
    const passesOpen = !activeFilters.has("open") || isOpen;
    const show       = passesType && passesOpen;
 
    card.hidden = !show;
    if (show) visibleCount++;
  });
 
  updateResultsHeading(visibleCount);
  setEmptyState(visibleCount === 0 && allResults.length > 0);
}
 
 
// ── 8. API Calls ───────────────────────────────────────────────────────────────
 
async function fetchByCounty(county, coords = null) {
    let url = `${API_BASE}/pantries/county/${encodeURIComponent(county)}`;
    if (coords) url += `?lat=${coords.lat}&lng=${coords.lng}`;

    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 404) throw new Error(`No data found for county: ${county}`);
        throw new Error(`API error${res.status}`);
    }

    const json = await res.json();
    // Merge into one flat array
    const all = [
        ...(json.regional_food_banks || []),
        ...(json.local_pantries || []),
    ];

    // If distance data came back, sort the merged array by it
    if (coords) {
        all.sort((a, b) => {
            if (a.distance_miles === null || a.distance_miles === undefined) return 1;
            if (b.distance_miles === null || b.distance === undefined) return -1;
            return a.distance_miles - b.distance_miles;
        });
    } else {
        // Sort alphabetically by name when no coords available
        all.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    return all;
}

 
async function reverseGeocode(lat, lng) {
  // FIX: https not http (mixed content), and correct function name (was reverseGecode)
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en" }
  });
 
  if (!res.ok) throw new Error("Reverse geocode failed");
 
  const json = await res.json();
  const raw  = json.address?.county || "";
  // FIX: replace spaces with underscores to match API county slugs (not hyphens)
  return raw
  .replace(/\s+county$/i, "")
  .trim()
  .split(/\s+/)
  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
  .join("_");

  console.log("Nominatim raw county:", raw);
}
 
 
// ── 9. Search Handlers ─────────────────────────────────────────────────────────
 
async function searchByZip(zip) {
    const county = countyFromZip(zip);

    if (!county) {
        showUserError("That doesn't look like a New Jersey ZIP code. Please try again.");
        return;
    }

    showLoading();

    try {
        const results = await fetchByCounty(county);
        allResults = results;
        renderResults(results);
        applyFilters();
        scrollToResults();
    } catch (err) {
        showUserError(err.message);
        console.error(err);
    }
}
 
async function searchByLocation() {
  if (!navigator.geolocation) {
    showUserError("Your browser doesn't support geolocation. Please enter a ZIP code instead.");
    return;
  }
 
  useLocationBtn.textContent = "📍 Locating…";
  useLocationBtn.disabled = true; // FIX: was useLocationBtn (missing 'n')
 
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      useLocationBtn.textContent = "📍 Use My Location";
      useLocationBtn.disabled = false;
 
      showLoading();
 
      try {
        const county  = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        const results = await fetchByCounty(county);
        allResults = results;
        renderResults(results);
        applyFilters();
        scrollToResults();
      } catch (err) {
        showUserError(err.message);
        console.error(err);
      }
    },
    () => {
      useLocationBtn.textContent = "📍 Use My Location";
      useLocationBtn.disabled = false;
      showUserError("Unable to get your location. Please enter a ZIP code instead.");
    },
    { timeout: 10000 }
  );
}
 
 
// ── 10. Error Display ──────────────────────────────────────────────────────────
 
function showUserError(message) {
  clearLoading();
  // FIX: missing closing </p> tag on first paragraph, was showUseError in searchByZip
  resultsList.innerHTML = `
    <li class="result-card result-card--error" role="alert">
      <p class="result-card__name">Something went wrong</p>
      <p class="result-card__meta">${message}</p>
    </li>`;
  setEmptyState(false);
  updateResultsHeading(0);
}
 
 
// ── 11. Scroll Helper ──────────────────────────────────────────────────────────
 
function scrollToResults() {
  document.querySelector(".results-section")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
 
 
// ── 12. Event Listeners ────────────────────────────────────────────────────────
 
// Search button
searchBtn.addEventListener("click", () => {
  const zip = zipInput.value.trim();
  if (!zip) {
    zipInput.focus();
    zipInput.setAttribute("aria-invalid", "true");
    return;
  }
  zipInput.removeAttribute("aria-invalid");
  searchByZip(zip);
});
 
// Enter key in ZIP field
zipInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchBtn.click();
});
 
// Clear aria-invalid as user types
zipInput.addEventListener("input", () => {
  zipInput.removeAttribute("aria-invalid");
});
 
// Use My Location button
useLocationBtn.addEventListener("click", searchByLocation);
 
// FIX: filter chips were missing the click event listener wrapper —
// the toggle logic was running immediately on page load instead of on click
filterChips.forEach(chip => {
  chip.addEventListener("click", () => {
    const filter  = chip.dataset.filter;
    const pressed = chip.getAttribute("aria-pressed") === "true";
 
    chip.setAttribute("aria-pressed", String(!pressed));
 
    if (!pressed) {
      activeFilters.add(filter);
    } else {
      activeFilters.delete(filter);
    }
 
    if (allResults.length > 0) applyFilters();
  });
});
 
 
// ── 13. Init ───────────────────────────────────────────────────────────────────
 
if (yearSpan) yearSpan.textContent = new Date().getFullYear();