import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CreateProjectForm } from "@/components/create-project-form";

export default async function NewProjectPage() {
  const session = await auth();

  if (!session) {
    redirect("/signin");
  }

  if (session.user.role !== "admin") {
    redirect("/projects");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Project</h1>
        <p className="text-muted-foreground">
          Set up a new translation project
        </p>
      </div>
      <CreateProjectForm />
    </div>
  );
}

