// Save search query logs in localStorage
function logQuery(query, success) {
  const logs = JSON.parse(localStorage.getItem("queryLogs")) || [];
  logs.push({ query, success, time: new Date().toLocaleString() });
  localStorage.setItem("queryLogs", JSON.stringify(logs));
}

// Parse user input to determine if it's an ID, username, or URL
function parseInput(input) {
  input = input.trim();
  if (input.includes("roblox.com")) {
    // Extract numeric ID from URL using regex
    const regex = /\/users\/(\d+)/;
    const match = input.match(regex);
    if (match && match[1]) {
      return { type: "id", value: match[1] };
    }
  }
  if (/^\d+$/.test(input)) {
    return { type: "id", value: input };
  }
  return { type: "username", value: input };
}

// Fetch profile data using Roblox API by user ID (GET)
async function fetchProfileById(userId) {
  const url = `https://users.roblox.com/v1/users/${userId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("User not found or API error.");
  }
  return await response.json();
}

// Revised: Fetch profile data by username using the legacy GET endpoint
async function fetchProfileByUsername(username) {
  const url = `https://api.roblox.com/users/get-by-username?username=${encodeURIComponent(username)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Username lookup failed.");
  }
  const data = await response.json();
  if (data.Id === 0) {
    throw new Error("No user found for that username.");
  }
  // For consistency, return an object similar to the fetchProfileById result
  return {
    id: data.Id,
    name: data.Username,
    displayName: data.Username  // The legacy endpoint doesn't provide a separate display name.
  };
}

// Fetch thumbnail image for the user using Roblox Thumbnail API
async function fetchThumbnail(userId) {
  const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch profile picture.");
  }
  const data = await response.json();
  if (data.data && data.data.length > 0) {
    return data.data[0].imageUrl;
  }
  return "";
}

// Execute code based on the current page
document.addEventListener("DOMContentLoaded", function() {
  // On index.html: Handle search form submission
  const searchForm = document.getElementById("searchForm");
  if (searchForm) {
    searchForm.addEventListener("submit", async function(e) {
      e.preventDefault();
      const inputField = document.getElementById("robloxInput");
      const errorDiv = document.getElementById("error");
      errorDiv.textContent = "";
      const input = inputField.value;
      let parsed;
      try {
        parsed = parseInput(input);
      } catch (err) {
        errorDiv.textContent = "Invalid input.";
        return;
      }
      // Log the query attempt (initially false)
      logQuery(input, false);
      // Redirect to results page with the query as a URL parameter
      window.location.href = `results.html?query=${encodeURIComponent(input)}`;
    });
  }

  // On results.html: Fetch and display profile data
  if (window.location.pathname.includes("results.html")) {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("query");
    const errorDiv = document.getElementById("error");
    if (!query) {
      errorDiv.textContent = "No query provided.";
      return;
    }
    const parsed = parseInput(query);
    let profileData;
    try {
      if (parsed.type === "id") {
        profileData = await fetchProfileById(parsed.value);
      } else {
        profileData = await fetchProfileByUsername(parsed.value);
      }
      // Log successful query
      logQuery(query, true);
    } catch (err) {
      errorDiv.textContent = err.message;
      return;
    }
    // Get profile thumbnail
    let thumbnail = "";
    try {
      thumbnail = await fetchThumbnail(profileData.id);
    } catch (err) {
      console.error("Error fetching thumbnail:", err);
    }
    // Populate UI with profile data
    document.getElementById("profileImg").src = thumbnail || "placeholder.png";
    document.getElementById("displayName").textContent = profileData.displayName || "No display name";
    document.getElementById("username").textContent = "Username: " + profileData.name;
    document.getElementById("robloxId").textContent = "User ID: " + profileData.id;
    document.getElementById("profileCard").style.display = "block";
  }

  // On logs.html: Display the query logs
  if (window.location.pathname.includes("logs.html")) {
    const logsContainer = document.getElementById("logsContainer");
    const logs = JSON.parse(localStorage.getItem("queryLogs")) || [];
    if (logs.length === 0) {
      logsContainer.innerHTML = "<p>No logs available.</p>";
      return;
    }
    let html = `<table class="table table-bordered table-hover">
                  <thead class="table-dark">
                    <tr>
                      <th>Time</th>
                      <th>Query</th>
                      <th>Success</th>
                    </tr>
                  </thead>
                  <tbody>`;
    logs.reverse().forEach(log => {
      html += `<tr>
                <td>${log.time}</td>
                <td>${log.query}</td>
                <td>${log.success ? "Yes" : "No"}</td>
              </tr>`;
    });
    html += "</tbody></table>";
    logsContainer.innerHTML = html;
  }
});
