"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, X, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ProjectMember = {
  projectMember: {
    projectId: string;
    userId: string;
    role: "translator" | "reviewer";
    createdAt: Date;
  };
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
};

interface ProjectMemberManagerProps {
  projectId: string;
  initialMembers: ProjectMember[];
  allUsers: Array<{ id: string; name: string; email: string }>;
}

export function ProjectMemberManager({
  projectId,
  initialMembers,
  allUsers,
}: ProjectMemberManagerProps) {
  const [members, setMembers] = useState(initialMembers);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<"translator" | "reviewer">("translator");
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const { toast } = useToast();

  const availableUsers = allUsers.filter(
    (user) => !members.some((m) => m.user.id === user.id)
  );

  const handleAddMember = async () => {
    if (!selectedUserId) {
      toast({
        title: "Error",
        description: "Please select a user",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          role: selectedRole,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add member");
      }

      // Fetch updated list
      const updatedResponse = await fetch(`/api/projects/${projectId}/members`);
      const updated = await updatedResponse.json();
      setMembers(updated);

      setSelectedUserId("");
      toast({
        title: "Member Added",
        description: "User has been added to the project",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add member",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setIsRemoving(userId);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/members?userId=${userId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove member");
      }

      // Fetch updated list
      const updatedResponse = await fetch(`/api/projects/${projectId}/members`);
      const updated = await updatedResponse.json();
      setMembers(updated);

      toast({
        title: "Member Removed",
        description: "User has been removed from the project",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove member",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Project Members
        </CardTitle>
        <CardDescription>
          Manage translators and reviewers for this project
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Member */}
        <div className="flex gap-2">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a user to add" />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">
                  All users have been added
                </div>
              ) : (
                availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as "translator" | "reviewer")}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="translator">Translator</SelectItem>
              <SelectItem value="reviewer">Reviewer</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleAddMember}
            disabled={!selectedUserId || isAdding || availableUsers.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            {isAdding ? "Adding..." : "Add"}
          </Button>
        </div>

        {/* Member List */}
        {members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No members added yet. Add your first member above.
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.user.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={member.user.image || ""} />
                    <AvatarFallback>
                      {member.user.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{member.user.name}</div>
                    <div className="text-sm text-muted-foreground">{member.user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={member.projectMember.role === "reviewer" ? "secondary" : "outline"}
                    className="capitalize"
                  >
                    {member.projectMember.role}
                  </Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isRemoving === member.user.id}
                      >
                        {isRemoving === member.user.id ? (
                          "Removing..."
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Member?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove {member.user.name} from this project?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemoveMember(member.user.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

