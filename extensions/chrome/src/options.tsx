/**
 * Options page for configuring the extension
 */

import React, { useState, useEffect } from "react";

interface Config {
  apiUrl: string;
  apiKey: string;
  projectId: string;
  enabled: boolean;
}

export function Options() {
  const [config, setConfig] = useState<Config>({
    apiUrl: "",
    apiKey: "",
    projectId: "",
    enabled: true,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    const result = await chrome.storage.sync.get(["linguaflow_config"]);
    if (result.linguaflow_config) {
      setConfig(result.linguaflow_config);
    }
  }

  async function saveConfig() {
    await chrome.storage.sync.set({ linguaflow_config: config });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", padding: "20px" }}>
      <h1>LinguaFlow Extension Settings</h1>

      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
          API URL
        </label>
        <input
          type="text"
          value={config.apiUrl}
          onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
          placeholder="https://your-linguaflow-instance.com"
          style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
        />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
          API Key
        </label>
        <input
          type="password"
          value={config.apiKey}
          onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
          placeholder="lf_..."
          style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
        />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
          Project ID
        </label>
        <input
          type="text"
          value={config.projectId}
          onChange={(e) => setConfig({ ...config, projectId: e.target.value })}
          placeholder="project-id"
          style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
        />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />
          {" "}Enable extension
        </label>
      </div>

      <button
        onClick={saveConfig}
        style={{
          padding: "10px 20px",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "16px",
        }}
      >
        {saved ? "✓ Saved!" : "Save Settings"}
      </button>

      <div style={{ marginTop: "20px", padding: "12px", backgroundColor: "#f3f4f6", borderRadius: "4px" }}>
        <h3 style={{ marginTop: 0 }}>How to use:</h3>
        <ol>
          <li>Enter your LinguaFlow API URL, API Key, and Project ID</li>
          <li>Click "Save Settings"</li>
          <li>Navigate to a page that uses LinguaFlow translations</li>
          <li>Click the extension icon and enable "Edit Mode"</li>
          <li>Click on highlighted translation elements to edit them</li>
        </ol>
      </div>
    </div>
  );
}

