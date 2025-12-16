"use client";

import { useState } from "react";
import { CopyApiKeyButton } from "@/components/copy-api-key-button";
import { RegenerateApiKeyButton } from "@/components/regenerate-api-key-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Key } from "lucide-react";

interface ApiKeyCardProps {
  projectId: string;
  initialApiKey: string;
}

export function ApiKeyCard({ projectId, initialApiKey }: ApiKeyCardProps) {
  const [apiKey, setApiKey] = useState(initialApiKey);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Key
        </CardTitle>
        <CardDescription>Manage API access for this project</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">API Key</label>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                {apiKey}
              </code>
              <CopyApiKeyButton apiKey={apiKey} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Use this key to access translations via the API
            </p>
          </div>
          <RegenerateApiKeyButton
            projectId={projectId}
            onRegenerated={(newApiKey) => {
              setApiKey(newApiKey);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

