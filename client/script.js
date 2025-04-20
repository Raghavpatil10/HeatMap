document.addEventListener("DOMContentLoaded", () => {
  const map = L.map('map').setView([21.1458, 79.0882], 12); // Default to Nagpur

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  let heatLayer;
  let propertyMarkers = L.layerGroup().addTo(map);
  let treeMarkers = L.layerGroup().addTo(map); // Layer group for tree zones

  document.getElementById("searchBtn").addEventListener("click", () => {
    const city = document.getElementById("cityInput").value.trim();
    if (!city) {
      alert("Please enter a city.");
      return;
    }
    fetchCityData(city);
    fetchTreeZones(city);  // Fetch and display tree zones
    fetchResidences(city);  // Fetch and display residences
  });

  // Fetch weather, heatmap, reviews, and properties for the given city.
  async function fetchCityData(city) {
    // 1. Fetch city weather info.
    try {
      const weatherRes = await fetch(`/api/city-weather?city=${encodeURIComponent(city)}`);
      const weatherData = await weatherRes.json();
      document.getElementById("cityName").textContent = `City: ${weatherData.name}`;
      document.getElementById("weatherData").textContent = `Temperature: ${weatherData.temp} °C, ${weatherData.description}`;
      
      if (weatherData.coord) {
        map.setView([weatherData.coord.lat, weatherData.coord.lon], 12);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to get weather data.");
    }

    // 2. Fetch heatmap data for the city.
    try {
      const heatRes = await fetch(`/api/heatmap-data?city=${encodeURIComponent(city)}`);
      const heatData = await heatRes.json();
      const heatPoints = heatData.map(point => [point.lat, point.lon, point.intensity]);
      if (heatLayer) {
        heatLayer.setLatLngs(heatPoints);
      } else {
        heatLayer = L.heatLayer(heatPoints, { radius: 30 }).addTo(map);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to get heatmap data.");
    }
  
    // 3. Fetch reviews for the city.
    try {
      const reviewsRes = await fetch(`/api/reviews?city=${encodeURIComponent(city)}`);
      const reviews = await reviewsRes.json();
      displayReviews(reviews);
    } catch (err) {
      console.error(err);
      alert("Failed to get reviews.");
    }

    // 4. Fetch properties in a non–heat zone.
    try {
      propertyMarkers.clearLayers();
      const propertiesRes = await fetch(`/api/properties?city=${encodeURIComponent(city)}`);
      const properties = await propertiesRes.json();
      properties.forEach(property => {
        const marker = L.marker([property.lat, property.lon])
          .bindPopup(`<b>${property.name}</b><br>Address: ${property.address}`)
          .addTo(propertyMarkers);
      });
    } catch (err) {
      console.error(err);
      alert("Failed to fetch properties.");
    }
  }

  // Fetch and display tree zones on the map.
  async function fetchTreeZones(city) {
    try {
      const treeRes = await fetch(`/api/tree-zones?city=${encodeURIComponent(city)}`);
      const treeZones = await treeRes.json();
      treeMarkers.clearLayers(); // Clear previous markers

      treeZones.forEach(zone => {
        const marker = L.marker([zone.lat, zone.lon], { icon: L.icon({ iconUrl: 'https://example.com/tree-icon.png', iconSize: [25, 25] }) })
          .bindPopup(`<b>Tree Planting Zone</b><br>${zone.description}`)
          .addTo(treeMarkers);
      });
    } catch (err) {
      console.error(err);
      alert("Failed to fetch tree zones.");
    }
  }

  // Fetch and display residences on the map and UI.
  async function fetchResidences(city) {
    try {
      const residenceRes = await fetch(`/api/residences?city=${encodeURIComponent(city)}`);
      const residences = await residenceRes.json();
      const residenceList = document.getElementById("residenceList");
      residenceList.innerHTML = '';  // Clear previous list

      residences.forEach(residence => {
        const listItem = document.createElement('li');
        listItem.textContent = `${residence.name} - ${residence.address}`;
        residenceList.appendChild(listItem);

        // Add a marker for each residence on the map.
        L.marker([residence.lat, residence.lon])
          .bindPopup(`<b>${residence.name}</b><br>Address: ${residence.address}`)
          .addTo(propertyMarkers);
      });
    } catch (err) {
      console.error(err);
      alert("Failed to fetch residences.");
    }
  }

  // Render reviews in the reviews container.
  function displayReviews(reviews) {
    const container = document.getElementById("reviewsContainer");
    container.innerHTML = "";
    if (!reviews.length) {
      container.textContent = "No reviews yet.";
      return;
    }
    reviews.forEach(review => {
      const reviewDiv = document.createElement("div");
      reviewDiv.classList.add("review");
      reviewDiv.innerHTML = `
        <p>${review.text}</p>
        <span>Rating: ${review.rating}</span>
      `;
      
      // Create a delete button for the review.
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.onclick = async () => {
        if (!confirm("Are you sure you want to delete this review?")) return;
        try {
          const res = await fetch(`/api/reviews/${review._id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            alert("Review deleted successfully!");
            const city = document.getElementById("cityInput").value.trim();
            fetchCityData(city);
          } else {
            alert("Review not found or already deleted.");
          }
        } catch (err) {
          console.error(err);
          alert("Error deleting review.");
        }
      };

      reviewDiv.appendChild(deleteBtn);
      container.appendChild(reviewDiv);
    });
  }

  // Handle review form submission.
  document.getElementById("reviewForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const city = document.getElementById("cityInput").value.trim();
    if (!city) {
      alert("Please enter a city to submit your review for.");
      return;
    }
    const reviewText = document.getElementById("reviewText").value.trim();
    const reviewRating = document.getElementById("reviewRating").value;
    if (!reviewText || !reviewRating) {
      alert("Please fill in your review and rating.");
      return;
    }
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, text: reviewText, rating: parseInt(reviewRating) })
      });
      const data = await res.json();
      if (data.success) {
        alert("Review submitted successfully!");
        document.getElementById("reviewText").value = "";
        document.getElementById("reviewRating").value = "";
        fetchCityData(city);
      } else {
        alert("Failed to submit review.");
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting review.");
    }
  });
});
