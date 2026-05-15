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
   Plants are stored in database.
   Each plant object: { id, name, waterFreq, addedAt }
------------------------------------------------------- */
async function loadPlants() {
  try {
    const res = await fetch("/api/user/plants");

    if (!res.ok) {
      throw new Error("Failed to load plants");
    }

    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

/* -------------------------------------------------------
   3. PLANT CARD RENDERING
   Build a premium card DOM element for a single plant
   with horizontal layout, notification badges, and
   expandable checklist.
------------------------------------------------------- */
// Card design inspired by Bootstrap Blog template: https://getbootstrap.com/docs/5.3/examples/blog/
// Modified by: Harun Yaprak

// Get default image for a species (fallback if user hasn't uploaded)
function getDefaultPlantImage(species) {
  if (!species) return "/images/error.png";
  const name = species.toLowerCase().replace(/\s+/g, "_");
  return `/images/${name}.jpg`;
}

// Create and return a .plant-card element for the given plant
function createPlantCard(plant) {
  const wrapper = document.createElement("div");

  const displayName = plant.nickname
    ? plant.nickname
    : plant.species || plant.name;
  const speciesName = plant.species || plant.name;
  const addedDate = plant.addedAt
    ? new Date(plant.addedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Unknown date";

  // Determine watering state
  const now = Date.now();
  let isWatered = false;
  if (plant.lastWateredAt) {
    const last = new Date(plant.lastWateredAt).getTime();
    const intervalMs = (plant.intervalDays || 7) * 24 * 60 * 60 * 1000;
    if (now - last < intervalMs) {
      isWatered = true;
    }
  }

  // Determine shade state
  let isInShade = false;
  if (plant.movedToShadeAt) {
    const shadeTime = new Date(plant.movedToShadeAt).getTime();
    if (now - shadeTime < 8 * 60 * 60 * 1000) {
      isInShade = true;
    }
  }

  // Look up plant type info from loaded database data
  const plantTypeInfo =
    availablePlantTypes.find((p) => p.name === speciesName) || {};

  // Determine misting state (conditional)
  const mistingFreq = plantTypeInfo.mistingFreq || null;
  const needsMisting = mistingFreq !== null;
  let isMisted = false;
  if (needsMisting && plant.lastMistedAt) {
    const last = new Date(plant.lastMistedAt).getTime();
    if (now - last < mistingFreq * 24 * 60 * 60 * 1000) {
      isMisted = true;
    }
  }

  // Determine rotated state
  let isRotated = false;
  if (plant.lastRotatedAt) {
    const last = new Date(plant.lastRotatedAt).getTime();
    if (now - last < 14 * 24 * 60 * 60 * 1000) {
      // 14 days
      isRotated = true;
    }
  }

  // Determine harvest state
  const harvestDays = plantTypeInfo.harvestDays || null;
  const isEdible = harvestDays !== null;
  let isReadyToHarvest = false;
  let isHarvested = false;

  if (isEdible) {
    const referenceTime = plant.lastHarvestedAt
      ? new Date(plant.lastHarvestedAt).getTime()
      : plant.addedAt
        ? new Date(plant.addedAt).getTime()
        : now;
    const daysSinceRef = (now - referenceTime) / (1000 * 60 * 60 * 24);

    if (daysSinceRef >= harvestDays) {
      isReadyToHarvest = true;
    } else if (plant.lastHarvestedAt) {
      // Stay checked/visible for 8 hours after harvesting
      const hoursSinceHarvest =
        (now - new Date(plant.lastHarvestedAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceHarvest < 8) {
        isHarvested = true;
      }
    }
  }

  const maxTemp = plantTypeInfo.temp || 25;
  const isTooHot =
    typeof window.currentTemperature !== "undefined" &&
    window.currentTemperature > maxTemp;
  const showSunAlert = isTooHot && !isInShade;

  // Use user-uploaded image or default
  const plantImageUrl = plant.imageUrl || getDefaultPlantImage(plant.species);

  // Build badge HTML
  const waterBadgeClass = isWatered
    ? "badge-notify badge-water resolved"
    : "badge-notify badge-water";
  const waterBadgeText = isWatered ? "✓ Watered" : "💧 Needs Water";
  const waterBadgeHTML = `<span class="${waterBadgeClass}" id="water-badge-${plant.id}" data-plant-id="${plant.id}" title="Click to expand checklist">${waterBadgeText}</span>`;

  let sunBadgeHTML = "";
  if (showSunAlert) {
    sunBadgeHTML = `<span class="badge-notify badge-sun" id="sun-badge-${plant.id}" data-plant-id="${plant.id}" title="Click to expand checklist">☀️ Too Hot!</span>`;
  } else if (isInShade) {
    sunBadgeHTML = `<span class="badge-notify badge-sun resolved" id="sun-badge-${plant.id}" data-plant-id="${plant.id}">✓ In Shade</span>`;
  } else {
    sunBadgeHTML = `<span class="badge-notify badge-sun" id="sun-badge-${plant.id}" data-plant-id="${plant.id}" title="Click to expand checklist" style="display: none;">☀️ Too Hot!</span>`;
  }

  let harvestBadgeHTML = "";
  if (isEdible) {
    if (isReadyToHarvest) {
      harvestBadgeHTML = `<span class="badge-notify badge-harvest" id="harvest-badge-${plant.id}" data-plant-id="${plant.id}" title="Click to expand checklist">🌾 Ready to Harvest</span>`;
    } else if (isHarvested) {
      harvestBadgeHTML = `<span class="badge-notify badge-harvest resolved" id="harvest-badge-${plant.id}" data-plant-id="${plant.id}">✓ Harvested</span>`;
    } else {
      harvestBadgeHTML = `<span class="badge-notify badge-harvest" id="harvest-badge-${plant.id}" data-plant-id="${plant.id}" style="display: none;">🌾 Ready to Harvest</span>`;
    }
  }

  // Nickname display
  const nicknameHTML = plant.nickname
    ? `<p class="card-nickname">"${plant.nickname}"</p>`
    : "";

  // Format water frequency if it's just a number
  let displayFreq = plant.waterFreq || "Weekly";
  if (!isNaN(displayFreq) && displayFreq.toString().trim() !== "") {
    displayFreq = displayFreq == 1 ? "Every day" : `Every ${displayFreq} days`;
  }

  wrapper.innerHTML = `
    <div class="plant-card" data-plant-id="${plant.id}">
      <!-- Notification Badges -->
      <div class="card-badges">
        ${waterBadgeHTML}
        ${sunBadgeHTML}
        ${harvestBadgeHTML}
      </div>

      <!-- Card Body: Horizontal Layout -->
      <div class="card-body-row">
        <!-- Plant Image -->
        <div class="plant-img-wrapper" id="img-wrapper-${plant.id}">
          <img src="${plantImageUrl}" alt="${speciesName}" 
               onerror="if(this.src.includes('.jpg')){this.src=this.src.replace('.jpg','.png')}else if(!this.src.includes('error.png')){this.src='/images/error.png'}" />
          <div class="img-upload-overlay" title="Upload photo">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" 
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <input type="file" class="card-image-input" accept="image/jpeg,image/png,image/webp,image/heic" 
            style="display:none;" data-plant-id="${plant.id}" />
        </div>

        <!-- Card Info -->
        <div class="card-info">
          <h3 class="card-species">${speciesName}</h3>
          ${nicknameHTML}
          <p class="card-date">Added ${addedDate}</p>
          <div class="card-actions">
            <a href="/details/${plant.slug || (plant.species || plant.name || "").toLowerCase().replace(/\s+/g, "_")}" class="btn-details">Details →</a>
            <button class="btn-delete-card" data-id="${plant.id}" title="Remove plant">
              <img src="/icons/bin.png" alt="Delete" />
            </button>
          </div>
        </div>
      </div>

      <!-- Expandable Checklist Panel -->
      <div class="checklist-panel" id="checklist-${plant.id}">
        <div class="checklist-inner">
          <!-- Watering Checklist -->
          <div class="checklist-item">
            <input type="checkbox" class="water-checkbox" id="check-water-${plant.id}" ${isWatered ? "checked" : ""} />
            <label for="check-water-${plant.id}">Water the Plant</label>
            <span class="freq-tag">${displayFreq}</span>
          </div>
          
          <!-- Move to Shade Checklist (conditional) -->
          <div class="checklist-item shade-item" id="shade-item-${plant.id}" style="${isTooHot || isInShade ? "" : "display: none;"}">
            <input type="checkbox" class="shade-checkbox" id="check-shade-${plant.id}" ${isInShade ? "checked" : ""} />
            <label for="check-shade-${plant.id}">Move the Plant into Shade</label>
            <span class="freq-tag">8hr cooldown</span>
          </div>
          
          
          <!-- Misting Checklist (conditional) -->
          <div class="checklist-item misting-item" id="misting-item-${plant.id}" style="${needsMisting ? "" : "display: none;"}">
            <input type="checkbox" class="misting-checkbox" id="check-misting-${plant.id}" ${isMisted ? "checked" : ""} />
            <label for="check-misting-${plant.id}">Mist the Leaves</label>
            <span class="freq-tag">${needsMisting ? "Every " + mistingFreq + " days" : ""}</span>
          </div>
          
          <!-- Rotate Checklist -->
          <div class="checklist-item">
            <input type="checkbox" class="rotate-checkbox" id="check-rotate-${plant.id}" ${isRotated ? "checked" : ""} />
            <label for="check-rotate-${plant.id}">Rotate the Plant</label>
            <span class="freq-tag">Bi-weekly</span>
          </div>
          
          <!-- Harvest Checklist (conditional) -->
          <div class="checklist-item harvest-item" id="harvest-item-${plant.id}" style="${isEdible && (isReadyToHarvest || isHarvested) ? "" : "display: none;"}">
          <input type="checkbox" class="harvest-checkbox" id="check-harvest-${plant.id}" ${isHarvested ? "checked" : ""} />
            <label for="check-harvest-${plant.id}">Your Plant Might be Ready to Harvest!</label>
            <span class="freq-tag">${harvestDays} days</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const card = wrapper.firstElementChild;

  // --- Event: Card click toggles checklist ---
  card.addEventListener("click", (e) => {
    // Ignore clicks on interactive elements
    if (e.target.closest("button, a, input, label, .img-upload-overlay"))
      return;

    const checklist = card.querySelector(".checklist-panel");
    if (checklist) {
      const wasOpen = checklist.classList.contains("open");

      // Close all open checklists
      document.querySelectorAll(".checklist-panel.open").forEach((panel) => {
        panel.classList.remove("open");
      });

      // If it wasn't open before, open it now
      if (!wasOpen) {
        checklist.classList.add("open");
      }
    }
  });

  // --- Event: Image upload overlay click ---
  const imgOverlay = card.querySelector(".img-upload-overlay");
  const imgInput = card.querySelector(".card-image-input");
  if (imgOverlay && imgInput) {
    imgOverlay.addEventListener("click", (e) => {
      e.stopPropagation();
      imgInput.click();
    });

    imgInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const formData = new FormData();
        formData.append("image", file);

        const res = await fetch("/api/plants/upload-image", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();

        // Save imageUrl to database
        await fetch(`/api/user/plants/${plant.id}/image`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageUrl: data.imageUrl,
          }),
        });

        // Update image in DOM immediately
        const img = card.querySelector(".plant-img-wrapper img");
        if (img) img.src = data.imageUrl;
      } catch (err) {
        console.error("Image upload error:", err);
        alert("Failed to upload image. Please try again.");
      }
    });
  }

  // --- Event: Watering checkbox ---
  const waterCheckbox = card.querySelector(".water-checkbox");
  if (waterCheckbox) {
    waterCheckbox.addEventListener("change", (e) => {
      updatePlantWateredState(plant.id, e.target.checked);
      const badge = card.querySelector(`#water-badge-${plant.id}`);
      if (badge) {
        if (e.target.checked) {
          badge.classList.add("resolved");
          badge.textContent = "✓ Watered";
        } else {
          badge.classList.remove("resolved");
          badge.textContent = "💧 Needs Water";
        }
      }
    });
  }

  // --- Event: Shade checkbox ---
  // Adopted from AI
  // Modified by: Harun Yaprak
  const shadeCheckbox = card.querySelector(".shade-checkbox");
  if (shadeCheckbox) {
    shadeCheckbox.addEventListener("change", (e) => {
      updatePlantShadeState(plant.id, e.target.checked);
      const badge = card.querySelector(`#sun-badge-${plant.id}`);
      if (badge) {
        const maxTemp = getPlantMaxTemp(plant.species);
        const isCurrentlyHot =
          typeof window.currentTemperature !== "undefined" &&
          window.currentTemperature > maxTemp;
        if (e.target.checked) {
          badge.classList.add("resolved");
          badge.textContent = "✓ In Shade";
        } else if (isCurrentlyHot) {
          badge.classList.remove("resolved");
          badge.textContent = "☀️ Too Hot!";
        }
      }
    });
  }

  // --- Event: Misting checkbox ---
  const mistingCheckbox = card.querySelector(".misting-checkbox");
  if (mistingCheckbox) {
    mistingCheckbox.addEventListener("change", (e) => {
      updatePlantMistedState(plant.id, e.target.checked);
    });
  }

  // --- Event: Rotate checkbox ---
  const rotateCheckbox = card.querySelector(".rotate-checkbox");
  if (rotateCheckbox) {
    rotateCheckbox.addEventListener("change", (e) => {
      updatePlantRotatedState(plant.id, e.target.checked);
    });
  }

  // --- Event: Harvest checkbox ---
  const harvestCheckbox = card.querySelector(".harvest-checkbox");
  if (harvestCheckbox) {
    harvestCheckbox.addEventListener("change", (e) => {
      updatePlantHarvestedState(plant.id, e.target.checked);
      const badge = card.querySelector(`#harvest-badge-${plant.id}`);
      if (badge) {
        if (e.target.checked) {
          badge.classList.add("resolved");
          badge.textContent = "✓ Harvested";
        } else {
          badge.classList.remove("resolved");
          badge.textContent = "🌾 Ready to Harvest";
        }
      }
    });
  }

  // --- Event: Delete button ---
  const deleteBtn = card.querySelector(".btn-delete-card");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deletePlant(plant.id);
    });
  }

  return card;
}

