// Track which tabs have content scripts loaded
const loadedTabs = new Set();

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  if (request.action === 'contentScriptLoaded' && sender.tab) {
    console.log('Content script loaded in tab:', sender.tab.id);
    loadedTabs.add(sender.tab.id);
    sendResponse({ status: 'acknowledged' });
    return true;
  }

  if (request.action === 'summarizeTab') {
    handleSummarizeTab(request, sendResponse);
    return true; // Keep the message channel open for async response
  }

  if (request.action === 'summarizeText') {
    handleSummarizeText(request, sendResponse);
    return true; // Keep the message channel open for async response
  }
});

// Clean up loadedTabs when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  loadedTabs.delete(tabId);
});

async function injectContentScript(tabId) {
  try {
    console.log('Attempting to inject content script into tab:', tabId);
    
    // Check if we can access the tab
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) {
      throw new Error('Tab URL is not accessible');
    }

    // Skip chrome:// and chrome-extension:// URLs
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('Cannot inject script into chrome:// or extension pages');
    }

    // Skip non-http(s) URLs
    if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
      throw new Error('Can only inject into http:// and https:// pages');
    }

    // First try to ping the content script to see if it's already loaded
    try {
      console.log('Checking if content script is already loaded...');
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (response?.status === 'ok') {
        console.log('Content script is already loaded');
        loadedTabs.add(tabId);
        return true;
      }
    } catch (error) {
      console.log('Content script not loaded, proceeding with injection');
    }

    // Inject the content script
    console.log('Injecting content script...');
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ['content.js']
    });

    // Wait for content script to load
    const response = await new Promise((resolve) => {
      const listener = (message, sender) => {
        if (message.action === 'contentScriptLoaded' && sender.tab.id === tabId) {
          chrome.runtime.onMessage.removeListener(listener);
          resolve(true);
        }
      };
      chrome.runtime.onMessage.addListener(listener);
      
      // Set a timeout
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(listener);
        resolve(false);
      }, 5000);
    });

    if (!response) {
      throw new Error('Content script did not load in time');
    }

    console.log('Content script injection successful');
    loadedTabs.add(tabId);
    return true;
  } catch (error) {
    console.error('Error injecting content script:', error);
    throw error;
  }
}

async function handleSummarizeTab(request, sendResponse) {
  try {
    const tab = await chrome.tabs.get(request.tabId);
    
    if (!tab.url) {
      throw new Error('Tab URL is not accessible');
    }

    // Skip chrome:// and chrome-extension:// URLs
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('Cannot access chrome:// or extension pages');
    }

    // Skip non-http(s) URLs
    if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
      throw new Error('Can only access http:// and https:// pages');
    }

    // Ensure content script is loaded with retries
    let retries = 0;
    const maxRetries = 3;
    while (retries < maxRetries) {
      try {
        const injected = await injectContentScript(request.tabId);
        if (injected) break;
      } catch (error) {
        console.log(`Injection retry ${retries + 1}/${maxRetries} failed:`, error);
        retries++;
        if (retries === maxRetries) {
          throw new Error('Failed to inject content script after retries');
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Get page content with timeout and retry
    let content = null;
    retries = 0;
    while (retries < maxRetries) {
      try {
        const contentResponse = await Promise.race([
          new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(request.tabId, { action: 'getPageContent' }, (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
              }
              resolve(response);
            });
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Content script timeout')), 5000))
        ]);

        if (contentResponse?.content) {
          content = contentResponse.content;
          break;
        }
      } catch (error) {
        console.log(`Content extraction retry ${retries + 1}/${maxRetries} failed:`, error);
        retries++;
        if (retries === maxRetries) {
          throw new Error('Failed to get page content after retries');
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!content) {
      throw new Error('Failed to get page content');
    }

    const sanitizedText = content
      .replace(/[\u2018\u2019]/g, "'")   // Replace smart single quotes
      .replace(/[\u201C\u201D]/g, '"')   // Replace smart double quotes
      .replace(/[\u2013\u2014]/g, '-')   // Replace em/en dashes
      .replace(/[^\x00-\x7F]/g, ' ')     // Replace other non-ASCII chars with space
      .replace(/\s+/g, ' ')              // Replace multiple spaces with single space
      .trim();

    if (!sanitizedText) {
      throw new Error('No content found on page');
    }

    // Truncate text if too long (GPT-3.5 has ~4k token limit)
    const maxChars = 12000;
    const truncatedText = sanitizedText.length > maxChars 
      ? sanitizedText.slice(0, maxChars) + "..."
      : sanitizedText;

    // Make direct API request to OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${request.apiKey}`
      },
      body: JSON.stringify({
        model: request.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that summarizes text content concisely."
          },
          {
            role: "user",
            content: `Please summarize the following text in a concise way:\n\n${truncatedText}`
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || openaiResponse.status}`);
    }

    const data = await openaiResponse.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from OpenAI API');
    }

    sendResponse({ summary: data.choices[0].message.content.trim() });
  } catch (error) {
    console.error('Error in handleSummarizeTab:', error);
    sendResponse({ error: error.message });
  }
}

async function handleSummarizeText(request, sendResponse) {
  try {
    if (!request.text) {
      throw new Error('No text provided for summarization');
    }

    if (!request.apiKey) {
      throw new Error('No API key provided');
    }

    // Build the system message based on summary type
    let systemMessage = request.text.includes('bullet points')
      ? 'You are a helpful assistant that creates clear, concise bullet-point summaries. Format the output as bullet points, with each point starting with a bullet (•). Keep each point brief and focused.'
      : 'You are a helpful assistant that creates comprehensive, detailed summaries. Include important context and key details while maintaining clarity. Aim for a thorough understanding of the content.';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${request.apiKey}`
      },
      body: JSON.stringify({
        model: request.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemMessage
          },
          {
            role: 'user',
            content: request.text
          }
        ],
        temperature: 0.7,
        max_tokens: request.text.includes('bullet points') ? 500 : 800
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No summary generated');
    }

    const summary = data.choices[0].message.content.trim();
    sendResponse({ summary });
  } catch (error) {
    console.error('Error in handleSummarizeText:', error);
    sendResponse({ error: error.message });
  }
}
