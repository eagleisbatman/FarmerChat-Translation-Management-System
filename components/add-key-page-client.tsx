"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Key, CheckCircle, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const addKeySchema = z.object({
  key: z.string().min(1, "Key is required").max(255, "Key must be less than 255 characters"),
  namespace: z.string().optional(),
  description: z.string().optional(),
});

type AddKeyFormData = z.infer<typeof addKeySchema>;

interface AddKeyPageClientProps {
  projectId: string;
  languages: Array<{ id: string; code: string; name: string }>;
}

export function AddKeyPageClient({ projectId, languages }: AddKeyPageClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    keyId?: string;
    error?: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AddKeyFormData>({
    resolver: zodResolver(addKeySchema),
  });

  const onSubmit = async (data: AddKeyFormData) => {
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const response = await fetch("/api/translation-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          key: data.key,
          namespace: data.namespace || undefined,
          description: data.description || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || "Failed to create translation key");
      }

      setSubmitResult({
        success: true,
        keyId: result.id,
      });

      toast({
        title: "Translation key created",
        description: `Key "${data.key}" has been created successfully.`,
      });

      // Reset form
      reset();

      // Auto-redirect after 2 seconds
      setTimeout(() => {
        router.push(`/projects/${projectId}/translations`);
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create translation key";
      setSubmitResult({
        success: false,
        error: errorMessage,
      });

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            New Translation Key
          </CardTitle>
          <CardDescription>
            Create a new translation key and add translations for each language
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="key">Translation Key *</Label>
              <Input
                id="key"
                placeholder="e.g., welcome.message or button.save"
                {...register("key")}
                disabled={isSubmitting}
              />
              {errors.key && (
                <p className="text-sm text-destructive">{errors.key.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Use dot notation for nested keys (e.g., "common.button.save")
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="namespace">Namespace (Optional)</Label>
              <Input
                id="namespace"
                placeholder="e.g., common, ui, errors"
                {...register("namespace")}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Organize keys into namespaces for better management
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe what this translation key is used for..."
                {...register("description")}
                rows={3}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Help translators understand the context of this translation
              </p>
            </div>

            {submitResult && (
              <Alert variant={submitResult.success ? "default" : "destructive"}>
                {submitResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {submitResult.success ? "Key Created Successfully" : "Error Creating Key"}
                </AlertTitle>
                <AlertDescription>
                  {submitResult.success ? (
                    <div className="space-y-1">
                      <p>Translation key has been created.</p>
                      <p className="text-sm mt-2">Redirecting to translations page...</p>
                    </div>
                  ) : (
                    <p>{submitResult.error}</p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Key className="mr-2 h-4 w-4" />
                    Create Key
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>After creating the key, you can:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
            <li>Add translations for each language in the translation editor</li>
            <li>Use AI translation to auto-translate from your default language</li>
            <li>Attach screenshots for visual context</li>
            <li>Add comments for collaboration</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

