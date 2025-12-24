import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FolderKanban, ArrowRight, Languages } from "lucide-react";
import { getUserOrganizations } from "@/lib/security/organization-access";

export default async function ProjectsPage() {
  const session = await auth();

  if (!session) {
    redirect("/signin");
  }

  // Get user's organizations and filter projects
  const userOrgs = await getUserOrganizations(session.user.id);
  const orgIds = userOrgs.map((o) => o.organization.id);

  const allProjects = orgIds.length > 0
    ? await db.select().from(projects).where(inArray(projects.organizationId, orgIds))
    : [];

  return (
    <div className="space-y-6">
      {/* Header - stacks on mobile, inline on desktop */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your translation projects
          </p>
        </div>
        {session.user.role === "admin" && (
          <Button asChild className="w-full sm:w-auto min-h-[44px]">
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Link>
          </Button>
        )}
      </div>

      {allProjects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <FolderKanban className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Get started by creating your first translation project to manage your app&apos;s localization
            </p>
            {session.user.role === "admin" && (
              <Button asChild size="lg" className="min-h-[44px]">
                <Link href="/projects/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Project
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allProjects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="block group"
            >
              <Card className="h-full card-interactive border hover:border-primary/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="rounded-lg bg-primary/10 p-2 mb-2">
                      <Languages className="h-5 w-5 text-primary" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {project.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted">
                      {project.requiresReview ? "Review workflow" : "Direct publish"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

