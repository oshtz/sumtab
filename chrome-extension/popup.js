const darkModeToggle = document.getElementById('darkMode');
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark' || (!savedTheme && prefersDarkScheme.matches)) {
  document.body.setAttribute('data-theme', 'dark');
  darkModeToggle.checked = true;
}

darkModeToggle.addEventListener('change', handleThemeChange);

let summaryCache = {
  regular: {},
  bullets: {},
  timestamp: 0
};
const tabList = document.getElementById('tabList');
const apiKeyInput = document.getElementById('apiKey');
const saveApiKeyBtn = document.getElementById('saveApiKey');
const summarizeSelectedBtn = document.getElementById('summarizeSelected');
const modelSelect = document.getElementById('modelSelect');
const resultsDiv = document.getElementById('results');
const summaryContent = document.getElementById('summaryContent');
const selectAllBtn = document.getElementById('selectAll');
const deselectAllBtn = document.getElementById('deselectAll');
const openInNewTabBtn = document.getElementById('openInNewTab');
const clearBtn = document.getElementById('clearBtn');
const bulletsBtn = document.getElementById('bulletsBtn');
const copyBtn = document.getElementById('copyBtn');
const loader = document.getElementById('loader');
const apiStatus = document.getElementById('apiStatus');

let tabs = [];
let currentSummary = '';
let bulletSummary = '';
let isBulletMode = false;

async function loadCachedSummaries() {
  try {
    const data = await chrome.storage.local.get('summaryCache');
    if (data.summaryCache) {
      summaryCache = data.summaryCache;
      
      const tabs = await chrome.tabs.query({});
      const summaryContent = document.getElementById('summaryContent');
      
      summaryContent.innerHTML = '';
      
      for (const tab of tabs) {
        const regularSummary = summaryCache.regular[tab.url];
        const bulletSummary = summaryCache.bullets[tab.url];
        
        if (regularSummary || bulletSummary) {
          const summaryItem = document.createElement('div');
          summaryItem.className = 'summary-item';
          summaryItem.setAttribute('data-tab-id', tab.id);
          
          summaryItem.innerHTML = `
            <div class="summary-title">${tab.title}</div>
            <div class="summary-text">${regularSummary || bulletSummary}</div>
          `;
          
          summaryContent.appendChild(summaryItem);
          
          const resultsCard = document.getElementById('results');
          if (resultsCard) {
            resultsCard.style.display = 'block';
          }
        }
      }
    }
  } catch (error) {
    console.error('Error loading cached summaries:', error);
  }
}

async function saveSummariesToStorage() {
  try {
    const cacheWithTimestamp = {
      ...summaryCache,
      timestamp: Date.now()
    };
    await chrome.storage.local.set({ summaryCache: cacheWithTimestamp });
  } catch (error) {
    console.error('Error saving summaries to storage:', error);
  }
}

async function clearOldSummaries() {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  
  if (summaryCache.timestamp && (now - summaryCache.timestamp > oneDayMs)) {
    summaryCache = {
      regular: {},
      bullets: {},
      timestamp: now
    };
    await saveSummariesToStorage();
  }
}

async function loadTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const tabListContainer = document.getElementById('tabList');
    tabListContainer.innerHTML = '';

    if (tabs.length === 0) {
      tabListContainer.innerHTML = '<div class="no-tabs">No tabs available in current window</div>';
      return;
    }

    for (const tab of tabs) {
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        continue;
      }

      const tabElement = createTabElement(tab);
      
      if (summaryCache.regular[tab.url]) {
        const cached = summaryCache.regular[tab.url];
        if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
          const summaryElement = tabElement.querySelector('.tab-summary');
          if (summaryElement) {
            summaryElement.textContent = cached.summary;
            summaryElement.style.display = 'block';
          }
        }
      }
      
      tabListContainer.appendChild(tabElement);
    }

    updateSummarizeButtonState();
  } catch (error) {
    console.error('Error loading tabs:', error);
    updateApiStatus('Error loading tabs: ' + error.message, false);
  }
}

