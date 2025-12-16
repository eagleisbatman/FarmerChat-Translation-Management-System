"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Play, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface QueueItem {
  id: string;
  projectId: string;
  keyId: string;
  sourceLanguageId: string;
  targetLanguageId: string;
  sourceText: string;
  imageUrl: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  translatedText: string | null;
  error: string | null;
  provider: string | null;
  createdBy: string;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TranslationQueueDashboardProps {
  projectId: string;
}

export function TranslationQueueDashboard({ projectId }: TranslationQueueDashboardProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  const loadQueue = async () => {
    setIsLoading(true);
    try {
      const url = `/api/translation-queue?projectId=${projectId}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setQueue(data);
      }
    } catch (error) {
      console.error("Error loading queue:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const processQueue = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/translation-queue/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: 10 }),
      });

      if (!response.ok) {
        throw new Error("Failed to process queue");
      }

      const result = await response.json();
      toast({
        title: "Queue processed",
        description: `Processed ${result.processed} items. ${result.succeeded} succeeded, ${result.failed} failed.`,
      });
      loadQueue();
    } catch (error) {
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Failed to process queue",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [projectId, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case "processing":
        return <Badge variant="secondary" className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Processing</Badge>;
      case "completed":
        return <Badge className="bg-green-500 text-white flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Completed</Badge>;
      case "failed":
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const stats = {
    total: queue.length,
    pending: queue.filter((q) => q.status === "pending").length,
    processing: queue.filter((q) => q.status === "processing").length,
    completed: queue.filter((q) => q.status === "completed").length,
    failed: queue.filter((q) => q.status === "failed").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Translation Queue</h2>
          <p className="text-muted-foreground">Monitor and manage bulk AI translations</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadQueue} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={processQueue} disabled={isProcessing || stats.pending === 0}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Process Queue ({stats.pending})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Processing</CardDescription>
            <CardTitle className="text-2xl">{stats.processing}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-2xl text-green-500">{stats.completed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed</CardDescription>
            <CardTitle className="text-2xl text-red-500">{stats.failed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Queue Items */}
      <Card>
        <CardHeader>
          <CardTitle>Queue Items</CardTitle>
          <CardDescription>
            {queue.length === 0 ? "No items in queue" : `${queue.length} item${queue.length !== 1 ? "s" : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No items found</p>
          ) : (
            <div className="space-y-4">
              {queue.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(item.status)}
                        {item.provider && (
                          <Badge variant="outline">via {item.provider}</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium">Source: {item.sourceText.substring(0, 100)}...</p>
                      {item.translatedText && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Translated: {item.translatedText.substring(0, 100)}...
                        </p>
                      )}
                      {item.error && (
                        <p className="text-sm text-red-500 mt-1">Error: {item.error}</p>
                      )}
                      {item.imageUrl && (
                        <Badge variant="outline" className="mt-2">Has image context</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      <p>Created {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</p>
                      {item.processedAt && (
                        <p>Processed {formatDistanceToNow(new Date(item.processedAt), { addSuffix: true })}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

