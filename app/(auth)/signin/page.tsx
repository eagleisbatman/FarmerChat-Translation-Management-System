"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe2, Languages, Sparkles, Shield, Users } from "lucide-react";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/projects";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Hero section (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 gradient-accent p-12 flex-col justify-between text-white">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Globe2 className="h-10 w-10" />
            <span className="text-3xl font-bold">LinguaFlow</span>
          </div>
          <p className="text-white/80 text-lg">Translation Management System</p>
        </div>

        <div className="space-y-8">
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
            Seamless translations for global impact
          </h1>
          <p className="text-xl text-white/90 max-w-lg">
            Manage, collaborate, and deploy translations across all your applications with AI-powered assistance.
          </p>

          <div className="grid grid-cols-2 gap-6 pt-4">
            <FeatureItem icon={Languages} text="Multi-language support" />
            <FeatureItem icon={Sparkles} text="AI-powered translations" />
            <FeatureItem icon={Users} text="Team collaboration" />
            <FeatureItem icon={Shield} text="Enterprise security" />
          </div>
        </div>

        <p className="text-white/60 text-sm">
          Trusted by Digital Green for agricultural development programs worldwide
        </p>
      </div>

      {/* Right side - Sign in form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background safe-area-top safe-area-bottom">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center space-y-2">
            <div className="inline-flex items-center gap-2 text-primary">
              <Globe2 className="h-8 w-8" />
              <span className="text-2xl font-bold">LinguaFlow</span>
            </div>
            <p className="text-muted-foreground">Translation Management System</p>
          </div>

          <Card className="border-0 shadow-xl lg:border lg:shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold tracking-tight text-center">
                Welcome back
              </CardTitle>
              <CardDescription className="text-center">
                Sign in to manage your translation projects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Button
                onClick={() => signIn("google", { callbackUrl })}
                className="w-full min-h-[52px] sm:min-h-[44px] text-base sm:text-sm"
                size="lg"
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Authorized domains
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 text-xs rounded-full bg-muted text-muted-foreground">
                  @digitalgreen.org
                </span>
                <span className="px-3 py-1 text-xs rounded-full bg-muted text-muted-foreground">
                  @digitalgreentrust.org
                </span>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground px-4">
            By signing in, you agree to our Terms of Service and Privacy Policy.
            Contact your administrator if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-white/10">
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-white/90">{text}</span>
    </div>
  );
}

