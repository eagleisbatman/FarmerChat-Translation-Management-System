import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, users, projectMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { ProjectSettingsForm } from "@/components/project-settings-form";
import { ApiKeyCard } from "@/components/api-key-card";
import { ProjectMemberManager } from "@/components/project-member-manager";
import { AIModelConfig } from "@/components/ai-model-config";
import { ProjectAdvancedSettings } from "@/components/project-advanced-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  // Fetch project members
  const projectMembersData = await db
    .select({
      projectMember: projectMembers,
      user: users,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, id));

  // Fetch all users for member dropdown
  const allUsers = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
  }).from(users);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Project Settings</h1>
        <p className="text-muted-foreground">
          Configure settings for {project.name}
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
          <TabsTrigger value="api">API & Access</TabsTrigger>
          <TabsTrigger value="ai">AI Translation</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
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

            <ProjectMemberManager
              projectId={id}
              initialMembers={projectMembersData}
              allUsers={allUsers}
            />
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <ProjectAdvancedSettings
            projectId={id}
            initialSettings={{
              requiresReview: project.requiresReview,
            }}
          />
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <ApiKeyCard projectId={id} initialApiKey={project.apiKey} />
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <AIModelConfig
            projectId={id}
            initialAiProvider={project.aiProvider || undefined}
            initialAiFallbackProvider={project.aiFallbackProvider || undefined}
            initialImageContextEnabled={project.imageContextEnabled || false}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

