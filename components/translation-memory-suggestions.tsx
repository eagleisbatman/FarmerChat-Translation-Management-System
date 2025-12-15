"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TranslationMemoryMatch {
  sourceText: string;
  targetText: string;
  similarity: number;
  usageCount: number;
}

interface TranslationMemorySuggestionsProps {
  sourceText: string;
  sourceLanguageId: string;
  targetLanguageId: string;
  projectId: string;
  onSelect: (text: string) => void;
}

export function TranslationMemorySuggestions({
  sourceText,
  sourceLanguageId,
  targetLanguageId,
  projectId,
  onSelect,
}: TranslationMemorySuggestionsProps) {
  const [matches, setMatches] = useState<TranslationMemoryMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (sourceText.trim().length > 3) {
      loadSuggestions();
    } else {
      setMatches([]);
    }
  }, [sourceText, sourceLanguageId, targetLanguageId, projectId]);

  const loadSuggestions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/translation-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText,
          sourceLanguageId,
          targetLanguageId,
          projectId,
          threshold: 0.6,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches || []);
      }
    } catch (error) {
      console.error("Error loading suggestions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (text: string) => {
    onSelect(text);
    toast({
      title: "Translation applied",
      description: "Translation from memory has been applied.",
    });
  };

  if (matches.length === 0 && !isLoading) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Translation Memory Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading suggestions...</p>
        ) : (
          matches.map((match, index) => (
            <div
              key={index}
              className="flex items-start justify-between p-2 border rounded hover:bg-accent transition-colors"
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{match.targetText}</p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(match.similarity * 100)}% match • Used {match.usageCount} times
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleSelect(match.targetText)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

