"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 rounded-lg border bg-card p-8 shadow-lg">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            Authentication Error
          </h1>
          <p className="mt-2 text-muted-foreground">
            There was a problem signing you in. Please make sure you're using
            an authorized email domain.
          </p>
        </div>
        <Button asChild className="w-full" size="lg">
          <Link href="/signin">Try Again</Link>
        </Button>
      </div>
    </div>
  );
}

