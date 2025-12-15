import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { ProjectSettingsForm } from "@/components/project-settings-form";
import { CopyApiKeyButton } from "@/components/copy-api-key-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Key } from "lucide-react";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session) {
    redirect("/signin");
  }

  if (session.user.role !== "admin") {
    redirect(`/projects/${id}`);
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Project Settings</h1>
        <p className="text-muted-foreground">
          Configure settings for {project.name}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              General Settings
            </CardTitle>
            <CardDescription>Update project details and workflow</CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectSettingsForm project={project} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Key
            </CardTitle>
            <CardDescription>Manage API access for this project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">API Key</label>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                    {project.apiKey}
                  </code>
                  <CopyApiKeyButton apiKey={project.apiKey} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Use this key to access translations via the API
                </p>
              </div>
              <Button variant="destructive" size="sm">
                Regenerate API Key
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

