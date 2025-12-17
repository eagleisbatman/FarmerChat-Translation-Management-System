"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Loader2, Figma } from "lucide-react";
import Link from "next/link";

interface FileImportExportProps {
  projectId: string;
}

export function FileImportExport({ projectId }: FileImportExportProps) {
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImport = async (file: File) => {
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/projects/${projectId}/import`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
      }

      const result = await response.json();
      toast({
        title: "Import successful",
        description: `Created ${result.keysCreated} keys and ${result.translationsCreated} translations`,
      });

      window.location.reload();
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import translations",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/projects/${projectId}/figma-import`}>
          <Figma className="mr-2 h-4 w-4" />
          Import from Figma
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/projects/${projectId}/export`}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Link>
      </Button>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv,.xliff,.xlf,.po,.pot,.strings,.stringsdict,.arb,.xml,.resx,.yaml,.yml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleImport(file);
            }
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
        >
          {isImporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

