const express = require('express');
const router = express.Router();
const weatherService = require('../services/weatherService');

// Code adapted from Ai.
// Modified by: Harun Yaprak
// GET /api/weather/coords?lat=...&lon=...
router.get('/coords', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: "Missing latitude or longitude parameters" });
    }
    const temp = await weatherService.fetchWeatherData(lat, lon);
    res.json({ temp, city: null });
  } catch (err) {
    console.error("Error fetching weather by coords:", err);
    res.status(500).json({ error: "Failed to fetch weather data" });
  }
});

// Code adapted from Ai.
// Modified by: Harun Yaprak
// GET /api/weather/ip
router.get('/ip', async (req, res) => {
  try {
    let clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const geoData = await weatherService.fetchLocationByIP(clientIP);
    const { latitude, longitude, city } = geoData;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: "Could not determine location from IP" });
    }
    
    const temp = await weatherService.fetchWeatherData(latitude, longitude);
    res.json({ temp, city });
  } catch (err) {
    console.error("Error fetching weather by IP:", err);
    res.status(500).json({ error: "Failed to fetch weather by IP" });
  }
});

module.exports = router;
