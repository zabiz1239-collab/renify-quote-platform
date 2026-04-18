"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Send, AlertTriangle, Check, Loader2, Mail, Search, CheckCircle, Clock, XCircle } from "lucide-react";
import { getJobs, getSuppliers, getTemplates } from "@/lib/supabase";
import { TRADES } from "@/data/trades";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Job, Supplier, EmailTemplate } from "@/types";
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
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobCode, setSelectedJobCode] = useState("");
  const [selectedTradeCode, setSelectedTradeCode] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [checkedSuppliers, setCheckedSuppliers] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [jobsData, suppliersData, templatesData] = await Promise.all([
        getJobs(),
        getSuppliers(),
        getTemplates(),
      ]);
      setJobs(jobsData);
      setSuppliers(suppliersData);
      setTemplates(templatesData);
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
  const tradeMeta = TRADES.find((t) => t.code === selectedTradeCode);

  // Get all suppliers for the selected trade (no region filter — show everything)
  const tradeSuppliers = useMemo(() => {
    if (!selectedTradeCode) return [];
    return suppliers.filter((s) => s.trades.includes(selectedTradeCode));
  }, [suppliers, selectedTradeCode]);

  // Filter by search term
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return tradeSuppliers;
    const term = supplierSearch.toLowerCase();
    return tradeSuppliers.filter(
      (s) =>
        s.company.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        s.phone.includes(term)
    );
  }, [tradeSuppliers, supplierSearch]);

  function toggleSupplier(id: string) {
    setCheckedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setCheckedSuppliers(new Set(filteredSuppliers.map((s) => s.id)));
  }

  function selectNone() {
    setCheckedSuppliers(new Set());
  }

  function buildSelections(): Selection[] {
    return Array.from(checkedSuppliers).map((supplierId) => ({
      supplierId,
      tradeCodes: [selectedTradeCode],
    }));
  }

  async function handleSend() {
    if (!selectedJob) return;
    setSending(true);
    try {
      const selections = buildSelections();
      const res = await fetch("/api/email/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobCode: selectedJob.jobCode, selections, templateId: selectedTemplateId && selectedTemplateId !== "auto" ? selectedTemplateId : undefined }),
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

  // File counts for summary
  function getFileCounts(job: Job) {
    const counts: Record<string, number> = {};
    for (const doc of job.documents || []) {
      counts[doc.category] = (counts[doc.category] || 0) + 1;
    }
    return counts;
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
          <CardHeader><CardTitle>1. Select Job</CardTitle></CardHeader>
          <CardContent>
            <Select
              value={selectedJobCode}
              onValueChange={(v) => {
                setSelectedJobCode(v);
                setSelectedTradeCode("");
                setCheckedSuppliers(new Set());
                setSupplierSearch("");
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

        {/* Step 2: Trade Dropdown + Quote Status */}
        {selectedJob && (selectedJob.trades || []).length > 0 && (
          <Card>
            <CardHeader><CardTitle>2. Select Trade</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={selectedTradeCode}
                onValueChange={(v) => {
                  setSelectedTradeCode(v);
                  setSelectedTemplateId("");
                  setCheckedSuppliers(new Set());
                  setSupplierSearch("");
                }}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Choose a trade..." />
                </SelectTrigger>
                <SelectContent>
                  {(selectedJob.trades || []).map((trade) => {
                    const supplierCount = suppliers.filter((s) => s.trades.includes(trade.code)).length;
                    const requested = (trade.quotes || []).filter((q) => q.status === "requested").length;
                    const received = (trade.quotes || []).filter((q) => q.status === "received" || q.status === "accepted").length;
                    return (
                      <SelectItem key={trade.code} value={trade.code}>
                        {trade.code} {trade.name} ({supplierCount} suppliers)
                        {requested > 0 && ` — ${requested} requested`}
                        {received > 0 && ` — ${received} received`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Quote status summary for selected job */}
              {(() => {
                const tradesWithQuotes = (selectedJob.trades || []).filter(
                  (t) => t.quotes && t.quotes.length > 0
                );
                if (tradesWithQuotes.length === 0) return null;
                return (
                  <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
                    <div className="px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                      Quotes already requested for this job
                    </div>
                    {tradesWithQuotes.map((trade) => {
                      const requested = (trade.quotes || []).filter((q) => q.status === "requested");
                      const received = (trade.quotes || []).filter((q) => q.status === "received" || q.status === "accepted");
                      const declined = (trade.quotes || []).filter((q) => q.status === "declined");
                      return (
                        <div key={trade.code} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span>
                            <span className="text-muted-foreground">{trade.code}</span>{" "}
                            {trade.name}
                          </span>
                          <div className="flex gap-2">
                            {requested.length > 0 && (
                              <span className="flex items-center gap-1 text-xs text-blue-600">
                                <Clock className="w-3 h-3" /> {requested.length} requested
                              </span>
                            )}
                            {received.length > 0 && (
                              <span className="flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle className="w-3 h-3" /> {received.length} received
                              </span>
                            )}
                            {declined.length > 0 && (
                              <span className="flex items-center gap-1 text-xs text-red-600">
                                <XCircle className="w-3 h-3" /> {declined.length} declined
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Supplier List with Search */}
        {selectedTradeCode && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  3. Select Suppliers — {tradeMeta?.name || selectedTradeCode}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({tradeSuppliers.length} total, {checkedSuppliers.size} selected)
                  </span>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search + bulk actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search suppliers..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    className="pl-9 min-h-[44px]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll} className="min-h-[44px]">
                    Select all ({filteredSuppliers.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectNone} className="min-h-[44px]">
                    Clear
                  </Button>
                </div>
              </div>

              {/* Supplier list */}
              {filteredSuppliers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {supplierSearch
                    ? "No suppliers match your search."
                    : "No suppliers found for this trade. Add some on the Suppliers page."}
                </p>
              ) : (
                <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                  {filteredSuppliers.map((sup) => {
                    // Check if this supplier already has a quote for this trade on this job
                    const existingQuote = selectedJob
                      ? (selectedJob.trades || [])
                          .find((t) => t.code === selectedTradeCode)
                          ?.quotes?.find((q) => q.supplierId === sup.id)
                      : undefined;
                    return (
                      <label
                        key={sup.id}
                        className={`flex items-center gap-3 p-3 hover:bg-muted cursor-pointer min-h-[44px] ${existingQuote ? "bg-blue-50/50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checkedSuppliers.has(sup.id)}
                          onChange={() => toggleSupplier(sup.id)}
                          className="w-4 h-4 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{sup.company}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {sup.email || "No email"}
                            {sup.phone && ` · ${sup.phone}`}
                            {sup.regions.length > 0 && ` · ${sup.regions.join(", ")}`}
                          </p>
                        </div>
                        {existingQuote ? (
                          <Badge
                            className={`text-xs flex-shrink-0 ${
                              existingQuote.status === "received" || existingQuote.status === "accepted"
                                ? "bg-green-100 text-green-800"
                                : existingQuote.status === "requested"
                                ? "bg-blue-100 text-blue-800"
                                : existingQuote.status === "declined"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {existingQuote.status.replace("_", " ")}
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className={`text-xs flex-shrink-0 ${
                              sup.status === "verified"
                                ? "bg-green-100 text-green-800"
                                : sup.status === "blacklisted"
                                ? "bg-red-100 text-red-800"
                                : ""
                            }`}
                          >
                            {sup.status}
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Template Picker */}
        {selectedTradeCode && checkedSuppliers.size > 0 && (
          <Card>
            <CardHeader><CardTitle>4. Email Template</CardTitle></CardHeader>
            <CardContent>
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Auto-select best template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-select best template</SelectItem>
                  {templates
                    .filter((t) => t.type === "request")
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Leave on auto to use the best matching template, or pick a specific one.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        {selectedJobCode && (
          <div className="sticky bottom-4 z-10 flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedJobCode("");
                setSelectedTradeCode("");
                setCheckedSuppliers(new Set());
                setSupplierSearch("");
              }}
              className="min-h-[52px] text-base shadow-lg"
            >
              Clear All
            </Button>
            <Button
              onClick={() => setPreviewOpen(true)}
              disabled={checkedSuppliers.size === 0}
              className="flex-1 min-h-[52px] text-base shadow-lg bg-[#2D5E3A] hover:bg-[#2D5E3A]/90"
            >
              <Send className="w-5 h-5 mr-2" />
              Send Quote{checkedSuppliers.size > 0 ? ` (${checkedSuppliers.size} supplier${checkedSuppliers.size !== 1 ? "s" : ""})` : ""}
            </Button>
          </div>
        )}

        {/* Preview Modal */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Confirm Send — {tradeMeta?.name || selectedTradeCode}</DialogTitle>
              <DialogDescription>
                {selectedJob?.jobCode} — {selectedJob?.address}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                {buildSelections().map((sel) => {
                  const sup = suppliers.find((s) => s.id === sel.supplierId);
                  return (
                    <div key={sel.supplierId} className="flex items-center gap-3 p-3">
                      <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{sup?.company || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{sup?.email || "No email"}</p>
                      </div>
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground">
                {buildSelections().length} email{buildSelections().length !== 1 ? "s" : ""} will be sent for {tradeMeta?.name || selectedTradeCode}
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
