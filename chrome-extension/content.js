(() => {
  console.log('Content script initializing...');
  
  setupMessageListeners();
  
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
      return true;
    }
  });
}

function extractPageContent() {
  const bodyClone = document.body.cloneNode(true);

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

  const strategies = [
    () => {
      const article = document.querySelector('[itemtype*="Article"]');
      return article ? article.textContent : null;
    },

    () => {
      const article = bodyClone.querySelector('article');
      return article ? article.textContent : null;
    },

    () => {
      const main = bodyClone.querySelector('main');
      return main ? main.textContent : null;
    },

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

  for (const strategy of strategies) {
    const content = strategy();
    if (content && content.trim().length > 100) {
      return content.trim();
    }
  }

  return bodyClone.textContent.trim();
}
