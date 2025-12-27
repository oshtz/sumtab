// Panel mode detection
const PANEL_MODE = document.body.getAttribute("data-panel-mode") || "sidebar";
const IS_SIDEBAR = PANEL_MODE === "sidebar";

const darkModeToggle = document.getElementById("darkMode");
const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

const tabList = document.getElementById("tabList");
const apiConfigSection = document.getElementById("apiConfig");
const modelStyleSection = document.getElementById("modelStyle");
const systemPromptsSection = document.getElementById("systemPrompts");
const panelSettingsSection = document.getElementById("panelSettings");
const apiKeyInput = document.getElementById("apiKey");
const openRouterKeyInput = document.getElementById("openRouterKey");
const anthropicKeyInput = document.getElementById("anthropicKey");
const googleKeyInput = document.getElementById("googleKey");
const customApiKeyInput = document.getElementById("customApiKey");

const saveApiKeyBtn = document.getElementById("saveApiKey");
const saveProviderSettingsBtn = document.getElementById("saveProviderSettings");
const summarizeSelectedBtn = document.getElementById("summarizeSelected");
const modelSelect = document.getElementById("modelSelect");
const providerSelect = document.getElementById("providerSelect");
const resultsDiv = document.getElementById("results");
const summaryContent = document.getElementById("summaryContent");
const summarySkeleton = document.getElementById("summarySkeleton");
const selectAllBtn = document.getElementById("selectAll");
const deselectAllBtn = document.getElementById("deselectAll");
const openInNewTabBtn = document.getElementById("openInNewTab");
const clearBtn = document.getElementById("clearBtn");
const bulletsBtn = document.getElementById("bulletsBtn");
const copyBtn = document.getElementById("copyBtn");
const loader = document.getElementById("loader");
const apiStatus = document.getElementById("apiStatus");

// Loader progress bar elements
const progressLabel = document.getElementById("progressLabel");
const progressBar = document.getElementById("progressBar");
const progressTab = document.getElementById("progressTab");
const providerStatus = document.getElementById("providerStatus");
const modelStatus = document.getElementById("modelStatus");
const toneSelect = document.getElementById("toneSelect");
const lengthSelect = document.getElementById("lengthSelect");
const metaProvider = document.getElementById("metaProvider");
const metaModel = document.getElementById("metaModel");
const tabEmpty = document.getElementById("tabEmpty");
const summaryEmpty = document.getElementById("summaryEmpty");
const unsavedHint = document.getElementById("unsavedHint");
const inlineError = document.getElementById("inlineError");

// Summary section progress bar elements
const summaryProgress = document.getElementById("summaryProgress");
const progressCount = document.getElementById("progressCount");
const progressFill = document.getElementById("progressFill");
const progressTabName = document.getElementById("progressTabName");

// System prompt elements
const promptSelect = document.getElementById("promptSelect");
const promptName = document.getElementById("promptName");
const promptContent = document.getElementById("promptContent");
const savePromptBtn = document.getElementById("savePrompt");
const addNewPromptBtn = document.getElementById("addNewPrompt");
const deletePromptBtn = document.getElementById("deletePrompt");
const promptStatus = document.getElementById("promptStatus");

// Panel settings elements
const panelModeSelect = document.getElementById("panelModeSelect");
const switchToSidebarBtn = document.getElementById("switchToSidebar");
const switchToPopupBtn = document.getElementById("switchToPopup");
const panelStatus = document.getElementById("panelStatus");

const collapseStates = {
  apiConfig: true,
  modelStyle: true,
  systemPrompts: false,
  panelSettings: false,
};

const DEFAULT_PROVIDER = "openai";
const PROVIDER_LABELS = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  anthropic: "Anthropic",
  google: "Google",
  ollama: "Ollama",
  lmstudio: "LM Studio",
  custom: "Custom",
};
const PROVIDER_REQUIRES_KEY = {
  openai: true,
  openrouter: true,
  anthropic: true,
  google: true,
  ollama: false,
  lmstudio: false,
  custom: true,
};

const PROVIDER_DEFAULT_MODEL = {
  openai: "gpt-4o-mini",
  openrouter: "openrouter/openai/gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-20240620",
  google: "gemini-1.5-flash",
  ollama: "llama3.1",
  lmstudio: "local-model",
  custom: "",
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 50;
const TAB_REFRESH_DEBOUNCE_MS = 200;

// Default system prompt
const DEFAULT_SYSTEM_PROMPT = {
  id: "default",
  name: "Default",
  content:
    "You are a helpful assistant that summarizes text content concisely.",
  isDefault: true,
};

let tabs = [];
let summaryCache = {
  entries: {},
  order: [],
  timestamp: 0,
};
let tabRefreshTimer = null;
let isRefreshingTabs = false;
let isSummarizingTabs = false;
let pendingTabRefresh = false;
let modelRefreshToken = 0;
let lastUserInteraction = 0;
const USER_INTERACTION_COOLDOWN_MS = 500;

let providerSettings = {
  selectedProvider: DEFAULT_PROVIDER,
  modelByProvider: {
    openai: PROVIDER_DEFAULT_MODEL.openai,
    openrouter: PROVIDER_DEFAULT_MODEL.openrouter,
    anthropic: PROVIDER_DEFAULT_MODEL.anthropic,
    google: PROVIDER_DEFAULT_MODEL.google,
    ollama: PROVIDER_DEFAULT_MODEL.ollama,
    lmstudio: PROVIDER_DEFAULT_MODEL.lmstudio,
    custom: PROVIDER_DEFAULT_MODEL.custom,
  },
  keys: {
    openai: "",
    openrouter: "",
    anthropic: "",
    google: "",
    ollama: "",
    lmstudio: "",
    custom: "",
  },
  extras: {
    openrouter: {
      referer: "",
      title: "sumtab",
    },
    custom: {},
  },
  tone: "neutral",
  length: "medium",
};

let systemPromptSettings = {
  prompts: [DEFAULT_SYSTEM_PROMPT],
  selectedId: "default",
};

let panelSettings = {
  defaultMode: "sidebar",
  sidebarWasOpen: true,
};

(function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark" || (!savedTheme && prefersDarkScheme.matches)) {
    document.body.setAttribute("data-theme", "dark");
    darkModeToggle.checked = true;
  }
})();

