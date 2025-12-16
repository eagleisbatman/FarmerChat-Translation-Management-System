import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, translationKeys, translations, languages, projectLanguages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Languages, Settings, Key, Eye } from "lucide-react";
import { DeleteKeyButton } from "@/components/delete-key-button";
import { LanguageManager } from "@/components/language-manager";
import { TranslationQueueDashboard } from "@/components/translation-queue-dashboard";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session) {
    redirect("/signin");
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project) {
    notFound();
  }

  const projectLangsData = await db
    .select({
      projectLanguage: projectLanguages,
      language: languages,
    })
    .from(projectLanguages)
    .innerJoin(languages, eq(projectLanguages.languageId, languages.id))
    .where(eq(projectLanguages.projectId, id));

  const allLanguages = await db.select().from(languages);

  const keys = await db
    .select()
    .from(translationKeys)
    .where(eq(translationKeys.projectId, id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground">{project.description || "No description"}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/projects/${id}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/projects/${id}/translations`}>
              <Key className="mr-2 h-4 w-4" />
              Translations
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="languages">Languages</TabsTrigger>
              <TabsTrigger value="keys">Translation Keys</TabsTrigger>
              <TabsTrigger value="queue">Translation Queue</TabsTrigger>
            </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Translation Keys</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{keys.length}</div>
                <p className="text-xs text-muted-foreground">Total keys in project</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Languages</CardTitle>
                <Languages className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projectLangsData.length}</div>
                <p className="text-xs text-muted-foreground">Active languages</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Workflow</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {project.requiresReview ? "Review" : "Direct"}
                </div>
                <p className="text-xs text-muted-foreground">Translation workflow</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="languages" className="space-y-4">
          {session.user.role === "admin" ? (
            <LanguageManager
              projectId={id}
              initialProjectLanguages={projectLangsData}
              allLanguages={allLanguages}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Project Languages</CardTitle>
                <CardDescription>
                  Languages enabled for this project
                </CardDescription>
              </CardHeader>
              <CardContent>
                {projectLangsData.length === 0 ? (
                  <p className="text-muted-foreground">No languages configured yet</p>
                ) : (
                  <div className="space-y-2">
                    {projectLangsData.map((pl) => (
                      <div key={pl.language.id} className="flex items-center justify-between p-2 border rounded">
                        <span>{pl.language.flagEmoji} {pl.language.name} ({pl.language.code})</span>
                        {pl.projectLanguage.isDefault && (
                          <span className="text-xs text-muted-foreground">Default</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Translation Keys</CardTitle>
              <CardDescription>
                All translation keys in this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              {keys.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No translation keys yet</p>
                  <Button asChild>
                    <Link href={`/projects/${id}/translations`}>Add Keys</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {keys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-3 border rounded hover:bg-accent transition-colors">
                      <div>
                        <div className="font-medium">{key.key}</div>
                        {key.description && (
                          <div className="text-sm text-muted-foreground">{key.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/projects/${id}/translations?key=${key.id}`}>Edit</Link>
                        </Button>
                        {session.user.role === "admin" && (
                          <DeleteKeyButton
                            keyId={key.id}
                            keyName={key.key}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <TranslationQueueDashboard projectId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
