"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Clock, User } from "lucide-react";

interface VersionComparisonProps {
  current: {
    value: string;
    state: string;
    createdAt: string;
    user: {
      name: string;
      email: string;
    };
  };
  previous: {
    value: string;
    state: string;
    createdAt: string;
    user: {
      name: string;
      email: string;
    };
  };
}

export function VersionComparison({ current, previous }: VersionComparisonProps) {
  const getStateColor = (state: string) => {
    switch (state) {
      case "approved":
        return "bg-green-500";
      case "review":
        return "bg-yellow-500";
      case "draft":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  // Simple diff highlighting (word-level)
  const highlightDiff = (oldText: string, newText: string) => {
    const oldWords = oldText.split(/(\s+)/);
    const newWords = newText.split(/(\s+)/);
    
    // Simple comparison - highlight words that changed
    const result: Array<{ text: string; changed: boolean }> = [];
    const maxLen = Math.max(oldWords.length, newWords.length);
    
    for (let i = 0; i < maxLen; i++) {
      const oldWord = oldWords[i] || "";
      const newWord = newWords[i] || "";
      
      if (oldWord !== newWord) {
        result.push({ text: newWord, changed: true });
      } else {
        result.push({ text: newWord, changed: false });
      }
    }
    
    return result;
  };

  const diff = highlightDiff(previous.value, current.value);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Current Version</CardTitle>
            <Badge className={`${getStateColor(current.state)} text-white text-xs`}>
              {current.state}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">
                {current.user.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <span>{current.user.name}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(current.createdAt), { addSuffix: true })}
            </span>
          </div>
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm whitespace-pre-wrap">
              {diff.map((item, idx) => (
                <span
                  key={idx}
                  className={item.changed ? "bg-yellow-200 dark:bg-yellow-900/30 font-medium" : ""}
                >
                  {item.text}
                </span>
              ))}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Previous Version</CardTitle>
            <Badge className={`${getStateColor(previous.state)} text-white text-xs`}>
              {previous.state}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">
                {previous.user.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <span>{previous.user.name}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(previous.createdAt), { addSuffix: true })}
            </span>
          </div>
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm whitespace-pre-wrap">{previous.value}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

