"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, AlertTriangle, Check, Loader2, Mail, Search, CheckCircle, Clock, XCircle, FileText } from "lucide-react";
import { getJobs, getSuppliers, getTemplates, saveJob } from "@/lib/supabase";
import { Trash2 } from "lucide-react";
import { TRADES } from "@/data/trades";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  getAttachmentCategoryLabel,
  getAttachmentPreferenceCategories,
  getJobDocumentKey,
} from "@/lib/attachments";
import { supplierMatchesRegion } from "@/lib/regions";
import type { Job, Supplier, EmailTemplate } from "@/types";
import { toast } from "sonner";

interface Selection {
  supplierId: string;
  tradeCodes: string[];
}

export default function SendQuotesPage() {
  usePageTitle("Send Quotes");
  useSession();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobCode, setSelectedJobCode] = useState("");
  const [selectedTradeCode, setSelectedTradeCode] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [checkedSuppliers, setCheckedSuppliers] = useState<Set<string>>(new Set());
  const [attachmentSelections, setAttachmentSelections] = useState<Record<string, string[]>>({});
  const [activeAttachmentSupplierId, setActiveAttachmentSupplierId] = useState("");
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
  const documentOptions = useMemo(
    () =>
      (selectedJob?.documents || [])
        .map((doc, index) => ({
          doc,
          index,
          key: getJobDocumentKey(doc, index),
        }))
        .filter(({ doc }) => doc.type === "upload"),
    [selectedJob]
  );
  const selectedSupplierList = useMemo(
    () =>
      Array.from(checkedSuppliers)
        .map((supplierId) => suppliers.find((supplier) => supplier.id === supplierId))
        .filter((supplier): supplier is Supplier => Boolean(supplier)),
    [checkedSuppliers, suppliers]
  );

  const allTradeSuppliers = useMemo(() => {
    if (!selectedTradeCode) return [];
    return suppliers.filter((s) => s.trades.includes(selectedTradeCode));
  }, [suppliers, selectedTradeCode]);

  const tradeSuppliers = useMemo(() => {
    if (!selectedTradeCode) return [];
    return allTradeSuppliers.filter((s) => supplierMatchesRegion(s.regions, selectedJob?.region));
  }, [allTradeSuppliers, selectedJob?.region, selectedTradeCode]);

  const excludedByRegionCount = allTradeSuppliers.length - tradeSuppliers.length;

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

  const getDefaultDocumentKeys = useCallback((supplier: Supplier): string[] => {
    if (!selectedTradeCode) return [];
    const categories = getAttachmentPreferenceCategories(supplier, selectedTradeCode);
    return documentOptions
      .filter(({ doc }) => categories.includes(doc.category))
      .map(({ key }) => key);
  }, [selectedTradeCode, documentOptions]);

  function getSelectedDocumentKeys(supplier: Supplier): string[] {
    return attachmentSelections[supplier.id] ?? getDefaultDocumentKeys(supplier);
  }

  function setSupplierDocumentKeys(supplierId: string, documentKeys: string[]) {
    setAttachmentSelections((prev) => ({
      ...prev,
      [supplierId]: documentKeys,
    }));
  }

  function toggleSupplierDocument(supplier: Supplier, documentKey: string) {
    const current = getSelectedDocumentKeys(supplier);
    const next = current.includes(documentKey)
      ? current.filter((key) => key !== documentKey)
      : [...current, documentKey];
    setSupplierDocumentKeys(supplier.id, next);
  }

  function buildSelections(): Selection[] {
    return Array.from(checkedSuppliers).map((supplierId) => ({
      supplierId,
      tradeCodes: [selectedTradeCode],
    }));
  }

  function buildAttachmentPayload() {
    return selectedSupplierList.map((supplier) => ({
      supplierId: supplier.id,
      documentKeys: getSelectedDocumentKeys(supplier),
    }));
  }

  useEffect(() => {
    setAttachmentSelections((prev) => {
      const next: Record<string, string[]> = {};
      for (const supplier of selectedSupplierList) {
        next[supplier.id] = prev[supplier.id] ?? getDefaultDocumentKeys(supplier);
      }
      return next;
    });
  }, [selectedSupplierList, getDefaultDocumentKeys]);

  useEffect(() => {
    if (selectedSupplierList.length === 0) {
      if (activeAttachmentSupplierId) setActiveAttachmentSupplierId("");
      return;
    }

    if (!selectedSupplierList.some((supplier) => supplier.id === activeAttachmentSupplierId)) {
      setActiveAttachmentSupplierId(selectedSupplierList[0].id);
    }
  }, [activeAttachmentSupplierId, selectedSupplierList]);

  async function handleSend() {
    if (!selectedJob) return;
    setSending(true);
    try {
      const selections = buildSelections();
      const res = await fetch("/api/email/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobCode: selectedJob.jobCode,
          selections,
          templateId: selectedTemplateId && selectedTemplateId !== "auto" ? selectedTemplateId : undefined,
          attachmentSelections: buildAttachmentPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      if (data.failed > 0) {
        const failedDetails = (data.results || [])
          .filter((r: { success: boolean; error?: string }) => !r.success)
          .map((r: { supplier: string; error?: string }) => `${r.supplier}: ${r.error}`)
          .join(", ");
        toast.error(`${data.failed} failed: ${failedDetails}`);
      }
      if (data.sent > 0) {
        toast.success(`Sent ${data.sent} email${data.sent !== 1 ? "s" : ""}`);
      }
      setPreviewOpen(false);
      // Stay on this screen — refresh job data and clear supplier selection so user
      // can immediately send another trade without re-picking the job.
      setCheckedSuppliers(new Set());
      setAttachmentSelections({});
      setActiveAttachmentSupplierId("");
      setSupplierSearch("");
      try {
        const jobsData = await getJobs();
        setJobs(jobsData);
      } catch {
        /* keep stale job data — toast above already shown */
      }
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
                setAttachmentSelections({});
                setActiveAttachmentSupplierId("");
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
                      {selectedJob.region && <> &middot; State / Region: {selectedJob.region}</>}
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
                  setAttachmentSelections({});
                  setActiveAttachmentSupplierId("");
                  setSupplierSearch("");
                }}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Choose a trade..." />
                </SelectTrigger>
                <SelectContent>
                  {(selectedJob.trades || []).map((trade) => {
                    const supplierCount = suppliers.filter(
                      (s) => s.trades.includes(trade.code) && supplierMatchesRegion(s.regions, selectedJob.region)
                    ).length;
                    const requested = (trade.quotes || []).filter((q) => q.status === "requested").length;
                    const received = (trade.quotes || []).filter((q) => q.status === "received" || q.status === "accepted").length;
                    return (
                      <SelectItem key={trade.code} value={trade.code}>
                        {trade.code} {trade.name} ({supplierCount} supplier{supplierCount !== 1 ? "s" : ""} in {selectedJob.region})
                        {requested > 0 && ` — ${requested} requested`}
                        {received > 0 && ` — ${received} received`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Quote status summary with remove option */}
              {(() => {
                const tradesWithQuotes = (selectedJob.trades || []).filter(
                  (t) => t.quotes && t.quotes.length > 0
                );
                if (tradesWithQuotes.length === 0) return null;

                async function removeQuoteRequest(tradeCode: string, supplierId: string, supplierName: string) {
                  if (!selectedJob) return;
                  if (!confirm(`Remove quote request from ${supplierName} for this trade?`)) return;
                  const updatedTrades = (selectedJob.trades || []).map((t) => {
                    if (t.code !== tradeCode) return t;
                    return { ...t, quotes: (t.quotes || []).filter((q) => q.supplierId !== supplierId) };
                  });
                  const updatedJob: Job = { ...selectedJob, trades: updatedTrades };
                  try {
                    await saveJob(updatedJob);
                    setJobs((prev) => prev.map((j) => j.jobCode === updatedJob.jobCode ? updatedJob : j));
                    toast.success(`Removed ${supplierName} from ${tradeCode}`);
                  } catch {
                    toast.error("Failed to remove quote request");
                  }
                }

                return (
                  <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                    <div className="px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                      Quotes already requested for this job
                    </div>
                    {tradesWithQuotes.map((trade) => (
                      <div key={trade.code}>
                        <div className="px-3 py-2 bg-muted/30 text-xs font-medium">
                          {trade.code} {trade.name} — {(trade.quotes || []).length} quote{(trade.quotes || []).length !== 1 ? "s" : ""}
                        </div>
                        {(trade.quotes || []).map((q, qi) => (
                          <div key={qi} className="flex items-center justify-between px-3 py-1.5 pl-6 text-sm">
                            <div className="flex items-center gap-2">
                              {q.status === "requested" && <Clock className="w-3 h-3 text-blue-500" />}
                              {(q.status === "received" || q.status === "accepted") && <CheckCircle className="w-3 h-3 text-green-500" />}
                              {q.status === "declined" && <XCircle className="w-3 h-3 text-red-500" />}
                              <span className="text-xs">{q.supplierName}</span>
                              <Badge className={`text-[10px] px-1.5 py-0 ${
                                q.status === "requested" ? "bg-blue-100 text-blue-800" :
                                q.status === "received" || q.status === "accepted" ? "bg-green-100 text-green-800" :
                                "bg-red-100 text-red-800"
                              }`}>{q.status}</Badge>
                              {q.priceExGST && <span className="text-xs font-mono">${q.priceExGST.toLocaleString()}</span>}
                            </div>
                            {q.status === "requested" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="min-h-[32px] text-xs text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                                onClick={() => removeQuoteRequest(trade.code, q.supplierId, q.supplierName)}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remove
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
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
                    ({tradeSuppliers.length} in {selectedJob?.region || "selected region"}, {checkedSuppliers.size} selected)
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

              {selectedJob?.region && excludedByRegionCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {excludedByRegionCount} supplier{excludedByRegionCount !== 1 ? "s" : ""} for this trade hidden because they are linked to another state or region.
                </p>
              )}

              {/* Supplier list */}
              {filteredSuppliers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {supplierSearch
                    ? "No suppliers match your search."
                    : `No suppliers are linked to ${selectedJob?.region || "this state or region"} for this trade. Add or update suppliers on the Suppliers page.`}
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

        {/* Step 4: Attachments */}
        {selectedTradeCode && checkedSuppliers.size > 0 && (
          <Card>
            <CardHeader><CardTitle>4. Attachments</CardTitle></CardHeader>
            <CardContent>
              {documentOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No uploaded job documents.
                </p>
              ) : (
                <Tabs
                  value={activeAttachmentSupplierId || selectedSupplierList[0]?.id}
                  onValueChange={setActiveAttachmentSupplierId}
                >
                  <TabsList className="h-auto flex-wrap justify-start gap-1">
                    {selectedSupplierList.map((supplier) => (
                      <TabsTrigger
                        key={supplier.id}
                        value={supplier.id}
                        className="max-w-[180px] truncate"
                      >
                        {supplier.company}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {selectedSupplierList.map((supplier) => {
                    const selectedKeys = getSelectedDocumentKeys(supplier);
                    return (
                      <TabsContent key={supplier.id} value={supplier.id} className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <p className="text-sm text-muted-foreground">
                            {selectedKeys.length}/{documentOptions.length} selected
                          </p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-h-[36px]"
                              onClick={() =>
                                setSupplierDocumentKeys(
                                  supplier.id,
                                  documentOptions.map(({ key }) => key)
                                )
                              }
                            >
                              All
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-h-[36px]"
                              onClick={() => setSupplierDocumentKeys(supplier.id, [])}
                            >
                              None
                            </Button>
                          </div>
                        </div>
                        <div className="border rounded-lg divide-y max-h-[320px] overflow-y-auto">
                          {documentOptions.map(({ doc, key }) => (
                            <label
                              key={key}
                              className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer min-h-[44px]"
                            >
                              <input
                                type="checkbox"
                                checked={selectedKeys.includes(key)}
                                onChange={() => toggleSupplierDocument(supplier, key)}
                                className="w-4 h-4 flex-shrink-0"
                              />
                              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{doc.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {getAttachmentCategoryLabel(doc.category)}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 5: Template Picker */}
        {selectedTradeCode && checkedSuppliers.size > 0 && (
          <Card>
            <CardHeader><CardTitle>5. Email Template</CardTitle></CardHeader>
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
                setAttachmentSelections({});
                setActiveAttachmentSupplierId("");
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
                  const attachmentCount = sup ? getSelectedDocumentKeys(sup).length : 0;
                  return (
                    <div key={sel.supplierId} className="flex items-center gap-3 p-3">
                      <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{sup?.company || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          {sup?.email || "No email"} - {attachmentCount} attachment{attachmentCount !== 1 ? "s" : ""}
                        </p>
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
