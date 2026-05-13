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
          const res = await fetch(
            `/api/weather/coords?lat=${latitude}&lon=${longitude}`,
          );
          if (!res.ok) throw new Error("Weather error");
          const data = await res.json();
          window.currentTemperature = data.temp;
          updateTemperatureAlerts();
          showWeather(data.temp, data.city);
        } catch {
          el.textContent = "Weather unavailable";
        }
      },
      // Geolocation denied → fall through to IP-based fallback
      async () => {
        await loadWeatherByIP();
      },
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
    const res = await fetch("/api/weather/ip");
    if (!res.ok) throw new Error("Weather error");
    const data = await res.json();
    window.currentTemperature = data.temp;
    updateTemperatureAlerts();
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
// Code adopted from bootstrap : https://getbootstrap.com/docs/5.3/components/card/
// Modified by: Harun Yaprak
// Create and return a .plant-card element for the given plant
function createPlantCard(plant) {
  const wrapper = document.createElement("div");

  const displayName = plant.nickname
    ? `${plant.nickname} (${plant.species})`
    : plant.species || plant.name;
  const addedDate = plant.addedAt
    ? new Date(plant.addedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Unknown date";

  const now = Date.now();
  let isWatered = false;
  if (plant.lastWateredAt) {
    const last = new Date(plant.lastWateredAt).getTime();
    const intervalMs = (plant.intervalDays || 7) * 24 * 60 * 60 * 1000;
    if (now - last < intervalMs) {
      isWatered = true;
    }
  }

  let isInShade = false;
  if (plant.movedToShadeAt) {
    const shadeTime = new Date(plant.movedToShadeAt).getTime();
    if (now - shadeTime < 8 * 60 * 60 * 1000) {
      isInShade = true;
    }
  }

  const maxTemp = getPlantMaxTemp(plant.species);
  const isTooHot =
    typeof window.currentTemperature !== "undefined" &&
    window.currentTemperature > maxTemp;
  const showSunIcon = isTooHot && !isInShade;
  wrapper.innerHTML = `
    <!-- Bootstrap Card -->
    <div class="card mb-3 shadow-sm border-0" style="border-radius: 20px; overflow: hidden; background-color: #d5d3cc;">
      <!-- Card Header (Clickable for Bootstrap Collapse) -->
      <div class="card-header fw-bold d-flex justify-content-between align-items-center" 
           data-bs-toggle="collapse" 
           href="#collapsePlant${plant.id}" 
           role="button" aria-expanded="false" 
           style="cursor: pointer; padding: 16px 24px; color: #19350c; background-color: transparent; border-bottom: none;">
        <span>${displayName}</span>
        <div class="d-flex align-items-center gap-2">
          <img src="/icons/sun.png" id="temp-alert-${plant.id}" alt="Too Hot" style="width: 20px; height: 20px; ${showSunIcon ? "" : "display: none;"} filter: invert(56%) sepia(85%) saturate(3015%) hue-rotate(1deg) brightness(103%) contrast(105%);" title="Too Hot!">
          <img src="/icons/h2o.png" id="water-alert-${plant.id}" alt="Needs Water" style="width: 20px; height: 20px; ${isWatered ? "display: none;" : ""} filter: invert(37%) sepia(87%) saturate(1637%) hue-rotate(194deg) brightness(101%) contrast(101%);" title="Needs Water">
          <small class="text-muted" style="font-size: 0.7em;">▼</small>
        </div>
      </div>
      
      <!-- Collapsible Body -->
      <div class="collapse" id="collapsePlant${plant.id}">
        <div class="card-body" style="background-color: #e8e6e0; padding: 16px 24px;">
          <p class="small mb-3" style="color: #687d31; font-weight: 500; font-style: italic;">Added on ${addedDate}</p>
          
          <!-- Watering Checklist -->
          <div class="form-check mb-3 p-3" style="background-color: #f2f1ee; border-radius: 12px; margin-left: 0; padding-left: 12px;">
            <div class="d-flex align-items-center gap-2">
              <input class="form-check-input water-checkbox m-0" type="checkbox" id="check${plant.id}" ${isWatered ? "checked" : ""} style="width: 18px; height: 18px; accent-color: #687d31;">
              <label class="form-check-label" for="check${plant.id}" style="color: #19350c; font-size: 0.9rem;">
                Watering Schedule: ${plant.waterFreq}
              </label>
            </div>
          </div>
          
          <!-- Move Plant To Shade Checklist -->
          <div class="form-check mb-3 p-3 shade-container" id="shade-container-${plant.id}" style="background-color: #f2f1ee; border-radius: 12px; margin-left: 0; padding-left: 12px; ${isTooHot || isInShade ? "display: block;" : "display: none;"}">
            <div class="d-flex align-items-center gap-2">
              <input class="form-check-input shade-checkbox m-0" type="checkbox" id="shade${plant.id}" ${isInShade ? "checked" : ""} style="width: 18px; height: 18px; accent-color: #687d31;">
              <label class="form-check-label" for="shade${plant.id}" style="color: #19350c; font-size: 0.9rem;">
                Move Plant To Shade
              </label>
            </div>
          </div>
          
          <!-- Footer Buttons -->
          <div class="d-flex justify-content-between align-items-center mt-3 pt-2">
            <a href="/details/${plant.slug}" class="btn btn-sm text-decoration-none px-4" style="background-color: #687d31; color: #d5d3cc; border-radius: 20px; font-weight: 600;">Details</a>
            <button class="btn btn-sm btn-delete border-0" data-id="${plant.id}" title="Remove plant" style="background: transparent; border: 1.5px solid rgba(25,53,12,0.2) !important; border-radius: 20px; padding: 4px 10px;">
              <img src="/icons/bin.png" alt="Delete" style="width: 16px; height: 16px; opacity: 0.6;" />
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const card = wrapper.firstElementChild;

  // Attach listener to checkbox to save watering state
  const checkbox = card.querySelector(".water-checkbox");
  if (checkbox) {
    checkbox.addEventListener("change", (e) => {
      updatePlantWateredState(plant.id, e.target.checked);
      const alertIcon = card.querySelector(`#water-alert-${plant.id}`);
      if (alertIcon) {
        alertIcon.style.display = e.target.checked ? "none" : "block";
      }
    });
  }

  // Attach listener to shade checkbox
  // Adopted from AI
  // Modified by: Harun Yaprak
  const shadeCheckbox = card.querySelector(".shade-checkbox");
  if (shadeCheckbox) {
    shadeCheckbox.addEventListener("change", (e) => {
      updatePlantShadeState(plant.id, e.target.checked);
      const alertIcon = card.querySelector(`#temp-alert-${plant.id}`);
      if (alertIcon) {
        const maxTemp = getPlantMaxTemp(plant.species);
        const isCurrentlyHot =
          typeof window.currentTemperature !== "undefined" &&
          window.currentTemperature > maxTemp;
        alertIcon.style.display =
          isCurrentlyHot && !e.target.checked ? "block" : "none";
      }
    });
  }

  // Attach delete listener — stops propagation so it doesn't trigger the toggle
  const deleteBtn = card.querySelector(".btn-delete");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deletePlant(plant.id);
    });
  }

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
  const index = plants.findIndex((p) => p.id === id);
  if (index !== -1) {
    plants[index].lastWateredAt = isWatered ? new Date().toISOString() : null;
    savePlants(plants);
  }
}

