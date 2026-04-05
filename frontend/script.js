// ============================================================
// Saathi- Frontend JavaScript
// Features: Chat, Streaming, Markdown, History, Auto-resize
// ============================================================

// ─── Configuration ────────────────────────────────────────────
const CONFIG = {
  // Directly using your Live Render URL for backend communication
  API_BASE: "https://saathi-ai-3zjr.onrender.com/api",
  MAX_HISTORY: 20,
  DEFAULT_MODEL: "gemini-2.5-flash",
};

// ─── App State ────────────────────────────────────────────────
let state = {
  messages: [],
  isLoading: false,
  chatSessions: [],
  currentSessionId: null,
  abortController: null,
  imgMode: false,
  imgModel: "flux",   // Default image model
};

// ─── DOM Elements ─────────────────────────────────────────────
const els = {
  messagesContainer: document.getElementById("messagesContainer"),
  welcomeScreen: document.getElementById("welcomeScreen"),
  messageInput: document.getElementById("messageInput"),
  sendBtn: document.getElementById("sendBtn"),
  newChatBtn: document.getElementById("newChatBtn"),
  newImageBtn: document.getElementById("newImageBtn"),
  clearBtn: document.getElementById("clearBtn"),
  historyList: document.getElementById("historyList"),
  imageHistoryList: document.getElementById("imageHistoryList"),
  chatTitle: document.getElementById("chatTitle"),
  logoutBtn: document.querySelector(".menu-item.logout"),

  modelSelect: document.getElementById("modelSelect"),
  streamToggle: null,  // Removed — streaming always on
  sidebar: document.getElementById("sidebar"),
  sidebarToggle: document.getElementById("sidebarToggle"),
  sidebarCollapseBtn: document.getElementById("sidebarCollapseBtn"),
  menuToggleBtn: document.getElementById("menuToggleBtn"),
  confirmModal: document.getElementById("confirmModal"),
  modalCancelBtn: document.getElementById("modalCancelBtn"),
  modalConfirmBtn: document.getElementById("modalConfirmBtn"),

  userProfileBtn: document.getElementById("userProfileBtn"),
  userMenu: document.getElementById("userMenu"),
  menuHeader: document.querySelector(".menu-header"),
  imgGenBtn: document.getElementById("imgGenBtn"),
  imgModelSelect: document.getElementById("imgModelSelect"),
  imgModelRow: document.getElementById("imgModelRow"),

  imageLightbox: document.getElementById("imageLightbox"),
  lightboxImg: document.getElementById("lightboxImg"),
  lightboxClose: document.getElementById("lightboxClose"),
  lightboxDownload: document.getElementById("lightboxDownload"),

  profileModal: document.getElementById("profileModal"),
  openProfileBtn: document.getElementById("openProfileBtn"),
  profileCancelBtn: document.getElementById("profileCancelBtn"),
  profileSaveBtn: document.getElementById("profileSaveBtn"),
  editDisplayName: document.getElementById("editDisplayName"),
  editUsername: document.getElementById("editUsername"),
  profileAvatarLarge: document.getElementById("profileAvatarLarge"),
  avatarInput: document.getElementById("avatarInput"),
  triggerAvatarInput: document.getElementById("triggerAvatarInput"),
};

function checkAuth() {
  if (sessionStorage.getItem("isLoggedIn") !== "true") {
    window.location.href = "login.html";
  }
}

function logout() {
  sessionStorage.removeItem("isLoggedIn");
  localStorage.removeItem("user_name");
  localStorage.removeItem("user_email");
  localStorage.removeItem("user_avatar_url");
  localStorage.removeItem("chatSessions");
  window.location.href = "login.html";
}

// ─── Handle OAuth Redirect (Google / GitHub) ──────────────────
function handleOAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
  const oauthStr = params.get("oauth");
  if (!oauthStr) return;

  try {
    const oauthParams = new URLSearchParams(oauthStr);
    const name    = oauthParams.get("name")    || "User";
    const email   = oauthParams.get("email")   || "";
    const avatar  = oauthParams.get("avatar")  || "";
    const provider = oauthParams.get("provider") || "";

    localStorage.setItem("user_name", name);
    localStorage.setItem("user_email", email);
    if (avatar) localStorage.setItem("user_avatar_url", avatar);
    localStorage.setItem("user_provider", provider);
    sessionStorage.setItem("isLoggedIn", "true");

    // Clean URL so params don't show on refresh
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (e) {
    console.error("OAuth param parse error:", e);
  }
}

// ─── Init ─────────────────────────────────────────────────────
function init() {
  handleOAuthRedirect(); // Must be FIRST — sets session before checkAuth
  checkAuth();
  loadSessionsFromStorage();
  
  if (state.chatSessions.length > 0) {
    // Auto-load most recent chat
    loadSession(state.chatSessions[0].id);
  } else {
    // Show Dashboard / Welcome screen
    els.messagesContainer.appendChild(els.welcomeScreen);
  }

  updateUserInfo();
  setupEventListeners();
  loadModels(); // Fetch and populate model list
  
  // Collapse sidebar by default on mobile, expanded on desktop
  if (window.innerWidth <= 768) {
    els.sidebar.classList.add("collapsed");
  }
  setupMarked();         // Configure markdown parser
  autoResizeTextarea();
  updateSendBtn();
}

