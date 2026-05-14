
// Code adapted from Ai.
// Modified by: Harun Yaprak
async function fetchWeatherData(latitude, longitude) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&current_weather=true`
  );
  const data = await res.json();
  return Math.round(data.current_weather.temperature);
}

// Code adapted from Ai.
// Modified by: Harun Yaprak
async function fetchLocationByIP(clientIP) {
  // In a local dev environment (localhost), the IP might be ::1 which ipapi can't geolocate.
  // We use a fallback to let ipapi infer the server's public IP if it's a local address.
  const isLocal = !clientIP || clientIP === '::1' || clientIP === '127.0.0.1';
  const url = isLocal ? `https://ipapi.co/json/` : `https://ipapi.co/${clientIP}/json/`;
  
  const geoRes = await fetch(url);
  return await geoRes.json();
}

module.exports = {
  fetchWeatherData,
  fetchLocationByIP
};
