"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Bot, Image as ImageIcon, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

type AIProvider = "openai" | "gemini" | "google-translate";

interface AIModelConfigProps {
  projectId: string;
  initialAiProvider?: AIProvider;
  initialAiFallbackProvider?: AIProvider;
}

interface ModelInfo {
  name: string;
  supportsImages: boolean;
  description: string;
  cost?: string;
}

const MODEL_INFO: Record<AIProvider, ModelInfo> = {
  openai: {
    name: "OpenAI GPT-4o",
    supportsImages: true,
    description: "Best for image + text translation. Uses GPT-4o for vision, GPT-4o-mini for text-only.",
    cost: "$$$",
  },
  gemini: {
    name: "Google Gemini",
    supportsImages: true,
    description: "Good for image + text translation. Uses gemini-pro-vision for images, gemini-pro for text.",
    cost: "$$",
  },
  "google-translate": {
    name: "Google Translate",
    supportsImages: false,
    description: "Fast and cost-effective for text-only translation. No image support.",
    cost: "$",
  },
};

export function AIModelConfig({
  projectId,
  initialAiProvider,
  initialAiFallbackProvider,
}: AIModelConfigProps) {
  const [primaryProvider, setPrimaryProvider] = useState<AIProvider | undefined>(
    initialAiProvider
  );
  const [fallbackProvider, setFallbackProvider] = useState<AIProvider | undefined>(
    initialAiFallbackProvider
  );
  const [isSaving, setIsSaving] = useState(false);
  const [useImageContext, setUseImageContext] = useState(true);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiProvider: primaryProvider,
          aiFallbackProvider: fallbackProvider,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update AI settings");
      }

      toast({
        title: "AI Settings Updated",
        description: "AI translation providers have been configured.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update AI settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Filter providers based on image context preference
  const availableProviders = Object.entries(MODEL_INFO).filter(([_, info]) =>
    useImageContext ? true : !info.supportsImages || true // Show all, but highlight appropriate ones
  ) as [AIProvider, ModelInfo][];

  const getRecommendedProvider = (): AIProvider | null => {
    if (useImageContext) {
      // Recommend providers that support images
      return primaryProvider && MODEL_INFO[primaryProvider].supportsImages
        ? primaryProvider
        : "openai"; // Default to OpenAI for image support
    } else {
      // Recommend cost-effective text-only providers
      return "google-translate";
    }
  };

  const recommendedProvider = getRecommendedProvider();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Translation Configuration
          </CardTitle>
          <CardDescription>
            Configure AI models for automatic translation. Models are selected based on whether
            image context is available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Image Context Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="image-context" className="text-base font-medium">
                Use Image Context
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, screenshots are sent to AI for context-aware translation
              </p>
            </div>
            <Switch
              id="image-context"
              checked={useImageContext}
              onCheckedChange={setUseImageContext}
            />
          </div>

          {/* Primary Provider */}
          <div className="space-y-2">
            <Label htmlFor="primary-provider">Primary AI Provider *</Label>
            <Select
              value={primaryProvider}
              onValueChange={(value: AIProvider) => setPrimaryProvider(value)}
              disabled={isSaving}
            >
              <SelectTrigger id="primary-provider">
                <SelectValue placeholder="Select primary provider" />
              </SelectTrigger>
              <SelectContent>
                {availableProviders.map(([provider, info]) => (
                  <SelectItem key={provider} value={provider}>
                    <div className="flex items-center gap-2">
                      {info.supportsImages ? (
                        <ImageIcon className="h-4 w-4 text-blue-500" />
                      ) : (
                        <FileText className="h-4 w-4 text-gray-500" />
                      )}
                      <span>{info.name}</span>
                      {recommendedProvider === provider && (
                        <Badge variant="outline" className="ml-2">Recommended</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {primaryProvider && (
              <div className="mt-2 p-3 bg-muted rounded-md">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{MODEL_INFO[primaryProvider].name}</span>
                  {MODEL_INFO[primaryProvider].supportsImages && (
                    <Badge variant="secondary" className="text-xs">
                      <ImageIcon className="h-3 w-3 mr-1" />
                      Image Support
                    </Badge>
                  )}
                  {MODEL_INFO[primaryProvider].cost && (
                    <Badge variant="outline" className="text-xs">
                      {MODEL_INFO[primaryProvider].cost}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {MODEL_INFO[primaryProvider].description}
                </p>
                {useImageContext && !MODEL_INFO[primaryProvider].supportsImages && (
                  <p className="text-xs text-yellow-600 mt-1">
                    ⚠️ This provider doesn't support images. Consider switching to OpenAI or Gemini.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Fallback Provider */}
          <div className="space-y-2">
            <Label htmlFor="fallback-provider">Fallback AI Provider (Optional)</Label>
            <Select
              value={fallbackProvider}
              onValueChange={(value: AIProvider) => setFallbackProvider(value)}
              disabled={isSaving}
            >
              <SelectTrigger id="fallback-provider">
                <SelectValue placeholder="Select fallback provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {availableProviders
                  .filter(([p]) => p !== primaryProvider)
                  .map(([provider, info]) => (
                    <SelectItem key={provider} value={provider}>
                      <div className="flex items-center gap-2">
                        {info.supportsImages ? (
                          <ImageIcon className="h-4 w-4 text-blue-500" />
                        ) : (
                          <FileText className="h-4 w-4 text-gray-500" />
                        )}
                        <span>{info.name}</span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {fallbackProvider && (
              <div className="mt-2 p-3 bg-muted rounded-md">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{MODEL_INFO[fallbackProvider].name}</span>
                  {MODEL_INFO[fallbackProvider].supportsImages && (
                    <Badge variant="secondary" className="text-xs">
                      <ImageIcon className="h-3 w-3 mr-1" />
                      Image Support
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {MODEL_INFO[fallbackProvider].description}
                </p>
              </div>
            )}
          </div>

          {/* Model Selection Guide */}
          <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
            <h4 className="text-sm font-medium mb-2">Model Selection Guide</h4>
            <ul className="text-xs space-y-1 text-muted-foreground">
              <li className="flex items-start gap-2">
                <ImageIcon className="h-3 w-3 mt-0.5 text-blue-500" />
                <span>
                  <strong>With Images:</strong> Use OpenAI GPT-4o or Gemini Pro Vision for
                  context-aware translation
                </span>
              </li>
              <li className="flex items-start gap-2">
                <FileText className="h-3 w-3 mt-0.5 text-gray-500" />
                <span>
                  <strong>Text Only:</strong> Use Google Translate for cost-effective, fast
                  translation
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-xs">💡</span>
                <span>
                  The system automatically selects the appropriate model based on whether
                  screenshots are available
                </span>
              </li>
            </ul>
          </div>

          <Button onClick={handleSave} disabled={isSaving || !primaryProvider}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save AI Configuration
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