function createTabElement(tab) {
  const tabDiv = document.createElement('div');
  tabDiv.className = 'tab-item';
  tabDiv.setAttribute('data-tab-id', tab.id);

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'tab-checkbox';
  checkbox.setAttribute('data-tab-id', tab.id);

  tabDiv.addEventListener('click', (e) => {
    if (e.target !== checkbox) {
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    }
  });

  checkbox.addEventListener('change', updateSummarizeButtonState);

  const tabContent = document.createElement('div');
  tabContent.className = 'tab-content';

  const favicon = document.createElement('img');
  favicon.src = tab.favIconUrl || 'icons/icon-16.png';
  favicon.className = 'tab-favicon';
  favicon.onerror = () => favicon.src = 'icons/icon-16.png';

  const title = document.createElement('span');
  title.className = 'tab-title';
  title.textContent = tab.title;
  title.title = tab.title;

  const loader = document.createElement('div');
  loader.className = 'tab-loader';
  loader.style.display = 'none';
  loader.innerHTML = '<div class="loader-spinner small"></div>';

  tabContent.appendChild(favicon);
  tabContent.appendChild(title);
  tabContent.appendChild(loader);

  tabDiv.appendChild(checkbox);
  tabDiv.appendChild(tabContent);

  return tabDiv;
}

function updateSummarizeButtonState() {
  const selectedCount = document.querySelectorAll('.tab-checkbox:checked').length;
  summarizeSelectedBtn.disabled = selectedCount === 0;
}

function getSelectedTabs() {
  const checkboxes = document.querySelectorAll('.tab-checkbox:checked');
  return Array.from(checkboxes).map(checkbox => {
    const tabId = parseInt(checkbox.getAttribute('data-tab-id'));
    return { id: tabId, element: checkbox.closest('.tab-item') };
  });
}

async function handleSummarizeSelected() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    updateApiStatus('Please enter your API key first.', false);
    return;
  }

  const selectedTabs = document.querySelectorAll('.tab-checkbox:checked');
  if (selectedTabs.length === 0) {
    updateApiStatus('Please select at least one tab to summarize.', false);
    return;
  }

  summarizeSelectedBtn.disabled = true;
  toggleLoader(true);
  updateApiStatus('Summarizing selected tabs...', true);

  try {
    for (const checkbox of selectedTabs) {
      const tabId = parseInt(checkbox.getAttribute('data-tab-id'));
      const tabElement = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
      
      try {
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'loader-spinner small';
        tabElement.appendChild(loadingSpinner);

        const response = await chrome.runtime.sendMessage({
          action: 'summarizeTab',
          tabId,
          apiKey,
          model: modelSelect.value
        });

        if (response.error) {
          throw new Error(response.error);
        }

        const tab = await chrome.tabs.get(tabId);
        
        summaryCache.regular[tab.url] = response.summary;
        await saveSummariesToStorage();

        await updateTabSummary(tabId, response.summary, false);

      } catch (error) {
        console.error(`Error summarizing tab ${tabId}:`, error);
        updateApiStatus(`Error summarizing tab: ${error.message}`, false);
      } finally {
        const spinner = tabElement.querySelector('.loader-spinner');
        if (spinner) spinner.remove();
      }
    }

    updateApiStatus('Summarization complete!', true);
  } catch (error) {
    console.error('Error in handleSummarizeSelected:', error);
    updateApiStatus('Error: ' + error.message, false);
  } finally {
    toggleLoader(false);
    summarizeSelectedBtn.disabled = false;
  }
}

