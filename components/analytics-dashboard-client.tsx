"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, Users, CheckCircle, Clock, BarChart3 } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AnalyticsDashboardClientProps {
  projectId: string;
}

interface AnalyticsData {
  project: {
    id: string;
    name: string;
  };
  summary: {
    totalKeys: number;
    totalTranslations: number;
    approvedTranslations: number;
    completionRate: string;
  };
  translationStats: Array<{
    languageCode: string;
    languageName: string;
    total: number;
    approved: number;
    inReview: number;
    draft: number;
  }>;
  userContributions: Array<{
    userId: string;
    userName: string | null;
    userEmail: string | null;
    translationsCreated: number;
    translationsApproved: number;
    reviewsCompleted: number;
  }>;
  activityOverTime: Array<{
    date: string;
    count: number;
    approved: number;
  }>;
  reviewTurnaround: {
    avgHours: string | null;
  };
  namespaceStats: Array<{
    namespace: string;
    count: number;
  }>;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export function AnalyticsDashboardClient({ projectId }: AnalyticsDashboardClientProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadAnalytics();
  }, [projectId]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);

      const response = await fetch(`/api/projects/${projectId}/analytics?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to load analytics");
      }

      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load analytics",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateFilter = () => {
    loadAnalytics();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No analytics data available</p>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data
  const languageCompletionData = data.translationStats.map((stat) => ({
    language: stat.languageCode,
    approved: stat.approved,
    inReview: stat.inReview,
    draft: stat.draft,
    total: stat.total,
    completionRate: stat.total > 0 ? ((stat.approved / stat.total) * 100).toFixed(1) : "0",
  }));

  const namespacePieData = data.namespaceStats.map((ns) => ({
    name: ns.namespace,
    value: ns.count,
  }));

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range Filter</CardTitle>
          <CardDescription>Filter analytics by date range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="from-date">From Date</Label>
              <Input
                id="from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="to-date">To Date</Label>
              <Input
                id="to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleDateFilter}>Apply Filter</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Keys</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalKeys}</div>
            <p className="text-xs text-muted-foreground">Translation keys</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Translations</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalTranslations}</div>
            <p className="text-xs text-muted-foreground">All translations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.approvedTranslations}</div>
            <p className="text-xs text-muted-foreground">
              {data.summary.completionRate}% completion rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Review Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.reviewTurnaround.avgHours ? `${data.reviewTurnaround.avgHours}h` : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">Average hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Language Completion Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Translation Completion by Language</CardTitle>
          <CardDescription>Breakdown of translations by state per language</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={languageCompletionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="language" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="approved" stackId="a" fill="#22c55e" name="Approved" />
              <Bar dataKey="inReview" stackId="a" fill="#f59e0b" name="In Review" />
              <Bar dataKey="draft" stackId="a" fill="#6b7280" name="Draft" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Activity Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Translation Activity Over Time</CardTitle>
          <CardDescription>Daily translation activity for the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.activityOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#0088FE"
                name="Total Translations"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="approved"
                stroke="#22c55e"
                name="Approved"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Namespace Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Namespace Distribution</CardTitle>
            <CardDescription>Translation keys by namespace</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={namespacePieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {namespacePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* User Contributions */}
        <Card>
          <CardHeader>
            <CardTitle>Top Contributors</CardTitle>
            <CardDescription>User contribution metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.userContributions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No contributor data available
                </p>
              ) : (
                data.userContributions.map((user, index) => (
                  <div key={user.userId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {user.userName || user.userEmail || "Unknown User"}
                        </p>
                        <p className="text-xs text-muted-foreground">{user.userEmail}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {user.translationsCreated}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {user.reviewsCompleted}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Language Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle>Language Statistics</CardTitle>
          <CardDescription>Detailed breakdown by language</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Language</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-right p-2">Approved</th>
                  <th className="text-right p-2">In Review</th>
                  <th className="text-right p-2">Draft</th>
                  <th className="text-right p-2">Completion</th>
                </tr>
              </thead>
              <tbody>
                {data.translationStats.map((stat) => (
                  <tr key={stat.languageCode} className="border-b">
                    <td className="p-2 font-medium">
                      {stat.languageName} ({stat.languageCode})
                    </td>
                    <td className="text-right p-2">{stat.total}</td>
                    <td className="text-right p-2 text-green-600">{stat.approved}</td>
                    <td className="text-right p-2 text-yellow-600">{stat.inReview}</td>
                    <td className="text-right p-2 text-gray-600">{stat.draft}</td>
                    <td className="text-right p-2">
                      <Badge variant={stat.approved === stat.total ? "default" : "secondary"}>
                        {stat.total > 0
                          ? `${((stat.approved / stat.total) * 100).toFixed(1)}%`
                          : "0%"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

