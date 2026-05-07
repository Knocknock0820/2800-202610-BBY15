/* -------------------------------------------------------
   1. WEATHER
   Calls our backend API routes which handle geolocation
   and weather fetching from Open-Meteo and ipapi.co.
------------------------------------------------------- */

// Build the display string and update the DOM element
// Code partly adapted from Ai.
// Modified by: Harun Yaprak
function showWeather(temp, city) {
  const el = document.getElementById("weatherText");
  const day = new Date().toLocaleDateString("en-US", { weekday: "long" });
  el.textContent = city
    ? `${day} · ${temp}°C  —  ${city}`
    : `${day} · ${temp}°C`;
}

// Loads weather data using browser Geolocation if available
// Code mixed of hand written and Ai.
// Modified by: Harun Yaprak
async function loadWeather() {
  const el = document.getElementById("weatherText");

  // Path A: use browser Geolocation if available
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        try {
          const res = await fetch(`/api/weather/coords?lat=${latitude}&lon=${longitude}`);
          if (!res.ok) 
            throw new Error("Weather error");
          const data = await res.json();
          showWeather(data.temp, data.city);
        } catch {
          el.textContent = "Weather unavailable";
        }
      },
      // Geolocation denied → fall through to IP-based fallback
      async () => {
        await loadWeatherByIP();
      }
    );
  } else {
    // Browser has no geolocation at all → use IP fallback
    await loadWeatherByIP();
  }
}

// Path B: resolve location via our backend using the client's IP
// Code mixed of hand written and Ai.
// Modified by: Harun Yaprak
async function loadWeatherByIP() {
  const el = document.getElementById("weatherText");
  try {
    const res = await fetch('/api/weather/ip');
    if (!res.ok) 
      throw new Error("Weather error");
    const data = await res.json();
    showWeather(data.temp, data.city);
  } catch {
    el.textContent = "Weather unavailable";
  }
}

/* -------------------------------------------------------
   2. PLANT STORAGE
   Plants are stored in localStorage as a JSON array.
   Each plant object: { id, name, waterFreq, addedAt }
------------------------------------------------------- */

const STORAGE_KEY = "users_plants";

// Load the plant array from localStorage (empty array if nothing saved)
function loadPlants() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// Persist the plant array back to localStorage
function savePlants(plants) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plants));
}

/* -------------------------------------------------------
   3. PLANT CARD RENDERING
   Build a card DOM element for a single plant object
   and attach the expand/collapse toggle to it.
------------------------------------------------------- */
// Code partly adapted from Ai.
// Modified by: Harun Yaprak
// Create and return a .plant-card element for the given plant
function createPlantCard(plant) {
  const card = document.createElement("div");
  card.className = "plant-card";
  card.dataset.id = plant.id;

  const displayName = plant.nickname ? `${plant.nickname} (${plant.species})` : (plant.species || plant.name);
  const addedDate = plant.addedAt ? new Date(plant.addedAt).toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' }) : "Unknown date";
  
  const now = Date.now();
  let isWatered = false;
  if (plant.lastWateredAt) {
    const last = new Date(plant.lastWateredAt).getTime();
    const intervalMs = (plant.intervalDays || 7) * 24 * 60 * 60 * 1000;
    if (now - last < intervalMs) {
      isWatered = true;
    }
  }

  card.innerHTML = `
    <div class="plant-card-header">${displayName}</div>
    <div class="plant-card-body">
      <p class="added-date-text">Added on ${addedDate}</p>
      <div class="watering-checklist">
        <label class="checklist-item">
          <input type="checkbox" class="water-checkbox" ${isWatered ? "checked" : ""} />
          <span>Watering Schedule: ${plant.waterFreq}</span>
        </label>
      </div>
      <div class="card-footer-row">
        <a href="/details" class="btn-details">Details</a>
        <button class="btn-delete" data-id="${plant.id}" title="Remove plant">
          <img src="/icons/bin.png" alt="Delete" class="delete-icon" />
        </button>
      </div>
    </div>
  `;

  // Attach listener to checkbox to save watering state
  const checkbox = card.querySelector(".water-checkbox");
  checkbox.addEventListener("change", (e) => {
    updatePlantWateredState(plant.id, e.target.checked);
  });

  // Attach expand/collapse click listener to the header
  card.querySelector(".plant-card-header").addEventListener("click", () => {
    toggleCard(card);
  });

  // Attach delete listener — stops propagation so it doesn't trigger the toggle
  card.querySelector(".btn-delete").addEventListener("click", (e) => {
    e.stopPropagation();
    deletePlant(plant.id);
  });

  return card;
}

// Remove a plant by id from storage and re-render the list
function deletePlant(id) {
  const plants = loadPlants().filter((p) => p.id !== id);
  savePlants(plants);
  renderPlants();
}

