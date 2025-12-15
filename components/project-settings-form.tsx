"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

const settingsSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  requiresReview: z.boolean(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface ProjectSettingsFormProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    requiresReview: boolean;
  };
}

export function ProjectSettingsForm({ project }: ProjectSettingsFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: project.name,
      description: project.description || "",
      requiresReview: project.requiresReview,
    },
  });

  const onSubmit = async (data: SettingsFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update project");
      }

      toast({
        title: "Settings updated",
        description: "Project settings have been updated successfully.",
      });

      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Project Name *</Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register("description")}
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

      <Button type="submit" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Changes
      </Button>
    </form>
  );
}

