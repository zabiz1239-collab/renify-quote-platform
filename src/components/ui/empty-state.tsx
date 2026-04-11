"use client";

import React from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="text-muted-foreground">
        {icon || <Inbox className="h-12 w-12" />}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && (
        <>
          {action.href ? (
            <Button
              asChild
              className="min-h-[44px] bg-[#2D5E3A] hover:bg-[#2D5E3A]/90"
            >
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button
              className="min-h-[44px] bg-[#2D5E3A] hover:bg-[#2D5E3A]/90"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
