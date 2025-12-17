/**
 * Background service worker for LinguaFlow extension
 */

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateTranslation") {
    // Handle translation updates
    // This would make an API call to update the translation
    handleTranslationUpdate(message.key, message.value, message.projectId)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

async function handleTranslationUpdate(
  key: string,
  value: string,
  projectId: string
): Promise<void> {
  const config = await chrome.storage.sync.get(["linguaflow_config"]);
  const apiConfig = config.linguaflow_config;

  if (!apiConfig) {
    throw new Error("Extension not configured");
  }

  // Make API call to update translation
  // Note: This would require authentication - for now, we'll just log
  console.log("Translation update:", { key, value, projectId });
  
  // In a real implementation, you'd make an authenticated API call here
  // For now, this is a placeholder
}

