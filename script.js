// ----- Helper Functions -----

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
    // Attempt to extract the numeric ID from a profile URL
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
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("User not found or API error (ID lookup).");
  }
  return await response.json();
}

// Fetch profile data by username using the legacy GET endpoint
async function fetchProfileByUsername(username) {
  const url = `https://api.roblox.com/users/get-by-username?username=${encodeURIComponent(username)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Username lookup failed (network error).");
  }
  const data = await response.json();
  if (data.Id === 0) {
    throw new Error("No user found for that username.");
  }
  // Map to a similar object structure as the ID lookup
  return {
    id: data.Id,
    name: data.Username,
    displayName: data.Username // The legacy endpoint does not provide a separate display name.
  };
}

// Fetch the user's profile thumbnail image
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
  return "placeholder.png";
}

// ----- Main Execution -----
document.addEventListener("DOMContentLoaded", function () {
  // ----- On index.html: Handle Search Form Submission -----
  const searchForm = document.getElementById("searchForm");
  if (searchForm) {
    searchForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const inputField = document.getElementById("robloxInput");
      const errorDiv = document.getElementById("error");
      errorDiv.textContent = "";
      const input = inputField.value;

      if (!input) {
        errorDiv.textContent = "Please enter a Roblox ID, username, or profile URL.";
        return;
      }

      let parsed;
      try {
        parsed = parseInput(input);
      } catch (err) {
        errorDiv.textContent = "Error parsing input: " + err.message;
        return;
      }

      // Log the query as pending (false)
      logQuery(input, false);
      // Redirect to the results page with the query in the URL
      window.location.href = `results.html?query=${encodeURIComponent(input)}`;
    });
  }

  // ----- On results.html: Fetch and Display Profile Data -----
  if (window.location.pathname.includes("results.html")) {
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
    } catch (err) {
      errorDiv.textContent = "Error parsing query: " + err.message;
      return;
    }

    // Provide loading feedback
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
        // Log the query as successful
        logQuery(query, true);
      } catch (err) {
        console.error("Error fetching profile data:", err);
        errorDiv.textContent = "Error fetching profile: " + err.message;
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

      errorDiv.textContent = ""; // Clear any error/loading message
      profileCard.style.display = "block"; // Show the profile card
    })();
  }

  // ----- On logs.html: Display the Query Logs -----
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
