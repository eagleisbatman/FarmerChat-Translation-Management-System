import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, languages, projectLanguages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { ExportPageClient } from "@/components/export-page-client";

export default async function ExportPage({
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

  const projectLanguagesList = projectLangsData.map((pl) => pl.language);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Export Translations</h1>
        <p className="text-muted-foreground">
          Export translations for {project.name} in various formats
        </p>
      </div>
      <ExportPageClient projectId={id} languages={projectLanguagesList} />
    </div>
  );
}

