import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { BulkUploadPageClient } from "@/components/bulk-upload-page-client";

export default async function BulkUploadPage({
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
        <h1 className="text-3xl font-bold tracking-tight">Bulk Upload Translations</h1>
        <p className="text-muted-foreground">
          Upload multiple translation keys at once for {project.name}
        </p>
      </div>
      <BulkUploadPageClient projectId={id} />
    </div>
  );
}

