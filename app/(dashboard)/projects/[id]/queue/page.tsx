import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { TranslationQueueDashboard } from "@/components/translation-queue-dashboard";

export default async function TranslationQueuePage({
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Translation Queue</h1>
        <p className="text-muted-foreground">
          Monitor and manage bulk AI translations for {project.name}
        </p>
      </div>
      <TranslationQueueDashboard projectId={id} />
    </div>
  );
}