darkModeToggle.addEventListener("change", handleThemeChange);

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await loadCachedSummaries();
  await clearOldSummaries();
  await loadTabs();
  setupEventListeners();
  updateSummarizeButtonState();
  initSystemPrompts();
  initPanelSettings();
});

function setupEventListeners() {
  summarizeSelectedBtn?.addEventListener("click", handleSummarizeSelected);
  saveApiKeyBtn?.addEventListener("click", handleSaveKeys);
  saveProviderSettingsBtn?.addEventListener(
    "click",
    handleSaveProviderSettings,
  );
  providerSelect?.addEventListener("change", handleProviderChange);
  modelSelect?.addEventListener("change", handleModelChange);
  toneSelect?.addEventListener("change", handleToneChange);
  lengthSelect?.addEventListener("change", handleLengthChange);

  [
    apiKeyInput,
    openRouterKeyInput,
    anthropicKeyInput,
    googleKeyInput,
    customApiKeyInput,
  ].forEach((el) => el?.addEventListener("input", markUnsaved));

  if (apiConfigSection) {
    apiConfigSection.addEventListener("toggle", () =>
      handleCollapseToggle("apiConfig", apiConfigSection),
    );
  }
  if (modelStyleSection) {
    modelStyleSection.addEventListener("toggle", () =>
      handleCollapseToggle("modelStyle", modelStyleSection),
    );
  }
  if (systemPromptsSection) {
    systemPromptsSection.addEventListener("toggle", () =>
      handleCollapseToggle("systemPrompts", systemPromptsSection),
    );
  }
  if (panelSettingsSection) {
    panelSettingsSection.addEventListener("toggle", () =>
      handleCollapseToggle("panelSettings", panelSettingsSection),
    );
  }

  // Use mousedown to set interaction time BEFORE focus event fires
  selectAllBtn?.addEventListener("mousedown", () => {
    lastUserInteraction = Date.now();
  });
  selectAllBtn?.addEventListener("click", () => {
    document.querySelectorAll(".tab-checkbox").forEach((cb) => {
      cb.checked = true;
      cb.dispatchEvent(new Event("change"));
    });
    updateSummarizeButtonState();
  });
  deselectAllBtn?.addEventListener("mousedown", () => {
    lastUserInteraction = Date.now();
  });
  deselectAllBtn?.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-checkbox")
      .forEach((cb) => (cb.checked = false));
    updateSummarizeButtonState();
  });
  copyBtn?.addEventListener("click", handleCopy);
  openInNewTabBtn?.addEventListener("click", handleOpenInNewTab);
  clearBtn?.addEventListener("click", handleClear);
  bulletsBtn?.addEventListener("click", toggleSummaryMode);

  // System prompt listeners
  promptSelect?.addEventListener("change", handlePromptSelect);
  savePromptBtn?.addEventListener("click", handleSavePrompt);
  addNewPromptBtn?.addEventListener("click", handleAddNewPrompt);
  deletePromptBtn?.addEventListener("click", handleDeletePrompt);

  // Panel settings listeners
  panelModeSelect?.addEventListener("change", handlePanelModeChange);
  switchToSidebarBtn?.addEventListener("click", handleSwitchToSidebar);
  switchToPopupBtn?.addEventListener("click", handleSwitchToPopup);

  // Only refresh tabs on visibility change, not on focus
  // Focus-based refresh causes issues with Select All button when panel is not focused
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleTabRefresh();
  });
}

async function loadSettings() {
  const stored = await chrome.storage.local.get([
    "providerSettings",
    "summaryCache",
    "apiKey",
    "model",
    "collapseStates",
    "systemPromptSettings",
    "panelSettings",
  ]);

  if (stored.providerSettings) {
    providerSettings = {
      ...providerSettings,
      ...stored.providerSettings,
      modelByProvider: {
        ...providerSettings.modelByProvider,
        ...(stored.providerSettings.modelByProvider || {}),
      },
      keys: {
        ...providerSettings.keys,
        ...(stored.providerSettings.keys || {}),
      },
      extras: {
        ...providerSettings.extras,
        ...(stored.providerSettings.extras || {}),
      },
    };
  } else {
    if (stored.apiKey) {
      providerSettings.keys.openai = stored.apiKey;
    }
    if (stored.model) {
      providerSettings.modelByProvider.openai = stored.model;
    }
  }

  if (stored.systemPromptSettings) {
    systemPromptSettings = {
      prompts: stored.systemPromptSettings.prompts || [DEFAULT_SYSTEM_PROMPT],
      selectedId: stored.systemPromptSettings.selectedId || "default",
    };
    // Ensure default prompt always exists
    if (!systemPromptSettings.prompts.find((p) => p.id === "default")) {
      systemPromptSettings.prompts.unshift(DEFAULT_SYSTEM_PROMPT);
    }
  }

  if (stored.panelSettings) {
    panelSettings = { ...panelSettings, ...stored.panelSettings };
  }

  providerSelect.value = providerSettings.selectedProvider;
  providerSettings.tone = providerSettings.tone || "neutral";
  providerSettings.length = providerSettings.length || "medium";
  toneSelect.value = providerSettings.tone;
  lengthSelect.value = providerSettings.length;
  await applyProviderSelection(providerSettings.selectedProvider);

  apiKeyInput.value = providerSettings.keys.openai || "";
  openRouterKeyInput.value = providerSettings.keys.openrouter || "";
  if (anthropicKeyInput)
    anthropicKeyInput.value = providerSettings.keys.anthropic || "";
  if (googleKeyInput) googleKeyInput.value = providerSettings.keys.google || "";
  customApiKeyInput.value = providerSettings.keys.custom || "";

  if (stored.summaryCache) {
    summaryCache = migrateCache(stored.summaryCache);
    pruneCache();
  }

  if (stored.collapseStates) {
    Object.keys(collapseStates).forEach((key) => {
      if (typeof stored.collapseStates[key] === "boolean") {
        collapseStates[key] = stored.collapseStates[key];
        const section = document.getElementById(key);
        if (section) section.open = collapseStates[key];
      }
    });
  }

  clearUnsaved();
  updateInlineError("");
}

function initSystemPrompts() {
  refreshPromptSelect();
  const selectedPrompt = systemPromptSettings.prompts.find(
    (p) => p.id === systemPromptSettings.selectedId,
  );
  if (selectedPrompt) {
    promptName.value = selectedPrompt.name;
    promptContent.value = selectedPrompt.content;
    updateDeleteButtonState();
  }
}

