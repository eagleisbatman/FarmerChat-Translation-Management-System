import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, languages, projectLanguages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { AddKeyPageClient } from "@/components/add-key-page-client";

export default async function AddKeyPage({
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

  // Get project languages
  const projectLangs = await db
    .select({
      language: languages,
    })
    .from(projectLanguages)
    .innerJoin(languages, eq(projectLanguages.languageId, languages.id))
    .where(eq(projectLanguages.projectId, id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add Translation Key</h1>
        <p className="text-muted-foreground">
          Create a new translation key for {project.name}
        </p>
      </div>
      <AddKeyPageClient
        projectId={id}
        languages={projectLangs.map((pl) => pl.language)}
      />
    </div>
  );
}

