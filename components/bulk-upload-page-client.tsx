"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface BulkUploadPageClientProps {
  projectId: string;
}

export function BulkUploadPageClient({ projectId }: BulkUploadPageClientProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    keysCreated: number;
    translationsCreated: number;
    errors?: string[];
  } | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const text = await file.text();
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

      const response = await fetch(`/api/projects/${projectId}/bulk-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: data }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || "Upload failed");
      }

      setUploadResult({
        success: true,
        keysCreated: result.keysCreated || 0,
        translationsCreated: result.translationsCreated || 0,
      });

      toast({
        title: "Upload successful",
        description: `Created ${result.keysCreated} keys and ${result.translationsCreated} translations`,
      });

      // Auto-redirect after 2 seconds
      setTimeout(() => {
        router.push(`/projects/${projectId}/translations`);
      }, 2000);
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
    <div className="max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Translation File</CardTitle>
          <CardDescription>
            Upload a JSON file containing multiple translation keys and their translations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="file-upload">Select JSON File</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              disabled={isUploading}
              className="mt-2"
            />
          </div>

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
                {uploadResult.success ? "Upload Successful" : "Upload Failed"}
              </AlertTitle>
              <AlertDescription>
                {uploadResult.success ? (
                  <div className="space-y-1">
                    <p>Created {uploadResult.keysCreated} translation keys</p>
                    <p>Created {uploadResult.translationsCreated} translations</p>
                    <p className="text-sm mt-2">Redirecting to translations page...</p>
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

          <div className="flex gap-2">
            <Button
              onClick={() => router.back()}
              variant="outline"
            >
              Cancel
            </Button>
            <Button asChild>
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

