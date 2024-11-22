// Handle messages from popup

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);

  if (request.action === 'summarizeTab') {
    try {
      // Get the tab content by sending message to content script
      console.log('Background script: Getting content from tab', request.tabId);
      
      // Ensure content script is injected
      try {
        browser.tabs.executeScript(request.tabId, { file: 'content.js' });
        console.log('Content script injected successfully');
      } catch (e) {
        console.log('Content script already injected or failed:', e);
      }

      // Wait a bit for content script to initialize
      browser.tabs.sendMessage(request.tabId, { 
        action: 'getPageContent' 
      }, (response) => {
        if (!response || !response.success) {
          throw new Error(response?.error || 'Failed to get page content');
        }

        const sanitizedText = response.content;
        // Truncate text if too long (GPT-3.5 has ~4k token limit)
        const maxChars = 12000;
        const truncatedText = sanitizedText.length > maxChars 
          ? sanitizedText.slice(0, maxChars) + "..."
          : sanitizedText;

        // Make direct API request to OpenAI
        console.log('Making OpenAI API request');
        fetch('https://api.openai.com/v1/chat/completions', {
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
                content: 'You are a helpful assistant that summarizes web pages. Provide a concise summary.'
              },
              {
                role: 'user',
                content: `Please summarize the following text:\n\n${truncatedText}`
              }
            ],
            max_tokens: 150,
            temperature: 0.7
          })
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          sendResponse({ summary: data.choices[0].message.content.trim() });
        })
        .catch(error => {
          console.error('Background script error:', error);
          sendResponse({ error: error.message });
        });
      });
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ error: error.message });
    }
    return true; // Required for async response
  }

  if (request.action === 'summarizeText') {
    (async () => {
      try {
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
                content: 'You are a helpful assistant that summarizes web pages. Provide a concise summary that captures the main points and key details. Format your response with proper spacing and structure using markdown. Use paragraphs, bullet points, or sections as appropriate. Always include a brief introduction followed by key points.'
              },
              {
                role: 'user',
                content: request.text
              }
            ],
            temperature: 0.7,
            max_tokens: 1000
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        console.log('API Response:', data);
        
        if (!data.choices || !data.choices[0]) {
          throw new Error('Invalid API response format');
        }

        // Format the summary with proper spacing
        const summary = data.choices[0].message.content.trim();
        
        sendResponse({
          summary: summary,
          success: true
        });
      } catch (error) {
        console.error('Background script error:', error);
        sendResponse({
          error: error.message,
          success: false
        });
      }
    })();
    return true; // Required for async response
  }
});