// Update the watering state of a plant
function updatePlantWateredState(id, isWatered) {
  const plants = loadPlants();
  const index = plants.findIndex(p => p.id === id);
  if (index !== -1) {
    plants[index].lastWateredAt = isWatered ? new Date().toISOString() : null;
    savePlants(plants);
  }
}

function getIntervalDays(freqStr) {
  if (!freqStr) return 7;
  const str = freqStr.toLowerCase();
  if (str.includes("day") && str.includes("2")) return 2;
  if (str.includes("day") && str.includes("3")) return 3;
  if (str.includes("day")) return 1;
  if (str.includes("week") && str.includes("1-2")) return 10;
  if (str.includes("week") && str.includes("2-3")) return 17;
  if (str.includes("week") && str.includes("2")) return 14;
  if (str.includes("month")) return 30;
  return 7; // default to 1 week
}

// Expand the clicked card and collapse all others
function toggleCard(card) {
  const body = card.querySelector(".plant-card-body");
  const isOpen = body.classList.contains("open");

  // Close every currently open card first
  document.querySelectorAll(".plant-card-body.open").forEach((b) => {
    b.classList.remove("open");
    b.closest(".plant-card").classList.remove("expanded");
  });

  // If this card was closed before the click, open it now
  if (!isOpen) {
    body.classList.add("open");
    card.classList.add("expanded");
  }
}

// Render all plants from storage into #plantList
function renderPlants() {
  const list = document.getElementById("plantList");
  list.innerHTML = ""; // clear existing cards

  const plants = loadPlants();

  if (plants.length === 0) {
    // Show a friendly empty state message
    list.innerHTML = `
      <p style="text-align:center; color:#687d31; margin-top:32px; font-size:0.9rem;">
        No plants yet — tap <strong>+</strong> to add your first one!
      </p>
    `;
    return;
  }

  plants.forEach((plant) => {
    list.appendChild(createPlantCard(plant));
  });
}

/* -------------------------------------------------------
   4. ADD PLANT MODAL
   The FAB (+) opens a bottom-sheet modal.
   On save, a new plant is added to storage and the list
   is re-rendered without a page reload.
------------------------------------------------------- */

let availablePlantTypes = [];

async function fetchPlantTypes() {
  try {
    const res = await fetch("/api/plants");
    if (!res.ok) 
      throw new Error("Failed to fetch plants");
    availablePlantTypes = await res.json();
    
    const select = document.getElementById("plantSpecies");
    select.innerHTML = '<option value="" disabled selected>Select a species...</option>';
    
    availablePlantTypes.forEach(p => {
      const option = document.createElement("option");
      option.value = p._id;
      option.textContent = p.name;
      select.appendChild(option);
    });
  } catch (err) {
    console.error(err);
    const select = document.getElementById("plantSpecies");
    if (select) {
      select.innerHTML = '<option value="" disabled>Error loading species</option>';
    }
  }
}


function openModal() {
  const modal = document.getElementById("addPlantModal");
  // Clear any previous input before showing the modal
  document.getElementById("plantName").value = "";
  document.getElementById("plantSpecies").value = "";
  modal.classList.add("open");
}

function closeModal() {
  document.getElementById("addPlantModal").classList.remove("open");
}

// Create a new plant object and persist it, then refresh the list
function savePlant() {
  const speciesSelect = document.getElementById("plantSpecies");
  const speciesId = speciesSelect.value;
  const nickname = document.getElementById("plantName").value.trim();

  if (!speciesId) {
    speciesSelect.focus();
    return; // do nothing if species is not selected
  }

  const selectedType = availablePlantTypes.find(p => p._id === speciesId);
  const plants = loadPlants();

  const newPlant = {
    id: Date.now(), // unique numeric id based on timestamp
    species: selectedType.name,
    nickname: nickname,
    waterFreq: selectedType.waterFreq,
    intervalDays: getIntervalDays(selectedType.waterFreq),
    addedAt: new Date().toISOString(),
    lastWateredAt: null,
  };

  plants.push(newPlant);
  savePlants(plants);

  closeModal();
  renderPlants(); // refresh the list to show the new card
}

function initModal() {
  fetchPlantTypes();

  // FAB opens the modal
  document.getElementById("btnAdd").addEventListener("click", openModal);

  // Cancel button closes the modal
  document.getElementById("btnCancel").addEventListener("click", closeModal);

  // Save button persists the plant
  document.getElementById("btnSave").addEventListener("click", savePlant);

  // Tapping the dark backdrop (outside the sheet) also closes the modal
  document.getElementById("addPlantModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
}

/* -------------------------------------------------------
   INIT — run everything once the DOM is ready
------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  loadWeather();
  renderPlants(); // render saved plants on page load
  initModal(); // wire up the add-plant modal
});