// ─── Configure Marked.js (Markdown parser) ─────────────────────
function setupMarked() {
  marked.setOptions({
    highlight: function (code, lang) {
      // Syntax highlighting via Highlight.js
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
    breaks: true,       // Convert \n to <br>
    gfm: true,          // GitHub Flavored Markdown
  });
}

// ─── Event Listeners ──────────────────────────────────────────
function setupEventListeners() {
  // Send on button click
  els.sendBtn.addEventListener("click", sendMessage);

  // Send on Enter (Shift+Enter = new line)
  els.messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Enable/disable send button based on input
  els.messageInput.addEventListener("input", () => {
    updateSendBtn();
    autoResizeTextarea();
  });

  // New chat buttons
  if (els.newChatBtn) {
    els.newChatBtn.addEventListener("click", () => startNewChat(false));
  }
  if (els.newImageBtn) {
    els.newImageBtn.addEventListener("click", () => startNewChat(true));
  }

  // Clear chat
  if (els.clearBtn) {
    els.clearBtn.addEventListener("click", clearCurrentChat);
  }

  // Image generation toggle button
  if (els.imgGenBtn) {
    els.imgGenBtn.addEventListener("click", toggleImgMode);
  }

  // Image model selector
  if (els.imgModelSelect) {
    els.imgModelSelect.addEventListener("change", () => {
      state.imgModel = els.imgModelSelect.value;
    });
  }

  // Modal buttons
  if (els.modalCancelBtn) {
    els.modalCancelBtn.addEventListener("click", () => hideModal(els.confirmModal));
  }
  if (els.modalConfirmBtn) {
    els.modalConfirmBtn.addEventListener("click", () => {
      hideModal(els.confirmModal);
      executeClearChat();
    });
  }

  // Close modal on click outside
  if (els.confirmModal) {
    els.confirmModal.addEventListener("click", (e) => {
      if (e.target === els.confirmModal) hideModal(els.confirmModal);
    });
  }

  // Sidebar toggle (mobile)
  if (els.sidebarToggle) {
    els.sidebarToggle.addEventListener("click", () => {
      els.sidebar.classList.toggle("open");
    });
  }

  if (els.logoutBtn) {
    els.logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }

  if (els.sidebarCollapseBtn) {
    els.sidebarCollapseBtn.addEventListener("click", () => {
      els.sidebar.classList.add("collapsed");
    });
  }

  if (els.menuToggleBtn) {
    els.menuToggleBtn.addEventListener("click", () => {
      els.sidebar.classList.remove("collapsed");
    });
  }

  // User Profile Menu Toggle
  if (els.userProfileBtn && els.userMenu) {
    els.userProfileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      els.userMenu.classList.toggle("active");
      els.userProfileBtn.classList.toggle("active");
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!els.userMenu.contains(e.target) && !els.userProfileBtn.contains(e.target)) {
        els.userMenu.classList.remove("active");
        els.userProfileBtn.classList.remove("active");
      }
    });
  }

  // Close sidebar when clicking outside (mobile)
  document.addEventListener("click", (e) => {
    if (
      window.innerWidth <= 768 &&
      els.sidebar &&
      !els.sidebar.contains(e.target) &&
      els.sidebarToggle &&
      !els.sidebarToggle.contains(e.target)
    ) {
      els.sidebar.classList.remove("open");
    }
  });

  // Lightbox Close Events
  if (els.lightboxClose) {
    els.lightboxClose.addEventListener("click", closeLightbox);
  }
  if (els.imageLightbox) {
    els.imageLightbox.addEventListener("click", (e) => {
      // Close only if clicking the overlay (not the image or buttons)
      if (e.target === els.imageLightbox) closeLightbox();
    });
  }

  // Global Event Delegation for Image Clicks (Makes old saved images zoomable too)
  document.addEventListener("click", (e) => {
    const parentWrap = e.target.closest(".gen-image-wrap");
    if (parentWrap && e.target.tagName === "IMG") {
      openLightbox(e.target.src);
    }
  });

  const openProfile = () => {
    const currentName = localStorage.getItem("user_name") || "Jay";
    const currentEmail = localStorage.getItem("user_email") || "jay@saathi.ai";
    const initials = currentName.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);

    if (els.editDisplayName) els.editDisplayName.value = currentName;
    if (els.editUsername) els.editUsername.value = currentEmail.includes("@") ? currentEmail.split("@")[0] : currentEmail;
    if (els.profileAvatarLarge) els.profileAvatarLarge.textContent = initials;
    
    showModal(els.profileModal);
    if (els.userMenu) els.userMenu.classList.remove("active");
  };

  if (els.openProfileBtn) {
    els.openProfileBtn.addEventListener("click", openProfile);
  }

  if (els.menuHeader) {
    els.menuHeader.style.cursor = "pointer";
    els.menuHeader.addEventListener("click", openProfile);
  }

  if (els.profileCancelBtn) {
    els.profileCancelBtn.addEventListener("click", () => {
      hideModal(els.profileModal);
    });
  }

  if (els.profileSaveBtn) {
    els.profileSaveBtn.addEventListener("click", () => {
      const newName = els.editDisplayName.value.trim();
      const newUsername = els.editUsername.value.trim();

      if (newName) {
        localStorage.setItem("user_name", newName);
        if (newUsername) {
          localStorage.setItem("user_email", newUsername + "@saathi.ai");
        }
        
        updateUserInfo();
        hideModal(els.profileModal);
        showToast("Profile updated!", "success");
      }
    });
  }

  // Handle Avatar Upload
  if (els.triggerAvatarInput && els.avatarInput) {
    els.triggerAvatarInput.addEventListener("click", () => {
      els.avatarInput.click();
    });

    els.avatarInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          localStorage.setItem("user_avatar_url", event.target.result);
          updateUserInfo();
          showToast("Photo updated!", "success");
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Close modals on overlay click
  document.querySelectorAll(".modal-overlay").forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
        document.body.style.overflow = ""; // Re-enable scroll
      }
    });
  });
}

function showModal(modalEl) {
  // Close all other modals first
  document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
  
  if (modalEl) {
    modalEl.classList.add("active");
    document.body.style.overflow = "hidden"; // Disable scroll
  }
}

function hideModal(modalEl) {
  if (modalEl) {
    modalEl.classList.remove("active");
    document.body.style.overflow = ""; // Re-enable scroll
  } else {
    document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
    document.body.style.overflow = "";
  }
}


// ─── Auto Resize Textarea ─────────────────────────────────────
function autoResizeTextarea() {
  const input = els.messageInput;
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 200) + "px";
}

