"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import AuthLayout from "@/components/layout/AuthLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarChart3, Download } from "lucide-react";
import { getJobs, getSettings } from "@/lib/supabase";
import { exportComparisonPDF } from "@/lib/pdf-export";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Job } from "@/types";

interface ComparisonRow {
  supplierName: string;
  priceExGST: number;
  priceIncGST?: number;
  markupPercent: number;
  sellPrice: number;
  receivedDate?: string;
  expiryDate?: string;
  version: number;
  isCheapest: boolean;
  isExpired: boolean;
}

export default function ComparePage() {
  usePageTitle("Price Comparison");
  useSession(); // auth status check
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobCode, setSelectedJobCode] = useState("");
  const [selectedTradeCode, setSelectedTradeCode] = useState("");
  const [markupPercent, setMarkupPercent] = useState(15);
  const [tradeMarkupPercents, setTradeMarkupPercents] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    try {
      const [settings, jobsData] = await Promise.all([
        getSettings(),
        getJobs(),
      ]);
      if (settings?.defaultMarkupPercent) setMarkupPercent(settings.defaultMarkupPercent);
      if (settings?.tradeMarkupPercents) setTradeMarkupPercents(settings.tradeMarkupPercents);
      setJobs(jobsData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedJob = jobs.find((j) => j.jobCode === selectedJobCode);
  const availableTrades = selectedJob?.trades || [];
  const selectedTrade = availableTrades.find((t) => t.code === selectedTradeCode);

  // Apply per-trade markup when trade changes
  const effectiveMarkup = selectedTradeCode && tradeMarkupPercents[selectedTradeCode] !== undefined
    ? tradeMarkupPercents[selectedTradeCode]
    : markupPercent;

  // Build comparison rows
  const rows: ComparisonRow[] = [];
  if (selectedTrade) {
    const receivedQuotes = selectedTrade.quotes.filter(
      (q) => (q.status === "received" || q.status === "accepted") && q.priceExGST
    );
    const minPrice = Math.min(
      ...receivedQuotes.map((q) => q.priceExGST || Infinity)
    );
    const now = Date.now();

    for (const quote of receivedQuotes) {
      const price = quote.priceExGST || 0;
      const sellPrice = price * (1 + effectiveMarkup / 100);
      const isExpired = quote.quoteExpiry
        ? new Date(quote.quoteExpiry).getTime() < now
        : false;

      rows.push({
        supplierName: quote.supplierName,
        priceExGST: price,
        priceIncGST: quote.priceIncGST,
        markupPercent: effectiveMarkup,
        sellPrice,
        receivedDate: quote.receivedDate,
        expiryDate: quote.quoteExpiry,
        version: quote.version,
        isCheapest: price === minPrice,
        isExpired,
      });
    }
    rows.sort((a, b) => a.priceExGST - b.priceExGST);
  }

  // Historical pricing across jobs
  const historicalData: { jobCode: string; supplierName: string; priceExGST: number; date?: string }[] = [];
  if (selectedTradeCode) {
    for (const job of jobs) {
      const trade = job.trades.find((t) => t.code === selectedTradeCode);
      if (!trade) continue;
      for (const quote of trade.quotes) {
        if (
          (quote.status === "received" || quote.status === "accepted") &&
          quote.priceExGST
        ) {
          historicalData.push({
            jobCode: job.jobCode,
            supplierName: quote.supplierName,
            priceExGST: quote.priceExGST,
            date: quote.receivedDate,
          });
        }
      }
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Price Comparison</h1>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Job</Label>
            <Select value={selectedJobCode} onValueChange={(v) => { setSelectedJobCode(v); setSelectedTradeCode(""); }}>
              <SelectTrigger className="w-56 min-h-[44px]">
                <SelectValue placeholder="Select job" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((job) => (
                  <SelectItem key={job.jobCode} value={job.jobCode}>
                    {job.jobCode} — {job.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Trade</Label>
            <Select value={selectedTradeCode} onValueChange={setSelectedTradeCode}>
              <SelectTrigger className="w-56 min-h-[44px]">
                <SelectValue placeholder="Select trade" />
              </SelectTrigger>
              <SelectContent>
                {availableTrades.map((trade) => (
                  <SelectItem key={trade.code} value={trade.code}>
                    {trade.code} {trade.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Markup %</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={markupPercent}
              onChange={(e) => setMarkupPercent(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-24 min-h-[44px]"
            />
          </div>
          {rows.length > 0 && selectedJob && selectedTrade && (
            <div className="space-y-1">
              <Label className="text-xs">&nbsp;</Label>
              <Button
                className="min-h-[44px] bg-[#2D5E3A] hover:bg-[#2D5E3A]/90"
                onClick={() =>
                  exportComparisonPDF({
                    jobCode: selectedJob.jobCode,
                    jobAddress: selectedJob.address,
                    tradeName: selectedTrade.name,
                    tradeCode: selectedTrade.code,
                    markupPercent,
                    rows,
                    historicalData: historicalData.length > 1 ? historicalData : undefined,
                  })
                }
              >
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : !selectedJobCode || !selectedTradeCode ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-medium">Select a job and trade</h2>
              <p className="text-muted-foreground mt-1">
                Choose a job and trade to compare received quotes.
              </p>
            </CardContent>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No received quotes for this trade yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedTrade?.name} — {selectedJob?.jobCode}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Price ex GST</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Price inc GST</TableHead>
                    <TableHead className="text-right">Markup %</TableHead>
                    <TableHead className="text-right">Sell Price</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="hidden md:table-cell">Expiry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow
                      key={i}
                      className={row.isCheapest ? "bg-green-50" : row.isExpired ? "bg-red-50" : ""}
                    >
                      <TableCell className="font-medium">
                        {row.supplierName}
                        {row.isCheapest && (
                          <Badge className="ml-2 bg-green-100 text-green-800 text-xs">
                            Cheapest
                          </Badge>
                        )}
                        {row.version > 1 && (
                          <Badge variant="outline" className="ml-1 text-xs">
                            v{row.version}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${row.priceExGST.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono hidden md:table-cell">
                        {row.priceIncGST ? `$${row.priceIncGST.toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">{row.markupPercent}%</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ${row.sellPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {row.receivedDate ? new Date(row.receivedDate).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {row.expiryDate ? (
                          <span className={row.isExpired ? "text-red-600 font-medium" : ""}>
                            {new Date(row.expiryDate).toLocaleDateString()}
                            {row.isExpired && " (EXPIRED)"}
                          </span>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Historical Pricing */}
        {selectedTradeCode && historicalData.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>
                Historical — {selectedTrade?.name || selectedTradeCode} across all jobs
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Price ex GST</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicalData
                    .sort((a, b) => a.priceExGST - b.priceExGST)
                    .map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.jobCode}</TableCell>
                        <TableCell>{row.supplierName}</TableCell>
                        <TableCell className="text-right font-mono">
                          ${row.priceExGST.toLocaleString()}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {row.date ? new Date(row.date).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AuthLayout>
  );
}