function initPanelSettings() {
  if (panelModeSelect) {
    panelModeSelect.value = panelSettings.defaultMode;
  }
  // Show appropriate switch button based on current mode
  if (IS_SIDEBAR && switchToPopupBtn) {
    switchToPopupBtn.style.display = "block";
  }
  if (!IS_SIDEBAR && switchToSidebarBtn) {
    switchToSidebarBtn.style.display = "block";
  }
}

function refreshPromptSelect() {
  if (!promptSelect) return;
  promptSelect.innerHTML = "";
  systemPromptSettings.prompts.forEach((prompt) => {
    const option = document.createElement("option");
    option.value = prompt.id;
    option.textContent = prompt.name + (prompt.isDefault ? " (Default)" : "");
    promptSelect.appendChild(option);
  });
  promptSelect.value = systemPromptSettings.selectedId;
}

function handlePromptSelect() {
  const selectedId = promptSelect.value;
  systemPromptSettings.selectedId = selectedId;
  const prompt = systemPromptSettings.prompts.find((p) => p.id === selectedId);
  if (prompt) {
    promptName.value = prompt.name;
    promptContent.value = prompt.content;
    updateDeleteButtonState();
  }
  saveSystemPromptSettings();
}

function updateDeleteButtonState() {
  const selectedPrompt = systemPromptSettings.prompts.find(
    (p) => p.id === systemPromptSettings.selectedId,
  );
  if (deletePromptBtn) {
    deletePromptBtn.disabled = selectedPrompt?.isDefault || false;
    deletePromptBtn.title = selectedPrompt?.isDefault
      ? "Cannot delete the default prompt"
      : "Delete this prompt";
  }
}

async function handleSavePrompt() {
  const selectedId = systemPromptSettings.selectedId;
  const promptIndex = systemPromptSettings.prompts.findIndex(
    (p) => p.id === selectedId,
  );

  if (promptIndex === -1) return;

  const isDefault = systemPromptSettings.prompts[promptIndex].isDefault;

  systemPromptSettings.prompts[promptIndex] = {
    ...systemPromptSettings.prompts[promptIndex],
    name: isDefault ? "Default" : promptName.value.trim() || "Unnamed Prompt",
    content: promptContent.value.trim() || DEFAULT_SYSTEM_PROMPT.content,
  };

  await saveSystemPromptSettings();
  refreshPromptSelect();
  updatePromptStatus("Prompt saved", true);
}

async function handleAddNewPrompt() {
  const newId = "prompt_" + Date.now();
  const newPrompt = {
    id: newId,
    name: "New Prompt",
    content: "You are a helpful assistant that summarizes text content.",
    isDefault: false,
  };

  systemPromptSettings.prompts.push(newPrompt);
  systemPromptSettings.selectedId = newId;

  await saveSystemPromptSettings();
  refreshPromptSelect();
  promptName.value = newPrompt.name;
  promptContent.value = newPrompt.content;
  updateDeleteButtonState();
  updatePromptStatus("New prompt created", true);
}

async function handleDeletePrompt() {
  const selectedId = systemPromptSettings.selectedId;
  const prompt = systemPromptSettings.prompts.find((p) => p.id === selectedId);

  if (prompt?.isDefault) {
    updatePromptStatus("Cannot delete the default prompt", false);
    return;
  }

  systemPromptSettings.prompts = systemPromptSettings.prompts.filter(
    (p) => p.id !== selectedId,
  );
  systemPromptSettings.selectedId = "default";

  await saveSystemPromptSettings();
  refreshPromptSelect();
  initSystemPrompts();
  updatePromptStatus("Prompt deleted", true);
}

async function saveSystemPromptSettings() {
  await chrome.storage.local.set({ systemPromptSettings });
}

function updatePromptStatus(message, success) {
  if (!promptStatus) return;
  promptStatus.textContent = message;
  promptStatus.className = `api-status ${success ? "success" : "error"}`;
  setTimeout(() => {
    promptStatus.textContent = "";
    promptStatus.className = "api-status";
  }, 3000);
}

async function handlePanelModeChange() {
  panelSettings.defaultMode = panelModeSelect.value;
  await savePanelSettings();
  // Notify background to update action behavior
  chrome.runtime.sendMessage({
    action: "updatePanelMode",
    mode: panelSettings.defaultMode,
  });
  updatePanelStatus(`Default mode set to ${panelSettings.defaultMode}`, true);
}

async function handleSwitchToSidebar() {
  try {
    // Update panel mode to sidebar
    panelSettings.defaultMode = "sidebar";
    await savePanelSettings();
    // Notify background to update action behavior
    await chrome.runtime.sendMessage({
      action: "updatePanelMode",
      mode: "sidebar",
    });
    updatePanelStatus(
      "Sidebar mode enabled. Click extension icon to open.",
      true,
    );
    // Close popup after a short delay
    setTimeout(() => window.close(), 1500);
  } catch (error) {
    updatePanelStatus("Failed to switch to sidebar: " + error.message, false);
  }
}

async function handleSwitchToPopup() {
  // Close sidebar and open popup
  chrome.runtime.sendMessage({ action: "openPopup" });
  updatePanelStatus("Opening popup...", true);
}

async function savePanelSettings() {
  await chrome.storage.local.set({ panelSettings });
}

function updatePanelStatus(message, success) {
  if (!panelStatus) return;
  panelStatus.textContent = message;
  panelStatus.className = `api-status ${success ? "success" : "error"}`;
  setTimeout(() => {
    panelStatus.textContent = "";
    panelStatus.className = "api-status";
  }, 3000);
}

async function applyProviderSelection(provider, options = {}) {
  const keyVisibility = {
    openai: ["apiKey"],
    openrouter: ["openRouterKey"],
    anthropic: ["anthropicKey"],
    google: ["googleKey"],
    custom: ["customApiKey"],
  };
  [
    "apiKey",
    "openRouterKey",
    "anthropicKey",
    "googleKey",
    "customApiKey",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (keyVisibility[provider]?.includes(id)) {
      el.closest(".input-group")?.classList.remove("hidden");
    } else {
      el.closest(".input-group")?.classList.add("hidden");
    }
  });

  await refreshModelOptions(provider, options);
  updateMetaBadges(provider, modelSelect?.value);
}

