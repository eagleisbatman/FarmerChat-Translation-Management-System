"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Settings, Bell, Shield, Zap } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProjectAdvancedSettingsProps {
  projectId: string;
  initialSettings: {
    requiresReview: boolean;
    autoApproveOnReview?: boolean;
    notifyOnTranslation?: boolean;
    maxRetries?: number;
  };
}

export function ProjectAdvancedSettings({
  projectId,
  initialSettings,
}: ProjectAdvancedSettingsProps) {
  const [settings, setSettings] = useState({
    requiresReview: initialSettings.requiresReview,
    autoApproveOnReview: initialSettings.autoApproveOnReview || false,
    notifyOnTranslation: initialSettings.notifyOnTranslation || false,
    maxRetries: initialSettings.maxRetries || 3,
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update settings");
      }

      toast({
        title: "Settings updated",
        description: "Advanced settings have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workflow Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Workflow Settings
          </CardTitle>
          <CardDescription>Configure translation workflow behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="requires-review">Require Review</Label>
              <p className="text-sm text-muted-foreground">
                Translations must be reviewed before being published
              </p>
            </div>
            <Switch
              id="requires-review"
              checked={settings.requiresReview}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, requiresReview: checked })
              }
            />
          </div>

          {settings.requiresReview && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-approve">Auto-Approve After Review</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically approve translations after reviewer approval
                </p>
              </div>
              <Switch
                id="auto-approve"
                checked={settings.autoApproveOnReview}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, autoApproveOnReview: checked })
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </CardTitle>
          <CardDescription>Configure when to receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notify-translation">Notify on Translation</Label>
              <p className="text-sm text-muted-foreground">
                Send notifications when translations are created or updated
              </p>
            </div>
            <Switch
              id="notify-translation"
              checked={settings.notifyOnTranslation}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, notifyOnTranslation: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Queue & Retry Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Queue & Retry Settings
          </CardTitle>
          <CardDescription>Configure translation queue behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="max-retries">Maximum Retries</Label>
            <Select
              value={settings.maxRetries.toString()}
              onValueChange={(value) =>
                setSettings({ ...settings, maxRetries: parseInt(value) })
              }
            >
              <SelectTrigger id="max-retries" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 retry</SelectItem>
                <SelectItem value="2">2 retries</SelectItem>
                <SelectItem value="3">3 retries (recommended)</SelectItem>
                <SelectItem value="5">5 retries</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Number of times to retry failed translations before marking as permanently failed
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Settings
          </CardTitle>
          <CardDescription>Configure security and access controls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>API key authentication is enabled by default.</p>
            <p className="mt-2">
              Rate limiting: 100 requests per minute per API key
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Advanced Settings
      </Button>
    </div>
  );
}

