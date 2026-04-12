"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Using native <select> instead of shadcn Select for reliable first-click
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TRADES } from "@/data/trades";
import { createJobFolders } from "@/lib/onedrive";
import { saveJob as saveJobToSupabase, getSettings } from "@/lib/supabase";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Job } from "@/types";
import Link from "next/link";
import { ChevronRight, ChevronDown, Search, AlertTriangle } from "lucide-react";

const TRADE_CATEGORY_ORDER = [
  { key: "siteworks", label: "Siteworks", range: [15, 100] },
  { key: "structure", label: "Structure", range: [105, 195] },
  { key: "external", label: "External", range: [200, 310] },
  { key: "services", label: "Services", range: [315, 370] },
  { key: "internal", label: "Internal", range: [375, 530] },
  { key: "finishes", label: "Finishes", range: [535, 640] },
  { key: "other", label: "Other", range: [641, 999] },
] as const;

function getTradeCategory(code: string): string {
  const num = parseInt(code, 10);
  for (const cat of TRADE_CATEGORY_ORDER) {
    if (num >= cat.range[0] && num <= cat.range[1]) return cat.key;
  }
  return "other";
}

const QUOTABLE_TRADES = TRADES.filter((t) => t.quotable);
const GROUPED_TRADES = TRADE_CATEGORY_ORDER.map((cat) => ({
  ...cat,
  trades: QUOTABLE_TRADES.filter((t) => getTradeCategory(t.code) === cat.key),
})).filter((g) => g.trades.length > 0);

const BUILD_TYPES = ["New Build", "Dual Occ", "Extension", "Renovation"] as const;
const STOREYS = ["Single", "Double", "Triple"] as const;
const DEFAULT_REGIONS = ["Western", "Northern", "South East", "Eastern", "Geelong", "Ballarat"];

