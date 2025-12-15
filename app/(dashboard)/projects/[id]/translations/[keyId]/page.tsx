import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translationKeys, translations, keyScreenshots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { TranslationComments } from "@/components/translation-comments";
import { ScreenshotManager } from "@/components/screenshot-manager";
import { TranslationHistoryViewer } from "@/components/translation-history-viewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Image as ImageIcon, MessageSquare, History } from "lucide-react";

export default async function TranslationKeyDetailPage({
  params,
}: {
  params: Promise<{ id: string; keyId: string }>;
}) {
  const session = await auth();
  const { id, keyId } = await params;

  if (!session) {
    redirect("/signin");
  }

  const [key] = await db
    .select()
    .from(translationKeys)
    .where(eq(translationKeys.id, keyId))
    .limit(1);

  if (!key || key.projectId !== id) {
    notFound();
  }

  const keyTranslations = await db
    .select()
    .from(translations)
    .where(eq(translations.keyId, keyId));

  const screenshots = await db
    .select()
    .from(keyScreenshots)
    .where(eq(keyScreenshots.keyId, keyId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{key.key}</h1>
        {key.description && (
          <p className="text-muted-foreground">{key.description}</p>
        )}
      </div>

      <Tabs defaultValue="translations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="translations">Translations</TabsTrigger>
          <TabsTrigger value="screenshots">
            <ImageIcon className="mr-2 h-4 w-4" />
            Screenshots ({screenshots.length})
          </TabsTrigger>
          <TabsTrigger value="comments">
            <MessageSquare className="mr-2 h-4 w-4" />
            Comments
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="translations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Translations</CardTitle>
              <CardDescription>All translations for this key</CardDescription>
            </CardHeader>
            <CardContent>
              {keyTranslations.length === 0 ? (
                <p className="text-muted-foreground">No translations yet</p>
              ) : (
                <div className="space-y-2">
                  {keyTranslations.map((translation) => (
                    <div key={translation.id} className="p-3 border rounded">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{translation.languageId}</span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          translation.state === "approved" ? "bg-green-500 text-white" :
                          translation.state === "review" ? "bg-yellow-500 text-white" :
                          "bg-gray-500 text-white"
                        }`}>
                          {translation.state}
                        </span>
                      </div>
                      <p className="mt-2">{translation.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="screenshots">
          <Card>
            <CardHeader>
              <CardTitle>Screenshots</CardTitle>
              <CardDescription>UI reference images for this translation key</CardDescription>
            </CardHeader>
            <CardContent>
              <ScreenshotManager
                keyId={keyId}
                screenshots={screenshots}
                onUpdate={() => window.location.reload()}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments">
          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
              <CardDescription>Discussion about translations for this key</CardDescription>
            </CardHeader>
            <CardContent>
              {keyTranslations.length > 0 ? (
                <div className="space-y-4">
                  {keyTranslations.map((translation) => (
                    <div key={translation.id} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Language: {translation.languageId}</h4>
                      <TranslationComments translationId={translation.id} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No translations yet. Add translations to enable comments.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Translation History</CardTitle>
              <CardDescription>Change history for all translations of this key</CardDescription>
            </CardHeader>
            <CardContent>
              {keyTranslations.length > 0 ? (
                <div className="space-y-4">
                  {keyTranslations.map((translation) => (
                    <div key={translation.id} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Language: {translation.languageId}</h4>
                      <TranslationHistoryViewer translationId={translation.id} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No translations yet. No history available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