// Remove a plant by id from storage and re-render the list
async function deletePlant(id) {
  try {
    const response = await fetch(`/api/user/plants/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Delete failed");
    }

    await renderPlants();
  } catch (err) {
    console.error(err);
    alert("Failed to delete plant");
  }
}

// Send a generic update to a user plant record
async function updatePlant(id, updates) {
  try {
    const response = await fetch(`/api/user/plants/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error("Failed to update plant");
    }
  } catch (err) {
    console.error(err);
  }
}

// Update the watering state of a plant
async function updatePlantWateredState(id, isWatered) {
  await updatePlant(id, {
    lastWateredAt: isWatered ? new Date().toISOString() : null,
  });
}

// Update the shade state of a plant
async function updatePlantShadeState(id, inShade) {
  await updatePlant(id, {
    movedToShadeAt: inShade ? new Date().toISOString() : null,
  });
}

// Update the misted state of a plant
async function updatePlantMistedState(id, isMisted) {
  await updatePlant(id, {
    lastMistedAt: isMisted ? new Date().toISOString() : null,
  });
}

// Update the rotated state of a plant
async function updatePlantRotatedState(id, isRotated) {
  await updatePlant(id, {
    lastRotatedAt: isRotated ? new Date().toISOString() : null,
  });
}

// Helper function removed - using DB values

