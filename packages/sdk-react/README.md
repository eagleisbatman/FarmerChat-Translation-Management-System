# @linguaflow/sdk-react

LinguaFlow React SDK for seamless translation management in React and Next.js applications.

## Installation

```bash
npm install @linguaflow/sdk-react
```

## Quick Start

### 1. Setup Provider

Wrap your app with `LinguaFlowProvider`:

```tsx
// app/layout.tsx (Next.js App Router)
import { LinguaFlowProvider } from '@linguaflow/sdk-react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <LinguaFlowProvider
          config={{
            apiKey: process.env.NEXT_PUBLIC_LINGUAFLOW_API_KEY!,
            projectId: process.env.NEXT_PUBLIC_LINGUAFLOW_PROJECT_ID!,
            baseUrl: process.env.NEXT_PUBLIC_LINGUAFLOW_BASE_URL, // Optional
            defaultLanguage: 'en',
            cacheEnabled: true,
            cacheTTL: 5 * 60 * 1000, // 5 minutes
          }}
        >
          {children}
        </LinguaFlowProvider>
      </body>
    </html>
  );
}
```

### 2. Use Translations

#### Client Components

```tsx
'use client';

import { useTranslation } from '@linguaflow/sdk-react';

export function WelcomeMessage() {
  const { t, isLoading } = useTranslation({ language: 'en' });
  
  if (isLoading) return <div>Loading...</div>;
  
  return <h1>{t('welcome.message')}</h1>;
}
```

#### With Parameters

```tsx
import { useTranslation } from '@linguaflow/sdk-react';

export function Greeting({ name }: { name: string }) {
  const { t } = useTranslation();
  
  return <p>{t('greeting', { name })}</p>;
}
```

#### Translation Component

```tsx
import { Translation } from '@linguaflow/sdk-react';

export function Welcome() {
  return (
    <Translation 
      key="welcome.message" 
      language="en"
      fallback={<div>Loading...</div>}
    />
  );
}
```

### 3. Server Components (Next.js)

```tsx
// app/page.tsx
import { getTranslations } from '@linguaflow/sdk-react/server';

export default async function Page() {
  const translations = await getTranslations(
    {
      apiKey: process.env.LINGUAFLOW_API_KEY!,
      projectId: process.env.LINGUAFLOW_PROJECT_ID!,
    },
    { language: 'en' }
  );
  
  return <div>{translations.common.welcome}</div>;
}
```

## API Reference

### `LinguaFlowProvider`

Provider component that wraps your app to enable translation functionality.

**Props:**
- `config: LinguaFlowConfig` - Configuration object
- `children: ReactNode` - Your app content

### `useTranslation(options?)`

Hook to get translations in client components.

**Options:**
- `language?: string` - Language code (defaults to config defaultLanguage)
- `namespace?: string` - Namespace to load translations from
- `fallbackLanguage?: string` - Fallback language if translation not found
- `fallbackToKey?: boolean` - Return key if translation not found (default: true)

**Returns:**
- `t(key: string, params?: Record<string, string | number>)` - Translation function
- `isLoading: boolean` - Loading state
- `error: Error | null` - Error state
- `language: string` - Current language
- `translations: Translations` - All translations

### `useTranslations(options?)`

Hook to get all translations for a namespace.

**Options:**
- `language?: string` - Language code
- `namespace?: string` - Namespace to load

**Returns:**
- `translations: Translations` - All translations
- `isLoading: boolean` - Loading state
- `error: Error | null` - Error state
- `t(key: string, params?)` - Translation function

### `Translation` Component

Component for rendering translated text.

**Props:**
- `key: string` - Translation key
- `params?: Record<string, string | number>` - Parameters for interpolation
- `language?: string` - Language code
- `namespace?: string` - Namespace
- `fallback?: ReactNode` - Fallback content while loading
- `children?: (translation: string) => ReactNode` - Render prop

### Server Utilities

#### `getTranslations(config, options?)`

Fetch translations on the server side.

#### `getTranslation(translations, key, namespace?)`

Get a single translation value from translations object.

## Configuration

### Environment Variables

```env
NEXT_PUBLIC_LINGUAFLOW_API_KEY=your-api-key
NEXT_PUBLIC_LINGUAFLOW_PROJECT_ID=your-project-id
NEXT_PUBLIC_LINGUAFLOW_BASE_URL=https://your-tms.com  # Optional
```

### Config Options

- `apiKey: string` - Your LinguaFlow API key (required)
- `projectId: string` - Your project ID (required)
- `baseUrl?: string` - Base URL of your LinguaFlow instance (optional)
- `defaultLanguage?: string` - Default language code (default: "en")
- `cacheEnabled?: boolean` - Enable caching (default: true)
- `cacheTTL?: number` - Cache TTL in milliseconds (default: 5 minutes)

## Examples

### Namespace Support

```tsx
const { t } = useTranslation({ namespace: 'common' });
<div>{t('welcome')}</div> // Looks in common.welcome
```

### Parameter Interpolation

Translations support `{{param}}` syntax:

```tsx
// Translation: "Hello, {{name}}!"
const { t } = useTranslation();
<div>{t('greeting', { name: 'John' })}</div> // "Hello, John!"
```

### Multiple Languages

```tsx
const { t: tEn } = useTranslation({ language: 'en' });
const { t: tEs } = useTranslation({ language: 'es' });

<div>
  <p>{tEn('welcome')}</p>
  <p>{tEs('welcome')}</p>
</div>
```

## License

MIT