function getModelListExtras(provider) {
  if (provider === "openrouter") {
    return (
      providerSettings.extras?.openrouter || { referer: "", title: "sumtab" }
    );
  }
  if (provider === "custom") {
    return providerSettings.extras?.custom || {};
  }
  return {};
}

function updateModelStatus(message, success, persist = false) {
  if (!modelStatus) return;
  if (!message) {
    modelStatus.textContent = "";
    modelStatus.className = "api-status";
    return;
  }
  modelStatus.textContent = message;
  modelStatus.className = `api-status ${success ? "success" : "error"}`;
  if (!persist) {
    setTimeout(() => {
      modelStatus.textContent = "";
      modelStatus.className = "api-status";
    }, 3000);
  }
}

async function requestProviderModels(provider, options = {}) {
  const apiKey = providerSettings.keys[provider] || "";
  const extras = getModelListExtras(provider);
  try {
    const response = await chrome.runtime.sendMessage({
      action: "listModels",
      provider,
      apiKey,
      extras,
      forceRefresh: options.forceRefresh === true,
    });
    return (
      response || {
        models: [],
        source: "error",
        error: "No response from background.",
      }
    );
  } catch (error) {
    return {
      models: [],
      source: "error",
      error: error?.message || "Unable to fetch models.",
    };
  }
}

async function refreshModelOptions(provider, options = {}) {
  if (!modelSelect) return;
  const refreshId = (modelRefreshToken += 1);
  const desired =
    providerSettings.modelByProvider[provider] ||
    PROVIDER_DEFAULT_MODEL[provider];

  while (modelSelect.firstChild) {
    modelSelect.removeChild(modelSelect.firstChild);
  }

  const loadingOption = document.createElement("option");
  loadingOption.value = "";
  loadingOption.textContent = "Loading models...";
  modelSelect.appendChild(loadingOption);
  updateModelStatus("Fetching models...", true);

  const response = await requestProviderModels(provider, options);
  if (refreshId !== modelRefreshToken) return;

  const models = Array.isArray(response?.models) ? response.models : [];
  const uniqueModels = [];
  const seen = new Set();
  models.forEach((model) => {
    if (model && !seen.has(model)) {
      uniqueModels.push(model);
      seen.add(model);
    }
  });
  if (desired && !seen.has(desired)) {
    uniqueModels.push(desired);
    seen.add(desired);
  }

  while (modelSelect.firstChild) {
    modelSelect.removeChild(modelSelect.firstChild);
  }

  if (uniqueModels.length) {
    const group = document.createElement("optgroup");
    group.label = PROVIDER_LABELS[provider] || provider;
    uniqueModels.forEach((model) => {
      const opt = document.createElement("option");
      opt.value = model;
      opt.textContent = truncateOpenRouterPrefix(model);
      group.appendChild(opt);
    });
    modelSelect.appendChild(group);
  } else {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Enter a custom model after saving settings";
    modelSelect.appendChild(opt);
  }

  if (desired) {
    modelSelect.value = desired;
  }

  if (response?.source === "missing_key") {
    updateModelStatus("Save an API key to load models.", false, true);
  } else if (response?.source === "error") {
    const detail = response.error ? `: ${response.error}` : ".";
    updateModelStatus(`Could not refresh models${detail}`, false);
  } else if (response?.source === "remote") {
    updateModelStatus("Models refreshed.", true);
  } else {
    updateModelStatus("", true);
  }
}

async function loadTabs() {
  try {
    showTabSkeletons();
    pruneCache();
    const provider = getCurrentProvider();
    const model = getCurrentModel(provider);
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    tabs = allTabs.filter(
      (t) =>
        t.url &&
        !t.url.startsWith("chrome://") &&
        !t.url.startsWith("chrome-extension://"),
    );
    tabList.innerHTML = "";

    if (tabs.length === 0) {
      if (tabEmpty) tabEmpty.style.display = "block";
      updateSummarizeButtonState();
      return;
    }
    if (tabEmpty) tabEmpty.style.display = "none";

    for (const tab of tabs) {
      const tabElement = createTabElement(tab);
      const cached =
        getCachedSummary(provider, model, tab.url, "regular") ||
        getCachedSummary(provider, model, tab.url, "bullets");
      if (cached) {
        const summaryElement = tabElement.querySelector(".tab-summary");
        if (summaryElement) {
          summaryElement.textContent = cached.summary || cached;
          summaryElement.style.display = "block";
        }
      }
      tabList.appendChild(tabElement);
    }

    updateSummarizeButtonState();
  } catch (error) {
    updateApiStatus("Error loading tabs: " + error.message, false);
  }
}

function createTabElement(tab) {
  const tabDiv = document.createElement("div");
  tabDiv.className = "tab-item";
  tabDiv.setAttribute("data-tab-id", tab.id);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "tab-checkbox";
  checkbox.setAttribute("data-tab-id", tab.id);

  tabDiv.addEventListener("click", (e) => {
    if (e.target !== checkbox) {
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change"));
    }
  });

  checkbox.addEventListener("change", () => {
    tabDiv.classList.toggle("selected", checkbox.checked);
    updateSummarizeButtonState();
  });

  const tabContentDiv = document.createElement("div");
  tabContentDiv.className = "tab-content";

  const favicon = document.createElement("img");
  favicon.src = tab.favIconUrl || "icons/icon-16.png";
  favicon.className = "tab-favicon";
  favicon.onerror = () => (favicon.src = "icons/icon-16.png");

  const title = document.createElement("span");
  title.className = "tab-title";
  title.textContent = tab.title;
  title.title = tab.title;

  const statusSpan = document.createElement("span");
  statusSpan.className = "tab-status";
  statusSpan.textContent = "";
  statusSpan.style.display = "none";

  const loaderDiv = document.createElement("div");
  loaderDiv.className = "tab-loader";
  loaderDiv.style.display = "none";
  loaderDiv.innerHTML = '<div class="loader-spinner small"></div>';

  tabContentDiv.appendChild(favicon);
  tabContentDiv.appendChild(title);
  tabContentDiv.appendChild(statusSpan);
  tabContentDiv.appendChild(loaderDiv);

  tabDiv.appendChild(checkbox);
  tabDiv.appendChild(tabContentDiv);

  return tabDiv;
}

