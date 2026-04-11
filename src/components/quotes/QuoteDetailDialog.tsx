"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Mail, Clock } from "lucide-react";
import type { Quote } from "@/types";

interface QuoteDetailDialogProps {
  open: boolean;
  onClose: () => void;
  quote: Quote;
  allVersions: Quote[];
  tradeName: string;
  tradeCode: string;
  jobCode: string;
}

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-800",
  requested: "bg-blue-100 text-blue-800",
  received: "bg-green-100 text-green-800",
  accepted: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-800",
};

export default function QuoteDetailDialog({
  open,
  onClose,
  quote,
  allVersions,
  tradeName,
  tradeCode,
  jobCode,
}: QuoteDetailDialogProps) {
  const sortedVersions = [...allVersions].sort((a, b) => b.version - a.version);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {quote.supplierName} — {tradeCode} {tradeName}
          </DialogTitle>
          <DialogDescription>
            {jobCode} — Quote details, version history, and email timeline
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Current Quote Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <Badge className={STATUS_COLORS[quote.status] || ""}>
                {quote.status.replace("_", " ")}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Version</p>
              <p className="font-medium">v{quote.version}</p>
            </div>
            {quote.priceExGST !== undefined && (
              <div>
                <p className="text-muted-foreground text-xs">Price ex GST</p>
                <p className="font-medium font-mono">${quote.priceExGST.toLocaleString()}</p>
              </div>
            )}
            {quote.priceIncGST !== undefined && (
              <div>
                <p className="text-muted-foreground text-xs">Price inc GST</p>
                <p className="font-medium font-mono">${quote.priceIncGST.toLocaleString()}</p>
              </div>
            )}
            {quote.quoteExpiry && (
              <div>
                <p className="text-muted-foreground text-xs">Expiry</p>
                <p className="font-medium">{new Date(quote.quoteExpiry).toLocaleDateString()}</p>
              </div>
            )}
            {quote.quotePDF && (
              <div>
                <p className="text-muted-foreground text-xs">PDF</p>
                <p className="font-medium text-xs truncate">{quote.quotePDF}</p>
              </div>
            )}
          </div>

          {/* Version History */}
          {sortedVersions.length > 1 && (
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4" />
                Version History ({sortedVersions.length} versions)
              </h3>
              <div className="space-y-2">
                {sortedVersions.map((v) => (
                  <Card key={`v${v.version}`} className={v.version === quote.version ? "border-primary" : ""}>
                    <CardContent className="py-2 px-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">v{v.version}</Badge>
                          <Badge className={`text-xs ${STATUS_COLORS[v.status] || ""}`}>
                            {v.status.replace("_", " ")}
                          </Badge>
                        </div>
                        {v.priceExGST !== undefined && (
                          <span className="text-sm font-mono font-medium">
                            ${v.priceExGST.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                        {v.receivedDate && (
                          <span>Received: {new Date(v.receivedDate).toLocaleDateString()}</span>
                        )}
                        {v.quotePDF && (
                          <span className="truncate max-w-[200px]">{v.quotePDF}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Email History */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4" />
              Email History
            </h3>
            <div className="space-y-2">
              {quote.requestedDate && (
                <div className="flex items-start gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium">Quote Request Sent</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(quote.requestedDate).toLocaleDateString()} at{" "}
                      {new Date(quote.requestedDate).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              )}
              {quote.followUpCount >= 1 && (
                <div className="flex items-start gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium">1st Follow-Up Sent</p>
                    <p className="text-xs text-muted-foreground">
                      {quote.lastFollowUp && quote.followUpCount === 1
                        ? `${new Date(quote.lastFollowUp).toLocaleDateString()}`
                        : "Sent automatically"}
                    </p>
                  </div>
                </div>
              )}
              {quote.followUpCount >= 2 && (
                <div className="flex items-start gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium">2nd Follow-Up Sent</p>
                    <p className="text-xs text-muted-foreground">
                      {quote.lastFollowUp
                        ? `${new Date(quote.lastFollowUp).toLocaleDateString()}`
                        : "Sent automatically"}
                    </p>
                  </div>
                </div>
              )}
              {quote.receivedDate && (
                <div className="flex items-start gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium">Quote Received</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(quote.receivedDate).toLocaleDateString()}
                      {quote.priceExGST !== undefined && ` — $${quote.priceExGST.toLocaleString()} ex GST`}
                    </p>
                  </div>
                </div>
              )}
              {!quote.requestedDate && !quote.receivedDate && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  No email activity yet
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
