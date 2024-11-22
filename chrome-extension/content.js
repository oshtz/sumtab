// Content script initialization
(() => {
  console.log('Content script initializing...');
  
  // Set up message listeners immediately
  setupMessageListeners();
  
  // Notify background script that content script is loaded
  notifyScriptLoaded();
})();

function notifyScriptLoaded() {
  let retries = 0;
  const maxRetries = 3;
  const retryDelay = 1000;

  function attemptNotification() {
    try {
      chrome.runtime.sendMessage({ action: 'contentScriptLoaded' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending contentScriptLoaded:', chrome.runtime.lastError);
          retries++;
          if (retries < maxRetries) {
            setTimeout(attemptNotification, retryDelay);
          }
          return;
        }
        console.log('Content script loaded notification sent successfully');
      });
    } catch (error) {
      console.error('Failed to send contentScriptLoaded message:', error);
      retries++;
      if (retries < maxRetries) {
        setTimeout(attemptNotification, retryDelay);
      }
    }
  }

  attemptNotification();
}

function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request.action);
    
    if (request.action === 'ping') {
      console.log('Received ping request');
      sendResponse({ status: 'ok' });
      return true;
    }

    if (request.action === 'getPageContent') {
      try {
        // Get main content with timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Content extraction timeout')), 5000);
        });

        const extractionPromise = new Promise((resolve) => {
          const content = extractPageContent();
          console.log('Content extracted successfully, length:', content.length);
          resolve(content);
        });

        Promise.race([extractionPromise, timeoutPromise])
          .then(content => {
            sendResponse({ content, success: true });
          })
          .catch(error => {
            console.error('Content extraction error:', error);
            sendResponse({ error: error.message, success: false });
          });

      } catch (error) {
        console.error('Content extraction error:', error);
        sendResponse({ error: error.message, success: false });
      }
      return true; // Keep the message channel open for async response
    }
  });
}

function extractPageContent() {
  // Create a copy of the document body to manipulate
  const bodyClone = document.body.cloneNode(true);

  // Remove unwanted elements from the clone
  const unwantedSelectors = [
    'script', 'style', 'noscript', 'iframe', 'img', 'video',
    'nav', 'footer', 'header', '[role="navigation"]',
    '[role="banner"]', '[role="complementary"]', '[role="contentinfo"]',
    '.nav', '.footer', '.header', '.sidebar', '.ad', '.advertisement',
    '#nav', '#footer', '#header', '#sidebar',
    '[aria-hidden="true"]', '[hidden]'
  ];

  unwantedSelectors.forEach(selector => {
    bodyClone.querySelectorAll(selector).forEach(el => el.remove());
  });

  // Try different strategies to get the main content
  const strategies = [
    // Strategy 1: Schema.org Article
    () => {
      const article = document.querySelector('[itemtype*="Article"]');
      return article ? article.textContent : null;
    },

    // Strategy 2: Article element
    () => {
      const article = bodyClone.querySelector('article');
      return article ? article.textContent : null;
    },

    // Strategy 3: Main content
    () => {
      const main = bodyClone.querySelector('main');
      return main ? main.textContent : null;
    },

    // Strategy 4: Content by class/id
    () => {
      const contentSelectors = [
        '.content', '.article', '.post', '.entry',
        '#content', '#article', '#post', '#entry',
        '[role="main"]', '[role="article"]'
      ];
      
      for (const selector of contentSelectors) {
        const element = bodyClone.querySelector(selector);
        if (element) return element.textContent;
      }
      return null;
    },

    // Strategy 5: Largest text content block
    () => {
      let maxLength = 0;
      let bestContent = '';
      
      bodyClone.querySelectorAll('div, section, article, main').forEach(element => {
        const text = element.textContent.trim();
        if (text.length > maxLength) {
          maxLength = text.length;
          bestContent = text;
        }
      });
      
      return bestContent;
    }
  ];

  // Try each strategy in order until we get content
  for (const strategy of strategies) {
    const content = strategy();
    if (content && content.trim().length > 100) { // Minimum content length threshold
      return content.trim();
    }
  }

  // Fallback: Return all text content if no strategy worked
  return bodyClone.textContent.trim();
}