function getSelectedTabs() {
  const checkboxes = document.querySelectorAll(".tab-checkbox:checked");
  return Array.from(checkboxes).map((checkbox) => {
    const tabId = parseInt(checkbox.getAttribute("data-tab-id"), 10);
    return { id: tabId, element: checkbox.closest(".tab-item") };
  });
}

function getCurrentProvider() {
  return (
    providerSelect.value ||
    providerSettings.selectedProvider ||
    DEFAULT_PROVIDER
  );
}

function getCurrentModel(provider) {
  return (
    providerSettings.modelByProvider[provider] ||
    PROVIDER_DEFAULT_MODEL[provider]
  );
}

function getCurrentApiKey(provider) {
  return providerSettings.keys[provider] || "";
}

function getActiveSystemPrompt() {
  const prompt = systemPromptSettings.prompts.find(
    (p) => p.id === systemPromptSettings.selectedId,
  );
  return prompt?.content || DEFAULT_SYSTEM_PROMPT.content;
}

function getStyleExtras() {
  const tone = providerSettings.tone || "neutral";
  const length = providerSettings.length || "medium";
  const temperatureMap = {
    concise: 0.4,
    neutral: 0.7,
    detailed: 0.9,
  };
  const maxTokensMap = {
    short: 200,
    medium: 400,
    long: 800,
  };
  return {
    tone,
    length,
    temperature: temperatureMap[tone] ?? 0.7,
    maxTokens: maxTokensMap[length] ?? 400,
  };
}

function getExtras(provider) {
  const styleExtras = getStyleExtras();
  if (provider === "openrouter") {
    return {
      ...styleExtras,
      referer: "",
      title: "sumtab",
    };
  }
  return styleExtras;
}

// Helper function to truncate openrouter/ prefix for display
function truncateOpenRouterPrefix(modelName) {
  if (!modelName) return modelName;
  return modelName.startsWith("openrouter/")
    ? modelName.substring("openrouter/".length)
    : modelName;
}

function updateMetaBadges(provider, model) {
  if (metaProvider) {
    const label = PROVIDER_LABELS[provider] || provider;
    metaProvider.textContent = `Provider: ${label}`;
    metaProvider.title = metaProvider.textContent;
  }
  if (metaModel) {
    const displayModel = truncateOpenRouterPrefix(model);
    metaModel.textContent = `Model: ${displayModel || "default"}`;
    metaModel.title = metaModel.textContent;
  }
}

function showSummarySkeleton(show) {
  if (!summarySkeleton || !summaryContent) return;
  summarySkeleton.style.display = show ? "block" : "none";
  summaryContent.style.opacity = show ? 0.35 : 1;
  summaryContent.style.pointerEvents = show ? "none" : "auto";
}

function showTabSkeletons(count = 3) {
  if (!tabList) return;
  tabList.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    const skel = document.createElement("div");
    skel.className = "tab-item skeleton";
    skel.innerHTML = `
      <div class="tab-favicon"></div>
      <div class="tab-title skeleton-bar"></div>
    `;
    tabList.appendChild(skel);
  }
}

function scheduleTabRefresh() {
  if (!tabList || document.hidden) return;
  // Skip refresh if user recently interacted with the UI (e.g., clicked Select All)
  if (Date.now() - lastUserInteraction < USER_INTERACTION_COOLDOWN_MS) return;
  if (isSummarizingTabs) {
    pendingTabRefresh = true;
    return;
  }
  if (tabRefreshTimer) clearTimeout(tabRefreshTimer);
  tabRefreshTimer = setTimeout(() => {
    tabRefreshTimer = null;
    refreshTabs();
  }, TAB_REFRESH_DEBOUNCE_MS);
}

async function refreshTabs() {
  if (isRefreshingTabs) {
    pendingTabRefresh = true;
    return;
  }
  isRefreshingTabs = true;
  try {
    await loadTabs();
  } finally {
    isRefreshingTabs = false;
    if (pendingTabRefresh && !document.hidden) {
      pendingTabRefresh = false;
      scheduleTabRefresh();
    }
  }
}

function updateInlineError(message) {
  if (!inlineError) return;
  inlineError.textContent = message || "";
  inlineError.style.display = message ? "block" : "none";
}

function markUnsaved() {
  if (unsavedHint) unsavedHint.style.display = "block";
}

function handleCollapseToggle(key, el) {
  if (!el) return;
  collapseStates[key] = el.open;
  chrome.storage.local.set({ collapseStates });
}

function clearUnsaved() {
  if (unsavedHint) unsavedHint.style.display = "none";
}

function makeCacheKey(provider, model, url, mode = "regular") {
  return `${provider || ""}::${model || ""}::${mode}::${url}`;
}

function migrateCache(storedCache = {}) {
  if (storedCache.entries) {
    const normalizedOrder = Array.isArray(storedCache.order)
      ? storedCache.order.filter((key) => storedCache.entries[key])
      : [];
    return {
      entries: storedCache.entries,
      order: normalizedOrder,
      timestamp: storedCache.timestamp || Date.now(),
    };
  }

  const entries = {};
  const order = [];
  const legacyTimestamp = storedCache.timestamp || Date.now();

  Object.entries(storedCache.regular || {}).forEach(([url, summary]) => {
    const key = makeCacheKey(
      DEFAULT_PROVIDER,
      PROVIDER_DEFAULT_MODEL[DEFAULT_PROVIDER],
      url,
      "regular",
    );
    entries[key] = { summary, timestamp: legacyTimestamp };
    order.push(key);
  });

  Object.entries(storedCache.bullets || {}).forEach(([url, summary]) => {
    const key = makeCacheKey(
      DEFAULT_PROVIDER,
      PROVIDER_DEFAULT_MODEL[DEFAULT_PROVIDER],
      url,
      "bullets",
    );
    entries[key] = { summary, timestamp: legacyTimestamp };
    order.push(key);
  });

  return { entries, order, timestamp: legacyTimestamp };
}

function pruneCache() {
  const now = Date.now();
  summaryCache.entries = summaryCache.entries || {};
  summaryCache.order = Array.isArray(summaryCache.order)
    ? summaryCache.order
    : [];
  summaryCache.order = summaryCache.order.filter((key) => {
    const entry = summaryCache.entries[key];
    if (!entry || now - entry.timestamp > CACHE_TTL_MS) {
      delete summaryCache.entries[key];
      return false;
    }
    return true;
  });
  while (summaryCache.order.length > CACHE_MAX_ENTRIES) {
    const oldest = summaryCache.order.shift();
    if (oldest) delete summaryCache.entries[oldest];
  }
  summaryCache.timestamp = now;
}

