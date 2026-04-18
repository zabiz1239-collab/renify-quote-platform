"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import AuthLayout from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Save, Plus, X, AlertTriangle, Loader2, Download, Trash2, Database } from "lucide-react";
import { toast } from "sonner";
import { getSettings as fetchSettings, saveSettings as saveSettingsToDb, getJobs } from "@/lib/supabase";
import { FolderPicker } from "@/components/ui/folder-picker";
import { usePageTitle } from "@/hooks/usePageTitle";
import { TRADES } from "@/data/trades";
import type { AppSettings } from "@/types";
import { DEFAULT_ONEDRIVE_ROOT } from "@/types";

const DEFAULT_SETTINGS: AppSettings = {
  oneDriveRootPath: DEFAULT_ONEDRIVE_ROOT,
  regions: ["Western", "Northern", "South East", "Eastern", "Geelong", "Ballarat"],
  followUpDays: {
    first: 7,
    second: 14,
  },
  quoteExpiryWarningDays: [30, 60, 90],
  defaultMarkupPercent: 15,
  adminEmail: "",
};

interface ConflictEntry {
  jobCode: string;
  timestamp: string;
  overwrittenBy: string;
  previousData: unknown;
  currentData: unknown;
}

export default function SettingsPage() {
  usePageTitle("Settings");
  useSession(); // auth status check
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newRegion, setNewRegion] = useState("");
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);
  const [showTradeMarkups, setShowTradeMarkups] = useState(false);
  const [backups, setBackups] = useState<{id: string; created_at: string; label: string; size_estimate: number}[]>([]);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSettings() {
    try {
      const data = await fetchSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...data });
      // Load conflicts and backups
      loadConflicts();
      loadBackups();
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }

  async function loadConflicts() {
    try {
      const jobs = await getJobs();
      const allConflicts: ConflictEntry[] = [];

      for (const job of jobs) {
        if (job?.conflicts && job.conflicts.length > 0) {
          for (const c of job.conflicts) {
            allConflicts.push({
              jobCode: job.jobCode,
              timestamp: c.timestamp,
              overwrittenBy: c.overwrittenBy,
              previousData: c.previousData,
              currentData: job,
            });
          }
        }
      }

      setConflicts(allConflicts.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));
    } catch {
      // Conflicts loading is best-effort
    }
  }

  async function loadBackups() {
    try {
      const res = await fetch("/api/backup");
      const data = await res.json();
      setBackups(data.backups || []);
    } catch { /* best effort */ }
  }

  function getTradeMarkup(tradeCode: string): number {
    return settings.tradeMarkupPercents?.[tradeCode] ?? settings.defaultMarkupPercent;
  }

  function setTradeMarkup(tradeCode: string, value: number) {
    setSettings((prev) => ({
      ...prev,
      tradeMarkupPercents: {
        ...(prev.tradeMarkupPercents || {}),
        [tradeCode]: value,
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveSettingsToDb(settings);
      toast.success("Settings saved successfully");
    } catch (err: unknown) {
      console.error("Failed to save settings:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to save settings: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  function addRegion() {
    const trimmed = newRegion.trim();
    if (!trimmed || settings.regions.includes(trimmed)) return;
    setSettings((prev) => ({
      ...prev,
      regions: [...prev.regions, trimmed],
    }));
    setNewRegion("");
  }

  function removeRegion(region: string) {
    setSettings((prev) => ({
      ...prev,
      regions: prev.regions.filter((r) => r !== region),
    }));
  }

  if (loading) {
    return (
      <AuthLayout>
        <p className="text-muted-foreground">Loading settings...</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Settings</h1>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="min-h-[44px]"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Regions</CardTitle>
            <CardDescription>
              Manage the regions available in dropdown menus throughout the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {settings.regions.map((region) => (
                <Badge
                  key={region}
                  variant="secondary"
                  className="text-sm py-1 px-3 gap-1"
                >
                  {region}
                  <button
                    onClick={() => removeRegion(region)}
                    className="ml-1 hover:text-destructive min-w-[24px] min-h-[24px] flex items-center justify-center"
                    aria-label={`Remove ${region}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
                placeholder="New region name"
                className="min-h-[44px]"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRegion())}
              />
              <Button
                type="button"
                variant="outline"
                onClick={(e) => { e.preventDefault(); addRegion(); }}
                className="min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Follow-Up Rules</CardTitle>
            <CardDescription>
              Configure when automatic follow-up emails are sent for unanswered quote requests.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>1st Follow-Up (days)</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.followUpDays.first}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      followUpDays: {
                        ...p.followUpDays,
                        first: Math.max(1, parseInt(e.target.value) || 7),
                      },
                    }))
                  }
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label>2nd Follow-Up (days)</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.followUpDays.second}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      followUpDays: {
                        ...p.followUpDays,
                        second: Math.max(1, parseInt(e.target.value) || 14),
                      },
                    }))
                  }
                  className="min-h-[44px]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quote Expiry</CardTitle>
            <CardDescription>
              Warning thresholds for quote expiry dates (in days).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {settings.quoteExpiryWarningDays.map((days, i) => (
                <div key={i} className="space-y-2">
                  <Label>Warning {i + 1}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={days}
                    onChange={(e) => {
                      const updated = [...settings.quoteExpiryWarningDays];
                      updated[i] = parseInt(e.target.value) || 30;
                      setSettings((p) => ({
                        ...p,
                        quoteExpiryWarningDays: updated,
                      }));
                    }}
                    className="min-h-[44px] w-24"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>
              Default markup percentage applied to quote prices for sell price calculation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Default Markup %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.defaultMarkupPercent}
                onChange={(e) =>
                  setSettings((p) => ({
                    ...p,
                    defaultMarkupPercent: parseFloat(e.target.value) || 0,
                  }))
                }
                className="min-h-[44px] w-32"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Admin email for milestone notifications (when all trades for a job are quoted).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Admin Email</Label>
              <Input
                type="email"
                value={settings.adminEmail}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, adminEmail: e.target.value }))
                }
                placeholder="admin@renify.com.au"
                className="min-h-[44px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Per-Trade Markup %</CardTitle>
                <CardDescription>
                  Override the default markup for specific trades. Trades without an override use the default ({settings.defaultMarkupPercent}%).
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTradeMarkups(!showTradeMarkups)}
                className="min-h-[36px]"
              >
                {showTradeMarkups ? "Hide" : "Show"}
              </Button>
            </div>
          </CardHeader>
          {showTradeMarkups && (
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {TRADES.filter((t) => t.quotable).map((trade) => (
                  <div key={trade.code} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-8">{trade.code}</span>
                    <span className="text-xs flex-1 truncate">{trade.name}</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={getTradeMarkup(trade.code)}
                      onChange={(e) => setTradeMarkup(trade.code, parseFloat(e.target.value) || 0)}
                      className="w-20 min-h-[36px] text-xs"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Custom Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Trade Categories</CardTitle>
            <CardDescription>Add your own trade categories beyond the standard Databuild list.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Code (e.g. C01)"
                id="customCode"
                className="min-h-[44px] w-24"
              />
              <Input
                placeholder="Category name (e.g. POOL FENCING)"
                id="customName"
                className="min-h-[44px] flex-1"
              />
              <Button
                variant="outline"
                className="min-h-[44px]"
                onClick={() => {
                  const codeEl = document.getElementById("customCode") as HTMLInputElement;
                  const nameEl = document.getElementById("customName") as HTMLInputElement;
                  const code = codeEl?.value.trim().toUpperCase();
                  const name = nameEl?.value.trim().toUpperCase();
                  if (!code || !name) { toast.error("Enter both code and name"); return; }
                  const existing = settings.customTrades || [];
                  if (existing.some((t) => t.code === code)) { toast.error("Code already exists"); return; }
                  setSettings((p) => ({ ...p, customTrades: [...existing, { code, name }] }));
                  if (codeEl) codeEl.value = "";
                  if (nameEl) nameEl.value = "";
                  toast.success("Added — save settings to persist");
                }}
              >
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            {(settings.customTrades || []).length > 0 && (
              <div className="border rounded-lg divide-y">
                {(settings.customTrades || []).map((t) => (
                  <div key={t.code} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span><span className="text-muted-foreground">{t.code}</span> {t.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive min-h-[36px]"
                      onClick={() => {
                        setSettings((p) => ({
                          ...p,
                          customTrades: (p.customTrades || []).filter((ct) => ct.code !== t.code),
                        }));
                        toast.success("Removed — save settings to persist");
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Sync Conflicts
            </CardTitle>
            <CardDescription>
              When offline edits conflict with server changes, both versions are preserved here for review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conflicts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sync conflicts found.</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {conflicts.map((conflict, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="text-xs">{conflict.jobCode}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(conflict.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Overwritten by: <span className="font-medium">{conflict.overwrittenBy}</span>
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs font-medium mb-1">Previous Version</p>
                        <pre className="text-xs bg-red-50 p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap">
                          {JSON.stringify(conflict.previousData, null, 2).slice(0, 500)}
                          {JSON.stringify(conflict.previousData, null, 2).length > 500 && "..."}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-1">Current Version</p>
                        <pre className="text-xs bg-green-50 p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap">
                          {JSON.stringify(conflict.currentData, null, 2).slice(0, 500)}
                          {JSON.stringify(conflict.currentData, null, 2).length > 500 && "..."}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end pb-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="min-h-[44px]"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        <Separator />

        {/* Backups */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Data Backups
            </CardTitle>
            <CardDescription>
              Backup all your data (jobs, suppliers, estimators, templates, settings). Backups are kept for 14 days.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={async () => {
                setBackingUp(true);
                try {
                  const res = await fetch("/api/backup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ label: "Manual backup " + new Date().toLocaleDateString("en-AU") }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error);
                  toast.success("Backup created: " + data.jobs + " jobs, " + data.suppliers + " suppliers (" + data.sizeKB + " KB)");
                  loadBackups();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Backup failed");
                } finally {
                  setBackingUp(false);
                }
              }}
              disabled={backingUp}
              className="min-h-[44px] bg-[#2D5E3A] hover:bg-[#2D5E3A]/90"
            >
              {backingUp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
              {backingUp ? "Backing up..." : "Create Backup Now"}
            </Button>

            {backups.length > 0 && (
              <div className="border rounded-lg divide-y">
                {backups.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <p className="font-medium">{b.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(b.created_at).toLocaleString("en-AU")} — {Math.round((b.size_estimate || 0) / 1024)} KB
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[36px]"
                        onClick={async () => {
                          const res = await fetch("/api/backup?id=" + b.id);
                          const data = await res.json();
                          const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "renify-backup-" + new Date(b.created_at).toISOString().split("T")[0] + ".json";
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="w-3 h-3 mr-1" /> Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[36px] text-destructive"
                        onClick={async () => {
                          if (!confirm("Delete this backup?")) return;
                          await fetch("/api/backup?id=" + b.id, { method: "DELETE" });
                          loadBackups();
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="pb-8" />
      </div>

      <FolderPicker
        open={folderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        onSelect={(path) => {
          setSettings((p) => ({ ...p, oneDriveRootPath: path }));
          setFolderPickerOpen(false);
        }}
        title="Change Jobs Folder"
      />
    </AuthLayout>
  );
}
