# LinguaFlow Chrome Extension

In-context translation editing for LinguaFlow-managed translations.

## Features

- **Visual Translation Editing**: Highlight and edit translations directly on production sites
- **Real-time Preview**: See changes immediately
- **SDK Integration**: Works with LinguaFlow SDK-rendered translations
- **Data Attribute Support**: Detects `data-translation-key` attributes

## Installation

1. Build the extension:
   ```bash
   cd extensions/chrome
   npm install
   npm run build
   ```

2. Load unpacked extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extensions/chrome` directory

## Configuration

1. Click the extension icon
2. Click "Options"
3. Enter your:
   - **API URL**: Your LinguaFlow instance URL (e.g., `https://linguaflow.example.com`)
   - **API Key**: Your project's API key (starts with `lf_`)
   - **Project ID**: Your project ID
4. Click "Save Settings"

## Usage

1. Navigate to a page that uses LinguaFlow translations
2. Click the extension icon
3. Click "Enable Edit Mode"
4. Translation elements will be highlighted with blue outlines
5. Click on any highlighted element to edit its translation
6. Changes are saved to LinguaFlow (requires authentication)

## Development

The extension uses:
- TypeScript for type safety
- React for UI components
- Chrome Extension Manifest V3

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

## Limitations

- Currently requires manual authentication (full OAuth flow coming soon)
- Translation updates require API authentication
- Works best with SDK-rendered translations or `data-translation-key` attributes

