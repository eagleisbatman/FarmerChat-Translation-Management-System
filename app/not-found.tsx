import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-4xl">404</CardTitle>
          <CardDescription>Page not found</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Button asChild>
            <Link href="/projects">
              <Home className="mr-2 h-4 w-4" />
              Go to Projects
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

