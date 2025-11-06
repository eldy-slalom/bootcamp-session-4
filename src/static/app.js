document.addEventListener("DOMContentLoaded", () => {
  const capabilitiesList = document.getElementById("capabilities-list");
  const capabilitySelect = document.getElementById("capability");
  const requestCapabilitySelect = document.getElementById("request-capability");
  const registerForm = document.getElementById("register-form");
  const requestForm = document.getElementById("request-form");
  const messageDiv = document.getElementById("message");
  
  // Authentication elements
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const authContainer = document.getElementById("auth-container");
  const userInfo = document.getElementById("user-info");
  const userName = document.getElementById("user-name");
  const practiceLeadSection = document.getElementById("practice-lead-section");
  const consultantSection = document.getElementById("consultant-section");
  const closeModal = document.querySelector(".close");
  
  // Current user state
  let currentUser = null;
  let authToken = localStorage.getItem("authToken");

  // Authentication functions
  async function checkAuthStatus() {
    if (authToken) {
      try {
        const response = await fetch("/auth/me", {
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        });
        
        if (response.ok) {
          currentUser = await response.json();
          updateUIForUser();
        } else {
          // Token invalid, clear it
          localStorage.removeItem("authToken");
          authToken = null;
          updateUIForUser();
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        localStorage.removeItem("authToken");
        authToken = null;
        updateUIForUser();
      }
    } else {
      updateUIForUser();
    }
  }
  
  function updateUIForUser() {
    if (currentUser) {
      authContainer.classList.add("hidden");
      userInfo.classList.remove("hidden");
      userName.textContent = `${currentUser.full_name} (${currentUser.role})`;
      practiceLeadSection.classList.remove("hidden");
      consultantSection.classList.add("hidden");
    } else {
      authContainer.classList.remove("hidden");
      userInfo.classList.add("hidden");
      practiceLeadSection.classList.add("hidden");
      consultantSection.classList.remove("hidden");
    }
  }
  
  function canManageCapability(capability) {
    if (!currentUser) return false;
    if (currentUser.role === "admin") return true;
    if (currentUser.role === "practice_lead") {
      return currentUser.practice_areas.includes(capability.practice_area);
    }
    return false;
  }

  // Function to fetch capabilities from API
  async function fetchCapabilities() {
    try {
      const response = await fetch("/capabilities");
      const capabilities = await response.json();

      // Clear loading message
      capabilitiesList.innerHTML = "";

      // Populate capabilities list
      Object.entries(capabilities).forEach(([name, details]) => {
        const capabilityCard = document.createElement("div");
        capabilityCard.className = "capability-card";

        const availableCapacity = details.capacity || 0;
        const currentConsultants = details.consultants ? details.consultants.length : 0;

        // Create consultants HTML with delete icons (only for authorized users)
        const canManage = canManageCapability(details);
        const consultantsHTML =
          details.consultants && details.consultants.length > 0
            ? `<div class="consultants-section">
              <h5>Registered Consultants:</h5>
              <ul class="consultants-list">
                ${details.consultants
                  .map(
                    (email) =>
                      `<li><span class="consultant-email">${email}</span>${canManage ? `<button class="delete-btn" data-capability="${name}" data-email="${email}">❌</button>` : ''}</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No consultants registered yet</em></p>`;

        capabilityCard.innerHTML = `
          <h4>${name}${canManage ? '<span class="permission-indicator">Manage</span>' : ''}</h4>
          <p>${details.description}</p>
          <p><strong>Practice Area:</strong> ${details.practice_area}</p>
          <p><strong>Industry Verticals:</strong> ${details.industry_verticals ? details.industry_verticals.join(', ') : 'Not specified'}</p>
          <p><strong>Capacity:</strong> ${availableCapacity} hours/week available</p>
          <p><strong>Current Team:</strong> ${currentConsultants} consultants</p>
          <div class="consultants-container">
            ${consultantsHTML}
          </div>
        `;

        capabilitiesList.appendChild(capabilityCard);

        // Add option to select dropdowns
        if (capabilitySelect) {
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          capabilitySelect.appendChild(option);
        }
        
        if (requestCapabilitySelect) {
          const requestOption = document.createElement("option");
          requestOption.value = name;
          requestOption.textContent = name;
          requestCapabilitySelect.appendChild(requestOption);
        }
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      capabilitiesList.innerHTML =
        "<p>Failed to load capabilities. Please try again later.</p>";
      console.error("Error fetching capabilities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const capability = button.getAttribute("data-capability");
    const email = button.getAttribute("data-email");

    if (!authToken) {
      showMessage("You must be logged in as a Practice Lead to manage consultants.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/capabilities/${encodeURIComponent(
          capability
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        // Refresh capabilities list to show updated consultants
        fetchCapabilities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle practice lead registration form submission
  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!authToken) {
        showMessage("You must be logged in as a Practice Lead to register consultants.", "error");
        return;
      }

      const email = document.getElementById("email").value;
      const capability = document.getElementById("capability").value;

      try {
        const response = await fetch(
          `/capabilities/${encodeURIComponent(
            capability
          )}/register?email=${encodeURIComponent(email)}`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${authToken}`
            }
          }
        );

        const result = await response.json();

        if (response.ok) {
          showMessage(result.message, "success");
          registerForm.reset();
          // Refresh capabilities list to show updated consultants
          fetchCapabilities();
        } else {
          showMessage(result.detail || "An error occurred", "error");
        }
      } catch (error) {
        showMessage("Failed to register. Please try again.", "error");
        console.error("Error registering:", error);
      }
    });
  }

  // Handle consultant request form submission
  if (requestForm) {
    requestForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document.getElementById("request-email").value;
      const capability = document.getElementById("request-capability").value;

      try {
        const response = await fetch(
          `/capabilities/${encodeURIComponent(
            capability
          )}/request?email=${encodeURIComponent(email)}`,
          {
            method: "POST"
          }
        );

        const result = await response.json();

        if (response.ok) {
          showMessage(result.message, "success");
          requestForm.reset();
        } else {
          showMessage(result.detail || "An error occurred", "error");
        }
      } catch (error) {
        showMessage("Failed to submit request. Please try again.", "error");
        console.error("Error requesting:", error);
      }
    });
  }

  // Authentication event handlers
  loginBtn.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
  });

  closeModal.addEventListener("click", () => {
    loginModal.classList.add("hidden");
  });

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    // Clear any previous login messages
    loginMessage.classList.add("hidden");
    loginMessage.textContent = "";

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    console.log("Login attempt for:", username); // Debug log

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      const result = await response.json();
      console.log("Login response:", response.status, result); // Debug log

      if (response.ok) {
        authToken = result.access_token;
        currentUser = result.user;
        localStorage.setItem("authToken", authToken);
        
        console.log("Login successful, hiding modal"); // Debug log
        loginModal.classList.add("hidden");
        loginForm.reset();
        updateUIForUser();
        fetchCapabilities(); // Refresh to show management permissions
        
        showMessage(`Welcome, ${currentUser.full_name}!`, "success");
      } else {
        console.log("Login failed:", result.detail); // Debug log
        loginMessage.textContent = result.detail || "Login failed";
        loginMessage.className = "error";
        loginMessage.classList.remove("hidden");
      }
    } catch (error) {
      console.error("Login error:", error);
      loginMessage.textContent = "Login failed. Please try again.";
      loginMessage.className = "error";
      loginMessage.classList.remove("hidden");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });
    } catch (error) {
      console.error("Logout error:", error);
    }

    authToken = null;
    currentUser = null;
    localStorage.removeItem("authToken");
    updateUIForUser();
    fetchCapabilities(); // Refresh to hide management permissions
    showMessage("Successfully logged out.", "success");
  });

  // Utility function for showing messages
  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    // Hide message after 5 seconds
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  // Initialize app
  checkAuthStatus().then(() => {
    fetchCapabilities();
  });
});
