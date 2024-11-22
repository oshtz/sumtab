// Firefox-specific version of popup.js
// Dark mode handling
const darkModeToggle = document.getElementById('darkMode');
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

// Initialize theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark' || (!savedTheme && prefersDarkScheme.matches)) {
  document.body.setAttribute('data-theme', 'dark');
  darkModeToggle.checked = true;
}

darkModeToggle.addEventListener('change', () => {
  if (darkModeToggle.checked) {
    document.body.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.body.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  }
});

// Get DOM elements
const tabList = document.getElementById('tabList');
const apiKeyInput = document.getElementById('apiKey');
const saveApiKeyBtn = document.getElementById('saveApiKey');
const modelSelect = document.getElementById('model');
const resultsCard = document.getElementById('results-card');
const summaryContent = document.getElementById('summary-content');
const summarizeBtn = document.getElementById('summarizeBtn');
const openInNewTab = document.getElementById('openInNewTab');
const clearBtn = document.getElementById('clear-btn');
const bulletsBtn = document.getElementById('bullets-btn');
const copyBtn = document.getElementById('copy');
const loader = document.getElementById('loader');

let tabs = [];

console.log('Starting tab loading...');

// Initialize the popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded, initializing...');
  
  // Load API key and summaries from storage
  const stored = await browser.storage.local.get(['apiKey', 'model', 'regularSummary', 'bulletSummary', 'isBulletMode']);
  if (stored.apiKey) {
    apiKeyInput.value = stored.apiKey;
  }
  if (stored.model) {
    modelSelect.value = stored.model;
  }
  
  // Restore the last viewed summary
  if (stored.regularSummary || stored.bulletSummary) {
    resultsCard.style.display = 'block';
    if (stored.isBulletMode && stored.bulletSummary) {
      sanitizeAndSetContent(summaryContent, stored.bulletSummary, true);
      bulletsBtn.classList.add('active');
    } else {
      sanitizeAndSetContent(summaryContent, stored.regularSummary || '', false);
      bulletsBtn.classList.remove('active');
    }
  }

  try {
    console.log('Attempting to query tabs...');
    // Get all tabs
    const allTabs = await browser.tabs.query({});
    console.log('Raw tabs data:', allTabs);
    
    if (!allTabs || allTabs.length === 0) {
      console.error('No tabs returned from browser.tabs.query');
      return;
    }
    
    tabs = allTabs;
    console.log('Tabs loaded successfully:', tabs.length);

    // Check if tab-list element exists
    const tabListElement = document.getElementById('tabList');
    if (!tabListElement) {
      console.error('tab-list element not found in DOM');
      return;
    }
    console.log('tab-list element found:', tabListElement);

    // Render tab list
    console.log('Rendering tabs, count:', tabs.length);
    renderTabs(tabs);
  } catch (error) {
    console.error('Error loading tabs:', error);
  }
});

// Save API key when save button is clicked
saveApiKeyBtn.addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim();
  if (apiKey) {
    browser.storage.local.set({ apiKey });
    updateApiStatus('API key saved successfully!', true);
  } else {
    updateApiStatus('Please enter an API key', false);
  }
});

// Save API key when pressing Enter in the input field
apiKeyInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      browser.storage.local.set({ apiKey });
      updateApiStatus('API key saved successfully!', true);
    } else {
      updateApiStatus('Please enter an API key', false);
    }
  }
});

// Save model when changed
modelSelect.addEventListener('change', () => {
  const model = modelSelect.value;
  browser.storage.local.set({ model });
});

// Clear button functionality
clearBtn.addEventListener('click', () => {
  summaryContent.innerHTML = '';
  resultsCard.style.display = 'none';
  bulletsBtn.classList.remove('active');
  browser.storage.local.remove(['regularSummary', 'bulletSummary', 'isBulletMode']);
});

// Copy to clipboard functionality
copyBtn.addEventListener('click', async () => {
  const content = summaryContent.textContent;
  if (!content) {
    updateApiStatus('No content to copy', false);
    return;
  }

  try {
    await navigator.clipboard.writeText(content);
    
    // Visual feedback
    copyBtn.classList.add('copy-success');
    copyBtn.innerHTML = `
      <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
        <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    `;
    
    // Reset button after 2 seconds
    setTimeout(() => {
      copyBtn.classList.remove('copy-success');
      copyBtn.innerHTML = `
        <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      `;
    }, 2000);
    
    updateApiStatus('Copied to clipboard', true);
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    updateApiStatus('Failed to copy to clipboard', false);
  }
});

