"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Mail, Brain, Shield, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface OrganizationSettingsClientProps {
  organizationId: string;
  organizationName: string;
}

interface OrganizationSettings {
  emailProvider?: "smtp" | "resend" | "sendgrid" | "ses" | null;
  emailFrom?: string;
  emailFromName?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  resendApiKey?: string;
  sendgridApiKey?: string;
  sesAccessKeyId?: string;
  sesSecretAccessKey?: string;
  sesRegion?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  googleTranslateApiKey?: string;
  allowedEmailDomains?: string[];
  googleClientId?: string;
  googleClientSecret?: string;
  emailNotificationsEnabled?: boolean;
  aiTranslationEnabled?: boolean;
}

export function OrganizationSettingsClient({
  organizationId,
  organizationName,
}: OrganizationSettingsClientProps) {
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, [organizationId]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/settings`);
      if (!response.ok) {
        throw new Error("Failed to load settings");
      }
      const data = await response.json();
      setSettings(data.settings || {});
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load organization settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: settings?.emailProvider
            ? {
                provider: settings.emailProvider,
                from: settings.emailFrom,
                fromName: settings.emailFromName,
                ...(settings.emailProvider === "smtp" && {
                  smtp: {
                    host: settings.smtpHost,
                    port: settings.smtpPort,
                    user: settings.smtpUser,
                    password: settings.smtpPassword,
                    secure: settings.smtpSecure,
                  },
                }),
                ...(settings.emailProvider === "resend" && {
                  resendApiKey: settings.resendApiKey,
                }),
                ...(settings.emailProvider === "sendgrid" && {
                  sendgridApiKey: settings.sendgridApiKey,
                }),
                ...(settings.emailProvider === "ses" && {
                  ses: {
                    accessKeyId: settings.sesAccessKeyId,
                    secretAccessKey: settings.sesSecretAccessKey,
                    region: settings.sesRegion,
                  },
                }),
              }
            : undefined,
          ai: {
            openaiApiKey: settings?.openaiApiKey,
            geminiApiKey: settings?.geminiApiKey,
            googleTranslateApiKey: settings?.googleTranslateApiKey,
          },
          auth: {
            allowedEmailDomains: settings?.allowedEmailDomains,
            googleClientId: settings?.googleClientId,
            googleClientSecret: settings?.googleClientSecret,
          },
          emailNotificationsEnabled: settings?.emailNotificationsEnabled,
          aiTranslationEnabled: settings?.aiTranslationEnabled,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save settings");
      }

      toast({
        title: "Settings saved",
        description: "Organization settings have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Organization-Level Configuration</AlertTitle>
        <AlertDescription>
          These settings apply to all projects in {organizationName}. API keys and credentials are encrypted at rest.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="email" className="space-y-4">
        <TabsList>
          <TabsTrigger value="email">
            <Mail className="mr-2 h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Brain className="mr-2 h-4 w-4" />
            AI Providers
          </TabsTrigger>
          <TabsTrigger value="auth">
            <Shield className="mr-2 h-4 w-4" />
            Authentication
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Configuration</CardTitle>
              <CardDescription>
                Configure email service for notifications and communications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable email notifications for translation events
                  </p>
                </div>
                <Switch
                  checked={settings?.emailNotificationsEnabled ?? true}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, emailNotificationsEnabled: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emailProvider">Email Provider</Label>
                <Select
                  value={settings?.emailProvider || ""}
                  onValueChange={(value) =>
                    setSettings({
                      ...settings,
                      emailProvider: value as "smtp" | "resend" | "sendgrid" | "ses" | null,
                    })
                  }
                >
                  <SelectTrigger id="emailProvider">
                    <SelectValue placeholder="Select email provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smtp">SMTP</SelectItem>
                    <SelectItem value="resend">Resend</SelectItem>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                    <SelectItem value="ses">AWS SES</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings?.emailProvider && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="emailFrom">From Email</Label>
                      <Input
                        id="emailFrom"
                        type="email"
                        value={settings.emailFrom || ""}
                        onChange={(e) =>
                          setSettings({ ...settings, emailFrom: e.target.value })
                        }
                        placeholder="noreply@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emailFromName">From Name</Label>
                      <Input
                        id="emailFromName"
                        value={settings.emailFromName || ""}
                        onChange={(e) =>
                          setSettings({ ...settings, emailFromName: e.target.value })
                        }
                        placeholder="LinguaFlow"
                      />
                    </div>
                  </div>

                  {settings.emailProvider === "smtp" && (
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="font-medium">SMTP Configuration</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="smtpHost">SMTP Host</Label>
                          <Input
                            id="smtpHost"
                            value={settings.smtpHost || ""}
                            onChange={(e) =>
                              setSettings({ ...settings, smtpHost: e.target.value })
                            }
                            placeholder="smtp.example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="smtpPort">SMTP Port</Label>
                          <Input
                            id="smtpPort"
                            type="number"
                            value={settings.smtpPort || 587}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                smtpPort: parseInt(e.target.value) || 587,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="smtpUser">SMTP Username</Label>
                          <Input
                            id="smtpUser"
                            value={settings.smtpUser || ""}
                            onChange={(e) =>
                              setSettings({ ...settings, smtpUser: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="smtpPassword">SMTP Password</Label>
                          <Input
                            id="smtpPassword"
                            type="password"
                            value={settings.smtpPassword || ""}
                            onChange={(e) =>
                              setSettings({ ...settings, smtpPassword: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="smtpSecure"
                          checked={settings.smtpSecure ?? true}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, smtpSecure: checked })
                          }
                        />
                        <Label htmlFor="smtpSecure">Use TLS/SSL</Label>
                      </div>
                    </div>
                  )}

                  {settings.emailProvider === "resend" && (
                    <div className="space-y-2 border-t pt-4">
                      <Label htmlFor="resendApiKey">Resend API Key</Label>
                      <Input
                        id="resendApiKey"
                        type="password"
                        value={settings.resendApiKey || ""}
                        onChange={(e) =>
                          setSettings({ ...settings, resendApiKey: e.target.value })
                        }
                        placeholder="re_..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Get your API key from{" "}
                        <a
                          href="https://resend.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          Resend Dashboard
                        </a>
                      </p>
                    </div>
                  )}

                  {settings.emailProvider === "sendgrid" && (
                    <div className="space-y-2 border-t pt-4">
                      <Label htmlFor="sendgridApiKey">SendGrid API Key</Label>
                      <Input
                        id="sendgridApiKey"
                        type="password"
                        value={settings.sendgridApiKey || ""}
                        onChange={(e) =>
                          setSettings({ ...settings, sendgridApiKey: e.target.value })
                        }
                        placeholder="SG..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Get your API key from{" "}
                        <a
                          href="https://app.sendgrid.com/settings/api_keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          SendGrid Settings
                        </a>
                      </p>
                    </div>
                  )}

                  {settings.emailProvider === "ses" && (
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="font-medium">AWS SES Configuration</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="sesAccessKeyId">Access Key ID</Label>
                          <Input
                            id="sesAccessKeyId"
                            type="password"
                            value={settings.sesAccessKeyId || ""}
                            onChange={(e) =>
                              setSettings({ ...settings, sesAccessKeyId: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sesSecretAccessKey">Secret Access Key</Label>
                          <Input
                            id="sesSecretAccessKey"
                            type="password"
                            value={settings.sesSecretAccessKey || ""}
                            onChange={(e) =>
                              setSettings({ ...settings, sesSecretAccessKey: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sesRegion">AWS Region</Label>
                          <Input
                            id="sesRegion"
                            value={settings.sesRegion || ""}
                            onChange={(e) =>
                              setSettings({ ...settings, sesRegion: e.target.value })
                            }
                            placeholder="us-east-1"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Provider Configuration</CardTitle>
              <CardDescription>
                Configure API keys for AI translation providers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>AI Translation</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable AI-powered translation features
                  </p>
                </div>
                <Switch
                  checked={settings?.aiTranslationEnabled ?? true}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, aiTranslationEnabled: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
                <Input
                  id="openaiApiKey"
                  type="password"
                  value={settings?.openaiApiKey || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, openaiApiKey: e.target.value })
                  }
                  placeholder="sk-..."
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{" "}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    OpenAI Platform
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="geminiApiKey">Google Gemini API Key</Label>
                <Input
                  id="geminiApiKey"
                  type="password"
                  value={settings?.geminiApiKey || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, geminiApiKey: e.target.value })
                  }
                  placeholder="AIza..."
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="googleTranslateApiKey">Google Translate API Key</Label>
                <Input
                  id="googleTranslateApiKey"
                  type="password"
                  value={settings?.googleTranslateApiKey || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, googleTranslateApiKey: e.target.value })
                  }
                  placeholder="AIza..."
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{" "}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Google Cloud Console
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Configuration</CardTitle>
              <CardDescription>
                Configure OAuth and email domain restrictions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="allowedEmailDomains">Allowed Email Domains</Label>
                <Textarea
                  id="allowedEmailDomains"
                  value={settings?.allowedEmailDomains?.join(", ") || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      allowedEmailDomains: e.target.value
                        .split(",")
                        .map((d) => d.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="digitalgreen.org, digitalgreentrust.org"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of email domains allowed to sign in
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="googleClientId">Google OAuth Client ID</Label>
                <Input
                  id="googleClientId"
                  type="password"
                  value={settings?.googleClientId || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, googleClientId: e.target.value })
                  }
                  placeholder="...googleusercontent.com"
                />
                <p className="text-xs text-muted-foreground">
                  Get your OAuth credentials from{" "}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Google Cloud Console
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="googleClientSecret">Google OAuth Client Secret</Label>
                <Input
                  id="googleClientSecret"
                  type="password"
                  value={settings?.googleClientSecret || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, googleClientSecret: e.target.value })
                  }
                  placeholder="GOCSPX-..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

