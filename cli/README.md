# LinguaFlow CLI

Command-line tool for managing translations with LinguaFlow.

## Installation

```bash
npm install -g @linguaflow/cli
```

Or install from source:

```bash
cd cli
npm install
npm run build
npm link
```

## Usage

### Authentication

```bash
# Login (opens browser for OAuth)
linguaflow login

# Check authentication status
linguaflow status

# Logout
linguaflow logout
```

### Managing Projects

```bash
# Set default project
linguaflow project set <project-id>

# Get current project
linguaflow project get
```

### Pulling Translations

```bash
# Pull all translations
linguaflow pull <project-id>

# Pull specific language
linguaflow pull <project-id> --lang en

# Pull specific namespace
linguaflow pull <project-id> --namespace common

# Save to custom file
linguaflow pull <project-id> --output my-translations.json
```

### Pushing Translations

```bash
# Push translations from file
linguaflow push <project-id> --file translations.json

# Push with language
linguaflow push <project-id> --file translations.json --lang en

# Deprecate keys
linguaflow push <project-id> --file translations.json --deprecate "old.key1,old.key2"

# Push multiple files
linguaflow push <project-id> --pattern "locales/**/*.json"
```

### Syncing Translations

```bash
# Sync: pull, merge with local, and push
linguaflow sync <project-id>

# Sync with options
linguaflow sync <project-id> --lang en --file translations.json
```

## Configuration

The CLI stores configuration in:
- **macOS**: `~/Library/Preferences/linguaflow-nodejs/config.json`
- **Linux**: `~/.config/linguaflow/config.json`
- **Windows**: `%APPDATA%/linguaflow/config.json`

You can set the API URL via environment variable:
```bash
export LINGUAFLOW_API_URL=https://your-instance.com
```

## Example Workflow

```bash
# 1. Login
linguaflow login

# 2. Set default project
linguaflow project set my-project-id

# 3. Pull current translations
linguaflow pull

# 4. Edit translations.json locally

# 5. Push changes
linguaflow push

# Or sync (pull + merge + push)
linguaflow sync
```

## Integration with Agentic IDEs

The CLI can be used from Cursor, Claude Code, or any IDE:

```bash
# In your IDE terminal or script
linguaflow pull my-project-id --lang en --output src/locales/en.json
linguaflow push my-project-id --file src/locales/en.json
```

## Translation File Format

The CLI expects JSON files in this format:

```json
{
  "default": {
    "welcome": "Welcome",
    "hello": "Hello"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel"
  }
}
```

Keys are organized by namespace, with nested objects for each namespace.