// ─── Enable/Disable Send Button ───────────────────────────────
function updateSendBtn() {
  const hasText = els.messageInput.value.trim().length > 0;
  els.sendBtn.disabled = !hasText && !state.isLoading;
}

// ─── Set Image/Chat Mode UI ──────────────────────────────────
function setMode(isImage) {
  state.imgMode = isImage;
  const btn = els.imgGenBtn;
  const input = els.messageInput;

  if (state.imgMode) {
    if (btn) btn.classList.add("active");
    if (els.modelSelect) els.modelSelect.style.display = "none";
    input.placeholder = "✨ Describe the image you want to generate...";
    if (els.imgModelRow) els.imgModelRow.classList.add("visible");
  } else {
    if (btn) btn.classList.remove("active");
    if (els.modelSelect) els.modelSelect.style.display = "block";
    input.placeholder = "Message Saathi Ai... (or /image your prompt)";
    if (els.imgModelRow) els.imgModelRow.classList.remove("visible");
    const badge = document.getElementById("imgModeBadge");
    if (badge) badge.remove();
  }
}

// ─── Toggle Image Generation Mode ─────────────────────────────
function toggleImgMode() {
  setMode(!state.imgMode);
  els.messageInput.focus();
}

// ─── Handle Send Message ──────────────────────────────────────
function sendMessage() {
  const userMessage = els.messageInput.value.trim();
  if (!userMessage || state.isLoading) return;

  // Clear input
  els.messageInput.value = "";
  els.messageInput.style.height = "auto";

  // Hide welcome screen
  hideWelcomeScreen();

  // Check for /image command OR image mode toggle
  const imgCmdMatch = userMessage.match(/^\/image\s+(.+)/i);
  const imagePrompt = imgCmdMatch ? imgCmdMatch[1] : (state.imgMode ? userMessage : null);

  if (imagePrompt) {
    // Turn off image mode after sending
    if (state.imgMode) toggleImgMode();
    renderMessage("user", userMessage);
    
    // Save user's prompt to state
    state.messages.push({ role: "user", content: userMessage });
    
    if (state.messages.length === 1) updateChatTitle(userMessage);
    
    generateImage(imagePrompt);
    return;
  }

  // Normal chat
  state.messages.push({ role: "user", content: userMessage });
  renderMessage("user", userMessage);

  if (state.messages.length === 1) {
    updateChatTitle(userMessage);
  }

  // Get selected model
  const selectedModel = els.modelSelect && els.modelSelect.value 
    ? els.modelSelect.value 
    : CONFIG.DEFAULT_MODEL;

  // Streaming always on
  sendStreamingMessage(selectedModel);
}