async function updateTabSummary(tabId, summary, isBulletStyle = false) {
  const summaryContent = document.getElementById('summaryContent');
  const existingItem = summaryContent.querySelector(`[data-tab-id="${tabId}"]`);
  
  try {
    const tab = await chrome.tabs.get(tabId);
    
    if (isBulletStyle) {
      summaryCache.bullets[tab.url] = summary;
    } else {
      summaryCache.regular[tab.url] = summary;
    }

    if (existingItem) {
      existingItem.querySelector('.summary-text').textContent = summary;
    } else {
      const summaryItem = document.createElement('div');
      summaryItem.className = 'summary-item';
      summaryItem.setAttribute('data-tab-id', tabId);
      
      summaryItem.innerHTML = `
        <div class="summary-title">${tab.title}</div>
        <div class="summary-text">${summary}</div>
      `;
      
      summaryContent.appendChild(summaryItem);
    }

    const resultsCard = document.getElementById('results');
    if (resultsCard) {
      resultsCard.style.display = 'block';
    }

    await saveSummariesToStorage();
  } catch (error) {
    console.error('Error updating tab summary:', error);
  }
}

async function toggleSummaryMode() {
  const summaryContent = document.getElementById('summaryContent');
  const items = summaryContent.querySelectorAll('.summary-item');
  const apiKey = apiKeyInput.value.trim();
  const bulletsBtn = document.getElementById('bulletsBtn');
  
  if (!apiKey) {
    updateApiStatus('Please enter your API key first.', false);
    return;
  }

  bulletsBtn.disabled = true;

  try {
    let needsConversion = false;
    for (const item of items) {
      const tabId = parseInt(item.getAttribute('data-tab-id'));
      const tab = await chrome.tabs.get(tabId);
      const currentText = item.querySelector('.summary-text').textContent;
      
      if (!summaryCache.bullets[tab.url] && currentText === summaryCache.regular[tab.url]) {
        needsConversion = true;
        break;
      }
    }

    if (needsConversion) {
      toggleLoader(true);
      updateApiStatus('Converting summaries to bullet points...', true);
    }

    for (const item of items) {
      const tabId = parseInt(item.getAttribute('data-tab-id'));
      
      try {
        const tab = await chrome.tabs.get(tabId);
        const currentText = item.querySelector('.summary-text').textContent;
        
        if (summaryCache.bullets[tab.url]) {
          if (currentText === summaryCache.bullets[tab.url]) {
            item.querySelector('.summary-text').textContent = summaryCache.regular[tab.url];
          } else {
            item.querySelector('.summary-text').textContent = summaryCache.bullets[tab.url];
          }
        } else {
          const response = await chrome.runtime.sendMessage({
            action: 'summarizeText',
            text: `Convert this summary into a concise bullet-point format, focusing on the key points. Keep each bullet point brief and clear. Original summary: ${currentText}`,
            apiKey,
            model: modelSelect.value
          });

          if (response.error) {
            throw new Error(response.error);
          }

          await updateTabSummary(tabId, response.summary, true);
        }
      } catch (error) {
        console.error(`Error toggling summary for tab ${tabId}:`, error);
        updateApiStatus(`Error converting summary: ${error.message}`, false);
      }
    }
  } catch (error) {
    console.error('Error processing summaries:', error);
    updateApiStatus('Error processing summaries: ' + error.message, false);
  } finally {
    bulletsBtn.disabled = false;
    toggleLoader(false);
  }
}

function getAllSummariesText() {
  const summaryContent = document.getElementById('summaryContent');
  const summaries = [];
  
  summaryContent.querySelectorAll('.summary-item').forEach(item => {
    const title = item.querySelector('.summary-title').textContent;
    const text = item.querySelector('.summary-text').textContent;
    summaries.push(`${title}\n${text}\n`);
  });
  
  return summaries.join('\n');
}

