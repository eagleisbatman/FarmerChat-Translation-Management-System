"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Save, CheckCircle, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { FileImportExport } from "./file-import-export";
import { AutoTranslateButton } from "./auto-translate-button";
import { TranslationMemorySuggestions } from "./translation-memory-suggestions";
import { DeleteKeyButton } from "./delete-key-button";
import { TranslationFilters, type FilterState } from "./translation-filters";
import { BulkActions } from "./bulk-actions";
import { BulkOperationsPanel } from "./bulk-operations-panel";
import { Checkbox } from "@/components/ui/checkbox";
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
  createdBy?: string;
  createdAt?: Date;
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
  users: Array<{ id: string; name: string; email: string }>;
}

export function TranslationEditor({
  projectId,
  project,
  languages,
  keys,
  translations,
  userRole,
  userId,
  users,
}: TranslationEditorProps) {
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: "",
    searchIn: ["key"],
    states: [],
    languages: [],
    dateFrom: "",
    dateTo: "",
    createdBy: "",
  });
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{
    keyId: string;
    languageId: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectedKeyIndex, setSelectedKeyIndex] = useState<number>(-1);
  const { toast } = useToast();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs/textareas
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        // Allow Ctrl+S and Esc even in inputs
        if (e.key === "Escape") {
          e.preventDefault();
          setEditingCell(null);
          setEditValue("");
          return;
        }
        if ((e.metaKey || e.ctrlKey) && e.key === "s") {
          e.preventDefault();
          if (editingCell) {
            handleSave();
          }
          return;
        }
        return;
      }

      // Arrow key navigation
      if (e.key === "ArrowDown" && filteredKeys.length > 0) {
        e.preventDefault();
        const nextIndex = selectedKeyIndex < filteredKeys.length - 1 
          ? selectedKeyIndex + 1 
          : 0;
        setSelectedKeyIndex(nextIndex);
        // Scroll into view
        const element = document.getElementById(`key-${filteredKeys[nextIndex].id}`);
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (e.key === "ArrowUp" && filteredKeys.length > 0) {
        e.preventDefault();
        const prevIndex = selectedKeyIndex > 0 
          ? selectedKeyIndex - 1 
          : filteredKeys.length - 1;
        setSelectedKeyIndex(prevIndex);
        // Scroll into view
        const element = document.getElementById(`key-${filteredKeys[prevIndex].id}`);
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (e.key === "Enter" && selectedKeyIndex >= 0 && filteredKeys.length > 0) {
        e.preventDefault();
        const selectedKey = filteredKeys[selectedKeyIndex];
        // Open first language for editing
        if (languages.length > 0) {
          handleCellClick(selectedKey.id, languages[0].id);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditingCell(null);
        setEditValue("");
        setSelectedKeyIndex(-1);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (editingCell) {
          handleSave();
        } else {
          toast({
            title: "No changes to save",
            description: "Select a cell to edit first.",
          });
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        // Focus search input
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      }
    };

      window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedKeyIndex, filteredKeys, editingCell, languages, handleSave, handleCellClick, toast]);

  // Advanced filtering logic
  const filteredKeys = keys.filter((key) => {
    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const searchIn = filters.searchIn.length > 0 ? filters.searchIn : ["key"];
      
      let matches = false;
      if (searchIn.includes("key") && key.key.toLowerCase().includes(query)) {
        matches = true;
      }
      if (searchIn.includes("description") && key.description?.toLowerCase().includes(query)) {
        matches = true;
      }
      if (searchIn.includes("namespace") && key.namespace?.toLowerCase().includes(query)) {
        matches = true;
      }
      if (searchIn.includes("value")) {
        const keyTranslations = translations.filter((t) => t.keyId === key.id);
        const valueMatches = keyTranslations.some((t) =>
          t.value.toLowerCase().includes(query)
        );
        if (valueMatches) matches = true;
      }
      if (!matches) return false;
    }

    // State filter
    if (filters.states.length > 0) {
      const keyTranslations = translations.filter((t) => t.keyId === key.id);
      const hasMatchingState = keyTranslations.some((t) =>
        filters.states.includes(t.state)
      );
      if (!hasMatchingState) return false;
    }

    // Language filter
    if (filters.languages.length > 0) {
      const keyTranslations = translations.filter((t) => t.keyId === key.id);
      const hasMatchingLanguage = keyTranslations.some((t) =>
        filters.languages.includes(t.languageId)
      );
      if (!hasMatchingLanguage) return false;
    }

    // Date filter
    if (filters.dateFrom || filters.dateTo) {
      const keyTranslations = translations.filter((t) => t.keyId === key.id);
      // Note: We'd need createdAt in translations - for now, skip date filtering
      // This would require joining with translation history or adding createdAt to translations
    }

    // Created by filter
    if (filters.createdBy) {
      const keyTranslations = translations.filter(
        (t) => t.keyId === key.id && t.createdBy === filters.createdBy
      );
      if (keyTranslations.length === 0) return false;
    }

    // Date filter (if createdAt is available)
    if (filters.dateFrom || filters.dateTo) {
      const keyTranslations = translations.filter((t) => t.keyId === key.id);
      if (keyTranslations.length > 0 && keyTranslations[0].createdAt) {
        const translationDate = new Date(keyTranslations[0].createdAt);
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom);
          if (translationDate < fromDate) return false;
        }
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo);
          toDate.setHours(23, 59, 59, 999); // End of day
          if (translationDate > toDate) return false;
        }
      }
    }

    return true;
  });

  const getTranslation = (keyId: string, languageId: string): Translation | undefined => {
    return translations.find(
      (t) => t.keyId === keyId && t.languageId === languageId
    );
  };

  const handleCellClick = useCallback((keyId: string, languageId: string) => {
    const translation = getTranslation(keyId, languageId);
    setEditingCell({ keyId, languageId });
    setEditValue(translation?.value || "");
    setSelectedKeyIndex(-1); // Clear selection when editing
  }, [translations]);

  const handleSave = useCallback(async (submitForReview = false) => {
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
  }, [editingCell, editValue, project, projectId, translations, toast]);

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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 max-w-md flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search translations..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="pl-8"
            />
          </div>
          <TranslationFilters
            languages={languages}
            users={users}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>
        <div className="flex items-center gap-2">
              <BulkActions
                selectedKeys={Array.from(selectedKeys)}
                projectId={projectId}
                onActionComplete={() => {
                  setSelectedKeys(new Set());
                  window.location.reload();
                }}
              />
              <BulkOperationsPanel
                projectId={projectId}
                selectedKeys={Array.from(selectedKeys)}
                languages={languages}
                onComplete={() => {
                  setSelectedKeys(new Set());
                  window.location.reload();
                }}
              />
              <FileImportExport projectId={projectId} />
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${projectId}/keys/new`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Key
                </Link>
              </Button>
        </div>
      </div>

      {selectedKeys.size > 0 && (
        <div className="flex items-center justify-between p-2 bg-muted rounded-md">
          <span className="text-sm font-medium">
            {selectedKeys.size} key{selectedKeys.size !== 1 ? "s" : ""} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedKeys(new Set())}
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      <div className="text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+S</kbd> Save
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Esc</kbd> Cancel
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↑↓</kbd> Navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd> Edit
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+F</kbd> Search
        </span>
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
                  <th className="border p-2 text-left sticky left-0 bg-background z-10 w-12">
                    <Checkbox
                      checked={selectedKeys.size === filteredKeys.length && filteredKeys.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedKeys(new Set(filteredKeys.map((k) => k.id)));
                        } else {
                          setSelectedKeys(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="border p-2 text-left sticky left-12 bg-background z-10">
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
                {filteredKeys.map((key, keyIndex) => (
                  <tr 
                    key={key.id}
                    id={`key-${key.id}`}
                    className={selectedKeyIndex === keyIndex ? "bg-accent/50" : ""}
                  >
                    <td className="border p-2 sticky left-0 bg-background z-10 w-12">
                      <Checkbox
                        checked={selectedKeys.has(key.id)}
                        onCheckedChange={(checked) => {
                          const newSelected = new Set(selectedKeys);
                          if (checked) {
                            newSelected.add(key.id);
                          } else {
                            newSelected.delete(key.id);
                          }
                          setSelectedKeys(newSelected);
                        }}
                      />
                    </td>
                    <td className="border p-2 sticky left-12 bg-background z-10">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium">{key.key}</div>
                          {key.description && (
                            <div className="text-sm text-muted-foreground">
                              {key.description}
                            </div>
                          )}
                        </div>
                        {userRole === "admin" && (
                          <DeleteKeyButton
                            keyId={key.id}
                            keyName={key.key}
                            onDeleted={() => window.location.reload()}
                          />
                        )}
                      </div>
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
                                        keyId={key.id}
                                        context={`Translation key: ${key.key}${key.description ? ` - ${key.description}` : ""}`}
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

