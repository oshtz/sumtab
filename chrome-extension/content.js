(() => {
  console.log("Content script initializing...");

  setupMessageListeners();

  notifyScriptLoaded();
})();

function notifyScriptLoaded() {
  let retries = 0;
  let acknowledged = false;
  const maxRetries = 5;
  const retryDelay = 800;
  const maxTotalMs = 8000;
  const start = Date.now();

  function attemptNotification() {
    if (acknowledged) return;
    if (Date.now() - start > maxTotalMs) {
      console.warn("contentScriptLoaded notification timed out");
      return;
    }
    try {
      chrome.runtime.sendMessage({ action: "contentScriptLoaded" }, () => {
        if (chrome.runtime.lastError) {
          const message =
            chrome.runtime.lastError?.message ||
            String(chrome.runtime.lastError);
          const noisy =
            /Receiving end does not exist|Could not establish connection/i.test(
              message,
            );
          if (noisy) {
            console.warn(
              "contentScriptLoaded not acknowledged (ignored):",
              message,
            );
            return;
          }
          retries++;
          if (retries < maxRetries) {
            const jitter = Math.random() * 200;
            setTimeout(attemptNotification, retryDelay + jitter);
          }
          return;
        }
        acknowledged = true;
        console.log("Content script loaded notification sent successfully");
      });
    } catch (error) {
      console.warn("Failed to send contentScriptLoaded message:", error);
      retries++;
      if (retries < maxRetries) {
        const jitter = Math.random() * 200;
        setTimeout(attemptNotification, retryDelay + jitter);
      }
    }
  }

  attemptNotification();
}

function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script received message:", request.action);

    if (request.action === "ping") {
      console.log("Received ping request");
      sendResponse({ status: "ok" });
      return true;
    }

    if (request.action === "getPageContent") {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Content extraction timeout")),
            5000,
          );
        });

        const extractionPromise = new Promise((resolve, reject) => {
          const content = extractPageContent();
          if (!content || !content.trim()) {
            reject(new Error("No readable content found"));
            return;
          }
          console.log(
            "Content extracted successfully, length:",
            content.length,
          );
          resolve(content);
        });

        Promise.race([extractionPromise, timeoutPromise])
          .then((content) => {
            sendResponse({ content, success: true });
          })
          .catch((error) => {
            console.error("Content extraction error:", error);
            sendResponse({ error: error.message, success: false });
          });
      } catch (error) {
        console.error("Content extraction error:", error);
        sendResponse({ error: error.message, success: false });
      }
      return true;
    }
  });
}

function extractPageContent() {
  const bodyClone = document.body.cloneNode(true);

  const unwantedSelectors = [
    "script",
    "style",
    "noscript",
    "iframe",
    "img",
    "video",
    "nav",
    "footer",
    "header",
    '[role="navigation"]',
    '[role="banner"]',
    '[role="complementary"]',
    '[role="contentinfo"]',
    ".nav",
    ".footer",
    ".header",
    ".sidebar",
    ".ad",
    ".advertisement",
    "#nav",
    "#footer",
    "#header",
    "#sidebar",
    '[aria-hidden="true"]',
    "[hidden]",
  ];

  unwantedSelectors.forEach((selector) => {
    bodyClone.querySelectorAll(selector).forEach((el) => el.remove());
  });

  const sanitize = (text) =>
    text
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[^\x09\x0A\x0D\x20-\uFFFF]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const strategies = [
    () => {
      const article = document.querySelector('[itemtype*="Article"]');
      return article ? sanitize(article.textContent || "") : null;
    },

    () => {
      const article = bodyClone.querySelector("article");
      return article ? sanitize(article.textContent || "") : null;
    },

    () => {
      const main = bodyClone.querySelector("main");
      return main ? sanitize(main.textContent || "") : null;
    },

    () => {
      const contentSelectors = [
        ".content",
        ".article",
        ".post",
        ".entry",
        "#content",
        "#article",
        "#post",
        "#entry",
        '[role="main"]',
        '[role="article"]',
      ];

      for (const selector of contentSelectors) {
        const element = bodyClone.querySelector(selector);
        if (element) return sanitize(element.textContent || "");
      }
      return null;
    },

    () => {
      let maxLength = 0;
      let bestContent = "";

      bodyClone
        .querySelectorAll("div, section, article, main")
        .forEach((element) => {
          const text = sanitize(element.textContent || "");
          if (text.length > maxLength) {
            maxLength = text.length;
            bestContent = text;
          }
        });

      return bestContent;
    },
  ];

  for (const strategy of strategies) {
    const content = strategy();
    if (content && content.trim().length > 100) {
      return content.slice(0, 20000);
    }
  }

  const fallback = sanitize(bodyClone.textContent || "");
  if (!fallback) {
    throw new Error("No content found on page");
  }
  return fallback.slice(0, 20000);
}
