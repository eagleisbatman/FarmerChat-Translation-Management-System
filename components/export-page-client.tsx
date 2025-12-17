"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, Eye, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Language {
  id: string;
  code: string;
  name: string;
  flagEmoji: string | null;
}

interface ExportPageClientProps {
  projectId: string;
  languages: Language[];
}

interface PreviewData {
  format: string;
  language?: string;
  totalKeys: number;
  totalTranslations: number;
  sample: Record<string, any>;
  structure: string;
}

export function ExportPageClient({ projectId, languages }: ExportPageClientProps) {
  const [format, setFormat] = useState("json");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handlePreview = async () => {
    setIsLoadingPreview(true);
    try {
      const params = new URLSearchParams({
        format,
        preview: "true",
      });
      
      if (selectedLanguage !== "all") {
        params.append("lang", selectedLanguage);
      }

      const response = await fetch(`/api/projects/${projectId}/export/preview?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error("Failed to load preview");
      }

      const data = await response.json();
      setPreviewData(data);
    } catch (error) {
      toast({
        title: "Preview failed",
        description: error instanceof Error ? error.message : "Failed to load preview",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ format });
      
      if (selectedLanguage !== "all") {
        params.append("lang", selectedLanguage);
      }

      const url = `/api/projects/${projectId}/export?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      
      let extension = format;
      if (format === "xliff12") extension = "xliff";
      else if (format === "xliff20") extension = "xlf";
      else if (format === "po" || format === "pot") extension = "po";
      else if (format === "strings") extension = "strings";
      else if (format === "arb") extension = "arb";
      else if (format === "android-xml") extension = "xml";
      else if (format === "resx") extension = "resx";
      else if (format === "yaml" || format === "yml") extension = "yml";
      
      const langSuffix = selectedLanguage !== "all" ? `-${selectedLanguage}` : "";
      a.download = `translations${langSuffix}.${extension}`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: "Export successful",
        description: `Translations exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export translations",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/projects/${projectId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Project
        </Link>
      </Button>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Export Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Export Configuration</CardTitle>
            <CardDescription>Choose format and options for export</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="format">Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger id="format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="xliff12">XLIFF 1.2</SelectItem>
                  <SelectItem value="xliff20">XLIFF 2.0</SelectItem>
                  <SelectItem value="po">Gettext (.po)</SelectItem>
                  <SelectItem value="strings">Apple .strings</SelectItem>
                  <SelectItem value="arb">Flutter ARB</SelectItem>
                  <SelectItem value="android-xml">Android XML</SelectItem>
                  <SelectItem value="resx">.NET RESX</SelectItem>
                  <SelectItem value="yaml">YAML</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  {languages.map((lang) => (
                    <SelectItem key={lang.id} value={lang.code}>
                      {lang.flagEmoji} {lang.name} ({lang.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handlePreview}
                disabled={isLoadingPreview}
                variant="outline"
                className="flex-1"
              >
                {isLoadingPreview ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </>
                )}
              </Button>
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="flex-1"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Preview export data before downloading</CardDescription>
          </CardHeader>
          <CardContent>
            {previewData ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Preview loaded</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Keys</p>
                    <p className="text-2xl font-bold">{previewData.totalKeys}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Translations</p>
                    <p className="text-2xl font-bold">{previewData.totalTranslations}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Format Structure</p>
                  <Badge variant="outline">{previewData.format.toUpperCase()}</Badge>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Sample Data</p>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-48">
                    {JSON.stringify(previewData.sample, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Click "Preview" to see a sample of the export data before downloading.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Format Information */}
      <Card>
        <CardHeader>
          <CardTitle>Format Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <strong>JSON:</strong> Nested object structure with namespaces as keys
          </div>
          <div>
            <strong>CSV:</strong> Flat table format with columns: Key, Language, Namespace, Value
          </div>
          <div>
            <strong>XLIFF 1.2:</strong> Industry-standard XML format for translation files (version 1.2)
          </div>
          <div>
            <strong>XLIFF 2.0:</strong> Industry-standard XML format for translation files (version 2.0)
          </div>
          <div>
            <strong>Gettext (.po/.pot):</strong> Standard format for GNU gettext, used in many open-source projects
          </div>
          <div>
            <strong>Apple .strings:</strong> Native format for iOS and macOS applications
          </div>
          <div>
            <strong>Flutter ARB:</strong> Application Resource Bundle format used by Flutter
          </div>
          <div>
            <strong>Android XML:</strong> Native format for Android string resources (strings.xml)
          </div>
          <div>
            <strong>.NET RESX:</strong> Resource XML format used in .NET applications
          </div>
          <div>
            <strong>YAML:</strong> YAML format compatible with Ruby on Rails i18n structure
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

