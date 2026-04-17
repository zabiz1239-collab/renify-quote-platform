"use client";

import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ErrorMessage({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <h3 className="text-lg font-semibold">Something went wrong</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
        {onRetry && (
          <Button
            className="min-h-[44px] bg-[#2D5E3A] hover:bg-[#2D5E3A]/90"
            onClick={onRetry}
          >
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