// Update the shade state of a plant
function updatePlantShadeState(id, inShade) {
  const plants = loadPlants();
  const index = plants.findIndex((p) => p.id === id);
  if (index !== -1) {
    plants[index].movedToShadeAt = inShade ? new Date().toISOString() : null;
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

// After we implement plant database, we can remove this function and just get the data from the database
// Currently used to get max temperature tolerance for a plant species
function getPlantMaxTemp(species) {
  const temps = {
    Monstera: 10,
    "Snake Plant": 35,
    Cactus: 40,
    "Peace Lily": 28,
    "Spider Plant": 32,
    Pothos: 32,
    "Aloe Vera": 35,
  };
  return temps[species] || 30; // default 30°C if not specified
}

// Update temperature alerts for all rendered cards dynamically
// Adapted from AI, used to show temperature alerts for plants
// Modified by: Harun Yaprak
function updateTemperatureAlerts() {
  if (typeof window.currentTemperature === "undefined") return;
  const plants = loadPlants();
  const now = Date.now();
  plants.forEach((plant) => {
    let isInShade = false;
    if (plant.movedToShadeAt) {
      const shadeTime = new Date(plant.movedToShadeAt).getTime();
      if (now - shadeTime < 8 * 60 * 60 * 1000) {
        isInShade = true;
      }
    }
    const maxTemp = getPlantMaxTemp(plant.species);
    const isTooHot = window.currentTemperature > maxTemp;

    // Toggle Sun Icon
    const alertIcon = document.getElementById(`temp-alert-${plant.id}`);
    if (alertIcon) {
      alertIcon.style.display = isTooHot && !isInShade ? "block" : "none";
    }

    // Toggle Shade Checkbox Container
    const shadeContainer = document.getElementById(
      `shade-container-${plant.id}`,
    );
    if (shadeContainer) {
      shadeContainer.style.display = isTooHot || isInShade ? "block" : "none";
    }
  });
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
    if (!res.ok) throw new Error("Failed to fetch plants");
    availablePlantTypes = await res.json();

    const select = document.getElementById("plantSpecies");
    select.innerHTML =
      '<option value="" disabled selected>Select a species...</option>';

    availablePlantTypes.forEach((p) => {
      const option = document.createElement("option");
      option.value = p._id;
      option.textContent = p.name;
      select.appendChild(option);
    });
  } catch (err) {
    console.error(err);
    const select = document.getElementById("plantSpecies");
    if (select) {
      select.innerHTML =
        '<option value="" disabled>Error loading species</option>';
    }
  }
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

  const selectedType = availablePlantTypes.find((p) => p._id === speciesId);
  const plants = loadPlants();

  const newPlant = {
    id: Date.now(), // unique numeric id based on timestamp
    species: selectedType.name,
    slug: selectedType.slug,
    nickname: nickname,
    waterFreq: selectedType.waterFreq,
    intervalDays: getIntervalDays(selectedType.waterFreq),
    addedAt: new Date().toISOString(),
    lastWateredAt: null,
  };

  console.log("Saving new plant:", newPlant);
  plants.push(newPlant);
  savePlants(plants);

  // Close the bootstrap modal
  const modalEl = document.getElementById("addPlantModal");
  const modal =
    bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  modal.hide();

  renderPlants(); // refresh the list to show the new card
}

// User Guide Walkthrough Logic

const guideData = [
  {
    img: "/images/guide_step1.png",
    text: "Welcome to Sprout! We are excited to help you on your plant care journey. This quick guide will show you how to make the most of our app and keep your green friends thriving!",
  },
  {
    img: "/images/guide_step2.png",
    text: "Ready to grow? Tap the plus button to log your very first plant and start your gardening journey today!",
  },
  {
    img: "/images/guide_step3.png",
    text: "Identify your species and drop a nickname to begin your tracking journey! Pick the correct match to keep your plant healthy and your data accurate!",
  },
  {
    img: "/images/guide_step4.png",
    text: "Tap on your plant card to see your daily checklist and click the details button for more information.",
  },
  {
    img: "/images/guide_step5.png",
    text: "Details page includes care instructions, watering schedule, and fun facts about your plant. Check back often for updates and tips!",
  },
];

let currentGuideStep = 0;

function navigateGuide(direction) {
  const guideImg = document.getElementById("guidePhotoDisplay");
  const guideText = document.getElementById("guideDescription");

  if (!guideImg || !guideText) return;

  currentGuideStep += direction;

  // Loop logic
  if (currentGuideStep < 0) {
    currentGuideStep = guideData.length - 1;
  } else if (currentGuideStep >= guideData.length) {
    currentGuideStep = 0;
  }

  // Update both the photo and the text
  guideImg.src = guideData[currentGuideStep].img;
  guideText.innerText = guideData[currentGuideStep].text;
}

function initModal() {
  fetchPlantTypes();

  // Clear modal inputs when it's about to be shown
  const modalEl = document.getElementById("addPlantModal");
  if (modalEl) {
    modalEl.addEventListener("show.bs.modal", () => {
      document.getElementById("plantName").value = "";
      document.getElementById("plantSpecies").value = "";
    });
  }

  // Save button persists the plant
  document.getElementById("btnSave").addEventListener("click", savePlant);
}

/* -------------------------------------------------------
   INIT — run everything once the DOM is ready
------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  loadWeather();
  renderPlants(); // render saved plants on page load
  initModal(); // wire up the add-plant modal
});