// Open in new tab functionality
openInNewTab.addEventListener('click', () => {
  const markdownContent = summaryContent.textContent;
  if (!markdownContent) {
    updateApiStatus('No content to open', false);
    return;
  }

  const blob = new Blob([markdownContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  browser.tabs.create({ url });
});

// Sanitization function
function sanitizeAndSetContent(element, content, isBulletMode = false) {
  // First sanitize the content
  const sanitizedContent = content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Create a new div for the content
  const container = document.createElement('div');
  
  if (isBulletMode) {
    // For bullet points, split by newlines and create list items
    const bulletPoints = sanitizedContent.split('\n').filter(point => point.trim());
    const ul = document.createElement('ul');
    bulletPoints.forEach(point => {
      const li = document.createElement('li');
      li.textContent = point.trim().replace(/^[•\-*]\s*/, '');
      ul.appendChild(li);
    });
    container.appendChild(ul);
  } else {
    // For regular text, split paragraphs and create p elements
    const paragraphs = sanitizedContent.split('\n\n');
    paragraphs.forEach(para => {
      if (para.trim()) {
        const p = document.createElement('p');
        p.textContent = para.trim();
        container.appendChild(p);
      }
    });
  }

  // Clear existing content and append new content
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
  element.appendChild(container);
}

// Convert to bullet points functionality
async function convertToBulletPoints() {
  const stored = await browser.storage.local.get(['regularSummary', 'bulletSummary', 'isBulletMode']);
  
  // If we already have bullet points, just toggle to them
  if (stored.bulletSummary) {
    sanitizeAndSetContent(summaryContent, stored.bulletSummary, true);
    bulletsBtn.classList.add('active');
    browser.storage.local.set({ isBulletMode: true });
    return;
  }

  // Get the regular summary to convert
  const regularSummary = stored.regularSummary || summaryContent.textContent;
  if (!regularSummary) {
    updateApiStatus('No content to convert', false);
    return;
  }

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    updateApiStatus('Please enter an API key first', false);
    return;
  }

  try {
    toggleLoader(true);
    bulletsBtn.disabled = true;
    updateApiStatus('Converting to bullet points...', true);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelSelect.value,
        messages: [
          {
            role: "system",
            content: "You are a concise bullet point converter. Convert the given text into clear, concise bullet points. Keep only the most important information and remove any redundant or verbose content. Each bullet point should be a single line starting with '• '."
          },
          {
            role: "user",
            content: `Convert this summary into concise bullet points:\n\n${regularSummary}`
          }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const bulletPoints = data.choices[0].message.content.trim();

    // Save both versions
    await browser.storage.local.set({
      regularSummary: regularSummary,
      bulletSummary: bulletPoints,
      isBulletMode: true
    });

    sanitizeAndSetContent(summaryContent, bulletPoints, true);
    bulletsBtn.classList.add('active');
    updateApiStatus('Converted to bullet points', true);

  } catch (error) {
    console.error('Error converting to bullet points:', error);
    updateApiStatus('Error converting to bullet points: ' + error.message, false);
  } finally {
    toggleLoader(false);
    bulletsBtn.disabled = false;
  }
}

// Toggle between regular and bullet point summaries
async function toggleSummaryMode() {
  const currentContent = summaryContent.textContent;
  if (!currentContent) return;

  if (bulletsBtn.classList.contains('active')) {
    // Switch to regular mode
    const stored = await browser.storage.local.get(['regularSummary']);
    sanitizeAndSetContent(summaryContent, stored.regularSummary || '', false);
    bulletsBtn.classList.remove('active');
    browser.storage.local.set({ isBulletMode: false });
  } else {
    // Switch to bullet points or create them if they don't exist
    const stored = await browser.storage.local.get(['bulletSummary']);
    if (stored.bulletSummary) {
      sanitizeAndSetContent(summaryContent, stored.bulletSummary, true);
      bulletsBtn.classList.add('active');
      browser.storage.local.set({ isBulletMode: true });
    } else {
      await convertToBulletPoints();
    }
  }
}

// Add event listener for bullets button
bulletsBtn.addEventListener('click', toggleSummaryMode);

// Tab handling
const selectAllBtn = document.getElementById('selectAll');
const deselectAllBtn = document.getElementById('deselectAll');

// Load tabs (Firefox uses browser.tabs)
browser.tabs.query({}).then(browserTabs => {
  console.log('Tabs loaded:', browserTabs);
  tabs = browserTabs;
  renderTabs();
}).catch(error => {
  console.error('Error loading tabs:', error);
});

function renderTabs(tabs) {
  console.log('Rendering tabs, count:', tabs.length);
  tabList.innerHTML = '';
  
  tabs.forEach(tab => {
    const tabItem = createTabItem(tab);
    tabList.appendChild(tabItem);
  });
  
  updateSummarizeButtonState();
}

function createTabItem(tab) {
  const tabItem = document.createElement('div');
  tabItem.className = 'tab-item';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'tab-checkbox';
  checkbox.dataset.tabId = tab.id;
  checkbox.id = `tab-${tab.id}`; // Add unique ID
  
  const favicon = document.createElement('img');
  favicon.src = tab.favIconUrl || 'default-favicon.png';
  favicon.className = 'tab-favicon';
  favicon.onerror = () => {
    favicon.src = 'default-favicon.png';
  };
  
  const title = document.createElement('span');
  title.className = 'tab-title';
  title.textContent = tab.title;
  
  tabItem.appendChild(checkbox);
  tabItem.appendChild(favicon);
  tabItem.appendChild(title);
  
  // Add click handler for the entire tab item
  tabItem.addEventListener('click', (e) => {
    // Prevent toggling if clicking the checkbox directly
    if (e.target !== checkbox) {
      checkbox.checked = !checkbox.checked;
      // Trigger change event to update button state
      checkbox.dispatchEvent(new Event('change'));
    }
  });
  
  // Update summarize button state on checkbox change
  checkbox.addEventListener('change', updateSummarizeButtonState);
  
  return tabItem;
}

function getSelectedTabs() {
  const selectedCheckboxes = document.querySelectorAll('.tab-checkbox:checked');
  return Array.from(selectedCheckboxes).map(checkbox => {
    const tabId = parseInt(checkbox.dataset.tabId);
    return tabs.find(tab => tab.id === tabId);
  }).filter(tab => tab !== undefined);
}

function updateSummarizeButtonState() {
  const selectedTabs = getSelectedTabs();
  if (summarizeBtn) {
    summarizeBtn.disabled = selectedTabs.length === 0;
  }
}

selectAllBtn.addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('.tab-checkbox');
  checkboxes.forEach(cb => cb.checked = true);
  updateSummarizeButtonState();
});

