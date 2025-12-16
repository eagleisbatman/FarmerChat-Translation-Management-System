"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";

type AIProvider = "openai" | "gemini" | "google-translate" | null;

interface AIProviderConfigProps {
  projectId: string;
  currentProvider: AIProvider;
  currentFallback: AIProvider;
}

export function AIProviderConfig({
  projectId,
  currentProvider,
  currentFallback,
}: AIProviderConfigProps) {
  const [provider, setProvider] = useState<AIProvider>(currentProvider);
  const [fallback, setFallback] = useState<AIProvider>(currentFallback);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiProvider: provider,
          aiFallbackProvider: fallback,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update AI provider settings");
      }

      toast({
        title: "AI Provider Updated",
        description: "AI translation provider settings have been saved.",
      });

      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update AI provider settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = provider !== currentProvider || fallback !== currentFallback;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Translation Provider
        </CardTitle>
        <CardDescription>
          Configure AI providers for automatic translation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="provider">Primary Provider</Label>
          <Select
            value={provider || ""}
            onValueChange={(value) => setProvider(value === "" ? null : (value as AIProvider))}
          >
            <SelectTrigger id="provider">
              <SelectValue placeholder="Select AI provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None (disabled)</SelectItem>
              <SelectItem value="openai">OpenAI GPT</SelectItem>
              <SelectItem value="gemini">Google Gemini</SelectItem>
              <SelectItem value="google-translate">Google Translate</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Primary AI provider used for automatic translation
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fallback">Fallback Provider</Label>
          <Select
            value={fallback || ""}
            onValueChange={(value) => setFallback(value === "" ? null : (value as AIProvider))}
          >
            <SelectTrigger id="fallback">
              <SelectValue placeholder="Select fallback provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None (no fallback)</SelectItem>
              <SelectItem value="openai">OpenAI GPT</SelectItem>
              <SelectItem value="gemini">Google Gemini</SelectItem>
              <SelectItem value="google-translate">Google Translate</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Fallback provider used if primary provider fails
          </p>
        </div>

        {hasChanges && (
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? "Saving..." : "Save AI Provider Settings"}
          </Button>
        )}

        {!provider && (
          <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
            AI translation is currently disabled. Enable a provider above to use automatic translation.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

