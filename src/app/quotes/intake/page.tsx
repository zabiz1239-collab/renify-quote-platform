"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import AuthLayout from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileInput, Upload, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { getJobs, getSuppliers } from "@/lib/supabase";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Job, Supplier } from "@/types";
import { toast } from "sonner";

interface OcrResult {
  priceExGST?: number;
  priceIncGST?: number;
  supplierName?: string;
  quoteDate?: string;
  expiryDate?: string;
  scopeItems?: string[];
}

export default function QuoteIntakePage() {
  usePageTitle("Receive Quote");
  useSession();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedJobCode, setSelectedJobCode] = useState("");
  const [selectedTradeCode, setSelectedTradeCode] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [priceExGST, setPriceExGST] = useState("");
  const [priceIncGST, setPriceIncGST] = useState("");
  const [quoteExpiry, setQuoteExpiry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

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

  const selectedJob = jobs.find((j) => j.jobCode === selectedJobCode);
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  // Filter suppliers by trade code
  const matchingSuppliers = suppliers.filter((s) => s.trades.includes(selectedTradeCode));

  async function handleOcr() {
    if (!file) return;
    setOcrLoading(true);
    setOcrResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OCR failed");

      setOcrResult(data);
      // Auto-fill fields from OCR
      if (data.priceExGST && !priceExGST) setPriceExGST(String(data.priceExGST));
      if (data.priceIncGST && !priceIncGST) setPriceIncGST(String(data.priceIncGST));
      if (data.expiryDate && !quoteExpiry) setQuoteExpiry(data.expiryDate);
      toast.success("OCR extraction complete — check the auto-filled fields");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OCR failed";
      toast.error(msg);
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleSubmit() {
    if (!selectedJobCode || !selectedTradeCode || !selectedSupplierId || !selectedSupplier) {
      toast.error("Please select a job, trade, and supplier");
      return;
    }
    if (!priceExGST) {
      toast.error("Please enter the price ex GST");
      return;
    }

    setSubmitting(true);
    setDuplicateWarning(null);
    try {
      const formData = new FormData();
      formData.append("jobCode", selectedJobCode);
      formData.append("tradeCode", selectedTradeCode);
      formData.append("supplierId", selectedSupplierId);
      formData.append("supplierName", selectedSupplier.company);
      formData.append("priceExGST", priceExGST);
      if (priceIncGST) formData.append("priceIncGST", priceIncGST);
      if (quoteExpiry) formData.append("quoteExpiry", quoteExpiry);
      if (file) formData.append("file", file);

      const res = await fetch("/api/quotes/receive", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record quote");

      if (data.duplicateWarning) {
        setDuplicateWarning(data.duplicateWarning);
      }

      toast.success(`Quote recorded — v${data.version}${data.fileName ? ` (${data.fileName})` : ""}`);

      // Reset form for next entry
      setSelectedTradeCode("");
      setSelectedSupplierId("");
      setPriceExGST("");
      setPriceIncGST("");
      setQuoteExpiry("");
      setFile(null);
      setOcrResult(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to record quote";
      toast.error(msg);
    } finally {
      setSubmitting(false);
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
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Receive Quote</h1>

        {/* Step 1: Select Job */}
        <Card>
          <CardHeader><CardTitle>1. Select Job</CardTitle></CardHeader>
          <CardContent>
            <Select
              value={selectedJobCode}
              onValueChange={(v) => {
                setSelectedJobCode(v);
                setSelectedTradeCode("");
                setSelectedSupplierId("");
              }}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Choose a job..." />
              </SelectTrigger>
              <SelectContent>
                {jobs.filter((j) => j.status === "active" || j.status === "quoting").map((j) => (
                  <SelectItem key={j.jobCode} value={j.jobCode}>
                    {j.jobCode} — {j.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Step 2: Select Trade */}
        {selectedJob && (
          <Card>
            <CardHeader><CardTitle>2. Select Trade</CardTitle></CardHeader>
            <CardContent>
              <Select
                value={selectedTradeCode}
                onValueChange={(v) => {
                  setSelectedTradeCode(v);
                  setSelectedSupplierId("");
                }}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Choose a trade..." />
                </SelectTrigger>
                <SelectContent>
                  {(selectedJob.trades || []).map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.code} {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Select Supplier */}
        {selectedTradeCode && (
          <Card>
            <CardHeader><CardTitle>3. Select Supplier</CardTitle></CardHeader>
            <CardContent>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Choose a supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {matchingSuppliers.length > 0 ? (
                    matchingSuppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.company} {s.email ? `(${s.email})` : ""}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="_none" disabled>
                      No suppliers for this trade
                    </SelectItem>
                  )}
                  {/* Also show all suppliers as a fallback */}
                  {matchingSuppliers.length > 0 && suppliers.length > matchingSuppliers.length && (
                    <>
                      <SelectItem value="_divider" disabled>
                        ── Other suppliers ──
                      </SelectItem>
                      {suppliers
                        .filter((s) => !matchingSuppliers.some((m) => m.id === s.id))
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.company} {s.email ? `(${s.email})` : ""}
                          </SelectItem>
                        ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Upload PDF + Enter Price */}
        {selectedSupplierId && (
          <Card>
            <CardHeader><CardTitle>4. Quote Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* File upload */}
              <div className="space-y-2">
                <Label>Quote PDF</Label>
                <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors border-muted-foreground/25 hover:border-[#2D5E3A] hover:bg-muted/50 min-h-[80px]">
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setFile(f);
                      e.target.value = "";
                    }}
                  />
                  {file ? (
                    <div className="flex items-center gap-2">
                      <FileInput className="w-5 h-5 text-[#2D5E3A]" />
                      <span className="text-sm font-medium">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Click to upload PDF</span>
                    </>
                  )}
                </label>
              </div>

              {/* OCR button */}
              {file && (
                <Button
                  onClick={handleOcr}
                  disabled={ocrLoading}
                  variant="outline"
                  className="w-full min-h-[44px]"
                >
                  {ocrLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Extracting with AI...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Extract prices with AI (OCR)</>
                  )}
                </Button>
              )}

              {/* OCR result info */}
              {ocrResult && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  AI extracted: {ocrResult.priceExGST ? `$${ocrResult.priceExGST.toLocaleString()} ex GST` : "no price found"}
                  {ocrResult.scopeItems && ocrResult.scopeItems.length > 0 && (
                    <span className="block mt-1 text-xs">
                      Scope: {ocrResult.scopeItems.join(", ")}
                    </span>
                  )}
                </div>
              )}

              {/* Price fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Price ex GST *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={priceExGST}
                    onChange={(e) => setPriceExGST(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price inc GST</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={priceIncGST}
                    onChange={(e) => setPriceIncGST(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
              </div>

              {/* Expiry */}
              <div className="space-y-2">
                <Label>Quote Expiry Date</Label>
                <Input
                  type="date"
                  value={quoteExpiry}
                  onChange={(e) => setQuoteExpiry(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>

              {/* Duplicate warning */}
              {duplicateWarning && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{duplicateWarning}</span>
                </div>
              )}

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={submitting || !priceExGST}
                className="w-full min-h-[52px] text-base bg-[#2D5E3A] hover:bg-[#2D5E3A]/90"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recording...</>
                ) : (
                  <><FileInput className="w-5 h-5 mr-2" /> Record Quote</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AuthLayout>
  );
}
