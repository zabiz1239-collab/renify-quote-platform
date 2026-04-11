"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Quote } from "@/types";

interface QuoteCardProps {
  quote: Quote;
  tradeCode: string;
  tradeName: string;
  jobCode: string;
}

function getDaysElapsed(dateStr?: string): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getDayColor(days: number): string {
  if (days < 7) return "text-green-600";
  if (days <= 14) return "text-yellow-600";
  return "text-red-600";
}

function getExpiryStatus(expiryDate?: string): { label: string; color: string } | null {
  if (!expiryDate) return null;
  const daysUntil = Math.floor(
    (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntil < 0) return { label: "EXPIRED", color: "bg-red-100 text-red-800" };
  if (daysUntil <= 30) return { label: `${daysUntil}d left`, color: "bg-orange-100 text-orange-800" };
  if (daysUntil <= 60) return { label: `${daysUntil}d left`, color: "bg-yellow-100 text-yellow-800" };
  return null;
}

export default function QuoteCard({ quote, tradeCode, tradeName, jobCode }: QuoteCardProps) {
  const daysElapsed = getDaysElapsed(quote.requestedDate);
  const dayColor = getDayColor(daysElapsed);
  const expiry = getExpiryStatus(quote.quoteExpiry);

  return (
    <div className="bg-white rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing">
      <div className="flex items-start justify-between mb-1">
        <p className="font-medium text-sm truncate flex-1">{quote.supplierName}</p>
        <Badge variant="secondary" className="text-xs ml-2 shrink-0">
          {tradeCode}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground truncate">{tradeName}</p>
      <p className="text-xs text-muted-foreground">{jobCode}</p>

      <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
        {quote.requestedDate && (
          <span className={cn("text-xs font-medium", dayColor)}>
            {daysElapsed}d ago
          </span>
        )}
        {quote.priceExGST !== undefined && (
          <span className="text-xs font-semibold">
            ${quote.priceExGST.toLocaleString()}
          </span>
        )}
        {quote.version > 1 && (
          <Badge variant="outline" className="text-xs">
            v{quote.version}
          </Badge>
        )}
        {expiry && (
          <Badge className={cn("text-xs", expiry.color)}>
            {expiry.label}
          </Badge>
        )}
      </div>
    </div>
  );
}
