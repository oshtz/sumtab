const MAX_CHARS = 12000;
const TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 2000;
const MAX_INJECT_RETRIES = 3;
const MAX_PROVIDER_RETRIES = 1;
const RETRY_BACKOFF_MS = 1000;
const MODEL_CACHE_KEY = "providerModelCache";
const MODEL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant that summarizes text content concisely.";

const PROVIDERS = {
  openai: {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    requiresApiKey: true,
    headers: (apiKey) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openrouter/openai/gpt-4o-mini",
    requiresApiKey: true,
    headers: (apiKey, extras = {}) => ({
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": extras.referer || "https://example.com",
      "X-Title": extras.title || "sumtab",
    }),
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-sonnet-20240620",
    requiresApiKey: true,
    headers: (apiKey) => ({
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    }),
    buildRequest: buildAnthropicRequest,
    parseResponse: parseAnthropicResponse,
  },
  google: {
    id: "google",
    name: "Google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-1.5-flash",
    requiresApiKey: true,
    headers: (apiKey) => ({
      "x-goog-api-key": apiKey,
    }),
    buildRequest: buildGoogleRequest,
    parseResponse: parseGoogleResponse,
  },
  ollama: {
    id: "ollama",
    name: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.1",
    requiresApiKey: false,
    headers: (apiKey) => (apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  },
  lmstudio: {
    id: "lmstudio",
    name: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    defaultModel: "local-model",
    requiresApiKey: false,
    headers: (apiKey) => (apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  },
  custom: {
    id: "custom",
    name: "Custom",
    baseUrl: "",
    defaultModel: "",
    requiresApiKey: true,
    headers: (apiKey, extras = {}) => ({
      ...(extras.headers || {}),
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    }),
  },
};

async function getModelCache() {
  const stored = await browser.storage.local.get(MODEL_CACHE_KEY);
  return stored[MODEL_CACHE_KEY] || {};
}

function isModelCacheFresh(entry) {
  return (
    !!entry &&
    Array.isArray(entry.models) &&
    Date.now() - entry.timestamp < MODEL_CACHE_TTL_MS
  );
}

async function readCachedModels(providerId) {
  const cache = await getModelCache();
  const entry = cache[providerId];
  if (!isModelCacheFresh(entry)) return null;
  return entry.models;
}

async function writeCachedModels(providerId, models) {
  if (!Array.isArray(models) || models.length === 0) return;
  const cache = await getModelCache();
  cache[providerId] = { models, timestamp: Date.now() };
  await browser.storage.local.set({ [MODEL_CACHE_KEY]: cache });
}

function normalizeModelList(models = []) {
  return Array.from(new Set(models.filter(Boolean)));
}

function filterOpenAIModelIds(models) {
  return models.filter((id) => /^gpt-|^chatgpt-/.test(id));
}

function filterAnthropicModelIds(models) {
  return models.filter((id) => id.startsWith("claude-"));
}

function normalizeOpenRouterIds(models) {
  return models.map((id) =>
    id.startsWith("openrouter/") ? id : `openrouter/${id}`,
  );
}

function stripGoogleModelName(name) {
  return name ? name.replace(/^models\//, "") : "";
}

async function fetchModelJson(url, headers) {
  const response = await fetchWithTimeout(
    url,
    { method: "GET", headers },
    TIMEOUT_MS,
  );
  if (!response.ok) {
    const errBody = await parseError(response);
    const message =
      errBody?.error?.message ||
      errBody?.message ||
      response.statusText ||
      "Model list request failed";
    throw new Error(message);
  }
  return response.json();
}

async function fetchOpenAIModels(provider, apiKey, extras) {
  const data = await fetchModelJson(
    `${provider.baseUrl}/models`,
    provider.headers(apiKey, extras),
  );
  const rawModels = Array.isArray(data?.data)
    ? data.data.map((model) => model?.id).filter(Boolean)
    : [];
  return filterOpenAIModelIds(rawModels);
}

async function fetchOpenRouterModels(provider, apiKey, extras) {
  const data = await fetchModelJson(
    `${provider.baseUrl}/models`,
    provider.headers(apiKey, extras),
  );
  const rawModels = Array.isArray(data?.data)
    ? data.data.map((model) => model?.id).filter(Boolean)
    : [];
  return normalizeOpenRouterIds(rawModels);
}

async function fetchAnthropicModels(provider, apiKey, extras) {
  const data = await fetchModelJson(
    `${provider.baseUrl}/models`,
    provider.headers(apiKey, extras),
  );
  const rawModels = Array.isArray(data?.data)
    ? data.data.map((model) => model?.id).filter(Boolean)
    : [];
  return filterAnthropicModelIds(rawModels);
}

async function fetchGoogleModels(provider, apiKey, extras) {
  const data = await fetchModelJson(
    `${provider.baseUrl}/models`,
    provider.headers(apiKey, extras),
  );
  const models = Array.isArray(data?.models) ? data.models : [];
  return models
    .filter((model) => {
      const methods = model?.supportedGenerationMethods;
      return !Array.isArray(methods) || methods.includes("generateContent");
    })
    .map((model) => stripGoogleModelName(model?.name || model?.id || ""))
    .filter(Boolean);
}

async function fetchOpenAICompatibleModels(provider, apiKey, extras) {
  const data = await fetchModelJson(
    `${provider.baseUrl}/models`,
    provider.headers(apiKey, extras),
  );
  return Array.isArray(data?.data)
    ? data.data.map((model) => model?.id).filter(Boolean)
    : [];
}

async function fetchOllamaModels(provider, apiKey, extras) {
  let lastError;
  try {
    const models = await fetchOpenAICompatibleModels(provider, apiKey, extras);
    if (models.length) return models;
  } catch (error) {
    lastError = error;
  }

  const baseUrl = provider.baseUrl.replace(/\/v1\/?$/, "");
  try {
    const data = await fetchModelJson(`${baseUrl}/api/tags`, {});
    return Array.isArray(data?.models)
      ? data.models.map((model) => model?.name).filter(Boolean)
      : [];
  } catch (error) {
    throw lastError || error;
  }
}

async function listProviderModels({
  providerId,
  apiKey,
  extras,
  forceRefresh,
}) {
  const provider = PROVIDERS[providerId] || PROVIDERS.openai;
  const cached = forceRefresh ? null : await readCachedModels(providerId);
  if (cached) {
    return { models: cached, source: "cache" };
  }

  if (provider.requiresApiKey !== false && !apiKey) {
    return {
      models: [],
      source: "missing_key",
      error: "API key required to fetch models.",
    };
  }

  const fetchers = {
    openai: fetchOpenAIModels,
    openrouter: fetchOpenRouterModels,
    anthropic: fetchAnthropicModels,
    google: fetchGoogleModels,
    ollama: fetchOllamaModels,
    lmstudio: fetchOpenAICompatibleModels,
  };

  const fetcher = fetchers[provider.id];
  if (!fetcher) {
    return { models: [], source: "unsupported" };
  }

  try {
    const models = normalizeModelList(await fetcher(provider, apiKey, extras));
    if (models.length) {
      await writeCachedModels(providerId, models);
      return { models, source: "remote" };
    }
    return { models: [], source: "empty" };
  } catch (error) {
    return {
      models: [],
      source: "error",
      error: error?.message || "Unable to fetch models.",
    };
  }
}

function extractSystemMessage(messages = []) {
  const systemMessages = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .filter(Boolean);
  return {
    system: systemMessages.length ? systemMessages.join("\n") : "",
    messages: messages.filter((message) => message.role !== "system"),
  };
}

function buildOpenAIRequest({ provider, apiKey, model, messages, extras }) {
  const url = `${provider.baseUrl}/chat/completions`;
  const headers = {
    "Content-Type": "application/json",
    ...provider.headers(apiKey, extras),
  };
  // Strip openrouter/ prefix if present for API requests
  const normalizedModel = model?.startsWith("openrouter/")
    ? model.substring("openrouter/".length)
    : model;
  const body = {
    model: normalizedModel || provider.defaultModel,
    messages,
    temperature: extras?.temperature ?? 0.7,
    max_tokens: extras?.maxTokens ?? undefined,
  };
  return {
    url,
    init: { method: "POST", headers, body: JSON.stringify(body) },
    provider,
  };
}

function parseOpenAIResponse(data) {
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

function buildAnthropicRequest({ provider, apiKey, model, messages, extras }) {
  const { system, messages: chatMessages } = extractSystemMessage(messages);
  const payloadMessages = chatMessages
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content:
        typeof message.content === "string"
          ? message.content
          : String(message.content ?? ""),
    }))
    .filter((message) => message.content);

  const body = {
    model: model || provider.defaultModel,
    messages: payloadMessages,
    max_tokens: extras?.maxTokens ?? 800,
    temperature: extras?.temperature ?? 0.7,
    ...(system ? { system } : {}),
  };

  const headers = {
    "Content-Type": "application/json",
    ...provider.headers(apiKey, extras),
  };

  return {
    url: `${provider.baseUrl}/messages`,
    init: { method: "POST", headers, body: JSON.stringify(body) },
    provider,
  };
}

function parseAnthropicResponse(data) {
  const contentBlocks = Array.isArray(data?.content) ? data.content : [];
  const text = contentBlocks
    .map((block) => block?.text || "")
    .join("")
    .trim();
  return text || "";
}

function buildGoogleRequest({ provider, apiKey, model, messages, extras }) {
  const { system, messages: chatMessages } = extractSystemMessage(messages);
  const contents = chatMessages
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [
        {
          text:
            typeof message.content === "string"
              ? message.content
              : String(message.content ?? ""),
        },
      ],
    }))
    .filter((message) => message.parts[0].text);

  const body = {
    contents,
    generationConfig: {
      temperature: extras?.temperature ?? 0.7,
      maxOutputTokens: extras?.maxTokens ?? 800,
    },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  };

  const headers = {
    "Content-Type": "application/json",
    ...provider.headers(apiKey, extras),
  };

  const modelId = model || provider.defaultModel;
  return {
    url: `${provider.baseUrl}/models/${modelId}:generateContent`,
    init: { method: "POST", headers, body: JSON.stringify(body) },
    provider,
  };
}

