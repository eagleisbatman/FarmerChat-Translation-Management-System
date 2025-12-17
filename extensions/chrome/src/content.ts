/**
 * Content script for LinguaFlow Chrome Extension
 * Detects and highlights translation keys on the page
 */

interface TranslationKey {
  key: string;
  value: string;
  namespace?: string;
  language: string;
}

interface Config {
  apiUrl: string;
  apiKey: string;
  projectId: string;
  enabled: boolean;
}

let config: Config | null = null;
let translations: Record<string, string> = {};
let isEditMode = false;

// Load configuration
async function loadConfig(): Promise<Config | null> {
  const result = await chrome.storage.sync.get(["linguaflow_config"]);
  return result.linguaflow_config || null;
}

// Load translations from API
async function loadTranslations(): Promise<void> {
  if (!config) return;

  try {
    const response = await fetch(
      `${config.apiUrl}/api/v1/translations?lang=${navigator.language.split("-")[0]}`,
      {
        headers: {
          "X-API-Key": config.apiKey,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      // Flatten namespace structure
      translations = {};
      for (const namespace in data) {
        for (const key in data[namespace]) {
          translations[key] = data[namespace][key];
        }
      }
    }
  } catch (error) {
    console.error("Failed to load translations:", error);
  }
}

// Find elements with translation keys (data attributes or text matching)
function findTranslationElements(): Array<{ element: HTMLElement; key: string; value: string }> {
  const found: Array<{ element: HTMLElement; key: string; value: string }> = [];

  // Look for data-translation-key attributes
  const elementsWithKeys = document.querySelectorAll("[data-translation-key]");
  elementsWithKeys.forEach((el) => {
    const key = el.getAttribute("data-translation-key");
    if (key && translations[key]) {
      found.push({
        element: el as HTMLElement,
        key,
        value: translations[key],
      });
    }
  });

  // Also check for text content matching translations (for SDK-rendered content)
  const allElements = document.querySelectorAll("*");
  allElements.forEach((el) => {
    const text = el.textContent?.trim();
    if (text && translations[text]) {
      // Avoid nested matches
      if (!el.querySelector("[data-translation-key]")) {
        found.push({
          element: el as HTMLElement,
          key: text,
          value: translations[text],
        });
      }
    }
  });

  return found;
}

// Highlight translation elements
function highlightElements(elements: Array<{ element: HTMLElement; key: string; value: string }>): void {
  elements.forEach(({ element, key, value }) => {
    element.setAttribute("data-linguaflow-key", key);
    element.setAttribute("data-linguaflow-value", value);
    element.classList.add("linguaflow-highlight");
    
    // Add hover tooltip
    element.title = `Translation Key: ${key}\nValue: ${value}`;
  });
}

// Remove highlights
function removeHighlights(): void {
  const highlighted = document.querySelectorAll(".linguaflow-highlight");
  highlighted.forEach((el) => {
    el.classList.remove("linguaflow-highlight");
    el.removeAttribute("data-linguaflow-key");
    el.removeAttribute("data-linguaflow-value");
  });
}

// Initialize extension
async function init(): Promise<void> {
  config = await loadConfig();
  
  if (!config || !config.enabled) {
    return;
  }

  await loadTranslations();
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "toggleEditMode") {
      isEditMode = !isEditMode;
      
      if (isEditMode) {
        const elements = findTranslationElements();
        highlightElements(elements);
      } else {
        removeHighlights();
      }
      
      sendResponse({ enabled: isEditMode });
    } else if (message.action === "reloadTranslations") {
      loadTranslations().then(() => {
        if (isEditMode) {
          removeHighlights();
          const elements = findTranslationElements();
          highlightElements(elements);
        }
        sendResponse({ success: true });
      });
    }
  });
}

// Inject CSS
const style = document.createElement("style");
style.textContent = `
  .linguaflow-highlight {
    outline: 2px dashed #3b82f6 !important;
    outline-offset: 2px !important;
    cursor: pointer !important;
    position: relative !important;
  }
  
  .linguaflow-highlight:hover {
    outline-color: #2563eb !important;
    background-color: rgba(59, 130, 246, 0.1) !important;
  }
  
  .linguaflow-editor {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border: 2px solid #3b82f6;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    z-index: 999999;
    min-width: 400px;
    max-width: 600px;
  }
  
  .linguaflow-editor h3 {
    margin: 0 0 15px 0;
    color: #1e40af;
  }
  
  .linguaflow-editor input,
  .linguaflow-editor textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    margin-bottom: 10px;
  }
  
  .linguaflow-editor button {
    padding: 8px 16px;
    margin-right: 8px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .linguaflow-editor .save-btn {
    background: #3b82f6;
    color: white;
  }
  
  .linguaflow-editor .cancel-btn {
    background: #6b7280;
    color: white;
  }
`;

document.head.appendChild(style);

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

