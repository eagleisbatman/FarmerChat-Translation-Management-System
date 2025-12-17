"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Send, MessageSquare, AtSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { highlightMentions } from "@/lib/utils/mentions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

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

interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  isProjectMember?: boolean;
}

interface TranslationCommentsProps {
  translationId: string;
}

export function TranslationComments({ translationId }: TranslationCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadComments();
    loadUsers();
  }, [translationId]);

  const loadUsers = async () => {
    try {
      const response = await fetch(`/api/comments/users?translationId=${translationId}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

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

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    setNewComment(value);

    // Check for @mention trigger
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Check if there's a space or newline after @ (mention ended)
      if (textAfterAt.includes(" ") || textAfterAt.includes("\n")) {
        setShowMentionSuggestions(false);
        setMentionQuery("");
      } else {
        // Show suggestions
        setMentionQuery(textAfterAt);
        setMentionStartIndex(lastAtIndex);
        setShowMentionSuggestions(true);
        setSelectedMentionIndex(0);
      }
    } else {
      setShowMentionSuggestions(false);
      setMentionQuery("");
    }
  };

  const filteredUsers = users.filter((user) => {
    if (!mentionQuery) return true;
    const query = mentionQuery.toLowerCase();
    const name = user.name?.toLowerCase() || "";
    const email = user.email?.toLowerCase() || "";
    return name.includes(query) || email.includes(query);
  }).slice(0, 10);

  const insertMention = (user: User) => {
    if (mentionStartIndex === -1) return;

    const beforeMention = newComment.substring(0, mentionStartIndex);
    const afterMention = newComment.substring(mentionStartIndex + 1 + mentionQuery.length);
    const mentionText = `@${user.name || user.email}`;
    const newValue = beforeMention + mentionText + " " + afterMention;

    setNewComment(newValue);
    setShowMentionSuggestions(false);
    setMentionQuery("");
    setMentionStartIndex(-1);

    // Focus back on textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionSuggestions && filteredUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredUsers[selectedMentionIndex]);
      } else if (e.key === "Escape") {
        setShowMentionSuggestions(false);
        setMentionQuery("");
      }
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
      setShowMentionSuggestions(false);
      setMentionQuery("");
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

  // Create user map for mention highlighting
  const userMap = new Map<string, { id: string; name: string; email: string }>();
  comments.forEach((comment) => {
    userMap.set(comment.user.id, {
      id: comment.user.id,
      name: comment.user.name,
      email: comment.user.email,
    });
  });
  users.forEach((user) => {
    if (!userMap.has(user.id)) {
      userMap.set(user.id, {
        id: user.id,
        name: user.name,
        email: user.email,
      });
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h3 className="font-semibold">Comments ({comments.length})</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={newComment}
            onChange={handleCommentChange}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment... Use @ to mention someone"
            rows={3}
            className="pr-10"
          />
          {showMentionSuggestions && filteredUsers.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 w-full bg-popover border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
              {filteredUsers.map((user, index) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => insertMention(user)}
                  className={`w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 ${
                    index === selectedMentionIndex ? "bg-accent" : ""
                  }`}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.image || ""} />
                    <AvatarFallback className="text-xs">
                      {user.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {user.name || user.email}
                    </div>
                    {user.name && (
                      <div className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </div>
                    )}
                  </div>
                  {user.isProjectMember && (
                    <Badge variant="outline" className="text-xs">
                      Member
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={isLoading || !newComment.trim()}>
            <Send className="mr-2 h-4 w-4" />
            Add Comment
          </Button>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <AtSign className="h-3 w-3" />
            <span>Type @ to mention someone</span>
          </div>
        </div>
      </form>

      <div className="space-y-4">
        {comments.map((comment) => {
          const highlightedParts = highlightMentions(comment.content, userMap);
          return (
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
                <p className="text-sm">
                  {highlightedParts.map((part, index) => {
                    if (part.type === "mention") {
                      return (
                        <span
                          key={index}
                          className="font-medium text-primary bg-primary/10 px-1 rounded"
                        >
                          {part.content}
                        </span>
                      );
                    }
                    return <span key={index}>{part.content}</span>;
                  })}
                </p>
              </div>
            </div>
          );
        })}

        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>
    </div>
  );
}
