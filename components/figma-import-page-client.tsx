"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Figma, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface FigmaImportPageClientProps {
  projectId: string;
}

export function FigmaImportPageClient({ projectId }: FigmaImportPageClientProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [figmaToken, setFigmaToken] = useState("");
  const [fileKey, setFileKey] = useState("");
  const [nodeIds, setNodeIds] = useState("");
  const [importResult, setImportResult] = useState<{
    success: boolean;
    keysCreated: number;
    translationsCreated: number;
    error?: string;
  } | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const handleImport = async () => {
    if (!figmaToken || !fileKey) {
      toast({
        title: "Missing information",
        description: "Please provide Figma access token and file key",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/import-figma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: figmaToken,
          fileKey,
          nodeIds: nodeIds ? nodeIds.split(",").map((id) => id.trim()).filter(Boolean) : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || "Figma import failed");
      }

      setImportResult({
        success: true,
        keysCreated: result.keysCreated || 0,
        translationsCreated: result.translationsCreated || 0,
      });

      toast({
        title: "Figma import successful",
        description: `Imported ${result.keysCreated} translation keys from Figma`,
      });

      // Auto-redirect after 2 seconds
      setTimeout(() => {
        router.push(`/projects/${projectId}/translations`);
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to import from Figma";
      setImportResult({
        success: false,
        keysCreated: 0,
        translationsCreated: 0,
        error: errorMessage,
      });

      toast({
        title: "Figma import failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Figma className="h-5 w-5" />
            Figma Configuration
          </CardTitle>
          <CardDescription>
            Connect to Figma and import text nodes as translation keys
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="figma-token">Figma Access Token *</Label>
            <Input
              id="figma-token"
              type="password"
              placeholder="figd_..."
              value={figmaToken}
              onChange={(e) => setFigmaToken(e.target.value)}
              disabled={isImporting}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Get your token from{" "}
              <a
                href="https://www.figma.com/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Figma Settings → Personal Access Tokens
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          <div>
            <Label htmlFor="file-key">Figma File Key *</Label>
            <Input
              id="file-key"
              placeholder="abc123xyz456"
              value={fileKey}
              onChange={(e) => setFileKey(e.target.value)}
              disabled={isImporting}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Found in the Figma file URL: <code className="bg-muted px-1 rounded">figma.com/file/[FILE_KEY]/...</code>
            </p>
          </div>

          <div>
            <Label htmlFor="node-ids">Node IDs (Optional)</Label>
            <Textarea
              id="node-ids"
              placeholder="123:456, 789:012"
              value={nodeIds}
              onChange={(e) => setNodeIds(e.target.value)}
              disabled={isImporting}
              rows={3}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Comma-separated list of specific node IDs to import. Leave empty to import all text nodes from the file.
            </p>
          </div>

          {importResult && (
            <Alert variant={importResult.success ? "default" : "destructive"}>
              {importResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {importResult.success ? "Import Successful" : "Import Failed"}
              </AlertTitle>
              <AlertDescription>
                {importResult.success ? (
                  <div className="space-y-1">
                    <p>Created {importResult.keysCreated} translation keys</p>
                    <p>Created {importResult.translationsCreated} translations</p>
                    <p className="text-sm mt-2">Redirecting to translations page...</p>
                  </div>
                ) : (
                  <p>{importResult.error}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => router.back()}
              variant="outline"
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={isImporting || !figmaToken || !fileKey}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Figma className="mr-2 h-4 w-4" />
                  Import from Figma
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p>
              The Figma import feature extracts all text nodes from your Figma design file and
              creates translation keys for them. This is useful for:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
              <li>Quickly setting up translation keys from design mockups</li>
              <li>Ensuring design and translation keys stay in sync</li>
              <li>Bulk importing UI text from Figma files</li>
            </ul>
            <p className="mt-4">
              <strong>Note:</strong> Only text nodes will be imported. Each text node becomes a
              translation key with the node ID as the key identifier.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