// ─── Fetch Models ─────────────────────────────────────────────
async function loadModels() {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/models`);
    const data = await response.json();
    if (data.models) {
      // Update default if the hardcoded one isn't available
      const ids = data.models.map(m => m.id);
      if (!ids.includes(CONFIG.DEFAULT_MODEL) && ids.length > 0) {
        CONFIG.DEFAULT_MODEL = ids[0];
      }

      // Populate dropdown if it exists
      if (els.modelSelect) {
        els.modelSelect.innerHTML = data.models.map(m => 
          `<option value="${m.id}">${m.name}</option>`
        ).join("");
        
        // Auto-select Gemini Flash if available
        if (ids.includes("gemini-1.5-flash")) {
            els.modelSelect.value = "gemini-1.5-flash";
        }
      }
    }
  } catch (err) {
    console.error("Failed to load models:", err);
  }
}

// ─── Generate Image (Pollinations.ai — Free) ──────────────────
async function generateImage(prompt) {
  setLoading(true);

  const model = state.imgModel || "flux";
  const encoded = encodeURIComponent(prompt);
  const ts = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  const uniqueId = Date.now();

  // Render shimmer placeholder in a message bubble
  const wrapper = document.createElement("div");
  wrapper.className = "message-wrapper";
  wrapper.innerHTML = `
    <div class="message assistant">
      <div class="message-avatar">⚡</div>
      <div>
        <div class="message-content" style="background:transparent;border:none;padding:0;" id="imgContent_${uniqueId}">
          <div class="img-shimmer" id="imgShimmer_${uniqueId}">
            <div class="magic-loader"></div>
            <span id="imgStatus_${uniqueId}" style="margin-top:20px; font-weight:500; z-index:2;">🎨 Crafting image with <b>${model}</b>...</span>
          </div>
        </div>
        <div class="message-timestamp">${ts}</div>
      </div>
    </div>
  `;
  els.messagesContainer.appendChild(wrapper);
  scrollToBottom();

  const contentEl = wrapper.querySelector(`#imgContent_${uniqueId}`);

  const showResult = (blobUrl, realUrl) => {
    contentEl.innerHTML = `
      <div class="gen-image-wrap">
        <img src="${blobUrl}" alt="${escapeHtml(prompt)}"
          style="width:340px;min-height:200px;border-radius:var(--radius-lg);display:block;background:#1a1a1a;"
          onclick="openLightbox('${blobUrl}')">
        <div class="img-actions">
          <a href="${realUrl}" download="saathi-image.jpg" target="_blank" class="img-action-btn" title="Download">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </a>
        </div>
      </div>
    `;

    // Save structured image state to history using the real permanent URL
    state.messages.push({
      role: "assistant",
      isImage: true,
      imgUrl: realUrl,
      prompt: prompt,
      model: model,
      content: "[Image]" // Fallback text
    });
    saveCurrentSession();

    showToast("Image generated!", "success");
    setLoading(false);
    scrollToBottom();
  };

  const showFail = () => {
    contentEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        <span style="color:#f87171;">❌ Image generation failed. Pollinations API might be busy.</span>
        <button onclick="document.getElementById('messageInput').value = '/image ${escapeHtml(prompt).replace(/'/g, "\\'")}'; sendMessage();" 
          style="padding:6px 12px;background:var(--accent-gradient);border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:12px;width:fit-content;">
          🔄 Retry
        </button>
      </div>`;
    setLoading(false);
    scrollToBottom();
  };

  // Try loading up to 3 times
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const seed = Math.floor(Math.random() * 999999);
    // Use our local backend proxy instead of direct API to bypass ad-blockers and CORS
    const imgUrl = `${CONFIG.API_BASE}/image?prompt=${encoded}&model=${model}&seed=${seed}`;

    const statusEl = document.getElementById(`imgStatus_${uniqueId}`);
    if (statusEl && attempt > 1) {
      statusEl.innerHTML = `Retry ${attempt}/${MAX_ATTEMPTS} with <b>${model}</b>…`;
    }

    let loadSuccess = false;
    let userAborted = false;
    try {
      state.abortController = new AbortController();
      let isTimeout = false;
      const timer = setTimeout(() => {
        isTimeout = true;
        state.abortController.abort();
      }, 120000); // 120s timeout for heavy models

      const response = await fetch(imgUrl, { signal: state.abortController.signal });

      if (response.ok) {
        const blob = await response.blob();
        loadSuccess = URL.createObjectURL(blob); // Convert to local blob URL
      } else {
        console.error("Pollinations API Error:", response.status, response.statusText);
      }
      
      clearTimeout(timer);
    } catch (err) {
      if (err.name === "AbortError") {
        if (!isTimeout) userAborted = true;
        else console.log("Image fetch timeout");
      } else {
        console.error("Fetch Error:", err);
      }
    }

    if (userAborted) {
      contentEl.innerHTML = `
        <div style="color:var(--text-muted);font-style:italic;">
          🚫 Image generation stopped.
        </div>`;
      setLoading(false);
      return; 
    }

    if (loadSuccess) {
      showResult(loadSuccess, imgUrl);
      return; // Stop retries on success
    }

    // Wait 3 seconds before next retry
    if (attempt < MAX_ATTEMPTS) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // All attempts failed
  showFail();
}


// ─── Stop Streaming ───────────────────────────────────────────
function stopStreaming() {
  if (state.abortController) {
    state.abortController.abort();
  }
  setLoading(false);
}

// ─── Regular (Non-Streaming) API Call ─────────────────────────
async function sendRegularMessage(modelId) {
  setLoading(true);
  showTypingIndicator();

  try {
    const response = await fetch(`${CONFIG.API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: state.messages.map(m => ({ role: m.role, content: m.content })),
        model: modelId || CONFIG.DEFAULT_MODEL,
      }),
    });

    const data = await response.json();
    hideTypingIndicator();

    if (!response.ok) {
      throw new Error(data.error || "API Error");
    }

    // Add AI response to state & UI
    const aiMessage = data.message.content;
    state.messages.push({ role: "assistant", content: aiMessage });
    renderMessage("assistant", aiMessage);



    // Save session
    saveCurrentSession();

  } catch (error) {
    hideTypingIndicator();
    if (error.name !== "AbortError") {
      const msg = error.message.includes("Failed to fetch") 
        ? "Backend server is stopped or unreachable." 
        : error.message;
      showToast(msg, "error");
      
      // Also remote the last user message from state because the generation completely failed
      state.messages.pop();
      // Remove from dom
      const allWrappers = document.querySelectorAll(".message-wrapper");
      if (allWrappers.length > 0) {
        allWrappers[allWrappers.length - 1].remove();
      }
    }
  } finally {
    setLoading(false);
  }
}

