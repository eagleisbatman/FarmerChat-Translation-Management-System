"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Sparkles, Loader2, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BulkOperationsPanelProps {
  projectId: string;
  selectedKeys: string[];
  languages: Array<{ id: string; code: string; name: string }>;
  onComplete?: () => void;
}

export function BulkOperationsPanel({
  projectId,
  selectedKeys,
  languages,
  onComplete,
}: BulkOperationsPanelProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isQueuing, setIsQueuing] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState("json");
  const [targetLanguageId, setTargetLanguageId] = useState<string>("");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBulkUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const response = await fetch(`/api/projects/${projectId}/bulk-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: data }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Bulk upload failed");
      }

      const result = await response.json();
      toast({
        title: "Bulk upload successful",
        description: `Created ${result.keysCreated} keys and ${result.translationsCreated} translations`,
      });
      onComplete?.();
    } catch (error) {
      toast({
        title: "Bulk upload failed",
        description: error instanceof Error ? error.message : "Failed to upload",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleBulkDownload = async () => {
    if (selectedKeys.length === 0) {
      toast({
        title: "No keys selected",
        description: "Please select translation keys to download",
        variant: "destructive",
      });
      return;
    }

    setIsDownloading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/bulk-download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyIds: selectedKeys,
          format: downloadFormat,
          targetLanguageCode: targetLanguageId
            ? languages.find((l) => l.id === targetLanguageId)?.code
            : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Bulk download failed");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      const extension = downloadFormat.startsWith("xliff") ? (downloadFormat === "xliff12" ? "xliff" : "xlf") : downloadFormat;
      a.download = `bulk-translations.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: "Bulk download successful",
        description: `Downloaded ${selectedKeys.length} keys`,
      });
    } catch (error) {
      toast({
        title: "Bulk download failed",
        description: error instanceof Error ? error.message : "Failed to download",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBulkAITranslate = async () => {
    if (selectedKeys.length === 0) {
      toast({
        title: "No keys selected",
        description: "Please select translation keys to translate",
        variant: "destructive",
      });
      return;
    }

    if (!targetLanguageId) {
      toast({
        title: "Target language required",
        description: "Please select a target language",
        variant: "destructive",
      });
      return;
    }

    setIsQueuing(true);
    try {
      const response = await fetch("/api/translation-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          keyIds: selectedKeys,
          targetLanguageIds: [targetLanguageId],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to queue translations");
      }

      const result = await response.json();
      toast({
        title: "Translations queued",
        description: `${result.queued} translations added to queue. Processing will start automatically.`,
      });
      onComplete?.();
    } catch (error) {
      toast({
        title: "Queue failed",
        description: error instanceof Error ? error.message : "Failed to queue translations",
        variant: "destructive",
      });
    } finally {
      setIsQueuing(false);
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {/* Bulk Upload */}
      <Button asChild variant="outline" size="sm">
        <Link href={`/projects/${projectId}/bulk-upload`}>
          <Upload className="mr-2 h-4 w-4" />
          Bulk Upload
        </Link>
      </Button>

      {/* Bulk Download */}
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isDownloading || selectedKeys.length === 0}
          >
            {isDownloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Bulk Download ({selectedKeys.length})
              </>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Download Translations</DialogTitle>
            <DialogDescription>
              Download selected translation keys in your preferred format
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Format</Label>
              <Select value={downloadFormat} onValueChange={setDownloadFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="xliff12">XLIFF 1.2</SelectItem>
                  <SelectItem value="xliff20">XLIFF 2.0</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target Language (Optional)</Label>
              <Select value={targetLanguageId} onValueChange={setTargetLanguageId}>
                <SelectTrigger>
                  <SelectValue placeholder="All languages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All languages</SelectItem>
                  {languages.map((lang) => (
                    <SelectItem key={lang.id} value={lang.id}>
                      {lang.name} ({lang.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleBulkDownload} className="w-full" disabled={isDownloading}>
              <Download className="mr-2 h-4 w-4" />
              Download {selectedKeys.length} Keys
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk AI Translate */}
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isQueuing || selectedKeys.length === 0}
          >
            {isQueuing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Queuing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Bulk AI Translate ({selectedKeys.length})
              </>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk AI Translation</DialogTitle>
            <DialogDescription>
              Queue selected keys for AI translation. Processing happens in the background.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Target Language *</Label>
              <Select value={targetLanguageId} onValueChange={setTargetLanguageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target language" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.id} value={lang.id}>
                      {lang.name} ({lang.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>
                {selectedKeys.length} keys will be queued for translation. You can check
                the queue status in the dashboard.
              </p>
            </div>
            <Button
              onClick={handleBulkAITranslate}
              className="w-full"
              disabled={isQueuing || !targetLanguageId}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Queue {selectedKeys.length} Translations
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

