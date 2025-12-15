"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Send, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}

interface TranslationCommentsProps {
  translationId: string;
}

export function TranslationComments({ translationId }: TranslationCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadComments();
  }, [translationId]);

  const loadComments = async () => {
    try {
      const response = await fetch(`/api/comments?translationId=${translationId}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.map((item: { comment: Comment; user: Comment["user"] }) => ({
          ...item.comment,
          user: item.user,
        })));
      }
    } catch (error) {
      console.error("Error loading comments:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          translationId,
          content: newComment,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add comment");
      }

      toast({
        title: "Comment added",
        description: "Your comment has been added successfully.",
      });

      setNewComment("");
      loadComments();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h3 className="font-semibold">Comments ({comments.length})</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
        />
        <Button type="submit" disabled={isLoading || !newComment.trim()}>
          <Send className="mr-2 h-4 w-4" />
          Add Comment
        </Button>
      </form>

      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3 p-3 border rounded-lg">
            <Avatar className="h-8 w-8">
              <AvatarImage src={comment.user.image || ""} />
              <AvatarFallback>
                {comment.user.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{comment.user.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm">{comment.content}</p>
            </div>
          </div>
        ))}

        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>
    </div>
  );
}

