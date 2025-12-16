"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Language = {
  id: string;
  code: string;
  name: string;
  flagEmoji?: string | null;
};

type ProjectLanguage = {
  projectLanguage: {
    projectId: string;
    languageId: string;
    isDefault: boolean;
  };
  language: Language;
};

interface LanguageManagerProps {
  projectId: string;
  initialProjectLanguages: ProjectLanguage[];
  allLanguages: Language[];
}

export function LanguageManager({
  projectId,
  initialProjectLanguages,
  allLanguages,
}: LanguageManagerProps) {
  const [projectLanguages, setProjectLanguages] = useState(initialProjectLanguages);
  const [selectedLanguageId, setSelectedLanguageId] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const { toast } = useToast();

  const availableLanguages = allLanguages.filter(
    (lang) => !projectLanguages.some((pl) => pl.language.id === lang.id)
  );

  const handleAddLanguage = async () => {
    if (!selectedLanguageId) {
      toast({
        title: "Error",
        description: "Please select a language",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/languages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          languageId: selectedLanguageId,
          isDefault: projectLanguages.length === 0, // First language is default
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add language");
      }

      const newProjectLanguage = await response.json();
      
      // Fetch updated list
      const updatedResponse = await fetch(`/api/projects/${projectId}/languages`);
      const updated = await updatedResponse.json();
      setProjectLanguages(updated);

      setSelectedLanguageId("");
      toast({
        title: "Language Added",
        description: "Language has been added to the project",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add language",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveLanguage = async (languageId: string) => {
    setIsRemoving(languageId);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/languages?languageId=${languageId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove language");
      }

      // Fetch updated list
      const updatedResponse = await fetch(`/api/projects/${projectId}/languages`);
      const updated = await updatedResponse.json();
      setProjectLanguages(updated);

      toast({
        title: "Language Removed",
        description: "Language has been removed from the project",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove language",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(null);
    }
  };

  const handleSetDefault = async (languageId: string) => {
    try {
      // First remove the language and re-add it as default
      await fetch(`/api/projects/${projectId}/languages?languageId=${languageId}`, {
        method: "DELETE",
      });

      await fetch(`/api/projects/${projectId}/languages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          languageId,
          isDefault: true,
        }),
      });

      // Fetch updated list
      const updatedResponse = await fetch(`/api/projects/${projectId}/languages`);
      const updated = await updatedResponse.json();
      setProjectLanguages(updated);

      toast({
        title: "Default Language Updated",
        description: "Default language has been changed",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to set default language",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Project Languages
        </CardTitle>
        <CardDescription>
          Manage languages available for this project
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Language */}
        <div className="flex gap-2">
          <Select value={selectedLanguageId} onValueChange={setSelectedLanguageId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a language to add" />
            </SelectTrigger>
            <SelectContent>
              {availableLanguages.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">
                  All languages have been added
                </div>
              ) : (
                availableLanguages.map((lang) => (
                  <SelectItem key={lang.id} value={lang.id}>
                    {lang.flagEmoji} {lang.name} ({lang.code})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            onClick={handleAddLanguage}
            disabled={!selectedLanguageId || isAdding || availableLanguages.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            {isAdding ? "Adding..." : "Add"}
          </Button>
        </div>

        {/* Language List */}
        {projectLanguages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No languages added yet. Add your first language above.
          </div>
        ) : (
          <div className="space-y-2">
            {projectLanguages.map((pl) => (
              <div
                key={pl.language.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{pl.language.flagEmoji || "🌐"}</span>
                  <div>
                    <div className="font-medium">
                      {pl.language.name} ({pl.language.code})
                    </div>
                    {pl.projectLanguage.isDefault && (
                      <Badge variant="secondary" className="mt-1">
                        Default
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!pl.projectLanguage.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(pl.language.id)}
                    >
                      Set as Default
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isRemoving === pl.language.id}
                      >
                        {isRemoving === pl.language.id ? (
                          "Removing..."
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Language?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove {pl.language.name} from this project?
                          This will also remove all translations for this language.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemoveLanguage(pl.language.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