// ─── Streaming API Call ───────────────────────────────────────
async function sendStreamingMessage(modelId) {
  setLoading(true);
  showTypingIndicator();

  let aiMessageEl = null;
  let fullContent = "";

  state.abortController = new AbortController();

  try {
    const response = await fetch(`${CONFIG.API_BASE}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: state.messages.map(m => ({ role: m.role, content: m.content })),
        model: modelId || CONFIG.DEFAULT_MODEL,
      }),
      signal: state.abortController.signal,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Stream error");
    }

    // Read the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();

          if (data === "[DONE]") break; // Stream complete

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              if (!aiMessageEl) {
                hideTypingIndicator();
                aiMessageEl = renderMessage("assistant", "", true);
              }
              fullContent += parsed.content;
              // Update the AI message element in real-time
              updateStreamingMessage(aiMessageEl, fullContent);
            }
            if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (e) {
            // Ignore JSON parse errors for incomplete chunks
          }
        }
      }
    }

    // Finalize the streamed message
    state.messages.push({ role: "assistant", content: fullContent });
    saveCurrentSession();

  } catch (error) {
    hideTypingIndicator();
    if (error.name !== "AbortError") {
      const msg = error.message.includes("Failed to fetch") 
        ? "Backend server is stopped or unreachable." 
        : error.message;
      showToast(msg, "error");
      
      // If we didn't receive any content, remove the empty bubble and pop the user's message
      if (!fullContent) {
        if (aiMessageEl) aiMessageEl.remove();
        state.messages.pop(); // remove user message from state
        const allWrappers = document.querySelectorAll(".message-wrapper");
        if (allWrappers.length > 0) {
          allWrappers[allWrappers.length - 1].remove(); // remove it from dom
        }
      }
    }
  } finally {
    setLoading(false);
    state.abortController = null;
    // Scroll to bottom after stream finishes
    scrollToBottom();
  }
}

// ─── Render User/AI Message ───────────────────────────────────
function renderMessage(role, content, isStreaming = false, msgObj = null) {
  const wrapper = document.createElement("div");
  wrapper.className = "message-wrapper";

  const isUser = role === "user";
  const avatarContent = isUser ? "U" : "⚡";

  // Format timestamp
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Render markdown for AI messages
  const htmlContent = isUser
    ? escapeHtml(content)
    : isStreaming
      ? ""
      : parseMarkdown(content);

  const uniqueId = `msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const actionsHtml = isUser ? `
    <div class="msg-actions">
      <button class="action-msg-btn edit-msg-btn" onclick="editUserMessage(this)" title="Edit Message">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
      <button class="action-msg-btn copy-msg-btn" onclick="copyMessageText(this)" title="Copy Message">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
    </div>
  ` : '';

  let versionHtml = '';
  if (msgObj && msgObj.versions && msgObj.versions.length > 1) {
    const isPrevDisabled = msgObj.currentVersion === 0;
    const isNextDisabled = msgObj.currentVersion === msgObj.versions.length - 1;
    versionHtml = `
      <div class="msg-versions" style="display: flex; gap: 8px; align-items: center; font-size: 11px; margin-top: 4px; color: var(--text-muted); user-select: none;">
        <button onclick="switchMsgVersion(this, -1)" style="background:transparent;border:none;color:inherit;cursor:pointer;padding:2px 4px; border-radius: 4px; ${isPrevDisabled ? 'opacity:0.3;' : ''}" ${isPrevDisabled ? 'disabled' : ''}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <span style="font-weight: 500;">${msgObj.currentVersion + 1} / ${msgObj.versions.length}</span>
        <button onclick="switchMsgVersion(this, 1)" style="background:transparent;border:none;color:inherit;cursor:pointer;padding:2px 4px; border-radius: 4px; ${isNextDisabled ? 'opacity:0.3;' : ''}" ${isNextDisabled ? 'disabled' : ''}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
    `;
  }

  wrapper.innerHTML = `
    <div class="message ${role}">
      <div class="message-avatar">${avatarContent}</div>
      <div class="message-body" style="position: relative; display: flex; flex-direction: column; max-width: 100%; min-width: 0;">
        <div class="message-content" id="${uniqueId}">${htmlContent}</div>
        ${isUser ? actionsHtml + `<div style="display:flex;justify-content:space-between;align-items:center;">${versionHtml}<div class="message-timestamp">${time}</div></div>` : `
        <div class="message-footer" style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
          <div class="message-timestamp" style="margin-top: 0;">${time}</div>
          <button class="copy-msg-btn ai-copy-btn" onclick="copyMessageText(this)" title="Copy Message" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 4px; transition: color 0.2s ease;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          ${versionHtml}
        </div>`}
      </div>
    </div>
  `;

  // Add copy buttons to code blocks
  if (!isUser && !isStreaming) {
    addCopyButtons(wrapper);
    highlightCode(wrapper);
  }

  els.messagesContainer.appendChild(wrapper);
  scrollToBottom();

  return wrapper; // Return element for streaming updates
}

// ─── Update Streaming Message Element ─────────────────────────
function updateStreamingMessage(wrapper, content) {
  const contentEl = wrapper.querySelector(".message-content");
  if (contentEl) {
    contentEl.innerHTML = parseMarkdown(content) + '<span class="cursor">▌</span>';
    highlightCode(contentEl);
    scrollToBottom();
  }
}

// ─── Parse Markdown ───────────────────────────────────────────
function parseMarkdown(text) {
  return marked.parse(text);
}

// ─── Escape HTML (for user messages) ─────────────────────────
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ─── Syntax Highlight ─────────────────────────────────────────
function highlightCode(container) {
  container.querySelectorAll("pre code").forEach((block) => {
    hljs.highlightElement(block);
  });
}

// ─── Add Copy Buttons to Code Blocks ──────────────────────────
function addCopyButtons(container) {
  container.querySelectorAll("pre").forEach((pre) => {
    const btn = document.createElement("button");
    btn.className = "copy-code-btn";
    btn.textContent = "Copy";
    btn.addEventListener("click", () => {
      const code = pre.querySelector("code")?.textContent || "";
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = "✓ Copied";
        setTimeout(() => (btn.textContent = "Copy"), 2000);
      });
    });
    pre.style.position = "relative";
    pre.appendChild(btn);
  });
}



// ─── Typing Indicator ─────────────────────────────────────────
function showTypingIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "message-wrapper";
  indicator.id = "typingIndicator";
  indicator.innerHTML = `
    <div class="message assistant">
      <div class="message-avatar">⚡</div>
      <div class="message-content">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>
  `;
  els.messagesContainer.appendChild(indicator);
  scrollToBottom();
}

function hideTypingIndicator() {
  const indicator = document.getElementById("typingIndicator");
  if (indicator) indicator.remove();
}

// ─── Set Loading State ────────────────────────────────────────
function setLoading(loading) {
  state.isLoading = loading;
  els.messageInput.disabled = loading;

  if (loading) {
    els.sendBtn.classList.add("loading");
    els.sendBtn.disabled = false; // Keep enabled to allow stopping
    els.sendBtn.title = "Stop";
  } else {
    els.sendBtn.classList.remove("loading");
    updateSendBtn();
    els.sendBtn.title = "Send Message";
  }
}

// ─── Hide Welcome Screen ──────────────────────────────────────
function hideWelcomeScreen() {
  if (els.welcomeScreen) {
    els.welcomeScreen.style.display = "none";
  }
}

// ─── Scroll to Bottom ─────────────────────────────────────────
function scrollToBottom() {
  els.messagesContainer.scrollTo({
    top: els.messagesContainer.scrollHeight,
    behavior: "smooth",
  });
}

// ─── Use Suggestion Card ──────────────────────────────────────
function useSuggestion(text) {
  els.messageInput.value = text;
  updateSendBtn();
  autoResizeTextarea();
  els.messageInput.focus();
  sendMessage();
}

