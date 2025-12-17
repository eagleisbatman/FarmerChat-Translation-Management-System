"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const projectSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  requiresReview: z.boolean().default(true),
  organizationId: z.string().min(1, "Organization is required"),
});

type ProjectFormData = z.infer<typeof projectSchema>;

export function CreateProjectForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [primaryOrgId, setPrimaryOrgId] = useState<string | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);

  useEffect(() => {
    // Fetch user's primary organization
    fetch("/api/organizations/primary")
      .then((res) => res.json())
      .then((data) => {
        if (data.organization) {
          setPrimaryOrgId(data.organization.id);
        } else {
          toast({
            title: "No organization found",
            description: "Please create or join an organization first.",
            variant: "destructive",
          });
        }
        setLoadingOrg(false);
      })
      .catch((error) => {
        console.error("Error fetching primary organization:", error);
        setLoadingOrg(false);
      });
  }, [toast]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      requiresReview: true,
      organizationId: "",
    },
  });

  // Set organizationId when primary org is loaded
  useEffect(() => {
    if (primaryOrgId) {
      setValue("organizationId", primaryOrgId);
    }
  }, [primaryOrgId, setValue]);

  const onSubmit = async (data: ProjectFormData) => {
    if (!data.organizationId) {
      toast({
        title: "Error",
        description: "Organization is required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create project");
      }

      const project = await response.json();
      toast({
        title: "Project created",
        description: `Project "${project.name}" has been created successfully.`,
      });
      router.push(`/projects/${project.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create project",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingOrg) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!primaryOrgId) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            You need to be part of an organization to create projects.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Details</CardTitle>
        <CardDescription>Enter the details for your new translation project</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("organizationId")} />
          
          <div className="space-y-2">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="My Translation Project"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="A brief description of this project"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="requiresReview"
              {...register("requiresReview")}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="requiresReview" className="cursor-pointer">
              Require review before publishing translations
            </Label>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading || !primaryOrgId}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Project
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

