"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, FileText, CheckCircle, AlertCircle, Eye, ArrowLeft, TestTube } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface BulkUploadPageClientProps {
  projectId: string;
}

interface PreviewData {
  totalKeys: number;
  newKeys: number;
  conflicts: number;
  conflictDetails: Array<{
    key: string;
    existingValue?: string;
    newValue: string;
    namespace?: string;
  }>;
  sample: Array<{
    key: string;
    value: string;
    namespace?: string;
    description?: string;
  }>;
  format: string;
}

export function BulkUploadPageClient({ projectId }: BulkUploadPageClientProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [globalConflictResolution, setGlobalConflictResolution] = useState<"skip" | "overwrite" | "merge">("overwrite");
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, "skip" | "overwrite" | "merge">>({});
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    dryRun?: boolean;
    keysCreated: number;
    translationsCreated: number;
    translationsUpdated?: number;
    keysSkipped?: number;
    errors?: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewData(null);
    setUploadResult(null);

    // Auto-preview JSON files
    if (file.name.endsWith(".json")) {
      await handlePreview(file);
    }
  };

  const handlePreview = async (file?: File) => {
    const fileToPreview = file || selectedFile;
    if (!fileToPreview) return;

    setIsLoadingPreview(true);
    try {
      const formData = new FormData();
      formData.append("file", fileToPreview);
      formData.append("format", "json");

      const response = await fetch(`/api/projects/${projectId}/import/preview`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to load preview");
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

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const text = await selectedFile.text();
      let data: Array<{
        key: string;
        namespace?: string;
        description?: string;
        translations: Record<string, string>;
      }>;

      try {
        data = JSON.parse(text);
        if (!Array.isArray(data)) {
          throw new Error("JSON must be an array of translation keys");
        }
      } catch (parseError) {
        throw new Error(
          parseError instanceof Error
            ? parseError.message
            : "Invalid JSON format. Please check your file."
        );
      }

      // Build conflict resolution map
      const resolutionMap: Record<string, "skip" | "overwrite" | "merge"> = {};
      if (previewData?.conflictDetails) {
        previewData.conflictDetails.forEach((conflict) => {
          resolutionMap[conflict.key] = conflictResolutions[conflict.key] || globalConflictResolution;
        });
      }

      const response = await fetch(`/api/projects/${projectId}/bulk-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keys: data,
          conflictResolution: resolutionMap,
          dryRun,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || "Upload failed");
      }

      setUploadResult({
        success: true,
        dryRun: result.dryRun,
        keysCreated: result.keysCreated || 0,
        translationsCreated: result.translationsCreated || 0,
        translationsUpdated: result.translationsUpdated || 0,
        keysSkipped: result.keysSkipped || 0,
        errors: result.errors,
      });

      if (dryRun) {
        toast({
          title: "Dry-run completed",
          description: `Would create ${result.keysCreated} keys, ${result.translationsCreated} translations, update ${result.translationsUpdated || 0} translations, and skip ${result.keysSkipped || 0} keys`,
        });
      } else {
        toast({
          title: "Upload successful",
          description: `Created ${result.keysCreated} keys and ${result.translationsCreated} translations`,
        });

        // Auto-redirect after 2 seconds
        setTimeout(() => {
          router.push(`/projects/${projectId}/translations`);
        }, 2000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload file";
      setUploadResult({
        success: false,
        keysCreated: 0,
        translationsCreated: 0,
        errors: [errorMessage],
      });

      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/projects/${projectId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Project
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Upload Translations</CardTitle>
          <CardDescription>
            Upload a JSON file containing multiple translation keys and their translations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="file-upload">Select JSON File</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="file-upload"
                type="file"
                accept=".json,.csv,.xliff,.xlf,.po,.pot,.strings,.stringsdict,.arb,.xml,.resx,.yaml,.yml"
                onChange={handleFileSelect}
                disabled={isUploading || isLoadingPreview}
                className="flex-1"
                ref={fileInputRef}
              />
              {selectedFile && !previewData && (
                <Button
                  onClick={() => handlePreview()}
                  disabled={isLoadingPreview}
                  variant="outline"
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
              )}
            </div>
            {selectedFile && (
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          {isLoadingPreview && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing file and checking for conflicts...</span>
            </div>
          )}

          {previewData && (
            <div className="space-y-4">
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertTitle>Import Preview</AlertTitle>
                <AlertDescription>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Keys</p>
                      <p className="text-2xl font-bold">{previewData.totalKeys}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">New Keys</p>
                      <p className="text-2xl font-bold text-green-600">{previewData.newKeys}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Conflicts</p>
                      <p className="text-2xl font-bold text-orange-600">{previewData.conflicts}</p>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {previewData.conflicts > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Conflicts Detected</AlertTitle>
                  <AlertDescription>
                    <p className="mb-2">
                      {previewData.conflicts} translation key{previewData.conflicts !== 1 ? "s" : ""} already exist{previewData.conflicts === 1 ? "s" : ""} with different values.
                      {previewData.conflicts > previewData.conflictDetails.length && (
                        <span className="block mt-1">
                          Showing first {previewData.conflictDetails.length} conflicts.
                        </span>
                      )}
                    </p>
                    
                    {/* Global Conflict Resolution */}
                    <div className="mt-4 mb-4 p-3 bg-background rounded-md border">
                      <Label className="text-sm font-medium mb-2 block">Default Conflict Resolution</Label>
                      <Select value={globalConflictResolution} onValueChange={(value) => setGlobalConflictResolution(value as "skip" | "overwrite" | "merge")}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="overwrite">Overwrite - Replace existing translations</SelectItem>
                          <SelectItem value="merge">Merge - Only update if new value is different</SelectItem>
                          <SelectItem value="skip">Skip - Keep existing translations</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-2">
                        This applies to all conflicts unless overridden below.
                      </p>
                    </div>

                    <Tabs defaultValue="conflicts" className="mt-4">
                      <TabsList>
                        <TabsTrigger value="conflicts">Conflicts ({previewData.conflicts})</TabsTrigger>
                        <TabsTrigger value="sample">Sample Data</TabsTrigger>
                      </TabsList>
                      <TabsContent value="conflicts" className="space-y-2 max-h-96 overflow-y-auto">
                        {previewData.conflictDetails.map((conflict, idx) => (
                          <div key={idx} className="border rounded p-3 bg-muted/50">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="font-medium">{conflict.key}</div>
                                {conflict.namespace && (
                                  <Badge variant="outline" className="mt-1">{conflict.namespace}</Badge>
                                )}
                              </div>
                              <Select
                                value={conflictResolutions[conflict.key] || globalConflictResolution}
                                onValueChange={(value) => {
                                  setConflictResolutions({
                                    ...conflictResolutions,
                                    [conflict.key]: value as "skip" | "overwrite" | "merge",
                                  });
                                }}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="overwrite">Overwrite</SelectItem>
                                  <SelectItem value="merge">Merge</SelectItem>
                                  <SelectItem value="skip">Skip</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1 text-sm mt-2">
                              {conflict.existingValue && (
                                <div>
                                  <span className="text-muted-foreground">Current: </span>
                                  <span className="line-through">{conflict.existingValue}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-muted-foreground">New: </span>
                                <span>{conflict.newValue}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </TabsContent>
                      <TabsContent value="sample" className="space-y-2">
                        <div className="bg-muted p-3 rounded-md">
                          <pre className="text-xs overflow-auto">
                            {JSON.stringify(previewData.sample.slice(0, 5), null, 2)}
                          </pre>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </AlertDescription>
                </Alert>
              )}

              {previewData.conflicts === 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>No Conflicts</AlertTitle>
                  <AlertDescription>
                    All translation keys are new. Ready to import.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {isUploading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Uploading and processing translations...</span>
            </div>
          )}

          {uploadResult && (
            <Alert variant={uploadResult.success ? "default" : "destructive"}>
              {uploadResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {uploadResult.dryRun
                  ? "Dry-Run Results"
                  : uploadResult.success
                  ? "Upload Successful"
                  : "Upload Failed"}
              </AlertTitle>
              <AlertDescription>
                {uploadResult.success ? (
                  <div className="space-y-1">
                    {uploadResult.dryRun && (
                      <p className="font-medium text-blue-600">This was a dry-run. No changes were made.</p>
                    )}
                    <p>Created {uploadResult.keysCreated} translation keys</p>
                    <p>Created {uploadResult.translationsCreated} translations</p>
                    {uploadResult.translationsUpdated !== undefined && uploadResult.translationsUpdated > 0 && (
                      <p>Updated {uploadResult.translationsUpdated} translations</p>
                    )}
                    {uploadResult.keysSkipped !== undefined && uploadResult.keysSkipped > 0 && (
                      <p>Skipped {uploadResult.keysSkipped} keys</p>
                    )}
                    {uploadResult.errors && uploadResult.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium text-orange-600">Warnings:</p>
                        {uploadResult.errors.map((error, idx) => (
                          <p key={idx} className="text-sm">{error}</p>
                        ))}
                      </div>
                    )}
                    {!uploadResult.dryRun && (
                      <p className="text-sm mt-2">Redirecting to translations page...</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {uploadResult.errors?.map((error, idx) => (
                      <p key={idx}>{error}</p>
                    ))}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="border-t pt-6">
            <h3 className="font-medium mb-4">Expected File Format</h3>
            <div className="bg-muted p-4 rounded-lg">
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(
                  [
                    {
                      key: "welcome.message",
                      namespace: "common",
                      description: "Welcome message shown on homepage",
                      translations: {
                        en: "Welcome to our platform",
                        es: "Bienvenido a nuestra plataforma",
                        fr: "Bienvenue sur notre plateforme",
                      },
                    },
                    {
                      key: "button.save",
                      namespace: "ui",
                      translations: {
                        en: "Save",
                        es: "Guardar",
                        fr: "Enregistrer",
                      },
                    },
                  ],
                  null,
                  2
                )}
              </pre>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              <strong>Note:</strong> The file must be a valid JSON array. Each object should have:
            </p>
            <ul className="text-sm text-muted-foreground mt-2 list-disc list-inside space-y-1">
              <li><code>key</code> (required): The translation key identifier</li>
              <li><code>namespace</code> (optional): Namespace for organizing keys</li>
              <li><code>description</code> (optional): Description of the translation key</li>
              <li><code>translations</code> (required): Object mapping language codes to translated text</li>
            </ul>
          </div>

          {/* Dry-Run Toggle */}
          {previewData && (
            <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-md">
              <Checkbox
                id="dry-run"
                checked={dryRun}
                onCheckedChange={(checked) => setDryRun(checked === true)}
              />
              <Label htmlFor="dry-run" className="text-sm font-medium cursor-pointer">
                Dry-run mode (validate without importing)
              </Label>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => router.back()}
              variant="outline"
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading || isLoadingPreview}
              variant={dryRun ? "outline" : "default"}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {dryRun ? "Validating..." : "Uploading..."}
                </>
              ) : (
                <>
                  {dryRun ? (
                    <>
                      <TestTube className="mr-2 h-4 w-4" />
                      Validate (Dry-Run)
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Translations
                    </>
                  )}
                </>
              )}
            </Button>
            <Button asChild variant="outline">
              <Link href={`/projects/${projectId}/translations`}>
                View Translations
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
