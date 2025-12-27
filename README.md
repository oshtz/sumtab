<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./chrome-extension/logo-inverse.png" width="200">
    <source media="(prefers-color-scheme: light)" srcset="./chrome-extension/logo.png" width="200">
    <img alt="sumtab logo" src="./chrome-extension/logo.png" width="200">
  </picture>
</p>

## sumtab - AI Tab Summaries for Chrome and Firefox
sumtab is a browser extension that summarizes the content of your open tabs with your chosen AI provider. Select tabs, pick a model, and get concise or detailed summaries without leaving the browser.

## Supported Browsers
- Chrome: https://chromewebstore.google.com/detail/sumtab/ebmhpcnomlfihekgildeopmlahicgbeb
- Firefox: https://addons.mozilla.org/en-US/firefox/addon/sumtab/
- Source folders: [chrome-extension](./chrome-extension), [firefox-extension](./firefox-extension)

## Features
- Summarize selected tabs from the current window in a popup or sidebar/side panel.
- Provider and model selection with live model lists (cached locally).
- Providers: OpenAI, OpenRouter, Anthropic, Google Gemini, Ollama (local), LM Studio (local), Custom (OpenAI-compatible, advanced).
- Tone (concise/neutral/detailed) and length (short/medium/long) controls.
- Bullet-point toggle for summaries.
- System prompt library with create/edit/delete.
- Local summary caching with clear/reset controls.
- Copy summaries or open them in a new tab.
- Light/dark theme toggle with OS preference.

## Installation

### Chrome
- Visit https://chromewebstore.google.com/detail/sumtab/ebmhpcnomlfihekgildeopmlahicgbeb
- Click "Add to Chrome"

### Firefox
- Visit https://addons.mozilla.org/en-US/firefox/addon/sumtab/
- Click "Add to Firefox"

## Usage
1. Open the sidebar/side panel or popup.
2. Choose a provider and model, then save your API key (not required for Ollama or LM Studio).
3. Select tabs and click "Summarize Selected".
4. Optionally switch to bullets, copy, or open the summary in a new tab.

## Notes
- Works on http(s) pages only; browser internal pages cannot be summarized.
- Ollama and LM Studio assume local servers running on `localhost`.
- Custom provider requires manual configuration of the base URL in the extension code.

## Privacy
- Requests go directly from your browser to the selected AI provider.
- API keys and cached summaries are stored in browser local storage.
- Only the tabs you explicitly select are processed.
- No tracking or analytics.

## License
[MIT License](LICENSE)
