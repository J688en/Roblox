// ------------------ Helper Functions ------------------

// Log queries to localStorage
function logQuery(query, success) {
  const logs = JSON.parse(localStorage.getItem("queryLogs")) || [];
  logs.push({ query, success, time: new Date().toLocaleString() });
  localStorage.setItem("queryLogs", JSON.stringify(logs));
}

// Parse input to determine if it's an ID, username, or URL
function parseInput(input) {
  input = input.trim();
  if (input.includes("roblox.com")) {
    // Attempt to extract numeric ID from a profile URL
    const regex = /\/users\/(\d+)/;
    const match = input.match(regex);
    if (match && match[1]) {
      return { type: "id", value: match[1] };
    }
  }
  if (/^\d+$/.test(input)) {
    return { type: "id", value: input };
  }
  // Default to username if not numeric or URL-based
  return { type: "username", value: input };
}

// Fetch profile data by user ID using the Roblox Users API
async function fetchProfileById(userId) {
  const url = `https://users.roblox.com/v1/users/${userId}`;
  console.log("Fetching profile by ID:", url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("User not found or API error (ID lookup).");
  }
  return await response.json();
}

// Fetch profile data by username using the legacy GET endpoint
async function fetchProfileByUsername(username) {
  const url = `https://api.roblox.com/users/get-by-username?username=${encodeURIComponent(username)}`;
  console.log("Fetching profile by username:", url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Username lookup failed (network error).");
  }
  const data = await response.json();
  if (data.Id === 0) {
    throw new Error("No user found for that username.");
  }
  // Map to an object similar to the ID lookup response
  return {
    id: data.Id,
    name: data.Username,
    displayName: data.Username // Note: Legacy endpoint doesn't provide a separate display name.
  };
}

// Fetch the user's profile thumbnail image
async function fetchThumbnail(userId) {
  const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`;
  console.log("Fetching thumbnail:", url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch profile picture.");
  }
  const data = await response.json();
  if (data.data && data.data.length > 0) {
    return data.data[0].imageUrl;
  }
  return "placeholder.png";
}

// ------------------ Main Execution ------------------
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM fully loaded.");

  // -------------- For index.html (Search Page) --------------
  const searchForm = document.getElementById("searchForm");
  if (searchForm) {
    searchForm.addEventListener("submit", function (e) {
      e.preventDefault();
      console.log("Search form submitted.");

      const inputField = document.getElementById("robloxInput");
      const errorDiv = document.getElementById("error");
      errorDiv.textContent = "";
      const input = inputField.value;
      console.log("User input:", input);

      if (!input) {
        errorDiv.textContent = "Please enter a Roblox ID, username, or profile URL.";
        return;
      }

      let parsed;
      try {
        parsed = parseInput(input);
        console.log("Parsed input:", parsed);
      } catch (err) {
        errorDiv.textContent = "Error parsing input: " + err.message;
        console.error("Parsing error:", err);
        return;
      }

      // Log the query (pending success)
      logQuery(input, false);
      // Debug: Log the redirection step.
      console.log("Redirecting to results page with query:", input);
      // Redirect to results.html with the query as a URL parameter.
      window.location.href = `results.html?query=${encodeURIComponent(input)}`;
    });
  }

  // -------------- For results.html (Profile Display Page) --------------
  if (window.location.pathname.indexOf("results.html") !== -1) {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("query");
    const errorDiv = document.getElementById("error");
    const profileCard = document.getElementById("profileCard");

    if (!query) {
      errorDiv.textContent = "No query provided in the URL.";
      return;
    }

    let parsed;
    try {
      parsed = parseInput(query);
      console.log("Results page - parsed query:", parsed);
    } catch (err) {
      errorDiv.textContent = "Error parsing query: " + err.message;
      console.error("Parsing error on results page:", err);
      return;
    }

    // Show a loading message
    errorDiv.textContent = "Loading profile...";
    profileCard.style.display = "none";

    (async function () {
      let profileData;
      try {
        if (parsed.type === "id") {
          profileData = await fetchProfileById(parsed.value);
        } else {
          profileData = await fetchProfileByUsername(parsed.value);
        }
        console.log("Fetched profile data:", profileData);
        // Log successful query
        logQuery(query, true);
      } catch (err) {
        console.error("Error fetching profile data:", err);
        errorDiv.textContent = "Error fetching profile: " + err.message;
        alert("Error: " + err.message);
        return;
      }

      let thumbnail = "";
      try {
        thumbnail = await fetchThumbnail(profileData.id);
      } catch (err) {
        console.error("Error fetching thumbnail:", err);
        thumbnail = "placeholder.png";
      }

      // Populate the DOM with the profile information
      document.getElementById("profileImg").src = thumbnail;
      document.getElementById("displayName").textContent =
        profileData.displayName || "No display name available";
      document.getElementById("username").textContent = "Username: " + profileData.name;
      document.getElementById("robloxId").textContent = "User ID: " + profileData.id;

      // Clear loading message and show profile
      errorDiv.textContent = "";
      profileCard.style.display = "block";
      console.log("Profile displayed successfully.");
    })();
  }

  // -------------- For logs.html (Query Logs Page) --------------
  if (window.location.pathname.indexOf("logs.html") !== -1) {
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
