const DEFAULT_CSV_URL = "<<<HIER DEIN LINK>>>";
const MAX_DISTANCE_KM = 20;

const state = {
  providers: [],
  const CSV_URL = "./TheraFinder.csv";,
  geocodeCache: new Map(),
};

const statusText = document.getElementById("status-text");
const resultsSection = document.getElementById("results");
const searchForm = document.getElementById("search-form");
const locationInput = document.getElementById("location-input");
const specializationInput = document.getElementById("specialization-input");
const adminPanel = document.getElementById("admin-panel");
const csvUrlInput = document.getElementById("csv-url-input");
const csvFileInput = document.getElementById("csv-file-input");
const loadCsvButton = document.getElementById("load-csv-button");

const urlParams = new URLSearchParams(window.location.search);
const isAdmin = urlParams.get("admin") === "1";
if (isAdmin) {
  adminPanel.classList.remove("hidden");
  csvUrlInput.value = DEFAULT_CSV_URL;
}

function setStatus(message) {
  statusText.textContent = message;
}

function normalize(value) {
  return value?.toString().trim().toLowerCase() || "";
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((entry) => entry.trim());
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  const entries = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    return record;
  });

  return entries;
}

function toNumber(value) {
  const normalized = value?.toString().replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const radiusKm = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radiusKm * c;
}

async function geocodeLocation(query) {
  const normalized = normalize(query);
  if (!normalized) return null;
  if (state.geocodeCache.has(normalized)) {
    return state.geocodeCache.get(normalized);
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "ch");

  const response = await fetch(url.toString(), {
    headers: {
      "Accept-Language": "de",
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    state.geocodeCache.set(normalized, null);
    return null;
  }

  const match = data[0];
  const lat = toNumber(match.lat);
  const lon = toNumber(match.lon);
  if (lat === null || lon === null) {
    state.geocodeCache.set(normalized, null);
    return null;
  }

  const coords = { lat, lon };
  state.geocodeCache.set(normalized, coords);
  return coords;
}

function renderResults(results, originLabel) {
  resultsSection.innerHTML = "";

  if (results.length === 0) {
    resultsSection.innerHTML =
      "<div class=\"card\">Keine passenden Einträge gefunden.</div>";
    return;
  }

  results.forEach((item) => {
    const card = document.createElement("article");
    card.className = "result-card";

    const header = document.createElement("div");
    header.className = "result-header";

    const title = document.createElement("h3");
    title.textContent = item["Therapiestelle"] || "Therapiestelle";
    header.appendChild(title);

    if (item.distance !== null && item.distance !== undefined) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = `${item.distance.toFixed(1)} km entfernt`;
      header.appendChild(tag);
    }

    const grid = document.createElement("div");
    grid.className = "result-grid";
    grid.innerHTML = `
      <div><span>Kanton:</span> ${item.Kanton || "-"}</div>
      <div><span>Ort:</span> ${item.Ort || "-"}</div>
      <div><span>PLZ:</span> ${item.PLZ || "-"}</div>
      <div><span>Tel.:</span> ${item["Tel."] || "-"}</div>
      <div><span>E-Mail:</span> ${item["E-Mail"] || "-"}</div>
      <div><span>Homepage:</span> ${item.Homepage || "-"}</div>
      <div><span>Spezialisierung:</span> ${item.Spezialisierung || "-"}</div>
    `;

    const actions = document.createElement("div");
    actions.className = "actions";

    if (originLabel && item.PLZ) {
      const mapsLink = document.createElement("a");
      mapsLink.className = "link-button";
      mapsLink.textContent = "Google Maps öffnen";
      mapsLink.target = "_blank";
      mapsLink.rel = "noopener";
      const origin = encodeURIComponent(originLabel);
      const destination = encodeURIComponent(`${item.PLZ} ${item.Ort || ""}`.trim());
      mapsLink.href = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
      actions.appendChild(mapsLink);
    }

    card.appendChild(header);
    card.appendChild(grid);
    if (actions.childNodes.length > 0) {
      card.appendChild(actions);
    }
    resultsSection.appendChild(card);
  });
}

async function filterResults({ locationQuery, specializationQuery }) {
  const locationNorm = normalize(locationQuery);
  const specializationNorm = normalize(specializationQuery);

  let filtered = [...state.providers];

  if (specializationNorm) {
    filtered = filtered.filter((entry) =>
      normalize(entry.Spezialisierung).includes(specializationNorm)
    );
  }

  if (!locationNorm) {
    return { results: filtered, originLabel: "" };
  }

  const exactMatches = filtered.filter((entry) => {
    const plz = normalize(entry.PLZ);
    const ort = normalize(entry.Ort);
    return plz === locationNorm || ort === locationNorm;
  });

  if (exactMatches.length > 0) {
    return { results: exactMatches, originLabel: locationQuery };
  }

  const originCoords = await geocodeLocation(locationQuery);
  if (!originCoords) {
    return { results: [], originLabel: locationQuery };
  }

  const nearby = filtered
    .map((entry) => {
      const lat = toNumber(entry.lat);
      const lon = toNumber(entry.lon);
      if (lat === null || lon === null) return null;
      const distance = haversineDistance(originCoords.lat, originCoords.lon, lat, lon);
      return { ...entry, distance };
    })
    .filter((entry) => entry && entry.distance <= MAX_DISTANCE_KM)
    .sort((a, b) => a.distance - b.distance);

  return { results: nearby, originLabel: locationQuery };
}

async function loadCsvFromUrl(url) {
  setStatus("CSV wird geladen …");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("CSV konnte nicht geladen werden.");
  }
  const text = await response.text();
  state.providers = parseCsv(text);
  setStatus(`${state.providers.length} Einträge geladen.`);
}

async function loadCsvFromFile(file) {
  setStatus("CSV-Datei wird gelesen …");
  const text = await file.text();
  state.providers = parseCsv(text);
  setStatus(`${state.providers.length} Einträge geladen.`);
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const locationQuery = locationInput.value;
  const specializationQuery = specializationInput.value;

  if (!locationQuery && !specializationQuery) {
    setStatus("Bitte Ort/PLZ oder Spezialisierung eingeben.");
    return;
  }

  setStatus("Suche läuft …");
  const { results, originLabel } = await filterResults({
    locationQuery,
    specializationQuery,
  });

  if (results.length === 0 && locationQuery) {
    setStatus(
      "Keine exakte Übereinstimmung gefunden. Es konnten keine Orte im 20-km-Umkreis ermittelt werden."
    );
  } else {
    setStatus("Ergebnisse aktualisiert.");
  }

  renderResults(results, originLabel);
});

if (isAdmin) {
  loadCsvButton.addEventListener("click", async () => {
    try {
      const url = csvUrlInput.value.trim();
      if (!url && csvFileInput.files.length === 0) {
        setStatus("Bitte CSV-Link oder Datei auswählen.");
        return;
      }
      if (csvFileInput.files.length > 0) {
        await loadCsvFromFile(csvFileInput.files[0]);
      } else {
        await loadCsvFromUrl(url);
        state.csvUrl = url;
      }
    } catch (error) {
      setStatus(error.message);
    }
  });
}

if (!isAdmin && DEFAULT_CSV_URL && DEFAULT_CSV_URL !== "<<<HIER DEIN LINK>>>") {
  loadCsvFromUrl(DEFAULT_CSV_URL).catch((error) => {
    setStatus(error.message);
  });
} else if (!isAdmin) {
  setStatus("Admin-Link notwendig, um CSV zu laden.");
}