function getCachedSummary(provider, model, url, mode = "regular") {
  const key = makeCacheKey(provider, model, url, mode);
  const entry = summaryCache.entries[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    delete summaryCache.entries[key];
    summaryCache.order = summaryCache.order.filter((k) => k !== key);
    return null;
  }
  return entry.summary;
}

function setCachedSummary(provider, model, url, summary, mode = "regular") {
  const key = makeCacheKey(provider, model, url, mode);
  summaryCache.entries[key] = { summary, timestamp: Date.now() };
  summaryCache.order = (summaryCache.order || []).filter((k) => k !== key);
  summaryCache.order.push(key);
  pruneCache();
}

function setTabStatus(tabId, message, isError = false) {
  const el = document.querySelector(
    `.tab-item[data-tab-id="${tabId}"] .tab-status`,
  );
  if (!el) return;
  if (!message) {
    el.style.display = "none";
    el.textContent = "";
    el.classList.remove("pill", "error", "success");
    return;
  }
  el.textContent = message;
  el.style.display = "inline-block";
  el.classList.add("pill");
  el.classList.toggle("error", isError);
  el.classList.toggle("success", !isError);
}

function updateSummarizeButtonState() {
  const selectedCount = document.querySelectorAll(
    ".tab-checkbox:checked",
  ).length;
  const provider = getCurrentProvider();
  const key = getCurrentApiKey(provider);
  const requiresKey = PROVIDER_REQUIRES_KEY[provider] !== false;
  summarizeSelectedBtn.disabled = selectedCount === 0 || (requiresKey && !key);
}

async function handleProviderChange() {
  const provider = providerSelect.value;
  providerSettings.selectedProvider = provider;
  await applyProviderSelection(provider);
  updateSummarizeButtonState();
  saveProviderSettings();
  clearUnsaved();
}

function handleModelChange() {
  const provider = getCurrentProvider();
  providerSettings.modelByProvider[provider] = modelSelect.value;
  saveProviderSettings();
  updateMetaBadges(provider, modelSelect.value);
  clearUnsaved();
}

function handleToneChange() {
  providerSettings.tone = toneSelect.value;
  saveProviderSettings();
  clearUnsaved();
}

function handleLengthChange() {
  providerSettings.length = lengthSelect.value;
  saveProviderSettings();
  clearUnsaved();
}

async function handleSaveKeys() {
  providerSettings.keys.openai = apiKeyInput.value.trim();
  providerSettings.keys.openrouter = openRouterKeyInput.value.trim();
  if (anthropicKeyInput)
    providerSettings.keys.anthropic = anthropicKeyInput.value.trim();
  if (googleKeyInput)
    providerSettings.keys.google = googleKeyInput.value.trim();
  providerSettings.keys.custom = customApiKeyInput.value.trim();

  providerSettings.extras.openrouter = {
    referer: "",
    title: "sumtab",
  };

  await saveProviderSettings();
  await refreshModelOptions(getCurrentProvider(), { forceRefresh: true });
  updateSummarizeButtonState();
  clearUnsaved();
  updateInlineError("");
  updateApiStatus("Keys saved", true);
}

async function handleSaveProviderSettings() {
  await saveProviderSettings();
  updateSummarizeButtonState();
  clearUnsaved();
  updateInlineError("");
  updateProviderStatus("Provider settings saved", true);
}

async function saveProviderSettings() {
  await chrome.storage.local.set({ providerSettings });
}

function handleThemeChange() {
  const isDarkMode = document.getElementById("darkMode").checked;
  if (isDarkMode) {
    document.body.setAttribute("data-theme", "dark");
    localStorage.setItem("theme", "dark");
  } else {
    document.body.removeAttribute("data-theme");
    localStorage.setItem("theme", "light");
  }
}

function toggleLoader(show) {
  loader.style.display = show ? "block" : "none";
  document.getElementById("main-content").style.display = show
    ? "none"
    : "block";
}

// Loader progress bar functions
function updateLoaderProgress(current, total, tabTitle = "") {
  if (!progressLabel || !progressBar || !progressCount || !progressTab) return;

  const percentage = total > 0 ? (current / total) * 100 : 0;
  progressLabel.textContent =
    current <= total ? `Summarizing tabs...` : `Complete!`;
  progressBar.style.width = `${percentage}%`;
  progressCount.textContent = `${current} / ${total}`;

  if (tabTitle && tabTitle !== "Loading...") {
    progressTab.innerHTML = `Processing: <strong>${escapeHtml(truncateText(tabTitle, 40))}</strong>`;
    progressTab.style.display = "block";
  } else if (tabTitle === "Loading...") {
    progressTab.textContent = "Loading tab content...";
    progressTab.style.display = "block";
  } else {
    progressTab.style.display = "none";
  }
}

function resetLoaderProgress() {
  if (!progressLabel || !progressBar || !progressCount || !progressTab) return;
  progressLabel.textContent = "Summarizing tabs...";
  progressBar.style.width = "0%";
  progressCount.textContent = "0 / 0";
  progressTab.textContent = "";
  progressTab.style.display = "none";
}

// Summary section progress bar functions (for when loader is hidden)
function showSummaryProgress(current, total, tabTitle = "") {
  if (!summaryProgress) return;
  summaryProgress.style.display = "block";
  const percentage = total > 0 ? (current / total) * 100 : 0;
  progressCount.textContent = `${current} / ${total}`;
  progressFill.style.width = `${percentage}%`;
  if (tabTitle) {
    progressTabName.innerHTML = `Current: <strong>${escapeHtml(tabTitle)}</strong>`;
  } else {
    progressTabName.innerHTML = "";
  }
}

function updateSummaryProgress(current, total, tabTitle = "") {
  showSummaryProgress(current, total, tabTitle);
}

function hideSummaryProgress() {
  if (!summaryProgress) return;
  summaryProgress.style.display = "none";
}

// Helper function to truncate text
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

