"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Figma } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface FigmaImportDialogProps {
  projectId: string;
  onSuccess?: () => void;
}

export function FigmaImportDialog({ projectId, onSuccess }: FigmaImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [figmaToken, setFigmaToken] = useState("");
  const [fileKey, setFileKey] = useState("");
  const [nodeIds, setNodeIds] = useState("");
  const { toast } = useToast();

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
    try {
      const response = await fetch(`/api/projects/${projectId}/import-figma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: figmaToken,
          fileKey,
          nodeIds: nodeIds ? nodeIds.split(",").map((id) => id.trim()) : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Figma import failed");
      }

      const result = await response.json();
      toast({
        title: "Figma import successful",
        description: `Imported ${result.keysCreated} translation keys from Figma`,
      });
      setIsOpen(false);
      setFigmaToken("");
      setFileKey("");
      setNodeIds("");
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Figma import failed",
        description: error instanceof Error ? error.message : "Failed to import from Figma",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Figma className="mr-2 h-4 w-4" />
          Import from Figma
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from Figma</DialogTitle>
          <DialogDescription>
            Import text nodes from a Figma file as translation keys
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="figma-token">Figma Access Token *</Label>
            <Input
              id="figma-token"
              type="password"
              placeholder="figd_..."
              value={figmaToken}
              onChange={(e) => setFigmaToken(e.target.value)}
              disabled={isImporting}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Get your token from Figma → Settings → Personal Access Tokens
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
            />
            <p className="text-xs text-muted-foreground mt-1">
              Found in the Figma file URL: figma.com/file/[FILE_KEY]/...
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
            />
            <p className="text-xs text-muted-foreground mt-1">
              Comma-separated list of specific node IDs to import. Leave empty to import all text nodes.
            </p>
          </div>
          <Button onClick={handleImport} className="w-full" disabled={isImporting || !figmaToken || !fileKey}>
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
      </DialogContent>
    </Dialog>
  );
}