async function handleClear() {
  const summaryContent = document.getElementById('summaryContent');
  if (summaryContent) {
    summaryContent.innerHTML = '';
  }
  
  const resultsCard = document.getElementById('results');
  if (resultsCard) {
    resultsCard.style.display = 'none';
  }

  summaryCache = {
    regular: {},
    bullets: {},
    timestamp: 0
  };

  try {
    await chrome.storage.local.remove('summaryCache');
    updateApiStatus('Summaries cleared', true);
  } catch (error) {
    console.error('Error clearing summaries:', error);
    updateApiStatus('Error clearing summaries', false);
  }
}

function handleCopy() {
  const text = getAllSummariesText();
  if (!text) return;

  navigator.clipboard.writeText(text).then(() => {
    const copyBtn = document.getElementById('copyBtn');
    copyBtn.classList.add('copied');
    setTimeout(() => copyBtn.classList.remove('copied'), 2000);
  });
}

function handleOpenInNewTab() {
  const text = getAllSummariesText();
  if (!text) return;

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  chrome.tabs.create({ url }, () => {
    URL.revokeObjectURL(url);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Popup loaded, initializing...');
    
    await loadCachedSummaries();
    
    await clearOldSummaries();
    
    const settings = await chrome.storage.local.get([
      'apiKey',
      'model'
    ]);

    if (settings.apiKey) {
      apiKeyInput.value = settings.apiKey;
      updateApiStatus('API key loaded', true);
    }

    if (settings.model) {
      modelSelect.value = settings.model;
    }

    await loadTabs();

    setupEventListeners();
  } catch (error) {
    console.error('Error initializing popup:', error);
    updateApiStatus('Error initializing: ' + error.message, false);
  }
});

function setupEventListeners() {
  const elements = {
    summarizeSelected: document.getElementById('summarizeSelected'),
    saveApiKey: document.getElementById('saveApiKey'),
    darkMode: document.getElementById('darkMode'),
    modelSelect: document.getElementById('modelSelect'),
    selectAll: document.getElementById('selectAll'),
    deselectAll: document.getElementById('deselectAll'),
    copy: document.getElementById('copyBtn'),
    openInNewTab: document.getElementById('openInNewTab'),
    clearBtn: document.getElementById('clearBtn'),
    bulletsBtn: document.getElementById('bulletsBtn')
  };

  elements.summarizeSelected?.addEventListener('click', handleSummarizeSelected);
  elements.saveApiKey?.addEventListener('click', handleSaveApiKey);
  elements.darkMode?.addEventListener('change', handleThemeChange);
  elements.modelSelect?.addEventListener('change', handleModelChange);
  elements.selectAll?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.tab-checkbox');
    checkboxes.forEach(cb => cb.checked = true);
    updateSummarizeButtonState();
  });
  elements.deselectAll?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.tab-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    updateSummarizeButtonState();
  });
  elements.copy?.addEventListener('click', handleCopy);
  elements.openInNewTab?.addEventListener('click', handleOpenInNewTab);
  elements.clearBtn?.addEventListener('click', handleClear);
  elements.bulletsBtn?.addEventListener('click', toggleSummaryMode);
}

function handleModelChange() {
  const model = document.getElementById('modelSelect').value;
  chrome.storage.local.set({ model });
}

function handleSaveApiKey() {
  const apiKey = apiKeyInput.value.trim();
  if (apiKey) {
    chrome.storage.local.set({ apiKey }, () => {
      updateApiStatus('API key saved successfully!', true);
    });
  } else {
    updateApiStatus('Please enter an API key', false);
  }
}

function handleThemeChange() {
  const isDarkMode = document.getElementById('darkMode').checked;
  if (isDarkMode) {
    document.body.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.body.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  }
}

function toggleLoader(show) {
  loader.style.display = show ? 'block' : 'none';
  document.getElementById('main-content').style.display = show ? 'none' : 'block';
}

function updateApiStatus(message, success) {
  apiStatus.textContent = message;
  apiStatus.className = `api-status ${success ? 'success' : 'error'}`;
  setTimeout(() => {
    apiStatus.textContent = '';
    apiStatus.className = 'api-status';
  }, 3000);
}