function updateApiStatus(message, success) {
  if (!apiStatus) return;
  apiStatus.textContent = message;
  apiStatus.className = `api-status ${success ? "success" : "error"}`;
  setTimeout(() => {
    apiStatus.textContent = "";
    apiStatus.className = "api-status";
  }, 3000);
}

function updateProviderStatus(message, success) {
  if (!providerStatus) return;
  providerStatus.textContent = message;
  providerStatus.className = `api-status ${success ? "success" : "error"}`;
  setTimeout(() => {
    providerStatus.textContent = "";
    providerStatus.className = "api-status";
  }, 3000);
}

async function loadCachedSummaries() {
  try {
    const data = await chrome.storage.local.get("summaryCache");
    if (data.summaryCache) {
      summaryCache = migrateCache(data.summaryCache);
      pruneCache();
      const provider = getCurrentProvider();
      const model = getCurrentModel(provider);
      const allTabs = await chrome.tabs.query({});
      summaryContent.innerHTML = "";
      for (const tab of allTabs) {
        const regularSummary = getCachedSummary(
          provider,
          model,
          tab.url,
          "regular",
        );
        const bulletSummary = getCachedSummary(
          provider,
          model,
          tab.url,
          "bullets",
        );
        if (regularSummary || bulletSummary) {
          const summaryItem = document.createElement("div");
          summaryItem.className = "summary-item";
          summaryItem.setAttribute("data-tab-id", tab.id);
          summaryItem.innerHTML = `
            <div class="summary-title">${tab.title}</div>
            <div class="summary-text">${regularSummary || bulletSummary || ""}</div>
          `;
          summaryContent.appendChild(summaryItem);
          if (resultsDiv) {
            resultsDiv.style.display = "block";
          }
        }
      }
      if (!summaryContent.hasChildNodes()) {
        if (summaryEmpty) summaryEmpty.style.display = "block";
        if (resultsDiv) resultsDiv.style.display = "none";
      } else if (summaryEmpty) {
        summaryEmpty.style.display = "none";
      }
      await saveSummariesToStorage();
    } else {
      if (summaryEmpty) summaryEmpty.style.display = "block";
      if (resultsDiv) resultsDiv.style.display = "none";
    }
  } catch (error) {
    updateApiStatus("Error loading cached summaries: " + error.message, false);
  }
}

async function saveSummariesToStorage() {
  try {
    pruneCache();
    const cacheWithTimestamp = {
      ...summaryCache,
      timestamp: summaryCache.timestamp || Date.now(),
    };
    await chrome.storage.local.set({ summaryCache: cacheWithTimestamp });
  } catch (error) {
    updateApiStatus("Error saving summaries: " + error.message, false);
  }
}

async function clearOldSummaries() {
  pruneCache();
  await saveSummariesToStorage();
}

