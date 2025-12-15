"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { History, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface HistoryEntry {
  id: string;
  value: string;
  state: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface TranslationHistoryViewerProps {
  translationId: string;
}

export function TranslationHistoryViewer({ translationId }: TranslationHistoryViewerProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [translationId]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/translations/${translationId}/history`);
      if (response.ok) {
        const data = await response.json();
        setHistory(
          data.map((item: { history: HistoryEntry; user: HistoryEntry["user"] }) => ({
            ...item.history,
            user: item.user,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setIsLoading(false);
    }
  };

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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading history...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" />
          Translation History ({history.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history available</p>
        ) : (
          <div className="space-y-4">
            {history.map((entry, index) => (
              <div key={entry.id} className="flex gap-3 pb-4 border-b last:border-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={entry.user.image || ""} />
                  <AvatarFallback>
                    {entry.user.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{entry.user.name}</span>
                    <Badge className={`${getStateColor(entry.state)} text-white text-xs`}>
                      {entry.state}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm">{entry.value}</p>
                  {index < history.length - 1 && (
                    <div className="text-xs text-muted-foreground mt-2">
                      Changed from: "{history[index + 1]?.value}"
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