deselectAllBtn.addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('.tab-checkbox');
  checkboxes.forEach(cb => cb.checked = false);
  updateSummarizeButtonState();
});

// Summarize selected tabs functionality
async function summarizeSelectedTabs() {
  const selectedTabs = getSelectedTabs();
  if (selectedTabs.length === 0) {
    updateApiStatus('No tabs selected', false);
    return;
  }

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    updateApiStatus('Please enter an API Key', false);
    return;
  }

  summarizeBtn.disabled = true;
  toggleLoader(true);
  updateApiStatus('Summarizing tabs...', true);

  try {
    const summaries = [];
    for (const tab of selectedTabs) {
      try {
        console.log('Summarizing tab:', tab.title);
        const summary = await summarizeTab(tab, apiKey);
        if (summary) {
          // Format the summary with proper spacing
          const formattedSummary = `### ${tab.title}\n\n${summary}\n`;
          summaries.push(formattedSummary);
        }
      } catch (error) {
        console.error('Error summarizing tab:', error);
        updateApiStatus(`Error summarizing ${tab.title}: ${error.message}`, false);
      }
    }

    if (summaries.length > 0) {
      // Join summaries with clear separation
      const combinedSummary = summaries.join('\n\n---\n\n');
      sanitizeAndSetContent(summaryContent, combinedSummary);
      resultsCard.style.display = 'block';
      
      // Save the results
      await browser.storage.local.set({
        regularSummary: combinedSummary,
        isBulletMode: false
      });
      
      updateApiStatus('Summaries generated successfully', true);
    } else {
      updateApiStatus('No summaries were generated', false);
    }
  } catch (error) {
    console.error('Error in summarization process:', error);
    updateApiStatus('Error: ' + error.message, false);
  } finally {
    summarizeBtn.disabled = false;
    toggleLoader(false);
  }
}

async function summarizeTab(tab, apiKey) {
  if (!tab || !tab.id) {
    throw new Error('Invalid tab');
  }

  try {
    // Inject content script
    try {
      await browser.tabs.executeScript(tab.id, {
        file: 'content.js'
      });
    } catch (error) {
      console.log('Content script may already be injected:', error);
    }

    // Get page content
    const response = await browser.tabs.sendMessage(tab.id, { action: 'getContent' });
    if (!response || !response.success) {
      throw new Error('No content found');
    }

    const pageContent = `Title: ${tab.title}\n\nContent:\n${response.content}`;

    // Get summary from API
    const apiResponse = await browser.runtime.sendMessage({
      action: 'summarizeText',
      text: pageContent,
      apiKey: apiKey,
      model: modelSelect.value
    });

    if (apiResponse.error) {
      throw new Error(apiResponse.error);
    }

    return apiResponse.summary;
  } catch (error) {
    console.error('Error summarizing tab:', error);
    throw error;
  }
}

// Add event listeners
summarizeBtn.addEventListener('click', summarizeSelectedTabs);

// Show/hide loader function
function toggleLoader(show) {
  loader.style.display = show ? 'block' : 'none';
}

function updateApiStatus(message, success) {
  const apiStatus = document.getElementById('apiStatus');
  apiStatus.textContent = message;
  apiStatus.style.color = success ? 'var(--primary-color)' : '#ef4444';
}
