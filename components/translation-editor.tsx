"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Save, CheckCircle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddKeyDialog } from "./add-key-dialog";
import { FileImportExport } from "./file-import-export";
import { AutoTranslateButton } from "./auto-translate-button";
import { TranslationMemorySuggestions } from "./translation-memory-suggestions";
import type { TranslationState } from "@/lib/workflow";

type Language = {
  id: string;
  code: string;
  name: string;
  flagEmoji?: string | null;
};

type TranslationKey = {
  id: string;
  key: string;
  description?: string | null;
  namespace?: string | null;
};

type Translation = {
  id: string;
  keyId: string;
  languageId: string;
  value: string;
  state: TranslationState;
  key: string;
};

type Project = {
  id: string;
  name: string;
  requiresReview: boolean;
  defaultLanguageId?: string | null;
};

interface TranslationEditorProps {
  projectId: string;
  project: Project;
  languages: Language[];
  keys: TranslationKey[];
  translations: Translation[];
  userRole: "admin" | "translator" | "reviewer";
  userId: string;
}

export function TranslationEditor({
  projectId,
  project,
  languages,
  keys,
  translations,
  userRole,
  userId,
}: TranslationEditorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCell, setEditingCell] = useState<{
    keyId: string;
    languageId: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const { toast } = useToast();

  const filteredKeys = keys.filter((key) =>
    key.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTranslation = (keyId: string, languageId: string): Translation | undefined => {
    return translations.find(
      (t) => t.keyId === keyId && t.languageId === languageId
    );
  };

  const handleCellClick = (keyId: string, languageId: string) => {
    const translation = getTranslation(keyId, languageId);
    setEditingCell({ keyId, languageId });
    setEditValue(translation?.value || "");
  };

  const handleSave = async (submitForReview = false) => {
    if (!editingCell) return;

    try {
      const translation = getTranslation(editingCell.keyId, editingCell.languageId);
      const newState = submitForReview && project.requiresReview ? "review" : translation?.state || "draft";

      if (translation) {
        // Update existing translation
        const response = await fetch(`/api/translations/${translation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            value: editValue,
            state: newState,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update translation");
        }
      } else {
        // Create new translation
        const response = await fetch("/api/translations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            keyId: editingCell.keyId,
            languageId: editingCell.languageId,
            value: editValue,
            state: newState,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save translation");
        }
      }

      toast({
        title: "Translation saved",
        description: submitForReview
          ? "Translation submitted for review."
          : "Your translation has been saved successfully.",
      });

      setEditingCell(null);
      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save translation",
        variant: "destructive",
      });
    }
  };

  const handleApprove = async (translationId: string) => {
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: "approved",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve translation");
      }

      toast({
        title: "Translation approved",
        description: "The translation has been approved and is now published.",
      });

      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve translation",
        variant: "destructive",
      });
    }
  };

  const getStateColor = (state: TranslationState) => {
    switch (state) {
      case "approved":
        return "bg-green-500";
      case "review":
        return "bg-yellow-500";
      case "draft":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search keys..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FileImportExport projectId={projectId} />
          <AddKeyDialog projectId={projectId} onSuccess={() => window.location.reload()} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Translation Grid</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border p-2 text-left sticky left-0 bg-background z-10">
                    Key
                  </th>
                  {languages.map((lang) => (
                    <th key={lang.id} className="border p-2 text-left min-w-[200px]">
                      <div className="flex items-center gap-2">
                        {lang.flagEmoji && <span>{lang.flagEmoji}</span>}
                        <span>{lang.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredKeys.map((key) => (
                  <tr key={key.id}>
                    <td className="border p-2 sticky left-0 bg-background z-10">
                      <div className="font-medium">{key.key}</div>
                      {key.description && (
                        <div className="text-sm text-muted-foreground">
                          {key.description}
                        </div>
                      )}
                    </td>
                    {languages.map((lang) => {
                      const translation = getTranslation(key.id, lang.id);
                      const isEditing =
                        editingCell?.keyId === key.id &&
                        editingCell?.languageId === lang.id;

                      return (
                        <td
                          key={lang.id}
                          className="border p-2 cursor-pointer hover:bg-accent transition-colors"
                          onClick={() => handleCellClick(key.id, lang.id)}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              {/* Translation Memory Suggestions */}
                              {editingCell && (() => {
                                const defaultLangId = project.defaultLanguageId || languages[0]?.id || "";
                                const sourceTranslation = getTranslation(key.id, defaultLangId);
                                return sourceTranslation ? (
                                  <TranslationMemorySuggestions
                                    sourceText={sourceTranslation.value}
                                    sourceLanguageId={defaultLangId}
                                    targetLanguageId={lang.id}
                                    projectId={projectId}
                                    onSelect={(text) => setEditValue(text)}
                                  />
                                ) : null;
                              })()}
                              
                              <div className="flex items-start gap-2">
                                <Textarea
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="min-h-[80px] flex-1"
                                  autoFocus
                                />
                                <div className="flex flex-col gap-2">
                                  {(() => {
                                    const defaultLangId = project.defaultLanguageId || languages[0]?.id || "";
                                    const sourceTranslation = getTranslation(key.id, defaultLangId);
                                    return sourceTranslation ? (
                                      <AutoTranslateButton
                                        projectId={projectId}
                                        sourceText={sourceTranslation.value}
                                        sourceLanguageId={defaultLangId}
                                        targetLanguageId={lang.id}
                                        onTranslate={(text) => setEditValue(text)}
                                      />
                                    ) : null;
                                  })()}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSave(false)}
                                  disabled={!editValue.trim()}
                                >
                                  <Save className="mr-2 h-3 w-3" />
                                  Save Draft
                                </Button>
                                {project.requiresReview && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleSave(true)}
                                    disabled={!editValue.trim()}
                                  >
                                    <Send className="mr-2 h-3 w-3" />
                                    Submit
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingCell(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="mb-2">
                                {translation?.value || (
                                  <span className="text-muted-foreground italic">
                                    Click to add translation
                                  </span>
                                )}
                              </div>
                              {translation && (
                                <div className="flex items-center gap-2">
                                  <Badge
                                    className={`${getStateColor(translation.state)} text-white text-xs`}
                                  >
                                    {translation.state}
                                  </Badge>
                                  {translation.state === "review" &&
                                    (userRole === "admin" || userRole === "reviewer") && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 px-2"
                                        onClick={() => handleApprove(translation.id)}
                                      >
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Approve
                                      </Button>
                                    )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

