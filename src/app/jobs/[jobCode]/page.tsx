"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AuthLayout from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight, Trash2, FileText, CheckCircle, Clock, XCircle, Upload, Loader2, FileInput, Sparkles, Pencil, Plus, ChevronDown } from "lucide-react";
import { getJob, getEstimators, getSuppliers, saveJob } from "@/lib/supabase";
import { TRADES } from "@/data/trades";
import { supabase } from "@/lib/supabase";
import { usePageTitle } from "@/hooks/usePageTitle";
import { toast } from "sonner";
import type { Job, Estimator, Supplier } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 text-blue-800",
  quoting: "bg-yellow-100 text-yellow-800",
  quoted: "bg-green-100 text-green-800",
  tendered: "bg-purple-100 text-purple-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-red-100 text-red-800",
};

const QUOTE_STATUS_ICON: Record<string, React.ReactNode> = {
  not_started: <Clock className="w-4 h-4 text-gray-400" />,
  requested: <Clock className="w-4 h-4 text-blue-500" />,
  received: <CheckCircle className="w-4 h-4 text-green-500" />,
  accepted: <CheckCircle className="w-4 h-4 text-emerald-600" />,
  declined: <XCircle className="w-4 h-4 text-red-500" />,
};

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobCode = params.jobCode as string;
  usePageTitle(jobCode || "Job");
  useSession();

  const [job, setJob] = useState<Job | null>(null);
  const [estimator, setEstimator] = useState<Estimator | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingZone, setUploadingZone] = useState<string | null>(null);

  // Edit job dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    address: "",
    region: "",
    buildType: "" as Job["buildType"],
    storeys: "" as Job["storeys"],
    targetDate: "",
    budgetEstimate: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  function openEditDialog() {
    if (!job) return;
    setEditForm({
      address: job.address,
      region: job.region,
      buildType: job.buildType,
      storeys: job.storeys,
      targetDate: job.targetDate || "",
      budgetEstimate: job.budgetEstimate ? String(job.budgetEstimate) : "",
    });
    setEditOpen(true);
  }

  async function handleEditSubmit() {
    if (!job) return;
    if (!editForm.address || !editForm.region || !editForm.buildType || !editForm.storeys) {
      toast.error("Please fill in all required fields");
      return;
    }
    setEditSaving(true);
    try {
      const updatedJob: Job = {
        ...job,
        address: editForm.address,
        region: editForm.region,
        buildType: editForm.buildType,
        storeys: editForm.storeys,
        targetDate: editForm.targetDate || undefined,
        budgetEstimate: editForm.budgetEstimate ? parseFloat(editForm.budgetEstimate) : undefined,
        updatedAt: new Date().toISOString(),
      };
      await saveJob(updatedJob);
      setJob(updatedJob);
      setEditOpen(false);
      toast.success("Job updated");
    } catch {
      toast.error("Failed to update job");
    } finally {
      setEditSaving(false);
    }
  }

  // Receive quote dialog state
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveTradeCode, setReceiveTradeCode] = useState("");
  const [receiveSupplierId, setReceiveSupplierId] = useState("");
  const [receivePriceExGST, setReceivePriceExGST] = useState("");
  const [receivePriceIncGST, setReceivePriceIncGST] = useState("");
  const [receiveExpiry, setReceiveExpiry] = useState("");
  const [receiveFile, setReceiveFile] = useState<File | null>(null);
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);

  // Trade picker state
  const [tradePickerOpen, setTradePickerOpen] = useState(false);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [tradeSearch, setTradeSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [tradeSaving, setTradeSaving] = useState(false);

  const QUOTABLE_TRADES = TRADES.filter((t) => t.quotable);
  const TRADE_CATEGORY_ORDER = [
    { key: "siteworks", label: "Siteworks", range: [15, 100] },
    { key: "structure", label: "Structure", range: [105, 195] },
    { key: "external", label: "External", range: [200, 310] },
    { key: "services", label: "Services", range: [315, 370] },
    { key: "internal", label: "Internal", range: [375, 530] },
    { key: "finishes", label: "Finishes", range: [535, 640] },
  ] as const;

  function getTradeCategory(code: string) {
    const num = parseInt(code, 10);
    for (const cat of TRADE_CATEGORY_ORDER) {
      if (num >= cat.range[0] && num <= cat.range[1]) return cat.key;
    }
    return "other";
  }

  const GROUPED_TRADES = TRADE_CATEGORY_ORDER.map((cat) => ({
    ...cat,
    trades: QUOTABLE_TRADES.filter((t) => getTradeCategory(t.code) === cat.key),
  })).filter((g) => g.trades.length > 0);

  function openTradePicker() {
    // Pre-select trades already on the job
    setSelectedTrades((job?.trades || []).map((t) => t.code));
    setTradeSearch("");
    setTradePickerOpen(true);
  }

  function toggleTrade(code: string) {
    setSelectedTrades((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  async function handleSaveTrades() {
    if (!job) return;
    setTradeSaving(true);
    try {
      // Keep existing trade data for trades that are still selected
      const existingMap = new Map((job.trades || []).map((t) => [t.code, t]));
      const updatedTrades = selectedTrades.map((code) => {
        if (existingMap.has(code)) return existingMap.get(code)!;
        const tradeDef = TRADES.find((t) => t.code === code);
        return { code, name: tradeDef?.name || code, quotes: [] };
      });
      const updatedJob: Job = { ...job, trades: updatedTrades, updatedAt: new Date().toISOString() };
      await saveJob(updatedJob);
      setJob(updatedJob);
      setTradePickerOpen(false);
      toast.success(`${updatedTrades.length} trades selected`);
    } catch {
      toast.error("Failed to update trades");
    } finally {
      setTradeSaving(false);
    }
  }

  const loadData = useCallback(async () => {
    try {
      const [jobData, estimators, suppliersData] = await Promise.all([
        getJob(decodeURIComponent(jobCode)),
        getEstimators(),
        getSuppliers(),
      ]);
      setJob(jobData);
      setSuppliers(suppliersData);
      if (jobData?.estimatorId) {
        setEstimator(estimators.find((e) => e.id === jobData.estimatorId) || null);
      }
    } catch (err) {
      console.error("Failed to load job:", err);
    } finally {
      setLoading(false);
    }
  }, [jobCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleDelete() {
    if (!job) return;
    if (!confirm(`Delete job ${job.jobCode}? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from("qp_jobs").delete().eq("job_code", job.jobCode);
      if (error) throw error;
      toast.success(`Job ${job.jobCode} deleted`);
      router.push("/jobs");
    } catch (err) {
      console.error("Failed to delete job:", err);
      toast.error("Failed to delete job");
    }
  }

  async function handleStatusChange(newStatus: Job["status"]) {
    if (!job) return;
    try {
      await saveJob({ ...job, status: newStatus });
      setJob({ ...job, status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  async function quickReceive(tradeCode: string, supplierId: string, supplierName: string) {
    if (!job) return;
    const updatedTrades = (job.trades || []).map((t) => {
      if (t.code !== tradeCode) return t;
      return {
        ...t,
        quotes: (t.quotes || []).map((q) =>
          q.supplierId === supplierId
            ? { ...q, status: "received" as const, receivedDate: new Date().toISOString() }
            : q
        ),
      };
    });
    const updatedJob: Job = { ...job, trades: updatedTrades, updatedAt: new Date().toISOString() };
    try {
      await saveJob(updatedJob);
      setJob(updatedJob);
      toast.success(`${supplierName} marked as received`);
    } catch {
      toast.error("Failed to update");
    }
  }

  function openReceive(tradeCode: string) {
    setReceiveTradeCode(tradeCode);
    setReceiveSupplierId("");
    setReceivePriceExGST("");
    setReceivePriceIncGST("");
    setReceiveExpiry("");
    setReceiveFile(null);
    setReceiveOpen(true);
  }

  const receiveMatchingSuppliers = suppliers.filter((s) => s.trades.includes(receiveTradeCode));

  async function handleOcr() {
    if (!receiveFile) return;
    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", receiveFile);
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OCR failed");
      if (data.priceExGST && !receivePriceExGST) setReceivePriceExGST(String(data.priceExGST));
      if (data.priceIncGST && !receivePriceIncGST) setReceivePriceIncGST(String(data.priceIncGST));
      if (data.expiryDate && !receiveExpiry) setReceiveExpiry(data.expiryDate);
      toast.success("AI extracted prices");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OCR failed");
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleReceiveSubmit() {
    if (!job || !receiveTradeCode || !receiveSupplierId || !receivePriceExGST) {
      toast.error("Please fill in supplier and price");
      return;
    }
    const supplier = suppliers.find((s) => s.id === receiveSupplierId);
    if (!supplier) return;

    setReceiveSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("jobCode", job.jobCode);
      formData.append("tradeCode", receiveTradeCode);
      formData.append("supplierId", receiveSupplierId);
      formData.append("supplierName", supplier.company);
      formData.append("priceExGST", receivePriceExGST);
      if (receivePriceIncGST) formData.append("priceIncGST", receivePriceIncGST);
      if (receiveExpiry) formData.append("quoteExpiry", receiveExpiry);
      if (receiveFile) formData.append("file", receiveFile);

      const res = await fetch("/api/quotes/receive", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record quote");

      toast.success(`Quote recorded — v${data.version}`);
      setReceiveOpen(false);
      await loadData(); // Refresh job data
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record quote");
    } finally {
      setReceiveSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AuthLayout>
        <p className="text-muted-foreground">Loading job...</p>
      </AuthLayout>
    );
  }

  if (!job) {
    return (
      <AuthLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Job not found.</p>
          <Link href="/jobs" className="mt-4 inline-block">
            <Button variant="outline">Back to Jobs</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const UPLOAD_ZONES = [
    { category: "architectural", label: "Plans", accept: ".pdf" },
    { category: "engineering", label: "Engineering", accept: ".pdf" },
    { category: "scope", label: "Inclusions", accept: ".pdf" },
    { category: "colour_selection", label: "Colour Selection", accept: ".pdf" },
    { category: "other", label: "Other", accept: ".pdf" },
  ] as const;

  async function handleFileUpload(file: File, category: string) {
    if (!job) return;
    setUploadingZone(category);
    try {
      // Upload PDF directly to Supabase Storage from the browser. This bypasses
      // Vercel's 4.5MB request-body limit (which is what was blocking plans).
      const storagePath = `${job.jobCode}/${category}/${file.name}`;
      const { error: storageErr } = await supabase.storage
        .from("project-documents")
        .upload(storagePath, file, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (storageErr) throw new Error(`Storage upload failed: ${storageErr.message}`);

      // Now tell the API where the file landed (small JSON, no body-limit issue).
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobCode: job.jobCode,
          address: job.address,
          category,
          fileName: file.name,
          storagePath,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      toast.success(`Uploaded ${file.name}`);
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploadingZone(null);
    }
  }

  const totalTrades = job.trades?.length || 0;
  const quotedTrades = job.trades?.filter((t) =>
    t.quotes?.some((q) => q.status === "received" || q.status === "accepted")
  ).length || 0;

  return (
    <AuthLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/jobs" className="hover:text-foreground">Jobs</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">{job.jobCode}</span>
        </nav>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{job.jobCode}</h1>
            <p className="text-muted-foreground">{job.address}</p>
          </div>
          <div className="flex gap-2">
            <Badge className={STATUS_COLORS[job.status] || ""}>{job.status}</Badge>
            <Button variant="outline" size="sm" onClick={openEditDialog} className="min-h-[36px]">
              <Pencil className="w-4 h-4 mr-1" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive min-h-[36px]">
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          </div>
        </div>

        {/* Job Info */}
        <Card>
          <CardHeader><CardTitle>Job Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Region:</span> {job.region}</div>
              <div><span className="text-muted-foreground">Build Type:</span> {job.buildType}</div>
              <div><span className="text-muted-foreground">Storeys:</span> {job.storeys}</div>
              {estimator && <div><span className="text-muted-foreground">Estimator:</span> {estimator.name}</div>}
              {job.targetDate && <div><span className="text-muted-foreground">Target Date:</span> {new Date(job.targetDate).toLocaleDateString()}</div>}
              {job.budgetEstimate && <div><span className="text-muted-foreground">Budget:</span> ${job.budgetEstimate.toLocaleString()}</div>}
            </div>
          </CardContent>
        </Card>

        {/* Status Actions */}
        <Card>
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(["active", "quoting", "quoted"] as const).map((s) => (
                <Button
                  key={s}
                  variant={job.status === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStatusChange(s)}
                  className="min-h-[36px] capitalize"
                >
                  {s}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        {job.documents && job.documents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Documents ({job.documents.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {job.documents.map((doc, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                    <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{doc.category.replace("_", " ")}</p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="min-h-[44px] min-w-[44px] px-3"
                      onClick={async () => {
                        if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
                        try {
                          const updatedDocs = job.documents.filter((_, idx) => idx !== i);
                          const updatedJob = { ...job, documents: updatedDocs };
                          await saveJob(updatedJob);
                          setJob(updatedJob);
                          toast.success(`Deleted ${doc.name}`);
                        } catch {
                          toast.error("Failed to delete document");
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Zones */}
        <Card>
          <CardHeader><CardTitle>Upload Documents</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {UPLOAD_ZONES.map((zone) => {
                const isUploading = uploadingZone === zone.category;
                const existingDocs = (job.documents || []).filter(
                  (d) => d.category === zone.category
                );
                return (
                  <label
                    key={zone.category}
                    className={`relative flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors min-h-[120px] ${
                      isUploading
                        ? "border-[#2D5E3A] bg-[#2D5E3A]/5"
                        : "border-muted-foreground/25 hover:border-[#2D5E3A] hover:bg-muted/50"
                    }`}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files[0];
                      if (file) handleFileUpload(file, zone.category);
                    }}
                  >
                    <input
                      type="file"
                      accept={zone.accept}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, zone.category);
                        e.target.value = "";
                      }}
                      disabled={isUploading}
                    />
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 text-[#2D5E3A] animate-spin" />
                    ) : (
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{zone.label}</span>
                    {existingDocs.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {existingDocs.length} file{existingDocs.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Trade Checklist */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Trades ({quotedTrades}/{totalTrades} quoted)</CardTitle>
              <Button
                onClick={openTradePicker}
                variant="outline"
                size="sm"
                className="min-h-[36px] border-[#2D5E3A] text-[#2D5E3A] hover:bg-[#2D5E3A]/10"
              >
                <Plus className="w-4 h-4 mr-1" />
                {totalTrades === 0 ? "Select Trades" : "Edit Trades"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {totalTrades === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-3">No trades selected for this job yet.</p>
                <Button onClick={openTradePicker} className="min-h-[44px] bg-[#2D5E3A] hover:bg-[#2D5E3A]/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Select Trades to Quote
                </Button>
              </div>
            ) : (
            <div className="space-y-2">
              {(job.trades || []).map((trade) => {
                const bestQuote = trade.quotes?.find((q) => q.status === "accepted") ||
                  trade.quotes?.find((q) => q.status === "received");
                const latestStatus = bestQuote?.status ||
                  trade.quotes?.[trade.quotes.length - 1]?.status || "not_started";

                const requestedQuotes = (trade.quotes || []).filter((q) => q.status === "requested");

                return (
                  <div key={trade.code} className="border-b last:border-b-0">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        {QUOTE_STATUS_ICON[latestStatus] || QUOTE_STATUS_ICON.not_started}
                        <span className="text-sm">
                          <span className="text-muted-foreground">{trade.code}</span>{" "}
                          {trade.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {bestQuote?.priceExGST && (
                          <span className="text-sm font-mono">${bestQuote.priceExGST.toLocaleString()}</span>
                        )}
                        <Badge variant="secondary" className="text-xs capitalize">
                          {latestStatus.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {trade.quotes?.length || 0} quote{(trade.quotes?.length || 0) !== 1 ? "s" : ""}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[36px] text-xs border-[#2D5E3A] text-[#2D5E3A] hover:bg-[#2D5E3A]/10"
                          onClick={() => openReceive(trade.code)}
                        >
                          <FileInput className="w-3 h-3 mr-1" />
                          Receive
                        </Button>
                      </div>
                    </div>
                    {/* Show requested quotes with clear Received button */}
                    {requestedQuotes.length > 0 && (
                      <div className="pl-6 pb-3 space-y-2">
                        {requestedQuotes.map((q, qi) => (
                          <div key={qi} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-100">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-medium">{q.supplierName}</p>
                                <p className="text-xs text-muted-foreground">
                                  Requested {q.requestedDate ? new Date(q.requestedDate).toLocaleDateString("en-AU") : ""}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="min-h-[44px] px-4 bg-[#2D5E3A] hover:bg-[#2D5E3A]/90"
                              onClick={() => quickReceive(trade.code, q.supplierId, q.supplierName)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Received
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </CardContent>
        </Card>

        {/* Trade Picker Dialog */}
        <Dialog open={tradePickerOpen} onOpenChange={setTradePickerOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select Trades — {job.jobCode}</DialogTitle>
              <DialogDescription>
                Choose which trades need quotes for this job. Existing quote data will be preserved.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{selectedTrades.length} trades selected</span>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" className="text-xs h-7 px-2"
                    onClick={() => setSelectedTrades(QUOTABLE_TRADES.map((t) => t.code))}>
                    All
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="text-xs h-7 px-2"
                    onClick={() => setSelectedTrades([])}>
                    None
                  </Button>
                </div>
              </div>
              <Input
                placeholder="Search trades..."
                value={tradeSearch}
                onChange={(e) => setTradeSearch(e.target.value)}
                className="min-h-[44px]"
              />
              <div className="max-h-[400px] overflow-y-auto border rounded-lg">
                {(() => {
                  const filteredGroups = tradeSearch
                    ? GROUPED_TRADES.map((g) => ({
                        ...g,
                        trades: g.trades.filter(
                          (t) =>
                            t.name.toLowerCase().includes(tradeSearch.toLowerCase()) ||
                            t.code.includes(tradeSearch)
                        ),
                      })).filter((g) => g.trades.length > 0)
                    : GROUPED_TRADES;

                  return filteredGroups.map((group) => {
                    const isCollapsed = collapsedGroups.has(group.key) && !tradeSearch;
                    const groupCodes: string[] = group.trades.map((t) => t.code);
                    const allGroupSelected = groupCodes.every((c) => selectedTrades.includes(c));
                    const someGroupSelected = groupCodes.some((c) => selectedTrades.includes(c));

                    return (
                      <div key={group.key} className="border-b last:border-b-0">
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 sticky top-0">
                          <button
                            type="button"
                            onClick={() => setCollapsedGroups((prev) => {
                              const next = new Set(Array.from(prev));
                              if (next.has(group.key)) next.delete(group.key);
                              else next.add(group.key);
                              return next;
                            })}
                            className="p-1 min-w-[28px] min-h-[28px] flex items-center justify-center"
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                          </button>
                          <input
                            type="checkbox"
                            checked={allGroupSelected}
                            ref={(el) => { if (el) el.indeterminate = someGroupSelected && !allGroupSelected; }}
                            onChange={() => {
                              if (allGroupSelected) {
                                setSelectedTrades((prev) => prev.filter((c) => !groupCodes.includes(c)));
                              } else {
                                setSelectedTrades((prev) => Array.from(new Set([...prev, ...groupCodes])));
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm font-medium flex-1">{group.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {groupCodes.filter((c) => selectedTrades.includes(c)).length}/{groupCodes.length}
                          </span>
                        </div>
                        {!isCollapsed && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                            {group.trades.map((trade) => (
                              <label
                                key={trade.code}
                                className={`flex items-center gap-2 px-3 py-2 pl-10 cursor-pointer text-sm min-h-[44px] ${
                                  selectedTrades.includes(trade.code) ? "bg-[#2D5E3A]/10 font-medium" : "hover:bg-muted"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedTrades.includes(trade.code)}
                                  onChange={() => toggleTrade(trade.code)}
                                  className="w-4 h-4 flex-shrink-0"
                                />
                                <span className="truncate">
                                  <span className="text-muted-foreground">{trade.code}</span>{" "}
                                  {trade.name}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSaveTrades}
                  disabled={tradeSaving || selectedTrades.length === 0}
                  className="flex-1 min-h-[44px] bg-[#2D5E3A] hover:bg-[#2D5E3A]/90"
                >
                  {tradeSaving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    `Save ${selectedTrades.length} Trades`
                  )}
                </Button>
                <Button variant="outline" onClick={() => setTradePickerOpen(false)} className="min-h-[44px]">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Cost Summary */}
        {job.budgetEstimate && (
          <Card>
            <CardHeader><CardTitle>Cost Summary</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                let totalQuoted = 0;
                for (const trade of job.trades || []) {
                  const accepted = trade.quotes?.find((q) => q.status === "accepted");
                  if (accepted?.priceExGST) { totalQuoted += accepted.priceExGST; continue; }
                  const cheapest = trade.quotes?.filter((q) => q.status === "received" && q.priceExGST)
                    .sort((a, b) => (a.priceExGST || 0) - (b.priceExGST || 0))[0];
                  if (cheapest?.priceExGST) totalQuoted += cheapest.priceExGST;
                }
                const diff = totalQuoted - (job.budgetEstimate || 0);
                return (
                  <div className="grid grid-cols-3 gap-4 text-sm text-center">
                    <div>
                      <p className="text-muted-foreground">Budget</p>
                      <p className="text-lg font-bold">${job.budgetEstimate?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Quoted Total</p>
                      <p className="text-lg font-bold">${totalQuoted.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Difference</p>
                      <p className={`text-lg font-bold ${diff > 0 ? "text-red-600" : "text-green-600"}`}>
                        {diff > 0 ? "+" : ""}${diff.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
        {/* Receive Quote Dialog */}
        <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Receive Quote — {job.trades?.find((t) => t.code === receiveTradeCode)?.name || receiveTradeCode}
              </DialogTitle>
              <DialogDescription>
                {job.jobCode} — {job.address}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {/* Supplier */}
              <div className="space-y-2">
                <Label>Supplier *</Label>
                <Select value={receiveSupplierId} onValueChange={setReceiveSupplierId}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="Choose supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {receiveMatchingSuppliers.length > 0 ? (
                      receiveMatchingSuppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.company} ({s.email || "no email"})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="_none" disabled>No suppliers for this trade</SelectItem>
                    )}
                    {receiveMatchingSuppliers.length > 0 && suppliers.length > receiveMatchingSuppliers.length && (
                      <>
                        <SelectItem value="_div" disabled>── Other suppliers ──</SelectItem>
                        {suppliers
                          .filter((s) => !receiveMatchingSuppliers.some((m) => m.id === s.id))
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.company} ({s.email || "no email"})
                            </SelectItem>
                          ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* PDF upload */}
              <div className="space-y-2">
                <Label>Quote PDF</Label>
                <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-[#2D5E3A] hover:bg-muted/50 min-h-[60px]">
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setReceiveFile(f);
                      e.target.value = "";
                    }}
                  />
                  {receiveFile ? (
                    <div className="flex items-center gap-2">
                      <FileInput className="w-4 h-4 text-[#2D5E3A]" />
                      <span className="text-sm">{receiveFile.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Click to upload PDF</span>
                  )}
                </label>
              </div>

              {/* OCR */}
              {receiveFile && (
                <Button onClick={handleOcr} disabled={ocrLoading} variant="outline" className="w-full min-h-[44px]">
                  {ocrLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Extracting...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Extract prices with AI</>
                  )}
                </Button>
              )}

              {/* Prices */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Price ex GST *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={receivePriceExGST}
                    onChange={(e) => setReceivePriceExGST(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price inc GST</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={receivePriceIncGST}
                    onChange={(e) => setReceivePriceIncGST(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
              </div>

              {/* Expiry */}
              <div className="space-y-2">
                <Label>Quote Expiry</Label>
                <Input
                  type="date"
                  value={receiveExpiry}
                  onChange={(e) => setReceiveExpiry(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleReceiveSubmit}
                  disabled={receiveSubmitting || !receiveSupplierId || !receivePriceExGST}
                  className="flex-1 min-h-[44px] bg-[#2D5E3A] hover:bg-[#2D5E3A]/90"
                >
                  {receiveSubmitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recording...</>
                  ) : (
                    <><FileInput className="w-4 h-4 mr-2" /> Record Quote</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setReceiveOpen(false)} className="min-h-[44px]">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Job Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Job — {job.jobCode}</DialogTitle>
              <DialogDescription>Update job details below.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Address *</Label>
                <Input
                  value={editForm.address}
                  onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                  className="min-h-[44px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Region *</Label>
                <select
                  value={editForm.region}
                  onChange={(e) => setEditForm((f) => ({ ...f, region: e.target.value }))}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
                >
                  <option value="">Select region</option>
                  {["Western", "Northern", "South East", "Eastern", "Geelong", "Ballarat"].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Build Type *</Label>
                  <select
                    value={editForm.buildType}
                    onChange={(e) => setEditForm((f) => ({ ...f, buildType: e.target.value as Job["buildType"] }))}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
                  >
                    {["New Build", "Dual Occ", "Extension", "Renovation"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Storeys *</Label>
                  <select
                    value={editForm.storeys}
                    onChange={(e) => setEditForm((f) => ({ ...f, storeys: e.target.value as Job["storeys"] }))}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
                  >
                    {["Single", "Double", "Triple"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Date</Label>
                  <Input
                    type="date"
                    value={editForm.targetDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, targetDate: e.target.value }))}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Budget Estimate ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 350000"
                    value={editForm.budgetEstimate}
                    onChange={(e) => setEditForm((f) => ({ ...f, budgetEstimate: e.target.value }))}
                    className="min-h-[44px]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleEditSubmit}
                  disabled={editSaving || !editForm.address || !editForm.region}
                  className="flex-1 min-h-[44px] bg-[#2D5E3A] hover:bg-[#2D5E3A]/90"
                >
                  {editSaving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
                <Button variant="outline" onClick={() => setEditOpen(false)} className="min-h-[44px]">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AuthLayout>
  );
}
