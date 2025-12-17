"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, History, Bookmark, BookmarkPlus, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters?: string | null;
}

interface SearchHistoryItem {
  id: string;
  query: string;
  filters?: string | null;
  resultCount: number;
  createdAt: Date;
}

interface EnhancedSearchBarProps {
  projectId: string;
  value: string;
  onChange: (value: string) => void;
  onSearch?: (query: string, filters?: Record<string, any>) => void;
  placeholder?: string;
}

export function EnhancedSearchBar({
  projectId,
  value,
  onChange,
  onSearch,
  placeholder = "Search translations... (e.g., key:value, \"exact phrase\", AND, OR, NOT)",
}: EnhancedSearchBarProps) {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadSavedSearches();
    loadSearchHistory();
  }, [projectId]);

  const loadSavedSearches = async () => {
    setIsLoadingSaved(true);
    try {
      const response = await fetch(`/api/saved-searches?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setSavedSearches(data);
      }
    } catch (error) {
      console.error("Error loading saved searches:", error);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  const loadSearchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/search-history?projectId=${projectId}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setSearchHistory(data);
      }
    } catch (error) {
      console.error("Error loading search history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSaveSearch = async () => {
    if (!saveSearchName.trim() || !value.trim()) {
      toast({
        title: "Error",
        description: "Please provide a name and search query",
        variant: "destructive",
      });
      return;
    }

    try {
      const filters = {}; // You can extract filters from props if needed
      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: saveSearchName,
          query: value,
          filters,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save search");
      }

      toast({
        title: "Search saved",
        description: `"${saveSearchName}" has been saved`,
      });

      setShowSaveDialog(false);
      setSaveSearchName("");
      loadSavedSearches();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save search",
        variant: "destructive",
      });
    }
  };

  const handleLoadSavedSearch = (search: SavedSearch) => {
    onChange(search.query);
    if (search.filters) {
      try {
        const filters = JSON.parse(search.filters);
        // You can pass filters to parent component if needed
        if (onSearch) {
          onSearch(search.query, filters);
        }
      } catch (e) {
        if (onSearch) {
          onSearch(search.query);
        }
      }
    } else {
      if (onSearch) {
        onSearch(search.query);
      }
    }
    inputRef.current?.focus();
  };

  const handleLoadHistoryItem = (item: SearchHistoryItem) => {
    onChange(item.query);
    if (item.filters) {
      try {
        const filters = JSON.parse(item.filters);
        if (onSearch) {
          onSearch(item.query, filters);
        }
      } catch (e) {
        if (onSearch) {
          onSearch(item.query);
        }
      }
    } else {
      if (onSearch) {
        onSearch(item.query);
      }
    }
    inputRef.current?.focus();
    setShowHistory(false);
  };

  const handleDeleteSavedSearch = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/saved-searches/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete search");
      }

      toast({
        title: "Search deleted",
        description: "Saved search has been removed",
      });

      loadSavedSearches();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete search",
        variant: "destructive",
      });
    }
  };

  const handleSearch = () => {
    if (onSearch) {
      onSearch(value);
    }
    // Record in history
    if (value.trim()) {
      fetch("/api/search-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          query: value,
          resultCount: 0, // Will be updated when results are fetched
        }),
      }).catch(console.error);
    }
  };

  return (
    <div className="relative flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch();
            }
          }}
          placeholder={placeholder}
          className="pl-9 pr-20"
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <DropdownMenu open={showHistory} onOpenChange={setShowHistory}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <History className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Recent Searches</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {isLoadingHistory ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : searchHistory.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No recent searches
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {searchHistory.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => handleLoadHistoryItem(item)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate flex-1">{item.query}</span>
                  {item.resultCount > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {item.resultCount}
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <Bookmark className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Saved Searches</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {isLoadingSaved ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : savedSearches.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No saved searches
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {savedSearches.map((search) => (
                <DropdownMenuItem
                  key={search.id}
                  onClick={() => handleLoadSavedSearch(search)}
                  className="flex items-center justify-between cursor-pointer group"
                >
                  <span className="truncate flex-1">{search.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                    onClick={(e) => handleDeleteSavedSearch(search.id, e)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </DropdownMenuItem>
              ))}
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowSaveDialog(true)}
            disabled={!value.trim()}
            className="cursor-pointer"
          >
            <BookmarkPlus className="mr-2 h-4 w-4" />
            Save current search
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button onClick={handleSearch} disabled={!value.trim()}>
        Search
      </Button>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Search</DialogTitle>
            <DialogDescription>
              Give this search a name so you can quickly access it later
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="search-name">Search Name</Label>
              <Input
                id="search-name"
                value={saveSearchName}
                onChange={(e) => setSaveSearchName(e.target.value)}
                placeholder="e.g., Missing translations"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveSearch();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Query</Label>
              <div className="p-2 bg-muted rounded-md text-sm font-mono">
                {value || "(empty)"}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSearch} disabled={!saveSearchName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

