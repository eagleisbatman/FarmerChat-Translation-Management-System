"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 rounded-lg border bg-card p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to access the Translation Management System
          </p>
        </div>
        <Button
          onClick={() => signIn("google", { callbackUrl: "/projects" })}
          className="w-full"
          size="lg"
        >
          <LogIn className="mr-2 h-4 w-4" />
          Sign in with Google
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Only @digitalgreen.org and @digitalgreentrust.org emails are allowed
        </p>
      </div>
    </div>
  );
}