// ─── New Chat ─────────────────────────────────────────────────
function startNewChat(isImage = false) {
  // Save current session if there are messages
  if (state.messages.length > 0) {
    saveCurrentSession();
  }

  // Reset state
  state.messages = [];
  state.currentSessionId = null;

  // Clear UI
  while (els.messagesContainer.firstChild) {
    els.messagesContainer.removeChild(els.messagesContainer.firstChild);
  }

  // Apply desired mode UI
  setMode(isImage);

  // Show welcome screen again
  const welcomeEl = document.createElement("div");
  welcomeEl.className = "welcome-screen";
  welcomeEl.id = "welcomeScreen";
  welcomeEl.innerHTML = `
    <div class="welcome-icon">${isImage ? '🎨' : '⚡'}</div>
    <h1 class="welcome-title">Saathi AI ${isImage ? 'Image' : ''}</h1>
    <p class="welcome-subtitle">${isImage ? 'Create stunning AI images instantly.' : 'Your intelligent AI assistant. Ask me anything!'}</p>
    <div class="suggestion-grid">
      ${isImage ? `
        <button class="suggestion-card" onclick="useSuggestion('A futuristic city with neon lights and flying cars')">
          <span class="suggestion-icon">🏙️</span>
          <span>A futuristic city with neon lights</span>
        </button>
        <button class="suggestion-card" onclick="useSuggestion('A cute fluffy cat wearing a space suit, realistic')">
          <span class="suggestion-icon">🐱</span>
          <span>Cute cat in space suit</span>
        </button>
      ` : `
        <button class="suggestion-card" onclick="useSuggestion('Explain quantum computing in simple terms')">
          <span class="suggestion-icon">🔬</span>
          <span>Explain quantum computing in simple terms</span>
        </button>
        <button class="suggestion-card" onclick="useSuggestion('Write a Python function to sort a list of dictionaries')">
          <span class="suggestion-icon">💻</span>
          <span>Write a Python sort function</span>
        </button>
      `}
    </div>
  `;
  els.messagesContainer.appendChild(welcomeEl);
  els.messageInput.focus();

  // Update refs
  els.welcomeScreen = document.getElementById("welcomeScreen");

  if (els.chatTitle) {
    els.chatTitle.textContent = "New Conversation";
  }

  // Deactivate all history items
  document.querySelectorAll(".history-item").forEach((el) => {
    el.classList.remove("active");
  });

  els.messageInput.focus();
  showToast("New chat started!", "success");
}

// ─── Clear Current Chat ───────────────────────────────────────
function clearCurrentChat() {
  if (state.messages.length === 0) return;
  showModal(els.confirmModal);
}

function hideConfirmModal() {
  hideModal(els.confirmModal);
}

function executeClearChat() {
  state.messages = [];
  startNewChat();
}

// ─── Update Chat Title ────────────────────────────────────────
function updateChatTitle(firstMessage) {
  // Use first 35 chars as the title
  const title = firstMessage.length > 35
    ? firstMessage.substring(0, 35) + "..."
    : firstMessage;
  if (els.chatTitle) {
    els.chatTitle.textContent = title;
  }
}

// ─── Save Session to LocalStorage ─────────────────────────────
function saveCurrentSession() {
  if (state.messages.length === 0) return;

  const sessionId = state.currentSessionId || `session_${Date.now()}`;
  state.currentSessionId = sessionId;

  const session = {
    id: sessionId,
    title: getSessionTitle(),
    messages: state.messages,
    timestamp: Date.now(),
    model: CONFIG.DEFAULT_MODEL,
  };

  // Update or add session
  const existingIdx = state.chatSessions.findIndex((s) => s.id === sessionId);
  if (existingIdx >= 0) {
    state.chatSessions[existingIdx] = session;
  } else {
    state.chatSessions.unshift(session); // Add to beginning
  }

  // Limit stored sessions
  if (state.chatSessions.length > CONFIG.MAX_HISTORY) {
    state.chatSessions = state.chatSessions.slice(0, CONFIG.MAX_HISTORY);
  }

  // Save to localStorage
  localStorage.setItem("chatSessions", JSON.stringify(state.chatSessions));

  // Update sidebar history
  renderHistory();
}

// ─── Get Session Title ────────────────────────────────────────
function getSessionTitle() {
  const firstUserMsg = state.messages.find((m) => m.role === "user");
  if (!firstUserMsg) return "New Chat";
  return firstUserMsg.content.length > 40
    ? firstUserMsg.content.substring(0, 40) + "..."
    : firstUserMsg.content;
}

// ─── Load Sessions from LocalStorage ─────────────────────────
function loadSessionsFromStorage() {
  const saved = localStorage.getItem("chatSessions");
  if (saved) {
    state.chatSessions = JSON.parse(saved);
    renderHistory();
  }
}

