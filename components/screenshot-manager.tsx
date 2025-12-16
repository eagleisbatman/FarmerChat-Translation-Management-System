"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import Image from "next/image";

interface ScreenshotManagerProps {
  keyId: string;
  screenshots?: Array<{
    id: string;
    imageUrl: string;
    altText?: string | null;
  }>;
  onUpdate?: () => void; // Optional, will use router.refresh() if not provided
}

export function ScreenshotManager({ keyId, screenshots = [], onUpdate }: ScreenshotManagerProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("keyId", keyId);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image");
      }

      const { url } = await uploadResponse.json();

      // Save screenshot reference
      const screenshotResponse = await fetch("/api/key-screenshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyId,
          imageUrl: url,
        }),
      });

      if (!screenshotResponse.ok) {
        throw new Error("Failed to save screenshot");
      }

      toast({
        title: "Screenshot uploaded",
        description: "Screenshot has been added successfully.",
      });

      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      // Use router.refresh() to update Server Component data
      router.refresh();
      
      // Call optional callback if provided
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload screenshot",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (screenshotId: string) => {
    try {
      const response = await fetch(`/api/key-screenshots/${screenshotId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete screenshot");
      }

      toast({
        title: "Screenshot deleted",
        description: "Screenshot has been removed.",
      });

      // Use router.refresh() to update Server Component data
      router.refresh();
      
      // Call optional callback if provided
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete screenshot",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          id="screenshot-upload"
        />
        <Label htmlFor="screenshot-upload" asChild>
          <Button variant="outline" type="button" asChild>
            <span>
              <Upload className="mr-2 h-4 w-4" />
              Upload Screenshot
            </span>
          </Button>
        </Label>
        {preview && (
          <Button onClick={handleUpload} disabled={isUploading}>
            {isUploading ? "Uploading..." : "Save"}
          </Button>
        )}
      </div>

      {preview && (
        <div className="relative w-full h-48 border rounded-lg overflow-hidden">
          <Image
            src={preview}
            alt="Preview"
            fill
            className="object-contain"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={() => setPreview(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {screenshots.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {screenshots.map((screenshot) => (
            <div key={screenshot.id} className="relative group">
              <div className="relative w-full h-32 border rounded-lg overflow-hidden">
                <Image
                  src={screenshot.imageUrl}
                  alt={screenshot.altText || "Screenshot"}
                  fill
                  className="object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(screenshot.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {screenshots.length === 0 && !preview && (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No screenshots yet</p>
        </div>
      )}
    </div>
  );
}

