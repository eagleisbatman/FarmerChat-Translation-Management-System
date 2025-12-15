"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2 } from "lucide-react";

const keySchema = z.object({
  key: z.string().min(1, "Key is required").max(255),
  description: z.string().optional(),
  namespace: z.string().optional(),
});

type KeyFormData = z.infer<typeof keySchema>;

interface AddKeyDialogProps {
  projectId: string;
  onSuccess?: () => void;
}

export function AddKeyDialog({ projectId, onSuccess }: AddKeyDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<KeyFormData>({
    resolver: zodResolver(keySchema),
  });

  const onSubmit = async (data: KeyFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/translation-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          projectId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create key");
      }

      toast({
        title: "Key created",
        description: `Translation key "${data.key}" has been created.`,
      });

      reset();
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create key",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Translation Key</DialogTitle>
          <DialogDescription>
            Create a new translation key for this project
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="key">Key *</Label>
            <Input
              id="key"
              {...register("key")}
              placeholder="welcome.message"
            />
            {errors.key && (
              <p className="text-sm text-destructive">{errors.key.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="namespace">Namespace</Label>
            <Input
              id="namespace"
              {...register("namespace")}
              placeholder="common"
            />
            {errors.namespace && (
              <p className="text-sm text-destructive">{errors.namespace.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="A brief description of this translation key"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Key
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

