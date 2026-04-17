"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import AuthLayout from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
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
import { BarChart3, Download, AlertTriangle } from "lucide-react";
import { getJobs, getSettings } from "@/lib/supabase";
import { exportComparisonPDF } from "@/lib/pdf-export";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Job } from "@/types";

export default function ComparePage() {
  usePageTitle("Compare");
  useSession();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobCode, setSelectedJobCode] = useState("");
  const [selectedTradeCode, setSelectedTradeCode] = useState("");
  const [markupPercent, setMarkupPercent] = useState(15);
  const [tradeMarkups, setTradeMarkups] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    try {
      const [jobsData, settings] = await Promise.all([getJobs(), getSettings()]);
      setJobs(jobsData);
      setMarkupPercent(settings.defaultMarkupPercent || 15);
      setTradeMarkups(settings.tradeMarkupPercents || {});
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedJob = jobs.find((j) => j.jobCode === selectedJobCode);
  const selectedTrade = selectedJob?.trades?.find((t) => t.code === selectedTradeCode);
  const effectiveMarkup = selectedTradeCode
    ? tradeMarkups[selectedTradeCode] ?? markupPercent
    : markupPercent;

  // Get received/accepted quotes for the selected trade
  const quotes = (selectedTrade?.quotes || []).filter(
    (q) => q.status === "received" || q.status === "accepted"
  );

  // Find cheapest
  const cheapestPrice = quotes.length > 0
    ? Math.min(...quotes.filter((q) => q.priceExGST).map((q) => q.priceExGST!))
    : 0;

  // Historical: same trade across other jobs
  const historicalData: { jobCode: string; supplierName: string; priceExGST: number; date?: string }[] = [];
  if (selectedTradeCode) {
    for (const job of jobs) {
      if (job.jobCode === selectedJobCode) continue;
      const trade = job.trades?.find((t) => t.code === selectedTradeCode);
      if (!trade) continue;
      for (const q of trade.quotes || []) {
        if ((q.status === "received" || q.status === "accepted") && q.priceExGST) {
          historicalData.push({
            jobCode: job.jobCode,
            supplierName: q.supplierName,
            priceExGST: q.priceExGST,
            date: q.receivedDate,
          });
        }
      }
    }
  }

  function handleExportPDF() {
    if (!selectedJob || !selectedTrade) return;
    const rows = quotes
      .filter((q) => q.priceExGST)
      .map((q) => ({
        supplierName: q.supplierName,
        priceExGST: q.priceExGST!,
        priceIncGST: q.priceIncGST,
        sellPrice: q.priceExGST! * (1 + effectiveMarkup / 100),
        receivedDate: q.receivedDate,
        expiryDate: q.quoteExpiry,
        version: q.version,
        isCheapest: q.priceExGST === cheapestPrice,
        isExpired: q.quoteExpiry ? new Date(q.quoteExpiry).getTime() < Date.now() : false,
      }));

    exportComparisonPDF({
      jobCode: selectedJob.jobCode,
      jobAddress: selectedJob.address,
      tradeName: selectedTrade.name,
      tradeCode: selectedTrade.code,
      markupPercent: effectiveMarkup,
      rows,
      historicalData: historicalData.length > 0 ? historicalData : undefined,
    });
  }

  if (loading) {
    return (
      <AuthLayout>
        <p className="text-muted-foreground">Loading...</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Price Comparison</h1>

        {/* Job + Trade selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Select
              value={selectedJobCode}
              onValueChange={(v) => {
                setSelectedJobCode(v);
                setSelectedTradeCode("");
              }}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Select job..." />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((j) => (
                  <SelectItem key={j.jobCode} value={j.jobCode}>
                    {j.jobCode} — {j.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Select
              value={selectedTradeCode}
              onValueChange={setSelectedTradeCode}
              disabled={!selectedJob}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Select trade..." />
              </SelectTrigger>
              <SelectContent>
                {(selectedJob?.trades || []).map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.code} {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Comparison Table */}
        {selectedTrade && quotes.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {selectedTrade.code} {selectedTrade.name} — {quotes.length} quote{quotes.length !== 1 ? "s" : ""}
                </CardTitle>
                <Button onClick={handleExportPDF} variant="outline" className="min-h-[44px]">
                  <Download className="w-4 h-4 mr-2" /> Export PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Price ex GST</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Price inc GST</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Markup %</TableHead>
                    <TableHead className="text-right">Sell Price</TableHead>
                    <TableHead className="hidden lg:table-cell">Date</TableHead>
                    <TableHead className="hidden lg:table-cell">Expiry</TableHead>
                    <TableHead className="text-center">Ver.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes
                    .filter((q) => q.priceExGST)
                    .sort((a, b) => (a.priceExGST || 0) - (b.priceExGST || 0))
                    .map((q) => {
                      const isCheapest = q.priceExGST === cheapestPrice;
                      const isExpired = q.quoteExpiry ? new Date(q.quoteExpiry).getTime() < Date.now() : false;
                      const sellPrice = q.priceExGST! * (1 + effectiveMarkup / 100);

                      return (
                        <TableRow key={`${q.supplierId}-${q.version}`} className={isCheapest ? "bg-green-50" : ""}>
                          <TableCell className={`font-medium ${isCheapest ? "text-[#2D5E3A]" : ""}`}>
                            {q.supplierName}
                            {isCheapest && <Badge className="ml-2 bg-[#2D5E3A] text-white text-xs">Cheapest</Badge>}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${q.priceExGST!.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono hidden sm:table-cell">
                            {q.priceIncGST ? `$${q.priceIncGST.toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell className="text-right hidden md:table-cell">
                            {effectiveMarkup}%
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${sellPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">
                            {q.receivedDate ? new Date(q.receivedDate).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell className={`hidden lg:table-cell text-sm ${isExpired ? "text-red-600 font-medium" : ""}`}>
                            {q.quoteExpiry ? (
                              <>
                                {new Date(q.quoteExpiry).toLocaleDateString()}
                                {isExpired && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                              </>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-center">v{q.version}</TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {selectedTrade && quotes.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No received quotes</h3>
              <p className="text-muted-foreground mt-1">
                Quotes need to be received before you can compare prices.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Historical Pricing */}
        {historicalData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Historical Pricing — {selectedTrade?.name}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Price ex GST</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicalData
                    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                    .map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.jobCode}</TableCell>
                        <TableCell>{row.supplierName}</TableCell>
                        <TableCell className="text-right font-mono">
                          ${row.priceExGST.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.date ? new Date(row.date).toLocaleDateString() : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* No job selected */}
        {!selectedJob && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Select a job and trade</h3>
              <p className="text-muted-foreground mt-1">
                Choose a job and trade above to compare quote prices.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AuthLayout>
  );
}