// Update the harvested state of a plant
async function updatePlantHarvestedState(id, isHarvested) {
  await updatePlant(id, {
    lastHarvestedAt: isHarvested ? new Date().toISOString() : null,
  });
}

// Helper function removed - using DB values

function getIntervalDays(freqStr) {
  if (!freqStr || typeof freqStr !== "string") return 7;
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

// Helper function removed - using DB values

// Update temperature alerts for all rendered cards dynamically
// Adapted from AI, used to show temperature alerts for plants
// Modified by: Harun Yaprak
async function updateTemperatureAlerts() {
  if (typeof window.currentTemperature === "undefined") return;
  const plants = await loadPlants();
  const now = Date.now();
  plants.forEach((plant) => {
    let isInShade = false;
    if (plant.movedToShadeAt) {
      const shadeTime = new Date(plant.movedToShadeAt).getTime();
      if (now - shadeTime < 8 * 60 * 60 * 1000) {
        isInShade = true;
      }
    }
    const plantTypeInfo =
      availablePlantTypes.find((p) => p.name === plant.species) || {};
    const maxTemp = plantTypeInfo.temp || 25;
    const isTooHot = window.currentTemperature > maxTemp;

    // Toggle Sun Badge
    const sunBadge = document.getElementById(`sun-badge-${plant.id}`);
    if (sunBadge) {
      if (isTooHot && !isInShade) {
        sunBadge.style.display = "";
        sunBadge.classList.remove("resolved");
        sunBadge.textContent = "☀️ Too Hot!";
      } else if (isInShade) {
        sunBadge.style.display = "";
        sunBadge.classList.add("resolved");
        sunBadge.textContent = "✓ In Shade";
      } else {
        sunBadge.style.display = "none";
      }
    }

    // Toggle Shade Checklist Item
    const shadeItem = document.getElementById(`shade-item-${plant.id}`);
    if (shadeItem) {
      shadeItem.style.display = isTooHot || isInShade ? "" : "none";
    }
  });
}

// Render all plants from storage into #plantList
async function renderPlants() {
  const list = document.getElementById("plantList");
  list.innerHTML = ""; // clear existing cards

  const plants = await loadPlants();

  if (plants.length === 0) {
    // Show a friendly empty state
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">🌱</span>
        <h3 class="empty-state-title">No plants yet</h3>
        <p class="empty-state-text">Tap the <strong>+</strong> button below to add your first plant and start your green journey!</p>
      </div>
    `;
    return;
  }

  plants.forEach((plant) => {
    list.appendChild(createPlantCard(plant));
  });
}

/* -------------------------------------------------------
   4. IMAGE UPLOAD HELPERS
   Handles image preview in the Add Plant modal
------------------------------------------------------- */

// Selected file reference for upload
let selectedPlantImageFile = null;

function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  selectedPlantImageFile = file;

  const reader = new FileReader();
  reader.onload = function (e) {
    const preview = document.getElementById("imagePreview");
    const container = document.getElementById("imagePreviewContainer");
    const uploadArea = document.getElementById("imageUploadArea");

    preview.src = e.target.result;
    container.style.display = "block";
    uploadArea.style.display = "none";
  };
  reader.readAsDataURL(file);
}

function removeImagePreview() {
  selectedPlantImageFile = null;
  const preview = document.getElementById("imagePreview");
  const container = document.getElementById("imagePreviewContainer");
  const uploadArea = document.getElementById("imageUploadArea");
  const fileInput = document.getElementById("plantImage");

  preview.src = "";
  container.style.display = "none";
  uploadArea.style.display = "block";
  fileInput.value = "";
}

/* -------------------------------------------------------
   5. ADD PLANT MODAL
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
async function savePlant() {
  const speciesSelect = document.getElementById("plantSpecies");
  const speciesId = speciesSelect.value;
  const nickname = document.getElementById("plantName").value.trim();

  if (!speciesId) {
    speciesSelect.focus();
    return; // do nothing if species is not selected
  }

  const btnSave = document.getElementById("btnSave");
  const originalText = btnSave.innerHTML;

  // Show loading state
  btnSave.innerHTML =
    '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Saving...';
  btnSave.disabled = true;

  try {
    const selectedType = availablePlantTypes.find((p) => p._id === speciesId);

    let imageUrl = null;

    // Upload image if one was selected
    if (selectedPlantImageFile) {
      const formData = new FormData();
      formData.append("image", selectedPlantImageFile);

      const res = await fetch("/api/plants/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Image upload failed");
      }

      const data = await res.json();
      imageUrl = data.imageUrl;
      if (!imageUrl) {
        throw new Error("Image upload response did not include imageUrl");
      }
    }

    const newPlant = {
      id: Date.now(), // unique numeric id based on timestamp
      species: selectedType.name,
      slug: selectedType.slug,
      nickname: nickname,
      waterFreq: selectedType.waterFreq,
      imageUrl,
      intervalDays:
        typeof selectedType.waterFreq === "number"
          ? selectedType.waterFreq
          : getIntervalDays(selectedType.waterFreq),
      addedAt: new Date().toISOString(),
      lastWateredAt: null,
      lastMistedAt: null,
      lastRotatedAt: null,
      lastHarvestedAt: null,
    };

    console.log("Saving new plant:", newPlant);
    const response = await fetch("/api/user/plants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newPlant),
    });

    if (!response.ok) {
      throw new Error("Failed to save plant");
    }

    // Close the bootstrap modal
    const modalEl = document.getElementById("addPlantModal");
    const modal =
      bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.hide();

    // Reset image upload state
    selectedPlantImageFile = null;

    renderPlants(); // refresh the list to show the new card
  } catch (err) {
    console.error("Error saving plant:", err);
    alert("An error occurred while saving the plant.");
  } finally {
    // Restore button state
    btnSave.innerHTML = originalText;
    btnSave.disabled = false;
  }
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
  // Clear modal inputs when it's about to be shown
  const modalEl = document.getElementById("addPlantModal");
  if (modalEl) {
    modalEl.addEventListener("show.bs.modal", () => {
      document.getElementById("plantName").value = "";
      document.getElementById("plantSpecies").value = "";
      // Reset image preview
      removeImagePreview();
    });
  }

  // Save button persists the plant
  document.getElementById("btnSave").addEventListener("click", savePlant);
}

/* -------------------------------------------------------
   INIT — run everything once the DOM is ready
------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await loadWeather();
  await fetchPlantTypes(); // Must load plant attributes before rendering cards
  await renderPlants(); // render saved plants on page load
  initModal(); // wire up the add-plant modal
});
