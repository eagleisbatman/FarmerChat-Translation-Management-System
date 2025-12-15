import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, translationKeys, translations, languages, projectLanguages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { TranslationEditor } from "@/components/translation-editor";

export default async function TranslationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const { key } = await searchParams;

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

  const projectLangs = await db
    .select({
      language: languages,
    })
    .from(projectLanguages)
    .innerJoin(languages, eq(projectLanguages.languageId, languages.id))
    .where(eq(projectLanguages.projectId, id));

  const keys = await db
    .select()
    .from(translationKeys)
    .where(eq(translationKeys.projectId, id));

  const allTranslations = await db
    .select()
    .from(translations)
    .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
    .where(eq(translationKeys.projectId, id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Translations</h1>
        <p className="text-muted-foreground">
          Manage translations for {project.name}
        </p>
      </div>
      <TranslationEditor
        projectId={id}
        project={project}
        languages={projectLangs.map((pl) => pl.language)}
        keys={keys}
        translations={allTranslations.map((t) => ({
          ...t.translations,
          key: t.translation_keys.key,
        }))}
        userRole={session.user.role}
        userId={session.user.id}
      />
    </div>
  );
}

