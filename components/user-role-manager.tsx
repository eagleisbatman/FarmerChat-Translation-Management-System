"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
type UserRole = "admin" | "translator" | "reviewer";
import { Loader2 } from "lucide-react";

interface UserRoleManagerProps {
  userId: string;
  currentRole: UserRole;
  userName: string;
  onRoleChanged?: () => void; // Optional, will use router.refresh() if not provided
}

export function UserRoleManager({
  userId,
  currentRole,
  userName,
  onRoleChanged,
}: UserRoleManagerProps) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleRoleChange = async (newRole: UserRole) => {
    if (newRole === currentRole) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update user role");
      }

      toast({
        title: "Role Updated",
        description: `${userName}'s role has been changed to ${newRole}.`,
      });

      // Use router.refresh() to update Server Component data
      router.refresh();
      
      // Call optional callback if provided
      if (onRoleChanged) {
        onRoleChanged();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user role",
        variant: "destructive",
      });
      setSelectedRole(currentRole); // Revert on error
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Select
      value={selectedRole}
      onValueChange={(value) => {
        setSelectedRole(value as UserRole);
        handleRoleChange(value as UserRole);
      }}
      disabled={isUpdating}
    >
      <SelectTrigger className="w-32">
        {isUpdating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <SelectValue>
            <Badge
              variant={
                selectedRole === "admin"
                  ? "default"
                  : selectedRole === "reviewer"
                  ? "secondary"
                  : "outline"
              }
              className="capitalize"
            >
              {selectedRole}
            </Badge>
          </SelectValue>
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="reviewer">Reviewer</SelectItem>
        <SelectItem value="translator">Translator</SelectItem>
      </SelectContent>
    </Select>
  );
}