// ─── Load a Session ───────────────────────────────────────────
function loadSession(sessionId) {
  const session = state.chatSessions.find((s) => s.id === sessionId);
  if (!session) return;

  // Reset UI
  while (els.messagesContainer.firstChild) {
    els.messagesContainer.removeChild(els.messagesContainer.firstChild);
  }

  // Restore state
  state.messages = [...session.messages];
  state.currentSessionId = sessionId;
  if (els.chatTitle) {
    els.chatTitle.textContent = session.title;
  }

  // Re-render messages
  session.messages.forEach((msg) => {
    if (msg.isImage) {
      // Re-render structured image data using the real permanent URL
      const wrapper = document.createElement("div");
      wrapper.className = "message-wrapper";
      wrapper.innerHTML = `
        <div class="message assistant">
          <div class="message-avatar">⚡</div>
          <div>
            <div class="message-content" style="background:transparent;border:none;padding:0;">
              <div class="gen-image-wrap">
                <img src="${msg.imgUrl}" alt="${escapeHtml(msg.prompt || 'Generated Image')}"
                  style="width:340px;min-height:200px;border-radius:var(--radius-lg);display:block;background:#1a1a1a;">
                <div class="img-actions">
                  <a href="${msg.imgUrl}" download="saathi-image.jpg" target="_blank" class="img-action-btn" title="Download">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      els.messagesContainer.appendChild(wrapper);
    } else if (msg.isImageHtml) {
      // Legacy support for older sessions
      const wrapper = document.createElement("div");
      wrapper.className = "message-wrapper";
      wrapper.innerHTML = `
        <div class="message assistant">
          <div class="message-avatar">⚡</div>
          <div>
            <div class="message-content" style="background:transparent;border:none;padding:0;">
              ${msg.content}
            </div>
          </div>
        </div>
      `;
      els.messagesContainer.appendChild(wrapper);
    } else {
      renderMessage(msg.role, msg.content);
    }
  });

  // Highlight active in history
  document.querySelectorAll(".history-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === sessionId);
  });

  // Close sidebar on mobile
  els.sidebar.classList.remove("open");
}

// ─── Render History Sidebar ───────────────────────────────────
function renderHistory() {
  els.historyList.innerHTML = "";
  if (els.imageHistoryList) els.imageHistoryList.innerHTML = "";

  let hasTextChats = false;
  let hasImageChats = false;

  state.chatSessions.forEach((session) => {
    // Determine if this is an image generation session
    const isImageChat = session.messages.some((m) => m.isImage || m.isImageHtml);

    const item = document.createElement("div");
    item.className = "history-item";
    item.dataset.id = session.id;
    if (session.id === state.currentSessionId) {
      item.classList.add("active");
    }

    item.title = session.title;

    // Icon (Text Chat vs Image Chat)
    const chatIcon = document.createElement("div");
    chatIcon.className = "history-item-icon";
    if (isImageChat) {
      chatIcon.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      `;
      hasImageChats = true;
    } else {
      chatIcon.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
        </svg>
      `;
      hasTextChats = true;
    }

    // Title span
    const titleSpan = document.createElement("span");
    titleSpan.className = "history-item-title";
    titleSpan.textContent = session.title;

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "history-delete-btn";
    deleteBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
      </svg>
    `;
    deleteBtn.title = "Delete Chat";

    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSession(session.id);
    });

    item.appendChild(chatIcon);
    item.appendChild(titleSpan);
    item.appendChild(deleteBtn);

    item.addEventListener("click", () => loadSession(session.id));

    if (isImageChat && els.imageHistoryList) {
      els.imageHistoryList.appendChild(item);
    } else {
      els.historyList.appendChild(item);
    }
  });

  if (!hasTextChats) {
    els.historyList.innerHTML = '<div class="history-empty">No chats yet. Start a conversation!</div>';
  }
  if (!hasImageChats && els.imageHistoryList) {
    els.imageHistoryList.innerHTML = '<div class="history-empty">No images yet.</div>';
  }
}

// ─── Delete Session ───────────────────────────────────────────
function deleteSession(sessionId) {
  state.chatSessions = state.chatSessions.filter((s) => s.id !== sessionId);
  localStorage.setItem("chatSessions", JSON.stringify(state.chatSessions));

  if (state.currentSessionId === sessionId) {
    startNewChat();
  }

  renderHistory();
  showToast("Chat deleted", "success");
}

