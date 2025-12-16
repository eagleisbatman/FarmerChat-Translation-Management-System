"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2 } from "lucide-react";

interface AutoTranslateButtonProps {
  projectId: string;
  sourceText: string;
  sourceLanguageId: string;
  targetLanguageId: string;
  onTranslate: (translatedText: string) => void;
  keyId?: string; // Optional: to fetch associated screenshots
  imageUrl?: string; // Optional: direct image URL
  context?: string; // Optional: additional context
}

export function AutoTranslateButton({
  projectId,
  sourceText,
  sourceLanguageId,
  targetLanguageId,
  onTranslate,
  keyId,
  imageUrl,
  context,
}: AutoTranslateButtonProps) {
  const [isTranslating, setIsTranslating] = useState(false);
  const { toast } = useToast();

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      toast({
        title: "No text",
        description: "Please provide source text to translate",
        variant: "destructive",
      });
      return;
    }

    setIsTranslating(true);
    try {
      const response = await fetch("/api/auto-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          text: sourceText,
          sourceLanguageId,
          targetLanguageId,
          keyId,
          imageUrl,
          context,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Translation failed");
      }

      const result = await response.json();
      onTranslate(result.translatedText);

      toast({
        title: "Translation complete",
        description: `Translated using ${result.provider}`,
      });
    } catch (error) {
      toast({
        title: "Translation failed",
        description: error instanceof Error ? error.message : "Failed to translate",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleTranslate}
      disabled={isTranslating || !sourceText.trim()}
    >
      {isTranslating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Translating...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Auto Translate
        </>
      )}
    </Button>
  );
}

