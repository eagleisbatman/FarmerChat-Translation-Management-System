"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter, X } from "lucide-react";
import type { TranslationState } from "@/lib/workflow";

type Language = {
  id: string;
  code: string;
  name: string;
  flagEmoji?: string | null;
};

export interface FilterState {
  searchQuery: string;
  searchIn: ("key" | "value" | "description" | "namespace")[];
  states: TranslationState[];
  languages: string[];
  dateFrom: string;
  dateTo: string;
  createdBy: string;
}

interface TranslationFiltersProps {
  languages: Language[];
  users: Array<{ id: string; name: string; email: string }>;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function TranslationFilters({
  languages,
  users,
  filters,
  onFiltersChange,
}: TranslationFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleSearchIn = (field: "key" | "value" | "description" | "namespace") => {
    const current = filters.searchIn;
    const updated = current.includes(field)
      ? current.filter((f) => f !== field)
      : [...current, field];
    updateFilter("searchIn", updated);
  };

  const toggleState = (state: TranslationState) => {
    const current = filters.states;
    const updated = current.includes(state)
      ? current.filter((s) => s !== state)
      : [...current, state];
    updateFilter("states", updated);
  };

  const toggleLanguage = (languageId: string) => {
    const current = filters.languages;
    const updated = current.includes(languageId)
      ? current.filter((l) => l !== languageId)
      : [...current, languageId];
    updateFilter("languages", updated);
  };

  const clearFilters = () => {
    onFiltersChange({
      searchQuery: "",
      searchIn: ["key"],
      states: [],
      languages: [],
      dateFrom: "",
      dateTo: "",
      createdBy: "",
    });
  };

  const activeFilterCount =
    (filters.searchQuery ? 1 : 0) +
    filters.states.length +
    filters.languages.length +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.createdBy ? 1 : 0) +
    (filters.searchIn.length !== 1 || filters.searchIn[0] !== "key" ? 1 : 0);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative">
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Advanced Filters</h4>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 text-xs"
              >
                <X className="mr-1 h-3 w-3" />
                Clear All
              </Button>
            )}
          </div>

          {/* Search Query */}
          <div className="space-y-2">
            <Label>Search</Label>
            <Input
              placeholder="Search translations..."
              value={filters.searchQuery}
              onChange={(e) => updateFilter("searchQuery", e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="search-key"
                  checked={filters.searchIn.includes("key")}
                  onCheckedChange={() => toggleSearchIn("key")}
                />
                <Label htmlFor="search-key" className="text-xs cursor-pointer">
                  Key
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="search-value"
                  checked={filters.searchIn.includes("value")}
                  onCheckedChange={() => toggleSearchIn("value")}
                />
                <Label htmlFor="search-value" className="text-xs cursor-pointer">
                  Value
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="search-description"
                  checked={filters.searchIn.includes("description")}
                  onCheckedChange={() => toggleSearchIn("description")}
                />
                <Label htmlFor="search-description" className="text-xs cursor-pointer">
                  Description
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="search-namespace"
                  checked={filters.searchIn.includes("namespace")}
                  onCheckedChange={() => toggleSearchIn("namespace")}
                />
                <Label htmlFor="search-namespace" className="text-xs cursor-pointer">
                  Namespace
                </Label>
              </div>
            </div>
          </div>

          {/* State Filter */}
          <div className="space-y-2">
            <Label>Translation State</Label>
            <div className="flex flex-wrap gap-2">
              {(["draft", "review", "approved"] as TranslationState[]).map((state) => (
                <div key={state} className="flex items-center space-x-2">
                  <Checkbox
                    id={`state-${state}`}
                    checked={filters.states.includes(state)}
                    onCheckedChange={() => toggleState(state)}
                  />
                  <Label htmlFor={`state-${state}`} className="text-xs cursor-pointer capitalize">
                    {state}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Language Filter */}
          <div className="space-y-2">
            <Label>Languages</Label>
            <div className="max-h-32 overflow-y-auto space-y-2">
              {languages.map((lang) => (
                <div key={lang.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`lang-${lang.id}`}
                    checked={filters.languages.includes(lang.id)}
                    onCheckedChange={() => toggleLanguage(lang.id)}
                  />
                  <Label htmlFor={`lang-${lang.id}`} className="text-xs cursor-pointer flex items-center gap-1">
                    {lang.flagEmoji && <span>{lang.flagEmoji}</span>}
                    {lang.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-xs">From Date</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter("dateFrom", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">To Date</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter("dateTo", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Created By */}
          <div className="space-y-2">
            <Label>Created By</Label>
            <Select
              value={filters.createdBy}
              onValueChange={(value) => updateFilter("createdBy", value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All users</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