// ─── Profile & User Info ──────────────────────────────────────
function updateUserInfo() {
  const name      = localStorage.getItem("user_name")       || "Jay";
  const email     = localStorage.getItem("user_email")      || "jay@saathi.ai";
  const avatarUrl = localStorage.getItem("user_avatar_url") || "";
  const initials  = name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);

  // Apply avatar: img tag (photo) OR text initials
  const applyAvatar = (el, small = false) => {
    if (!el) return;
    if (avatarUrl) {
      el.innerHTML = `<img src="${avatarUrl}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
      el.style.background = "none";
    } else {
      el.innerHTML = small ? initials[0] : initials;
      el.style.background = "";
    }
  };

  // Footer avatar & name
  const userNameEl   = document.querySelector(".user-name");
  const userAvatarEl = document.querySelector(".user-avatar");
  if (userNameEl)   userNameEl.textContent = name;
  if (userAvatarEl) applyAvatar(userAvatarEl, true);

  // Dropdown menu header
  const menuNameEl       = document.querySelector(".menu-name");
  const menuHandleEl     = document.querySelector(".menu-handle");
  const menuAvatarEl     = document.querySelector(".menu-avatar");
  const menuItemAvatarEl = document.getElementById("menuItemAvatar");

  if (menuNameEl)       menuNameEl.textContent = name;
  if (menuHandleEl)     menuHandleEl.textContent = email.includes("@") ? "@" + email.split("@")[0] : email;
  if (menuAvatarEl)     applyAvatar(menuAvatarEl, false);
  if (menuItemAvatarEl) applyAvatar(menuItemAvatarEl, true);

  // Profile modal large avatar
  if (els.profileAvatarLarge) applyAvatar(els.profileAvatarLarge, false);
}




// ─── Toast Notification ───────────────────────────────────────
function showToast(message, type = "default") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add("show"), 50);

  // Remove after 2.5s
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ─── Lightbox Control Functions ───────────────────────────────
window.openLightbox = function(src) {
  if (!els.imageLightbox || !els.lightboxImg) return;
  els.lightboxImg.src = src;
  els.lightboxDownload.href = src;
  els.imageLightbox.style.display = "flex";
};

window.closeLightbox = function() {
  if (!els.imageLightbox) return;
  els.imageLightbox.style.display = "none";
  setTimeout(() => {
    if (els.lightboxImg) els.lightboxImg.src = "";
  }, 300); // Clear image src after fade out
};

// ─── Edit Message Functions ───────────────────────────────────
window.editUserMessage = function(btn) {
  const wrapper = btn.closest(".message-wrapper");
  const contentDiv = wrapper.querySelector(".message-content");
  const currentText = contentDiv.innerText;

  contentDiv.innerHTML = `
    <div class="edit-msg-mode" style="display:flex; flex-direction:column; gap:8px;">
      <textarea class="edit-msg-textarea" style="width:100%; min-height:60px; background:var(--bg-input); border:1px solid var(--border-default); color:var(--text-primary); border-radius:8px; padding:8px; font-family:inherit; font-size:14px; resize:none;">${currentText}</textarea>
      <div class="edit-msg-actions" style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="modal-btn cancel" onclick="cancelEditMessage(this, '${escapeHtml(currentText).replace(/'/g, "\\'")}')" style="padding:4px 10px; font-size:12px;">Cancel</button>
        <button class="modal-btn confirm" onclick="saveUserMessage(this)" style="padding:4px 10px; font-size:12px;">Save</button>
      </div>
    </div>
  `;
  btn.style.display = "none"; // Hide edit button

  const textarea = contentDiv.querySelector("textarea");
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
  textarea.focus();
};

window.cancelEditMessage = function(btn, originalText) {
  const wrapper = btn.closest(".message-wrapper");
  const contentDiv = wrapper.querySelector(".message-content");
  contentDiv.innerHTML = originalText;
  
  const editBtn = wrapper.querySelector(".edit-msg-btn");
  if (editBtn) editBtn.style.display = "flex";
};

window.saveUserMessage = function(btn) {
  if (state.isLoading) return;
  const wrapper = btn.closest(".message-wrapper");
  const contentDiv = wrapper.querySelector(".message-content");
  const textarea = contentDiv.querySelector("textarea");
  const newText = textarea.value.trim();
  
  if (!newText) return;
  
  // Find index to update state
  const allWrappers = Array.from(els.messagesContainer.querySelectorAll(".message-wrapper"));
  const wrapperIndex = allWrappers.indexOf(wrapper);
  
  if (wrapperIndex >= 0 && state.messages[wrapperIndex]) {
    const msg = state.messages[wrapperIndex];
    if (newText === msg.content) {
      contentDiv.innerHTML = escapeHtml(newText);
      const editBtn = wrapper.querySelector(".edit-msg-btn");
      if (editBtn) editBtn.style.display = "flex";
      return;
    }

    if (!msg.versions) {
      msg.versions = [{
        content: msg.content,
        tail: state.messages.slice(wrapperIndex + 1)
      }];
      msg.currentVersion = 0;
    } else {
      msg.versions[msg.currentVersion].tail = state.messages.slice(wrapperIndex + 1);
    }
    
    msg.content = newText;
    msg.versions.push({
      content: newText,
      tail: []
    });
    msg.currentVersion = msg.versions.length - 1;

    // Truncate state
    state.messages = state.messages.slice(0, wrapperIndex + 1);
    saveCurrentSession();
    
    if (wrapperIndex === 0) updateChatTitle(newText);
    
    // Re-render entire chat
    reRenderChat();
    
    // Regenerate response
    sendStreamingMessage();
  }
};

window.switchMsgVersion = function(btn, delta) {
  if (state.isLoading) return;
  const wrapper = btn.closest(".message-wrapper");
  const allWrappers = Array.from(els.messagesContainer.querySelectorAll(".message-wrapper"));
  const wrapperIndex = allWrappers.indexOf(wrapper);
  
  if (wrapperIndex < 0) return;
  
  const msg = state.messages[wrapperIndex];
  if (!msg || !msg.versions) return;
  
  const newVer = msg.currentVersion + delta;
  if (newVer < 0 || newVer >= msg.versions.length) return;
  
  // Save active tail for current version
  msg.versions[msg.currentVersion].tail = state.messages.slice(wrapperIndex + 1);
  
  // Switch
  msg.currentVersion = newVer;
  msg.content = msg.versions[newVer].content;
  
  // Restore new tail
  state.messages = state.messages.slice(0, wrapperIndex + 1).concat(msg.versions[newVer].tail);
  
  saveCurrentSession();
  
  if (wrapperIndex === 0) updateChatTitle(msg.content);
  
  reRenderChat();
};

function reRenderChat() {
  while (els.messagesContainer.firstChild) {
    els.messagesContainer.removeChild(els.messagesContainer.firstChild);
  }
  
  if (state.messages.length === 0 && els.welcomeScreen) {
    els.messagesContainer.appendChild(els.welcomeScreen);
    els.welcomeScreen.style.display = "flex";
  } else {
    hideWelcomeScreen();
  }

  state.messages.forEach((msg, idx) => {
    if (msg.isImage) {
      const wrapper = document.createElement("div");
      wrapper.className = "message-wrapper";
      wrapper.innerHTML = `
        <div class="message assistant">
          <div class="message-avatar">⚡</div>
          <div>
            <div class="message-content" style="background:transparent;border:none;padding:0;">
              <div class="gen-image-wrap">
                <img src="${msg.imgUrl}" alt="${escapeHtml(msg.prompt || 'Generated Image')}"
                  style="width:340px;min-height:200px;border-radius:var(--radius-lg);display:block;background:#1a1a1a;">
                <div class="img-actions">
                  <a href="${msg.imgUrl}" download="saathi-image.jpg" target="_blank" class="img-action-btn" title="Download">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      els.messagesContainer.appendChild(wrapper);
    } else if (msg.isImageHtml) {
      const wrapper = document.createElement("div");
      wrapper.className = "message-wrapper";
      wrapper.innerHTML = `
        <div class="message assistant">
          <div class="message-avatar">⚡</div>
          <div>
            <div class="message-content" style="background:transparent;border:none;padding:0;">
              ${msg.content}
            </div>
          </div>
        </div>
      `;
      els.messagesContainer.appendChild(wrapper);
    } else {
      renderMessage(msg.role, msg.content, false, msg);
    }
  });
  scrollToBottom();
}

window.copyMessageText = function(btn) {
  const wrapper = btn.closest(".message-wrapper");
  const contentDiv = wrapper.querySelector(".message-content");
  let textToCopy = "";
  
  // If the message is currently in edit mode, copy value from textarea
  const textarea = contentDiv.querySelector("textarea");
  if (textarea) {
    textToCopy = textarea.value;
  } else {
    textToCopy = contentDiv.innerText;
  }

  navigator.clipboard.writeText(textToCopy).then(() => {
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    setTimeout(() => {
      btn.innerHTML = originalHtml;
    }, 2000);
  }).catch(err => {
    console.error("Failed to copy message:", err);
  });
};

// ─── Initialize App ───────────────────────────────────────────
init();