async function handleSummarizeSelected() {
  const provider = getCurrentProvider();
  const apiKey = getCurrentApiKey(provider);
  const model = getCurrentModel(provider);
  const extras = { ...getExtras(provider) };
  const systemPrompt = getActiveSystemPrompt();
  const requiresKey = PROVIDER_REQUIRES_KEY[provider] !== false;

  if (requiresKey && !apiKey) {
    updateInlineError("Please enter your API key for the selected provider.");
    updateApiStatus(
      "Please enter your API key for the selected provider.",
      false,
    );
    return;
  }

  const selectedTabs = document.querySelectorAll(".tab-checkbox:checked");
  if (selectedTabs.length === 0) {
    updateInlineError("Select at least one tab to summarize.");
    updateApiStatus("Please select at least one tab to summarize.", false);
    return;
  }

  summarizeSelectedBtn.disabled = true;
  isSummarizingTabs = true;
  toggleLoader(true);
  showSummarySkeleton(true);
  resetLoaderProgress();
  updateLoaderProgress(0, selectedTabs.length, "");
  hideSummaryProgress();
  updateInlineError("");
  updateApiStatus("Summarizing selected tabs...", true);

  try {
    const total = selectedTabs.length;
    for (let i = 0; i < selectedTabs.length; i += 1) {
      const checkbox = selectedTabs[i];
      const tabId = parseInt(checkbox.getAttribute("data-tab-id"), 10);
      const tabElement = document.querySelector(
        `.tab-item[data-tab-id="${tabId}"]`,
      );
      let spinner;
      try {
        updateLoaderProgress(i + 1, total, "Loading...");
        updateApiStatus(
          `Summarizing ${i + 1} of ${total} tab${total === 1 ? "" : "s"}...`,
          true,
        );
        setTabStatus(tabId, "Summarizing...", false);
        spinner = document.createElement("div");
        spinner.className = "loader-spinner small";
        tabElement?.appendChild(spinner);

        const response = await chrome.runtime.sendMessage({
          action: "summarizeTab",
          tabId,
          apiKey,
          model,
          provider,
          extras,
          systemPrompt,
        });

        if (response.error) {
          const err = response.error;
          const providerLabel = err.provider ? ` [${err.provider}]` : "";
          const statusLabel = err.status ? ` (status ${err.status})` : "";
          const detail = err.details?.error?.message || err.details?.message;
          const msg = err.error || err.message || detail || "Unknown error";
          throw new Error(
            `Provider error${providerLabel}${statusLabel}: ${msg}`,
          );
        }

        const tab = await chrome.tabs.get(tabId);
        updateLoaderProgress(i + 1, total, tab.title);
        await updateTabSummary(tabId, response.summary, provider, model, false);
        setTabStatus(tabId, "Done", false);
      } catch (error) {
        setTabStatus(tabId, error.message, true);
        updateApiStatus(`Error summarizing tab: ${error.message}`, false);
        updateInlineError(error.message);
      } finally {
        if (spinner) spinner.remove();
      }
    }
    updateApiStatus("Summarization complete!", true);
    updateInlineError("");
  } catch (error) {
    updateApiStatus("Error: " + error.message, false);
    updateInlineError(error.message || "Unable to summarize tabs.");
  } finally {
    toggleLoader(false);
    showSummarySkeleton(false);
    resetLoaderProgress();
    hideSummaryProgress();
    summarizeSelectedBtn.disabled = false;
    isSummarizingTabs = false;
    if (pendingTabRefresh && !document.hidden) {
      pendingTabRefresh = false;
      scheduleTabRefresh();
    }
  }
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function updateTabSummary(
  tabId,
  summary,
  provider,
  model,
  isBulletStyle = false,
) {
  const items = summaryContent.querySelectorAll(".summary-item");
  const existingItem = Array.from(items).find(
    (item) => parseInt(item.getAttribute("data-tab-id"), 10) === tabId,
  );
  try {
    const tab = await chrome.tabs.get(tabId);
    const mode = isBulletStyle ? "bullets" : "regular";
    setCachedSummary(provider, model, tab.url, summary, mode);

    if (existingItem) {
      existingItem.querySelector(".summary-text").textContent = summary;
    } else {
      const summaryItem = document.createElement("div");
      summaryItem.className = "summary-item";
      summaryItem.setAttribute("data-tab-id", tabId);
      summaryItem.innerHTML = `
        <div class="summary-title">${tab.title}</div>
        <div class="summary-text">${summary}</div>
      `;
      summaryContent.appendChild(summaryItem);
    }

    if (resultsDiv) {
      resultsDiv.style.display = "block";
    }
    if (summaryEmpty) summaryEmpty.style.display = "none";
    await saveSummariesToStorage();
  } catch (error) {
    updateApiStatus("Error updating summary: " + error.message, false);
  }
}

async function toggleSummaryMode() {
  const provider = getCurrentProvider();
  const apiKey = getCurrentApiKey(provider);
  const model = getCurrentModel(provider);
  const extras = { ...getExtras(provider) };
  const requiresKey = PROVIDER_REQUIRES_KEY[provider] !== false;
  const isBulletMode = bulletsBtn.classList.contains("active");

  if (isBulletMode) {
    // Switch back to regular summary
    bulletsBtn.classList.remove("active");
    const buttonContent = bulletsBtn.querySelector(".button-content");
    if (buttonContent) buttonContent.textContent = "Bullets";
    bulletsBtn.title = "Toggle bullet points";

    const items = summaryContent.querySelectorAll(".summary-item");
    for (const item of items) {
      const tabId = parseInt(item.getAttribute("data-tab-id"), 10);
      const tab = await chrome.tabs.get(tabId);
      const cachedRegular = getCachedSummary(
        provider,
        model,
        tab.url,
        "regular",
      );
      if (cachedRegular) {
        item.querySelector(".summary-text").textContent = cachedRegular;
      }
    }
    bulletsBtn.disabled = false;
    updateApiStatus("Switched to summary view", true);
    return;
  }

  if (requiresKey && !apiKey) {
    updateInlineError("Please enter your API key first.");
    updateApiStatus("Please enter your API key first.", false);
    return;
  }

  bulletsBtn.disabled = true;
  showSummarySkeleton(true);

  // Update progress bar for bullet point creation
  if (progressLabel) {
    progressLabel.textContent = "Creating bullet points...";
  }
  if (progressBar) {
    progressBar.style.width = "100%";
  }
  if (progressCount) {
    progressCount.textContent = "";
  }
  if (progressTab) {
    progressTab.style.display = "none";
  }

  try {
    const items = summaryContent.querySelectorAll(".summary-item");
    for (const item of items) {
      const tabId = parseInt(item.getAttribute("data-tab-id"), 10);
      const tab = await chrome.tabs.get(tabId);
      const currentText = item.querySelector(".summary-text").textContent;

      const cachedBullets = getCachedSummary(
        provider,
        model,
        tab.url,
        "bullets",
      );
      const cachedRegular = getCachedSummary(
        provider,
        model,
        tab.url,
        "regular",
      );

      if (cachedBullets) {
        bulletsBtn.classList.add("active");
        if (currentText === cachedBullets && cachedRegular) {
          item.querySelector(".summary-text").textContent = cachedRegular;
        } else {
          item.querySelector(".summary-text").textContent = cachedBullets;
        }
        continue;
      }

      toggleLoader(true);
      updateApiStatus("Converting to bullet points...", true);
      const response = await chrome.runtime.sendMessage({
        action: "summarizeText",
        text: `Convert this summary into a concise bullet-point format, focusing on the key points. Keep each bullet point brief and clear. Original summary: ${currentText}`,
        apiKey,
        model,
        provider,
        extras,
      });

      if (response.error) {
        const err = response.error;
        const providerLabel = err.provider ? ` [${err.provider}]` : "";
        const statusLabel = err.status ? ` (status ${err.status})` : "";
        const detail = err.details?.error?.message || err.details?.message;
        const msg = err.error || err.message || detail || "Unknown error";
        throw new Error(`Provider error${providerLabel}${statusLabel}: ${msg}`);
      }

      bulletsBtn.classList.add("active");
      await updateTabSummary(tabId, response.summary, provider, model, true);
    }
  } catch (error) {
    updateApiStatus("Error converting summaries: " + error.message, false);
    updateInlineError(error.message || "Unable to convert summaries.");
  } finally {
    bulletsBtn.disabled = false;
    toggleLoader(false);
    showSummarySkeleton(false);
    resetLoaderProgress();
    // Update button text based on mode
    if (bulletsBtn.classList.contains("active")) {
      const buttonContent = bulletsBtn.querySelector(".button-content");
      if (buttonContent) buttonContent.textContent = "Summary";
      bulletsBtn.title = "Toggle back to summary";
    }
  }
}

function getAllSummariesText() {
  const summaries = [];
  summaryContent.querySelectorAll(".summary-item").forEach((item) => {
    const title = item.querySelector(".summary-title").textContent;
    const text = item.querySelector(".summary-text").textContent;
    summaries.push(`${title}\n${text}\n`);
  });
  return summaries.join("\n");
}

async function handleClear() {
  summaryContent.innerHTML = "";

  if (summaryEmpty) summaryEmpty.style.display = "block";

  if (resultsDiv) {
    resultsDiv.style.display = "block";
  }
  summaryCache = {
    entries: {},
    order: [],
    timestamp: Date.now(),
  };

  await chrome.storage.local.remove("summaryCache");

  updateApiStatus("Summaries cleared", true);

  updateInlineError("");
}

function handleCopy() {
  const text = getAllSummariesText();
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.classList.add("copied");
    setTimeout(() => copyBtn.classList.remove("copied"), 2000);
  });
}

function handleOpenInNewTab() {
  const text = getAllSummariesText();
  if (!text) return;
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  chrome.tabs.create({ url }, () => URL.revokeObjectURL(url));
}
