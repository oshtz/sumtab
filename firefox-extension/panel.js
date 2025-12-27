// Panel mode detection
const PANEL_MODE = document.body.getAttribute("data-panel-mode") || "popup";
const IS_SIDEBAR = PANEL_MODE === "sidebar";

const darkModeToggle = document.getElementById("darkMode");
const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

const apiConfigSection = document.getElementById("apiConfig");
const modelStyleSection = document.getElementById("modelStyle");
const systemPromptsSection = document.getElementById("systemPrompts");
const panelSettingsSection = document.getElementById("panelSettings");

const providerSelect = document.getElementById("providerSelect");
const apiKeyInput = document.getElementById("apiKey");
const openRouterKeyInput = document.getElementById("openRouterKey");
const anthropicKeyInput = document.getElementById("anthropicKey");
const googleKeyInput = document.getElementById("googleKey");
const customApiKeyInput = document.getElementById("customApiKey");
const saveApiKeyBtn = document.getElementById("saveApiKey");
const saveProviderSettingsBtn = document.getElementById("saveProviderSettings");

const modelSelect = document.getElementById("model");
const toneSelect = document.getElementById("toneSelect");
const lengthSelect = document.getElementById("lengthSelect");

const tabList = document.getElementById("tabList");
const summarizeBtn = document.getElementById("summarizeBtn");
const selectAllBtn = document.getElementById("selectAll");
const deselectAllBtn = document.getElementById("deselectAll");

const resultsCard = document.getElementById("results-card");
const summaryContent = document.getElementById("summary-content");
const summarySkeleton = document.getElementById("summarySkeleton");
const summaryEmpty = document.getElementById("summaryEmpty");
const summaryProgress = document.getElementById("summaryProgress");
const progressCount = document.getElementById("progressCount");
const progressFill = document.getElementById("progressFill");
const progressTabName = document.getElementById("progressTabName");

// Loader progress bar elements
const progressLabel = document.getElementById("progressLabel");
const progressBar = document.getElementById("progressBar");
const progressCountEl = document.getElementById("progressCount");
const progressTabEl = document.getElementById("progressTab");

const openInNewTabBtn = document.getElementById("openInNewTab");
const bulletsBtn = document.getElementById("bullets-btn");
const copyBtn = document.getElementById("copy");
const clearBtn = document.getElementById("clear-btn");
const loader = document.getElementById("loader");
const apiStatus = document.getElementById("apiStatus");
const providerStatus = document.getElementById("providerStatus");
const metaProvider = document.getElementById("metaProvider");
const metaModel = document.getElementById("metaModel");
const tabEmpty = document.getElementById("tabEmpty");

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
const TAB_REFRESH_DEBOUNCE_MS = 200;

const DEFAULT_SYSTEM_PROMPT = {
  id: "default",
  name: "Default",
  content:
    "You are a helpful assistant that summarizes text content concisely.",
  isDefault: true,
};

let tabs = [];
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
  extras: { openrouter: { referer: "", title: "sumtab" }, custom: {} },
  tone: "neutral",
  length: "medium",
};
let tabRefreshTimer = null;
let isRefreshingTabs = false;
let isSummarizingTabs = false;
let pendingTabRefresh = false;
let modelRefreshToken = 0;
let lastUserInteraction = 0;
const USER_INTERACTION_COOLDOWN_MS = 500;

let systemPromptSettings = {
  prompts: [DEFAULT_SYSTEM_PROMPT],
  selectedId: "default",
};

let panelSettings = {
  defaultMode: "sidebar",
};

const collapseStates = {
  apiConfig: true,
  modelStyle: true,
  systemPrompts: false,
  panelSettings: false,
};

(function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark" || (!savedTheme && prefersDarkScheme.matches)) {
    document.body.setAttribute("data-theme", "dark");
    if (darkModeToggle) darkModeToggle.checked = true;
  }
})();

