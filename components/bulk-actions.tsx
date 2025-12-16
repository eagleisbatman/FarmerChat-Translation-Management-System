"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { MoreVertical, CheckCircle, XCircle, Trash2, Send } from "lucide-react";
import type { TranslationState } from "@/lib/workflow";

interface BulkActionsProps {
  selectedKeys: string[];
  projectId: string;
  onActionComplete: () => void;
}

export function BulkActions({
  selectedKeys,
  projectId,
  onActionComplete,
}: BulkActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [action, setAction] = useState<"approve" | "reject" | "delete" | null>(null);
  const { toast } = useToast();

  if (selectedKeys.length === 0) {
    return null;
  }

  const handleBulkAction = async (actionType: "approve" | "reject" | "delete") => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/translation-keys/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          keyIds: selectedKeys,
          action: actionType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${actionType} keys`);
      }

      toast({
        title: "Bulk Action Complete",
        description: `${selectedKeys.length} key(s) ${actionType}d successfully.`,
      });

      onActionComplete();
      setAction(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${actionType} keys`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={isProcessing}>
            <MoreVertical className="mr-2 h-4 w-4" />
            Bulk Actions ({selectedKeys.length})
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setAction("approve")}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Approve Translations
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAction("reject")}>
            <XCircle className="mr-2 h-4 w-4" />
            Reject Translations
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setAction("delete")} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Keys
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={action !== null} onOpenChange={(open) => !open && setAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action === "approve" && "Approve Translations?"}
              {action === "reject" && "Reject Translations?"}
              {action === "delete" && "Delete Translation Keys?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action === "approve" &&
                `Are you sure you want to approve all translations for ${selectedKeys.length} selected key(s)?`}
              {action === "reject" &&
                `Are you sure you want to reject all translations for ${selectedKeys.length} selected key(s)? They will be reverted to draft state.`}
              {action === "delete" &&
                `Are you sure you want to delete ${selectedKeys.length} selected key(s)? This will permanently delete the keys and all their translations. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => action && handleBulkAction(action)}
              disabled={isProcessing}
              className={
                action === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {isProcessing ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

