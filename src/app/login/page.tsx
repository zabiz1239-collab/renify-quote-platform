"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-xl flex items-center justify-center bg-primary">
            <span className="text-2xl font-bold text-primary-foreground">R</span>
          </div>
          <CardTitle className="text-2xl">Renify Quote Platform</CardTitle>
          <CardDescription className="mt-2">
            Sign in with your Microsoft account to access Renify Jobs and send
            quote requests from your email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => signIn("microsoft", { callbackUrl: "/" })}
            className="w-full h-12 text-base"
          >
            Sign in with Microsoft
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
