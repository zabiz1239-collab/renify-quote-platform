"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { Upload, AlertTriangle, Scan } from "lucide-react";
import { readJsonFile, writeJsonFile, listFolder, uploadFile } from "@/lib/onedrive";
import {
  getQuoteFileName,
  getNextVersion,
  computeFileHash,
  checkDuplicateHash,
  getTradeNameByCode,
} from "@/lib/quote-utils";
import type { Job, Supplier, Quote, AppSettings, Estimator } from "@/types";
import { DEFAULT_ONEDRIVE_ROOT } from "@/types";
import { notifyQuoteReceived, notifyMilestone, isJobFullyQuoted } from "@/lib/notifications";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function QuoteIntakePage() {
  usePageTitle("Quote Intake");
  const { data: session } = useSession();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState("");

  const [selectedJobCode, setSelectedJobCode] = useState("");
  const [selectedTradeCode, setSelectedTradeCode] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [priceExGST, setPriceExGST] = useState("");
  const [priceIncGST, setPriceIncGST] = useState("");
  const [quoteExpiry, setQuoteExpiry] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);

  const rootPath = DEFAULT_ONEDRIVE_ROOT;

  const loadData = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const [suppliersData, settingsData] = await Promise.all([
        readJsonFile<Supplier[]>(session.accessToken, `${rootPath}/suppliers.json`),
        readJsonFile<AppSettings>(session.accessToken, `${rootPath}/settings.json`),
      ]);
      setSuppliers(suppliersData || []);

      const rp = settingsData?.oneDriveRootPath || rootPath;
      const items = await listFolder(session.accessToken, rp);
      const jobFolders = items.filter(
        (item) => item.folder && !item.name.endsWith(".json")
      );

      const jobPromises = jobFolders.map(async (folder) => {
        try {
          return await readJsonFile<Job>(
            session.accessToken!,
            `${rp}/${folder.name}/job-config.json`
          );
        } catch {
          return null;
        }
      });

      const results = await Promise.all(jobPromises);
      setJobs(results.filter((j): j is Job => j !== null));
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedJob = jobs.find((j) => j.jobCode === selectedJobCode);
  const availableTrades = selectedJob?.trades || [];
  const selectedTrade = availableTrades.find((t) => t.code === selectedTradeCode);

  // Filter suppliers by selected trade
  const filteredSuppliers = suppliers.filter(
    (s) => !selectedTradeCode || s.trades.includes(selectedTradeCode)
  );

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    setDuplicateWarning("");

    // Check for duplicates via SHA-256
    try {
      const hash = await computeFileHash(file);
      // Check against all quotes in the selected job
      if (selectedJob) {
        const allQuotes: Quote[] = [];
        for (const trade of selectedJob.trades) {
          allQuotes.push(...(trade.quotes || []));
        }
        const dup = checkDuplicateHash(hash, allQuotes);
        if (dup.isDuplicate) {
          setDuplicateWarning(
            `This file has already been uploaded as "${dup.existingFile}" by ${dup.existingSupplier}.`
          );
        }
      }
    } catch {
      // Hash computation failed, continue without check
    }
  }

  async function handleOcrExtract() {
    if (!pdfFile) return;
    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        if (data.priceExGST) setPriceExGST(String(data.priceExGST));
        if (data.priceIncGST) setPriceIncGST(String(data.priceIncGST));
        if (data.expiryDate) setQuoteExpiry(data.expiryDate);
        setOcrDone(true);
      }
    } catch {
      // OCR failed silently — user can still enter manually
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !selectedJob || !selectedTradeCode || !selectedSupplierId) {
      setError("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const supplier = suppliers.find((s) => s.id === selectedSupplierId);
      if (!supplier) throw new Error("Supplier not found");

      const tradeIndex = selectedJob.trades.findIndex(
        (t) => t.code === selectedTradeCode
      );
      if (tradeIndex === -1) throw new Error("Trade not found in job");

      const existingQuotes = selectedJob.trades[tradeIndex].quotes || [];
      const version = getNextVersion(existingQuotes, selectedSupplierId);
      const tradeName = getTradeNameByCode(selectedTradeCode);

      let fileHash: string | undefined;
      let quotePDF: string | undefined;

      // Upload PDF if provided
      if (pdfFile) {
        fileHash = await computeFileHash(pdfFile);
        quotePDF = getQuoteFileName(tradeName, supplier.company, version);

        const folderName = `${selectedJob.jobCode} - ${selectedJob.address}`;
        const fileBuffer = await pdfFile.arrayBuffer();
        await uploadFile(
          session.accessToken,
          `${rootPath}/${folderName}/Quotes`,
          quotePDF,
          fileBuffer
        );
      }

      // Create or update quote
      const existingQuoteIndex = existingQuotes.findIndex(
        (q) => q.supplierId === selectedSupplierId
      );

      const newQuote: Quote = {
        supplierId: selectedSupplierId,
        supplierName: supplier.company,
        status: "received",
        receivedDate: new Date().toISOString(),
        priceExGST: priceExGST ? parseFloat(priceExGST) : undefined,
        priceIncGST: priceIncGST ? parseFloat(priceIncGST) : undefined,
        quoteExpiry: quoteExpiry || undefined,
        quotePDF,
        version,
        fileHash,
        followUpCount: existingQuoteIndex >= 0 ? existingQuotes[existingQuoteIndex].followUpCount : 0,
        lastFollowUp: existingQuoteIndex >= 0 ? existingQuotes[existingQuoteIndex].lastFollowUp : undefined,
        requestedDate: existingQuoteIndex >= 0 ? existingQuotes[existingQuoteIndex].requestedDate : undefined,
        ocrExtracted: false,
      };

      const updatedJob = { ...selectedJob };
      if (existingQuoteIndex >= 0) {
        updatedJob.trades[tradeIndex].quotes[existingQuoteIndex] = newQuote;
      } else {
        updatedJob.trades[tradeIndex].quotes.push(newQuote);
      }
      updatedJob.updatedAt = new Date().toISOString();

      // Save to OneDrive
      const folderName = `${selectedJob.jobCode} - ${selectedJob.address}`;
      await writeJsonFile(
        session.accessToken,
        `${rootPath}/${folderName}/job-config.json`,
        updatedJob
      );

      // Send notifications (best-effort, don't block on failure)
      try {
        const estimators = (await readJsonFile<Estimator[]>(
          session.accessToken,
          `${rootPath}/estimators.json`
        )) || [];
        const estimator = estimators.find((e) => e.id === updatedJob.estimatorId) || estimators[0];
        if (estimator) {
          await notifyQuoteReceived(
            session.accessToken,
            estimator,
            updatedJob.jobCode,
            tradeName,
            supplier.company,
            priceExGST ? parseFloat(priceExGST) : undefined
          );
        }
        // Milestone check
        if (isJobFullyQuoted(updatedJob)) {
          const settings = await readJsonFile<AppSettings>(
            session.accessToken,
            `${rootPath}/settings.json`
          );
          if (settings?.adminEmail) {
            await notifyMilestone(session.accessToken, settings.adminEmail, updatedJob);
          }
        }
      } catch {
        // Notifications are best-effort
      }

      router.push("/quotes");
    } catch (err) {
      console.error("Failed to save quote:", err);
      setError("Failed to save quote. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Quote Intake</h1>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quote Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Job *</Label>
                  <Select value={selectedJobCode} onValueChange={(v) => { setSelectedJobCode(v); setSelectedTradeCode(""); }}>
                    <SelectTrigger className="min-h-[44px]">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Trade *</Label>
                    <Select value={selectedTradeCode} onValueChange={setSelectedTradeCode}>
                      <SelectTrigger className="min-h-[44px]">
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
                  <div className="space-y-2">
                    <Label>Supplier *</Label>
                    <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSuppliers.map((sup) => (
                          <SelectItem key={sup.id} value={sup.id}>
                            {sup.company}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedTrade && selectedSupplierId && (
                  <p className="text-xs text-muted-foreground">
                    Version: v{getNextVersion(selectedTrade.quotes || [], selectedSupplierId)}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Price ex GST ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={priceExGST}
                      onChange={(e) => setPriceExGST(e.target.value)}
                      placeholder="0.00"
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Price inc GST ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={priceIncGST}
                      onChange={(e) => setPriceIncGST(e.target.value)}
                      placeholder="0.00"
                      className="min-h-[44px]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Quote Expiry Date</Label>
                  <Input
                    type="date"
                    value={quoteExpiry}
                    onChange={(e) => setQuoteExpiry(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quote PDF</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload PDF</Label>
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="min-h-[44px]"
                  />
                </div>
                {duplicateWarning && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800">{duplicateWarning}</p>
                  </div>
                )}
                {pdfFile && !duplicateWarning && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Selected: {pdfFile.name} ({(pdfFile.size / 1024).toFixed(1)} KB)
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleOcrExtract}
                      disabled={ocrLoading || ocrDone}
                      className="min-h-[44px]"
                    >
                      <Scan className="w-4 h-4 mr-2" />
                      {ocrLoading ? "Extracting..." : ocrDone ? "Extracted" : "Extract with OCR"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={saving || !selectedJobCode || !selectedTradeCode || !selectedSupplierId}
                className="min-h-[44px] flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save Quote"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/quotes")}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