function parseGoogleResponse(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => part?.text || "")
    .join("")
    .trim();
}

function buildChatRequest({ providerId, apiKey, model, messages, extras }) {
  const provider = PROVIDERS[providerId] || PROVIDERS.openai;
  const builder = provider.buildRequest || buildOpenAIRequest;
  return builder({ provider, apiKey, model, messages, extras });
}

async function fetchWithTimeout(url, init, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseError(response) {
  try {
    return await response.json();
  } catch (_) {
    try {
      const text = await response.text();
      return { message: text };
    } catch (__) {
      return null;
    }
  }
}

function formatError({ provider, status, message, details }) {
  return {
    error: message,
    provider: provider?.id || "openai",
    status: status ?? null,
    details: details ?? null,
  };
}

function sanitizeAndTruncate(text) {
  const sanitizedText = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x00-\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitizedText) throw new Error("No content found on page");

  return sanitizedText.length > MAX_CHARS
    ? sanitizedText.slice(0, MAX_CHARS) + "..."
    : sanitizedText;
}

async function injectContentScript(tabId) {
  let attempts = 0;
  while (attempts < MAX_INJECT_RETRIES) {
    try {
      await browser.tabs.executeScript(tabId, { file: "content.js" });
      return;
    } catch (error) {
      attempts += 1;
      if (attempts >= MAX_INJECT_RETRIES) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

async function getPageContent(tabId) {
  let attempts = 0;
  while (attempts < MAX_INJECT_RETRIES) {
    try {
      await injectContentScript(tabId);
      const response = await Promise.race([
        browser.tabs.sendMessage(tabId, { action: "getContent" }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Content script timeout")), 5000),
        ),
      ]);
      if (response?.content) return response.content;
      throw new Error(response?.error || "Failed to get page content");
    } catch (error) {
      attempts += 1;
      if (attempts >= MAX_INJECT_RETRIES) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  throw new Error("Failed to get page content");
}

async function callProvider({ providerId, apiKey, model, messages, extras }) {
  const { url, init, provider } = buildChatRequest({
    providerId,
    apiKey,
    model,
    messages,
    extras,
  });

  let attempts = 0;
  while (attempts <= MAX_PROVIDER_RETRIES) {
    try {
      const response = await fetchWithTimeout(url, init, TIMEOUT_MS);
      if (!response.ok) {
        const errBody = await parseError(response);
        throw formatError({
          provider,
          status: response.status,
          message:
            errBody?.error?.message || errBody?.message || "Provider error",
          details: errBody || null,
        });
      }
      const data = await response.json();
      const parser = provider.parseResponse || parseOpenAIResponse;
      const content = parser(data);
      if (!content) {
        throw formatError({
          provider,
          status: response.status,
          message: "Invalid response from provider",
          details: data,
        });
      }
      return { summary: content, provider: provider.id };
    } catch (error) {
      const isTimeout = error?.name === "AbortError";
      const status = error?.status ?? error?.details?.status ?? null;
      const is5xx = typeof status === "number" && status >= 500;
      const retryable = (isTimeout || is5xx) && attempts < MAX_PROVIDER_RETRIES;

      if (!retryable) {
        if (isTimeout) {
          throw formatError({
            provider,
            status: null,
            message: "Timeout",
            details: "Request exceeded time limit",
          });
        }
        if (error?.error && error.provider) {
          throw error;
        }
        throw formatError({
          provider,
          status: status ?? null,
          message: error?.message || "Unknown error",
          details: error?.details ?? null,
        });
      }

      attempts += 1;
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_BACKOFF_MS * attempts),
      );
    }
  }

  throw formatError({
    provider,
    status: null,
    message: "Unknown error",
    details: null,
  });
}

async function handleSummarizeTab(request, sendResponse) {
  try {
    const providerId = request.provider || "openai";
    const provider = PROVIDERS[providerId] || PROVIDERS.openai;
    const apiKey = request.apiKey;
    const model = request.model;
    const extras = request.extras || {};

    if (provider.requiresApiKey !== false && !apiKey) {
      throw formatError({
        provider,
        status: null,
        message: "API key missing",
        details: null,
      });
    }

    const tab = await browser.tabs.get(request.tabId);
    if (!tab.url) throw new Error("Tab URL is not accessible");
    if (tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:")) {
      throw new Error("Cannot access restricted pages");
    }
    if (!tab.url.startsWith("http://") && !tab.url.startsWith("https://")) {
      throw new Error("Can only access http:// and https:// pages");
    }

    const rawContent = await getPageContent(request.tabId);
    const truncatedText = sanitizeAndTruncate(rawContent);

    const messages = [
      {
        role: "system",
        content:
          "You are a helpful assistant that summarizes text content concisely.",
      },
      {
        role: "user",
        content: `Please summarize the following text in a concise way:\n\n${truncatedText}`,
      },
    ];

    const result = await callProvider({
      providerId,
      apiKey,
      model,
      messages,
      extras,
    });
    sendResponse({ summary: result.summary, provider: result.provider });
  } catch (error) {
    const formatted = error?.error
      ? error
      : formatError({
          provider: PROVIDERS[request?.provider] || PROVIDERS.openai,
          status: error?.status ?? null,
          message: error?.message || "Unknown error",
          details: error?.details ?? null,
        });
    sendResponse({ error: formatted });
  }
}

async function handleSummarizeText(request, sendResponse) {
  try {
    const providerId = request.provider || "openai";
    const provider = PROVIDERS[providerId] || PROVIDERS.openai;
    const apiKey = request.apiKey;
    const model = request.model;
    const extras = request.extras || {};
    const customSystemPrompt = request.systemPrompt;

    if (!request.text) {
      throw formatError({
        provider: PROVIDERS[providerId],
        status: null,
        message: "No text provided for summarization",
        details: null,
      });
    }

    if (provider.requiresApiKey !== false && !apiKey) {
      throw formatError({
        provider,
        status: null,
        message: "API key missing",
        details: null,
      });
    }

    const isBulletRequest = request.text
      .toLowerCase()
      .includes("bullet points");

    // Use custom system prompt if provided, otherwise use default based on request type
    let systemMessage;
    if (customSystemPrompt && !isBulletRequest) {
      systemMessage = customSystemPrompt;
    } else if (isBulletRequest) {
      systemMessage =
        "You are a helpful assistant that creates clear, concise bullet-point summaries. Format the output as bullet points, with each point starting with a bullet (•). Keep each point brief and focused.";
    } else {
      systemMessage = customSystemPrompt || DEFAULT_SYSTEM_PROMPT;
    }

    const messages = [
      { role: "system", content: systemMessage },
      { role: "user", content: request.text },
    ];

    const result = await callProvider({
      providerId,
      apiKey,
      model,
      messages,
      extras: { ...extras, maxTokens: isBulletRequest ? 500 : 800 },
    });

    sendResponse({ summary: result.summary, provider: result.provider });
  } catch (error) {
    const formatted = error?.error
      ? error
      : formatError({
          provider: PROVIDERS[request?.provider] || PROVIDERS.openai,
          status: error?.status ?? null,
          message: error?.message || "Unknown error",
          details: error?.details ?? null,
        });
    sendResponse({ error: formatted });
  }
}

async function handleListModels(request, sendResponse) {
  try {
    const providerId = request.provider || "openai";
    const apiKey = request.apiKey || "";
    const extras = request.extras || {};
    const forceRefresh = request.forceRefresh === true;
    const result = await listProviderModels({
      providerId,
      apiKey,
      extras,
      forceRefresh,
    });
    sendResponse(result);
  } catch (error) {
    sendResponse({
      models: [],
      source: "error",
      error: error?.message || "Unable to fetch models.",
    });
  }
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summarizeTab") {
    handleSummarizeTab(request, sendResponse);
    return true;
  }

  if (request.action === "summarizeText") {
    handleSummarizeText(request, sendResponse);
    return true;
  }

  if (request.action === "listModels") {
    handleListModels(request, sendResponse);
    return true;
  }

  return false;
});