export default function NewJobPage() {
  usePageTitle("New Job");
  const { data: session } = useSession();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [authWarning, setAuthWarning] = useState("");

  useEffect(() => {
    if (!session?.accessToken) {
      setAuthWarning("Connect your Microsoft account before creating a job.");
    } else if (session.error === "RefreshAccessTokenError") {
      setAuthWarning("Your Microsoft session expired. Please sign out and sign back in.");
    } else {
      setAuthWarning("");
    }
  }, [session?.accessToken, session?.error]);

  const [form, setForm] = useState({
    jobCode: "",
    address: "",
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    region: "",
    buildType: "" as Job["buildType"] | "",
    storeys: "" as Job["storeys"] | "",
    estimatorId: "",
    targetDate: "",
    budgetEstimate: "",
  });

  const [selectedTrades, setSelectedTrades] = useState<string[]>(
    QUOTABLE_TRADES.map((t) => t.code)
  );
  const [tradeSearch, setTradeSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleTrade(code: string) {
    setSelectedTrades((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function toggleGroup(groupKey: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  function selectAllTrades() {
    setSelectedTrades(QUOTABLE_TRADES.map((t) => t.code));
  }

  function selectNoneTrades() {
    setSelectedTrades([]);
  }

  function toggleGroupTrades(trades: readonly { code: string; name: string; quotable: boolean; group?: string }[]) {
    const codes = trades.map((t) => t.code);
    const allSelected = codes.every((c) => selectedTrades.includes(c));
    if (allSelected) {
      setSelectedTrades((prev) => prev.filter((c) => !codes.includes(c)));
    } else {
      setSelectedTrades((prev) => Array.from(new Set([...prev, ...codes])));
    }
  }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) {
      setError("No access token — please sign out and sign back in.");
      return;
    }
    if (session.error === "RefreshAccessTokenError") {
      setError("Your Microsoft session expired. Please sign out and sign back in.");
      return;
    }

    setTouched(true);
    if (!form.jobCode || !form.address || !form.clientName || !form.region || !form.buildType || !form.storeys) {
      setError("Please fill in all required fields marked with *.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const settings = await getSettings();
      const rootPath = settings?.oneDriveRootPath;

      // Build job object
      const job: Job = {
        jobCode: form.jobCode,
        address: form.address,
        client: {
          name: form.clientName,
          phone: form.clientPhone || undefined,
          email: form.clientEmail || undefined,
        },
        region: form.region,
        buildType: form.buildType as Job["buildType"],
        storeys: form.storeys as Job["storeys"],
        estimatorId: form.estimatorId,
        targetDate: form.targetDate || undefined,
        status: "active",
        budgetEstimate: form.budgetEstimate ? parseFloat(form.budgetEstimate) : undefined,
        documents: [],
        trades: selectedTrades.map((code) => {
          const trade = TRADES.find((t) => t.code === code);
          return {
            code,
            name: trade?.name || code,
            quotes: [],
          };
        }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save job to Supabase
      await saveJobToSupabase(job);

      // Create OneDrive folder structure (for PDF uploads) — best effort
      if (session?.accessToken && rootPath) {
        try {
          await createJobFolders(session.accessToken, rootPath, form.jobCode, form.address);
        } catch (folderErr) {
          console.warn("OneDrive folder creation failed (non-blocking):", folderErr);
        }
      }

      toast.success(`Job ${form.jobCode} created`);
      router.push("/jobs");
    } catch (err: unknown) {
      console.error("Failed to create job:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to create job.");
      setError(`Failed to create job: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/jobs" className="hover:text-foreground">Jobs</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">New Job</span>
        </nav>
        <h1 className="text-2xl font-bold">Create New Job</h1>

        {authWarning && (
          <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p>{authWarning}</p>
              <Link href="/login" className="underline font-medium mt-1 inline-block">
                Sign in with Microsoft
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jobCode">Job Code *</Label>
                  <Input
                    id="jobCode"
                    required
                    placeholder="e.g. BIR40"
                    value={form.jobCode}
                    onChange={(e) => updateField("jobCode", e.target.value)}
                    className={`min-h-[44px] ${touched && !form.jobCode ? "border-red-500" : ""}`}
                  />
                  {touched && !form.jobCode && <p className="text-xs text-red-500">Job Code is required</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region *</Label>
                  <select
                    id="region"
                    value={form.region}
                    onChange={(e) => updateField("region", e.target.value)}
                    className={`flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] ${touched && !form.region ? "border-red-500" : ""}`}
                  >
                    <option value="">Select region</option>
                    {DEFAULT_REGIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {touched && !form.region && <p className="text-xs text-red-500">Region is required</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  required
                  placeholder="e.g. 40 Birmingham St Spotswood"
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  className={`min-h-[44px] ${touched && !form.address ? "border-red-500" : ""}`}
                />
                {touched && !form.address && <p className="text-xs text-red-500">Address is required</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="buildType">Build Type *</Label>
                  <select
                    id="buildType"
                    value={form.buildType}
                    onChange={(e) => updateField("buildType", e.target.value)}
                    className={`flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] ${touched && !form.buildType ? "border-red-500" : ""}`}
                  >
                    <option value="">Select type</option>
                    {BUILD_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {touched && !form.buildType && <p className="text-xs text-red-500">Build Type is required</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storeys">Storeys *</Label>
                  <select
                    id="storeys"
                    value={form.storeys}
                    onChange={(e) => updateField("storeys", e.target.value)}
                    className={`flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] ${touched && !form.storeys ? "border-red-500" : ""}`}
                  >
                    <option value="">Select storeys</option>
                    {STOREYS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {touched && !form.storeys && <p className="text-xs text-red-500">Storeys is required</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetDate">Target Quote Deadline</Label>
                  <Input
                    id="targetDate"
                    type="date"
                    value={form.targetDate}
                    onChange={(e) => updateField("targetDate", e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budgetEstimate">Budget Estimate ($)</Label>
                  <Input
                    id="budgetEstimate"
                    type="number"
                    min={0}
                    placeholder="e.g. 350000"
                    value={form.budgetEstimate}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || parseFloat(val) >= 0) updateField("budgetEstimate", val);
                    }}
                    className="min-h-[44px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name *</Label>
                <Input
                  id="clientName"
                  required
                  placeholder="Client name"
                  value={form.clientName}
                  onChange={(e) => updateField("clientName", e.target.value)}
                  className={`min-h-[44px] ${touched && !form.clientName ? "border-red-500" : ""}`}
                />
                {touched && !form.clientName && <p className="text-xs text-red-500">Client Name is required</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientPhone">Phone</Label>
                  <Input
                    id="clientPhone"
                    type="tel"
                    placeholder="e.g. 0400 000 000"
                    value={form.clientPhone}
                    onChange={(e) => updateField("clientPhone", e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientEmail">Email</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    placeholder="Email address"
                    value={form.clientEmail}
                    onChange={(e) => updateField("clientEmail", e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trades to Quote</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                <p className="text-sm text-muted-foreground">
                  {selectedTrades.length} of {QUOTABLE_TRADES.length} trades selected
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="min-h-[36px] text-xs" onClick={selectAllTrades}>
                    Select All
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="min-h-[36px] text-xs" onClick={selectNoneTrades}>
                    Select None
                  </Button>
                </div>
              </div>
              <div className="relative mb-3">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search trades..."
                  value={tradeSearch}
                  onChange={(e) => setTradeSearch(e.target.value)}
                  className="pl-9 min-h-[44px]"
                />
              </div>
              <div className="max-h-80 overflow-y-auto border rounded-lg">
                {filteredGroups.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.key) && !tradeSearch;
                  const groupCodes = group.trades.map((t) => t.code);
                  const allGroupSelected = groupCodes.every((c) => selectedTrades.includes(c));
                  const someGroupSelected = groupCodes.some((c) => selectedTrades.includes(c));

                  return (
                    <div key={group.key} className="border-b last:border-b-0">
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 sticky top-0">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.key)}
                          className="p-1 min-w-[28px] min-h-[28px] flex items-center justify-center"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                        </button>
                        <input
                          type="checkbox"
                          checked={allGroupSelected}
                          ref={(el) => { if (el) el.indeterminate = someGroupSelected && !allGroupSelected; }}
                          onChange={() => toggleGroupTrades(group.trades)}
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
                              className="flex items-center gap-2 px-3 py-2 pl-10 hover:bg-muted cursor-pointer min-h-[44px]"
                            >
                              <input
                                type="checkbox"
                                checked={selectedTrades.includes(trade.code)}
                                onChange={() => toggleTrade(trade.code)}
                                className="w-4 h-4"
                              />
                              <span className="text-sm">
                                <span className="text-muted-foreground">{trade.code}</span>{" "}
                                {trade.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredGroups.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No trades match your search.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={saving}
              className="min-h-[44px] flex-1"
            >
              {saving ? "Creating..." : "Create Job"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={(e) => { e.preventDefault(); router.push("/jobs"); }}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
