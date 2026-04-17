"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Send, AlertTriangle, Check, Loader2, Mail } from "lucide-react";
import { getJobs, getSuppliers } from "@/lib/supabase";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Job, Supplier } from "@/types";
import { toast } from "sonner";

interface Selection {
  supplierId: string;
  tradeCodes: string[];
}

export default function SendQuotesPage() {
  usePageTitle("Send Quotes");
  useSession();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobCode, setSelectedJobCode] = useState("");
  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set());
  const [checkedSuppliers, setCheckedSuppliers] = useState<Map<string, Set<string>>>(new Map());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [jobsData, suppliersData] = await Promise.all([
        getJobs(),
        getSuppliers(),
      ]);
      setJobs(jobsData);
      setSuppliers(suppliersData);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeJobs = jobs.filter((j) => j.status === "active" || j.status === "quoting");
  const selectedJob = jobs.find((j) => j.jobCode === selectedJobCode);

  // Count files per category for the summary card
  function getFileCounts(job: Job) {
    const counts: Record<string, number> = {};
    for (const doc of job.documents || []) {
      counts[doc.category] = (counts[doc.category] || 0) + 1;
    }
    return counts;
  }

  // Get suppliers matching a trade for the selected job
  function getSuppliersForTrade(tradeCode: string): Supplier[] {
    if (!selectedJob) return [];
    return suppliers.filter((s) => {
      if (!s.trades.includes(tradeCode)) return false;
      // If job has region set, filter by region; otherwise show all
      if (selectedJob.region && selectedJob.region.trim() !== "") {
        return s.regions.includes(selectedJob.region);
      }
      return true;
    });
  }

  function toggleTrade(code: string) {
    setSelectedTrades((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
        // Also uncheck suppliers for this trade
        setCheckedSuppliers((prevMap) => {
          const nextMap = new Map(prevMap);
          nextMap.delete(code);
          return nextMap;
        });
      } else {
        next.add(code);
      }
      return next;
    });
  }

  function toggleSupplier(tradeCode: string, supplierId: string) {
    setCheckedSuppliers((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(tradeCode) || []);
      if (set.has(supplierId)) set.delete(supplierId);
      else set.add(supplierId);
      next.set(tradeCode, set);
      return next;
    });
  }

  function selectAllForTrade(tradeCode: string) {
    const tradeSuppliers = getSuppliersForTrade(tradeCode);
    setCheckedSuppliers((prev) => {
      const next = new Map(prev);
      next.set(tradeCode, new Set(tradeSuppliers.map((s) => s.id)));
      return next;
    });
  }

  function selectNoneForTrade(tradeCode: string) {
    setCheckedSuppliers((prev) => {
      const next = new Map(prev);
      next.set(tradeCode, new Set());
      return next;
    });
  }

  // Build selections for the API
  function buildSelections(): Selection[] {
    const supplierMap = new Map<string, string[]>();
    for (const [tradeCode, supplierIds] of Array.from(checkedSuppliers.entries())) {
      for (const sid of Array.from(supplierIds)) {
        const existing = supplierMap.get(sid) || [];
        if (!existing.includes(tradeCode)) existing.push(tradeCode);
        supplierMap.set(sid, existing);
      }
    }
    return Array.from(supplierMap.entries()).map(([supplierId, tradeCodes]) => ({
      supplierId,
      tradeCodes,
    }));
  }

  const totalChecked = Array.from(checkedSuppliers.values()).reduce(
    (acc, set) => acc + set.size,
    0
  );

  async function handleSend() {
    if (!selectedJob) return;
    setSending(true);
    try {
      const selections = buildSelections();
      const res = await fetch("/api/email/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobCode: selectedJob.jobCode, selections }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      toast.success(`Sent ${data.sent} email${data.sent !== 1 ? "s" : ""}${data.failed ? `, ${data.failed} failed` : ""}`);
      setPreviewOpen(false);
      router.push(`/jobs/${encodeURIComponent(selectedJob.jobCode)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Send failed";
      toast.error(msg);
    } finally {
      setSending(false);
    }
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
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Send Quotes</h1>

        {/* Step 1: Job Picker */}
        <Card>
          <CardHeader>
            <CardTitle>1. Select Job</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedJobCode}
              onValueChange={(v) => {
                setSelectedJobCode(v);
                setSelectedTrades(new Set());
                setCheckedSuppliers(new Map());
              }}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Choose a job..." />
              </SelectTrigger>
              <SelectContent>
                {activeJobs.map((j) => (
                  <SelectItem key={j.jobCode} value={j.jobCode}>
                    {j.jobCode} — {j.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Job Summary */}
        {selectedJob && (() => {
          const fileCounts = getFileCounts(selectedJob);
          const missingCategories = ["architectural", "engineering", "scope"].filter(
            (c) => !fileCounts[c]
          );
          const categoryLabels: Record<string, string> = {
            architectural: "Plans",
            engineering: "Engineering",
            scope: "Inclusions",
            colour_selection: "Colour Selection",
            other: "Other",
          };
          return (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{selectedJob.address}</p>
                    <p className="text-sm text-muted-foreground">
                      Due: {selectedJob.targetDate ? new Date(selectedJob.targetDate).toLocaleDateString() : "No date set"}
                      {selectedJob.region && <> &middot; Region: {selectedJob.region}</>}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <Badge
                        key={key}
                        variant={fileCounts[key] ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {label}: {fileCounts[key] || 0}
                      </Badge>
                    ))}
                  </div>
                </div>
                {missingCategories.length > 0 && (
                  <div className="flex items-center gap-2 mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Missing uploads: {missingCategories.map((c) => categoryLabels[c]).join(", ")}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Step 2: Trade Chips */}
        {selectedJob && (selectedJob.trades || []).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>2. Select Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(selectedJob.trades || []).map((trade) => (
                  <button
                    key={trade.code}
                    onClick={() => toggleTrade(trade.code)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium min-h-[44px] transition-colors ${
                      selectedTrades.has(trade.code)
                        ? "bg-[#2D5E3A] text-white border-[#2D5E3A]"
                        : "bg-background hover:bg-muted border-border"
                    }`}
                  >
                    {trade.code} {trade.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Supplier Panels */}
        {selectedJob && selectedTrades.size > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>3. Select Suppliers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {Array.from(selectedTrades).map((tradeCode) => {
                const trade = (selectedJob.trades || []).find((t) => t.code === tradeCode);
                const tradeSuppliers = getSuppliersForTrade(tradeCode);
                const checkedSet = checkedSuppliers.get(tradeCode) || new Set<string>();
                return (
                  <div key={tradeCode} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        {tradeCode} {trade?.name || tradeCode}
                        <span className="ml-2 text-muted-foreground font-normal">
                          ({tradeSuppliers.length} supplier{tradeSuppliers.length !== 1 ? "s" : ""})
                        </span>
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => selectAllForTrade(tradeCode)}
                          className="text-xs text-[#2D5E3A] hover:underline min-h-[44px] px-2"
                        >
                          Select all
                        </button>
                        <button
                          onClick={() => selectNoneForTrade(tradeCode)}
                          className="text-xs text-muted-foreground hover:underline min-h-[44px] px-2"
                        >
                          Select none
                        </button>
                      </div>
                    </div>
                    {tradeSuppliers.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">
                        No suppliers match this trade{selectedJob.region ? ` in ${selectedJob.region}` : ""}.
                      </p>
                    ) : (
                      <div className="border rounded-lg divide-y">
                        {tradeSuppliers.map((sup) => (
                          <label
                            key={sup.id}
                            className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer min-h-[44px]"
                          >
                            <input
                              type="checkbox"
                              checked={checkedSet.has(sup.id)}
                              onChange={() => toggleSupplier(tradeCode, sup.id)}
                              className="w-4 h-4"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{sup.company}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {sup.email || "No email"}{sup.phone && ` · ${sup.phone}`}
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${
                                sup.status === "verified"
                                  ? "bg-green-100 text-green-800"
                                  : sup.status === "blacklisted"
                                  ? "bg-red-100 text-red-800"
                                  : ""
                              }`}
                            >
                              {sup.status}
                            </Badge>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Sticky Preview & Send Button */}
        {totalChecked > 0 && (
          <div className="sticky bottom-4 z-10">
            <Button
              onClick={() => setPreviewOpen(true)}
              className="w-full min-h-[52px] text-base shadow-lg bg-[#2D5E3A] hover:bg-[#2D5E3A]/90"
            >
              <Send className="w-5 h-5 mr-2" />
              Preview & Send ({totalChecked} supplier{totalChecked !== 1 ? "s" : ""})
            </Button>
          </div>
        )}

        {/* Preview Modal */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Confirm Send</DialogTitle>
              <DialogDescription>
                Review the quote requests before sending.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {buildSelections().map((sel) => {
                const sup = suppliers.find((s) => s.id === sel.supplierId);
                const tradeNames = sel.tradeCodes.map((code) => {
                  const t = (selectedJob?.trades || []).find((tr) => tr.code === code);
                  return t?.name || code;
                });
                return (
                  <div key={sel.supplierId} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Mail className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{sup?.company || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{sup?.email || "No email"}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Trades: {tradeNames.join(", ")}
                      </p>
                    </div>
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  </div>
                );
              })}
              <p className="text-sm text-muted-foreground">
                Total: {buildSelections().length} email{buildSelections().length !== 1 ? "s" : ""} will be sent
              </p>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-1 min-h-[44px] bg-[#2D5E3A] hover:bg-[#2D5E3A]/90"
                >
                  {sending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Send All</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setPreviewOpen(false)} className="min-h-[44px]">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Empty state */}
        {activeJobs.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Send className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No active jobs</h3>
              <p className="text-muted-foreground mt-1">
                Create a job first, then come here to send quote requests.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AuthLayout>
  );
}
