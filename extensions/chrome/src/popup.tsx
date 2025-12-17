/**
 * Extension popup UI
 * React component for the extension popup
 */

import React, { useState, useEffect } from "react";

interface Config {
  apiUrl: string;
  apiKey: string;
  projectId: string;
  enabled: boolean;
}

export function Popup() {
  const [config, setConfig] = useState<Config | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
    checkEditMode();
  }, []);

  async function loadConfig() {
    const result = await chrome.storage.sync.get(["linguaflow_config"]);
    setConfig(result.linguaflow_config || null);
    setLoading(false);
  }

  async function checkEditMode() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: "getEditMode" }, (response) => {
        if (response) {
          setEditMode(response.enabled);
        }
      });
    }
  }

  async function toggleEditMode() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: "toggleEditMode" }, (response) => {
        if (response) {
          setEditMode(response.enabled);
        }
      });
    }
  }

  async function reloadTranslations() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: "reloadTranslations" }, (response) => {
        if (response?.success) {
          alert("Translations reloaded!");
        }
      });
    }
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!config) {
    return (
      <div style={{ padding: "16px", minWidth: "300px" }}>
        <h2>LinguaFlow Extension</h2>
        <p>Please configure the extension in options.</p>
        <button onClick={openOptions}>Open Options</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px", minWidth: "300px" }}>
      <h2 style={{ marginTop: 0 }}>LinguaFlow</h2>
      
      <div style={{ marginBottom: "12px" }}>
        <strong>Project:</strong> {config.projectId}
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => {
              const newConfig = { ...config, enabled: e.target.checked };
              chrome.storage.sync.set({ linguaflow_config: newConfig });
              setConfig(newConfig);
            }}
          />
          {" "}Enable extension
        </label>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <button
          onClick={toggleEditMode}
          style={{
            padding: "8px 16px",
            backgroundColor: editMode ? "#ef4444" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          {editMode ? "Disable Edit Mode" : "Enable Edit Mode"}
        </button>

        <button
          onClick={reloadTranslations}
          style={{
            padding: "8px 16px",
            backgroundColor: "#6b7280",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Reload Translations
        </button>

        <button
          onClick={openOptions}
          style={{
            padding: "8px 16px",
            backgroundColor: "transparent",
            color: "#3b82f6",
            border: "1px solid #3b82f6",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Options
        </button>
      </div>
    </div>
  );
}