if (darkModeToggle) {
  darkModeToggle.addEventListener("change", () => {
    if (darkModeToggle.checked) {
      document.body.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await loadTabs();
  restoreSummaries();
  setupEventListeners();
  updateSummarizeButtonState();
  initSystemPrompts();
  initPanelSettings();
});

function setupEventListeners() {
  saveApiKeyBtn?.addEventListener("click", handleSaveKeys);
  saveProviderSettingsBtn?.addEventListener(
    "click",
    handleSaveProviderSettings,
  );
  providerSelect?.addEventListener("change", handleProviderChange);
  modelSelect?.addEventListener("change", handleModelChange);
  toneSelect?.addEventListener("change", handleToneChange);
  lengthSelect?.addEventListener("change", handleLengthChange);

  apiConfigSection?.addEventListener("toggle", () =>
    handleCollapseToggle("apiConfig", apiConfigSection),
  );
  modelStyleSection?.addEventListener("toggle", () =>
    handleCollapseToggle("modelStyle", modelStyleSection),
  );
  systemPromptsSection?.addEventListener("toggle", () =>
    handleCollapseToggle("systemPrompts", systemPromptsSection),
  );
  panelSettingsSection?.addEventListener("toggle", () =>
    handleCollapseToggle("panelSettings", panelSettingsSection),
  );

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

  summarizeBtn?.addEventListener("click", summarizeSelectedTabs);
  openInNewTabBtn?.addEventListener("click", openInNewTab);
  copyBtn?.addEventListener("click", copySummary);
  clearBtn?.addEventListener("click", clearSummaries);
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
  const stored = await browser.storage.local.get([
    "providerSettings",
    "regularSummary",
    "bulletSummary",
    "isBulletMode",
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
  }

  if (stored.systemPromptSettings) {
    systemPromptSettings = {
      prompts: stored.systemPromptSettings.prompts || [DEFAULT_SYSTEM_PROMPT],
      selectedId: stored.systemPromptSettings.selectedId || "default",
    };
    if (!systemPromptSettings.prompts.find((p) => p.id === "default")) {
      systemPromptSettings.prompts.unshift(DEFAULT_SYSTEM_PROMPT);
    }
  }

  if (stored.panelSettings) {
    panelSettings = { ...panelSettings, ...stored.panelSettings };
  }

  if (providerSelect)
    providerSelect.value =
      providerSettings.selectedProvider || DEFAULT_PROVIDER;
  providerSettings.tone = providerSettings.tone || "neutral";
  providerSettings.length = providerSettings.length || "medium";
  if (toneSelect) toneSelect.value = providerSettings.tone;
  if (lengthSelect) lengthSelect.value = providerSettings.length;
  if (apiKeyInput) apiKeyInput.value = providerSettings.keys.openai || "";
  if (openRouterKeyInput)
    openRouterKeyInput.value = providerSettings.keys.openrouter || "";
  if (anthropicKeyInput)
    anthropicKeyInput.value = providerSettings.keys.anthropic || "";
  if (googleKeyInput) googleKeyInput.value = providerSettings.keys.google || "";
  if (customApiKeyInput)
    customApiKeyInput.value = providerSettings.keys.custom || "";

  if (stored.collapseStates) {
    Object.keys(collapseStates).forEach((key) => {
      if (typeof stored.collapseStates[key] === "boolean") {
        collapseStates[key] = stored.collapseStates[key];
        const section = document.getElementById(key);
        if (section) section.open = collapseStates[key];
      }
    });
  }

  await applyProviderSelection(getCurrentProvider());
}

function initSystemPrompts() {
  if (!promptSelect) return;
  refreshPromptSelect();
  const selectedPrompt = systemPromptSettings.prompts.find(
    (p) => p.id === systemPromptSettings.selectedId,
  );
  if (selectedPrompt) {
    if (promptName) promptName.value = selectedPrompt.name;
    if (promptContent) promptContent.value = selectedPrompt.content;
    updateDeleteButtonState();
  }
}

function initPanelSettings() {
  if (panelModeSelect) {
    panelModeSelect.value = panelSettings.defaultMode || "sidebar";
  }
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
    if (promptName) promptName.value = prompt.name;
    if (promptContent) promptContent.value = prompt.content;
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
    name: isDefault ? "Default" : promptName?.value.trim() || "Unnamed Prompt",
    content: promptContent?.value.trim() || DEFAULT_SYSTEM_PROMPT.content,
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
  if (promptName) promptName.value = newPrompt.name;
  if (promptContent) promptContent.value = newPrompt.content;
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
  await browser.storage.local.set({ systemPromptSettings });
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
  if (!panelModeSelect) return;
  panelSettings.defaultMode = panelModeSelect.value;
  await savePanelSettings();
  updatePanelStatus(`Default mode set to ${panelSettings.defaultMode}`, true);
}

async function handleSwitchToSidebar() {
  if (!browser.sidebarAction?.open) {
    updatePanelStatus("Sidebar switching is not supported in this browser.", false);
    return;
  }
  try {
    await browser.sidebarAction.open();
    updatePanelStatus("Opening sidebar...", true);
    if (!IS_SIDEBAR) {
      setTimeout(() => window.close(), 500);
    }
  } catch (error) {
    updatePanelStatus(`Failed to open sidebar: ${error.message}`, false);
  }
}

async function handleSwitchToPopup() {
  if (!browser.browserAction?.openPopup) {
    updatePanelStatus("Popup switching is not supported in this browser.", false);
    return;
  }
  try {
    await browser.browserAction.openPopup();
    updatePanelStatus("Opening popup...", true);
  } catch (error) {
    updatePanelStatus(`Failed to open popup: ${error.message}`, false);
  }
}

async function savePanelSettings() {
  await browser.storage.local.set({ panelSettings });
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

function getActiveSystemPrompt() {
  const prompt = systemPromptSettings.prompts.find(
    (p) => p.id === systemPromptSettings.selectedId,
  );
  return prompt?.content || DEFAULT_SYSTEM_PROMPT.content;
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

async function requestProviderModels(provider, options = {}) {
  const apiKey = providerSettings.keys[provider] || "";
  const extras = getModelListExtras(provider);
  try {
    const response = await browser.runtime.sendMessage({
      action: "listModels",
      provider,
      apiKey,
      extras,
      forceRefresh: options.forceRefresh === true,
    });
    return response || { models: [], source: "error" };
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

  while (modelSelect.firstChild)
    modelSelect.removeChild(modelSelect.firstChild);

  const loadingOption = document.createElement("option");
  loadingOption.value = "";
  loadingOption.textContent = "Loading models...";
  modelSelect.appendChild(loadingOption);

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

  while (modelSelect.firstChild)
    modelSelect.removeChild(modelSelect.firstChild);

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
    opt.textContent = "Enter a custom model via settings";
    modelSelect.appendChild(opt);
  }
  if (desired !== undefined) modelSelect.value = desired;
}

async function applyProviderSelection(provider, options = {}) {
  const groups = {
    openai: ["apiKey"],
    openrouter: ["openRouterKey"],
    anthropic: ["anthropicKey"],
    google: ["googleKey"],
    custom: ["customApiKey"],
  };
  const ids = [
    "apiKey",
    "openRouterKey",
    "anthropicKey",
    "googleKey",
    "customApiKey",
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const group = el.closest(".input-group");
    if (!group) return;
    group.style.display = groups[provider]?.includes(id) ? "" : "none";
  });
  await refreshModelOptions(provider, options);
  updateSummarizeButtonState();
  updateMetaBadges(provider, modelSelect?.value);
  saveProviderSettings();
}

function getCurrentProvider() {
  return (
    providerSelect?.value ||
    providerSettings.selectedProvider ||
    DEFAULT_PROVIDER
  );
}

function getCurrentModel() {
  const provider = getCurrentProvider();
  return (
    providerSettings.modelByProvider[provider] ||
    PROVIDER_DEFAULT_MODEL[provider]
  );
}

function getCurrentApiKey() {
  const provider = getCurrentProvider();
  return providerSettings.keys[provider] || "";
}

function getStyleExtras() {
  const tone = providerSettings.tone || "neutral";
  const length = providerSettings.length || "medium";
  const temperatureMap = { concise: 0.4, neutral: 0.7, detailed: 0.9 };
  const maxTokensMap = { short: 200, medium: 400, long: 800 };
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
    return { ...styleExtras, referer: "", title: "sumtab" };
  }
  return styleExtras;
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
  for (let i = 0; i < count; i++) {
    const skel = document.createElement("div");
    skel.className = "tab-item skeleton";
    skel.innerHTML =
      '<div class="tab-favicon"></div><div class="tab-title skeleton-bar"></div>';
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

async function handleSaveKeys() {
  providerSettings.keys.openai = apiKeyInput?.value.trim() || "";
  providerSettings.keys.openrouter = openRouterKeyInput?.value.trim() || "";
  providerSettings.keys.anthropic = anthropicKeyInput?.value.trim() || "";
  providerSettings.keys.google = googleKeyInput?.value.trim() || "";
  providerSettings.keys.custom = customApiKeyInput?.value.trim() || "";
  providerSettings.extras.openrouter = { referer: "", title: "sumtab" };
  await saveProviderSettings();
  await refreshModelOptions(getCurrentProvider(), { forceRefresh: true });
  updateApiStatus("Keys saved", true);
  updateSummarizeButtonState();
}

async function handleSaveProviderSettings() {
  await saveProviderSettings();
  updateProviderStatus("Provider settings saved", true);
}

async function handleProviderChange() {
  providerSettings.selectedProvider = getCurrentProvider();
  await applyProviderSelection(providerSettings.selectedProvider);
}

function handleModelChange() {
  const provider = getCurrentProvider();
  if (modelSelect)
    providerSettings.modelByProvider[provider] = modelSelect.value;
  saveProviderSettings();
  updateMetaBadges(provider, modelSelect?.value);
}

function handleToneChange() {
  if (toneSelect) providerSettings.tone = toneSelect.value;
  saveProviderSettings();
}

function handleLengthChange() {
  if (lengthSelect) providerSettings.length = lengthSelect.value;
  saveProviderSettings();
}

async function saveProviderSettings() {
  await browser.storage.local.set({ providerSettings });
}

function updateSummarizeButtonState() {
  const hasSelection = getSelectedTabs().length > 0;
  const provider = getCurrentProvider();
  const hasKey = !!getCurrentApiKey();
  const requiresKey = PROVIDER_REQUIRES_KEY[provider] !== false;
  if (summarizeBtn)
    summarizeBtn.disabled = !(hasSelection && (!requiresKey || hasKey));
}

function handleCollapseToggle(key, el) {
  if (!el) return;
  collapseStates[key] = el.open;
  browser.storage.local.set({ collapseStates });
}

async function loadTabs() {
  try {
    showTabSkeletons();
    const allTabs = await browser.tabs.query({});
    tabs = allTabs;
    renderTabs(tabs);
  } catch (error) {
    updateApiStatus("Error loading tabs: " + error.message, false);
  }
}

function renderTabs(tabArray = []) {
  if (!tabList) return;
  tabList.innerHTML = "";
  if (!tabArray.length) {
    if (tabEmpty) tabEmpty.style.display = "block";
    updateSummarizeButtonState();
    return;
  }
  if (tabEmpty) tabEmpty.style.display = "none";
  tabArray.forEach((tab) => {
    const tabItem = createTabItem(tab);
    tabList.appendChild(tabItem);
  });
  updateSummarizeButtonState();
}

function createTabItem(tab) {
  const tabItem = document.createElement("div");
  tabItem.className = "tab-item";
  tabItem.setAttribute("data-tab-id", tab.id);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "tab-checkbox";
  checkbox.dataset.tabId = tab.id;

  const favicon = document.createElement("img");
  favicon.src = tab.favIconUrl || "default-favicon.png";
  favicon.className = "tab-favicon";
  favicon.onerror = () => (favicon.src = "default-favicon.png");

  const title = document.createElement("span");
  title.className = "tab-title";
  title.textContent = tab.title;

  const statusSpan = document.createElement("span");
  statusSpan.className = "tab-status";
  statusSpan.textContent = "";
  statusSpan.style.display = "none";

  tabItem.appendChild(checkbox);
  tabItem.appendChild(favicon);
  tabItem.appendChild(title);
  tabItem.appendChild(statusSpan);

  tabItem.addEventListener("click", (e) => {
    if (e.target !== checkbox) {
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change"));
    }
  });

  checkbox.addEventListener("change", () => {
    tabItem.classList.toggle("selected", checkbox.checked);
    updateSummarizeButtonState();
  });

  return tabItem;
}

function getSelectedTabs() {
  const selectedCheckboxes = document.querySelectorAll(".tab-checkbox:checked");
  return Array.from(selectedCheckboxes)
    .map((checkbox) => {
      const tabId = parseInt(checkbox.dataset.tabId, 10);
      return tabs.find((t) => t.id === tabId);
    })
    .filter(Boolean);
}

function toggleLoader(show) {
  if (loader) loader.style.display = show ? "block" : "none";
  const main = document.getElementById("main-content");
  if (main) main.style.filter = show ? "blur(4px)" : "none";
  if (show) {
    window.scrollTo({ top: 0 });
  }
  document.body.classList.toggle("loading", show);
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

// Loader progress bar functions
function updateLoaderProgress(current, total, tabTitle = "") {
  if (!progressLabel || !progressBar || !progressCountEl || !progressTabEl)
    return;

  const percentage = total > 0 ? (current / total) * 100 : 0;
  progressLabel.textContent =
    current <= total ? `Summarizing tabs...` : `Complete!`;
  progressBar.style.width = `${percentage}%`;
  progressCountEl.textContent = `${current} / ${total}`;

  if (tabTitle && tabTitle !== "Loading...") {
    progressTabEl.innerHTML = `Processing: <strong>${escapeHtml(truncateText(tabTitle, 40))}</strong>`;
    progressTabEl.style.display = "block";
  } else if (tabTitle === "Loading...") {
    progressTabEl.textContent = "Loading tab content...";
    progressTabEl.style.display = "block";
  } else {
    progressTabEl.style.display = "none";
  }
}

function resetLoaderProgress() {
  if (!progressLabel || !progressBar || !progressCountEl || !progressTabEl)
    return;
  progressLabel.textContent = "Summarizing tabs...";
  progressBar.style.width = "0%";
  progressCountEl.textContent = "0 / 0";
  progressTabEl.textContent = "";
  progressTabEl.style.display = "none";
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Helper function to truncate text
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

async function summarizeSelectedTabs() {
  const selected = getSelectedTabs();
  if (selected.length === 0) {
    updateApiStatus("No tabs selected", false);
    return;
  }
  const provider = getCurrentProvider();
  const model = getCurrentModel();
  const extras = { ...getExtras(provider) };
  const apiKey = getCurrentApiKey();
  const systemPrompt = getActiveSystemPrompt();
  const requiresKey = PROVIDER_REQUIRES_KEY[provider] !== false;

  if (requiresKey && !apiKey) {
    updateApiStatus("Please enter an API key", false);
    return;
  }

  if (summaryEmpty) summaryEmpty.style.display = "none";
  if (summarizeBtn) summarizeBtn.disabled = true;
  isSummarizingTabs = true;
  toggleLoader(true);
  showSummarySkeleton(true);
  resetLoaderProgress();
  updateLoaderProgress(0, selected.length, "");
  updateApiStatus("Summarizing tabs...", true);

  try {
    const summaries = [];
    const total = selected.length;

    for (let index = 0; index < selected.length; index++) {
      const tab = selected[index];
      try {
        updateLoaderProgress(index + 1, total, "Loading...");
        updateApiStatus(
          `Summarizing ${index + 1} of ${total} tab${total === 1 ? "" : "s"}...`,
          true,
        );
        setTabStatus(tab.id, "Summarizing...", false);
        const summary = await summarizeTab(
          tab,
          apiKey,
          model,
          provider,
          extras,
          systemPrompt,
        );
        updateLoaderProgress(index + 1, total, tab.title);
        if (summary) {
          summaries.push(`### ${tab.title}\n\n${summary}\n`);
          setTabStatus(tab.id, "Done", false);
        } else {
          setTabStatus(tab.id, "No summary", true);
        }
      } catch (error) {
        setTabStatus(tab.id, error.message, true);
        updateApiStatus(
          `Error summarizing ${tab.title}: ${error.message}`,
          false,
        );
      }
    }

    if (summaries.length > 0) {
      const combined = summaries.join("\n\n---\n\n");
      setSummaryContent(combined, false);
      await browser.storage.local.set({
        regularSummary: combined,
        isBulletMode: false,
      });
      updateApiStatus("Summaries generated successfully", true);
    } else {
      updateApiStatus("No summaries were generated", false);
      if (resultsCard) resultsCard.style.display = "block";
      if (summaryEmpty) summaryEmpty.style.display = "block";
    }
  } catch (error) {
    updateApiStatus("Error: " + error.message, false);
  } finally {
    if (summarizeBtn) summarizeBtn.disabled = false;
    toggleLoader(false);
    showSummarySkeleton(false);
    resetLoaderProgress();
    isSummarizingTabs = false;
    if (pendingTabRefresh && !document.hidden) {
      pendingTabRefresh = false;
      scheduleTabRefresh();
    }
  }
}

async function summarizeTab(
  tab,
  apiKey,
  model,
  provider,
  extras,
  systemPrompt,
) {
  try {
    await browser.tabs
      .executeScript(tab.id, { file: "content.js" })
      .catch(() => {});
    const response = await browser.tabs.sendMessage(tab.id, {
      action: "getContent",
    });
    if (!response || !response.success || !response.content) {
      throw new Error("No content found");
    }
    const pageContent = `Title: ${tab.title}\n\nContent:\n${response.content}`;
    const apiResponse = await browser.runtime.sendMessage({
      action: "summarizeText",
      text: pageContent,
      apiKey,
      model,
      provider,
      extras,
      systemPrompt,
    });
    if (apiResponse.error) {
      const err = apiResponse.error;
      const providerLabel = err.provider ? ` [${err.provider}]` : "";
      const statusLabel = err.status ? ` (status ${err.status})` : "";
      const detail = err.details?.error?.message || err.details?.message;
      const msg = err.error || err.message || detail || "Unknown error";
      throw new Error(`Provider error${providerLabel}${statusLabel}: ${msg}`);
    }
    return apiResponse.summary;
  } catch (error) {
    throw error;
  }
}

function setSummaryContent(content, isBulletMode) {
  if (!summaryContent) return;
  sanitizeAndSetContent(summaryContent, content, isBulletMode);
  if (resultsCard) resultsCard.style.display = "block";
  if (summaryEmpty) summaryEmpty.style.display = "none";
  showSummarySkeleton(false);
}

function sanitizeAndSetContent(element, content, isBulletMode = false) {
  const sanitizedContent = content
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const container = document.createElement("div");

  if (isBulletMode) {
    const bulletPoints = sanitizedContent
      .split("\n")
      .filter((point) => point.trim());
    const ul = document.createElement("ul");
    bulletPoints.forEach((point) => {
      const li = document.createElement("li");
      li.textContent = point.trim().replace(/^[•\-*]\s*/, "");
      ul.appendChild(li);
    });
    container.appendChild(ul);
  } else {
    const paragraphs = sanitizedContent.split("\n\n");
    paragraphs.forEach((para) => {
      if (para.trim()) {
        const p = document.createElement("p");
        p.textContent = para.trim();
        container.appendChild(p);
      }
    });
  }

  while (element.firstChild) element.removeChild(element.firstChild);
  element.appendChild(container);
}

function updateBulletsButton(label, title) {
  if (!bulletsBtn) return;
  const buttonContent = bulletsBtn.querySelector(".button-content");
  if (buttonContent) {
    buttonContent.textContent = label;
  } else {
    bulletsBtn.textContent = label;
  }
  if (title) bulletsBtn.title = title;
}

async function convertToBulletPoints() {
  const stored = await browser.storage.local.get([
    "regularSummary",
    "bulletSummary",
    "isBulletMode",
  ]);
  if (stored.bulletSummary) {
    setSummaryContent(stored.bulletSummary, true);
    if (bulletsBtn) bulletsBtn.classList.add("active");
    await browser.storage.local.set({ isBulletMode: true });
    return;
  }

  const regular = stored.regularSummary || summaryContent?.textContent;
  if (!regular) {
    updateApiStatus("No content to convert", false);
    return;
  }

  const provider = getCurrentProvider();
  const apiKey = getCurrentApiKey();
  const model = getCurrentModel();
  const extras = { ...getExtras(provider) };

  const requiresKey = PROVIDER_REQUIRES_KEY[provider] !== false;
  if (requiresKey && !apiKey) {
    updateApiStatus("Please enter an API key", false);
    return;
  }

  try {
    toggleLoader(true);
    if (bulletsBtn) bulletsBtn.disabled = true;
    updateApiStatus("Converting to bullet points...", true);

    const response = await browser.runtime.sendMessage({
      action: "summarizeText",
      text: `Convert this summary into concise bullet points:\n\n${regular}`,
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

    const bulletPoints = response.summary;
    await browser.storage.local.set({
      regularSummary: regular,
      bulletSummary: bulletPoints,
      isBulletMode: true,
    });

    setSummaryContent(bulletPoints, true);
    if (bulletsBtn) {
      bulletsBtn.classList.add("active");
      updateBulletsButton("Summary", "Toggle back to summary");
    }
    updateApiStatus("Converted to bullet points", true);
  } catch (error) {
    updateApiStatus("Error converting: " + error.message, false);
  } finally {
    toggleLoader(false);
    if (bulletsBtn) bulletsBtn.disabled = false;
  }
}

async function toggleSummaryMode() {
  const stored = await browser.storage.local.get([
    "regularSummary",
    "bulletSummary",
    "isBulletMode",
  ]);
  const isBullet = bulletsBtn?.classList.contains("active");

  if (isBullet) {
    // Switch back to regular summary
    setSummaryContent(stored.regularSummary || "", false);
    if (bulletsBtn) {
      bulletsBtn.classList.remove("active");
      updateBulletsButton("Bullets", "Convert to bullet points");
    }
    await browser.storage.local.set({ isBulletMode: false });
    updateApiStatus("Switched to summary view", true);
  } else {
    // Update progress bar for bullet point creation
    if (progressLabel) {
      progressLabel.textContent = "Creating bullet points...";
    }
    if (progressBar) {
      progressBar.style.width = "100%";
    }
    if (progressCountEl) {
      progressCountEl.textContent = "";
    }
    if (progressTabEl) {
      progressTabEl.style.display = "none";
    }

    if (stored.bulletSummary) {
      setSummaryContent(stored.bulletSummary, true);
      if (bulletsBtn) {
        bulletsBtn.classList.add("active");
        updateBulletsButton("Summary", "Toggle back to summary");
      }
      await browser.storage.local.set({ isBulletMode: true });
      resetLoaderProgress();
    } else {
      await convertToBulletPoints();
      resetLoaderProgress();
      // Update button to show "Summary" when in bullet mode
      if (bulletsBtn && bulletsBtn.classList.contains("active")) {
        updateBulletsButton("Summary", "Toggle back to summary");
      }
    }
  }
}

function restoreSummaries() {
  browser.storage.local
    .get(["regularSummary", "bulletSummary", "isBulletMode"])
    .then((stored) => {
      if (stored.regularSummary || stored.bulletSummary) {
        if (resultsCard) resultsCard.style.display = "block";
        const useBullets = stored.isBulletMode && stored.bulletSummary;
        setSummaryContent(
          useBullets ? stored.bulletSummary : stored.regularSummary,
          !!useBullets,
        );
        if (useBullets && bulletsBtn) {
          bulletsBtn.classList.add("active");
          updateBulletsButton("Summary", "Toggle back to summary");
        }
        updateApiStatus("Loaded cached summary", true);
      } else {
        if (resultsCard) resultsCard.style.display = "block";
        if (summaryEmpty) summaryEmpty.style.display = "block";
      }
    });
}

async function clearSummaries() {
  if (summaryContent) summaryContent.innerHTML = "";
  if (resultsCard) resultsCard.style.display = "block";
  if (bulletsBtn) bulletsBtn.classList.remove("active");
  if (summaryEmpty) summaryEmpty.style.display = "block";
  if (bulletsBtn) {
    bulletsBtn.classList.remove("active");
    updateBulletsButton("Bullets", "Convert to bullet points");
  }
  await browser.storage.local.remove([
    "regularSummary",
    "bulletSummary",
    "isBulletMode",
  ]);
  updateApiStatus("Cleared summaries", true);
}

async function copySummary() {
  const content = summaryContent?.textContent;
  if (!content) {
    updateApiStatus("No content to copy", false);
    return;
  }
  try {
    await navigator.clipboard.writeText(content);
    if (copyBtn) {
      copyBtn.classList.add("copied");
      setTimeout(() => copyBtn.classList.remove("copied"), 2000);
    }
    updateApiStatus("Copied to clipboard", true);
  } catch (error) {
    updateApiStatus("Failed to copy", false);
  }
}

function openInNewTab() {
  const content = summaryContent?.textContent;
  if (!content) {
    updateApiStatus("No content to open", false);
    return;
  }
  const blob = new Blob([content], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  browser.tabs.create({ url });
}
