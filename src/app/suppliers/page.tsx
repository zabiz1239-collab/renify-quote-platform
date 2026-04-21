"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useRef } from "react";
import AuthLayout from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Plus, Pencil, Trash2, Upload, Truck, Search, Loader2, ChevronDown, Download, AlertCircle, Tags, X } from "lucide-react";
import { getSuppliers as fetchSuppliers, saveSupplier as saveSupplierToDb, deleteSupplier as deleteSupplierFromDb, saveSuppliersBulk, getSettings, saveSettings } from "@/lib/supabase";
import { TRADES } from "@/data/trades";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Supplier, SupplierCategory } from "@/types";
import { v4 as uuidv4 } from "uuid";
import Papa from "papaparse";
import { toast } from "sonner";

const DEFAULT_REGIONS = ["Western", "Northern", "South East", "Eastern", "Geelong", "Ballarat"];

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
const DEFAULT_GROUPED_TRADES = TRADE_CATEGORY_ORDER.map((cat) => ({
  ...cat,
  trades: QUOTABLE_TRADES.filter((t) => getTradeCategory(t.code) === cat.key),
})).filter((g) => g.trades.length > 0);

const STATUS_OPTIONS = [
  { value: "verified", label: "Verified", color: "bg-green-100 text-green-800" },
  { value: "unverified", label: "Unverified", color: "bg-yellow-100 text-yellow-800" },
  { value: "blacklisted", label: "Blacklisted", color: "bg-red-100 text-red-800" },
] as const;

const EMPTY_FORM = {
  company: "",
  contact: "",
  email: "",
  phone: "",
  abn: "",
  trades: [] as string[],
  regions: [] as string[],
  status: "unverified" as Supplier["status"],
  rating: 3,
  notes: "",
};

export default function SuppliersPage() {
  usePageTitle("Suppliers");
  useSession(); // auth status check
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState("");
  const [csvResult, setCsvResult] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [tradeSearch, setTradeSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scraper modal state
  const [scraperOpen, setScraperOpen] = useState(false);
  const [scraperTrade, setScraperTrade] = useState("");
  const [scraperRegion, setScraperRegion] = useState("");
  const [scraperResults, setScraperResults] = useState<{ company: string; phone: string; website: string; address: string }[]>([]);
  const [scraperLoading, setScraperLoading] = useState(false);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const [scraperRegions, setScraperRegions] = useState<string[]>(DEFAULT_REGIONS);
  const [scraperSaving, setScraperSaving] = useState(false);

  // Category management state
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [customCategories, setCustomCategories] = useState<SupplierCategory[]>([]);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatKeywords, setNewCatKeywords] = useState("");
  const [editingCatKey, setEditingCatKey] = useState<string | null>(null);
  const [editCatLabel, setEditCatLabel] = useState("");
  const [editCatKeywords, setEditCatKeywords] = useState("");

  // Custom trades state
  const [customTrades, setCustomTrades] = useState<{ code: string; name: string }[]>([]);
  const [newTradeCode, setNewTradeCode] = useState("");
  const [newTradeName, setNewTradeName] = useState("");

  // Dynamically include custom trades in grouped trades
  const GROUPED_TRADES = (() => {
    if (customTrades.length === 0) return DEFAULT_GROUPED_TRADES;
    const allQuotable = [...QUOTABLE_TRADES, ...customTrades.map((t) => ({ ...t, quotable: true as const }))];
    return TRADE_CATEGORY_ORDER.map((cat) => ({
      ...cat,
      trades: allQuotable.filter((t) => getTradeCategory(t.code) === cat.key),
    })).filter((g) => g.trades.length > 0);
  })();

  useEffect(() => {
    loadSuppliers();
    // Load regions, custom categories and custom trades from settings
    getSettings().then((s) => {
      if (s.regions && s.regions.length > 0) setScraperRegions(s.regions);
      if (s.supplierCategories) setCustomCategories(s.supplierCategories);
      if (s.customTrades) setCustomTrades(s.customTrades);
    }).catch(() => {});
  }, []);

  async function loadSuppliers() {
    try {
      const data = await fetchSuppliers();
      setSuppliers(data);
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setTouched(false);
    setTradeSearch("");
    setDialogOpen(true);
  }

  function openEdit(sup: Supplier) {
    setForm({
      company: sup.company,
      contact: sup.contact,
      email: sup.email,
      phone: sup.phone,
      abn: sup.abn || "",
      trades: [...sup.trades],
      regions: [...sup.regions],
      status: sup.status,
      rating: sup.rating,
      notes: sup.notes,
    });
    setEditingId(sup.id);
    setDialogOpen(true);
  }

  async function handleSave() {
    setTouched(true);
    if (!form.company || !form.email) return;
    if (form.trades.length === 0) {
      toast.error("Please select at least one trade so this supplier shows up when quoting");
      return;
    }
    setSaving(true);
    try {
      const sup: Supplier = editingId
        ? { ...suppliers.find((s) => s.id === editingId)!, ...form, abn: form.abn || undefined }
        : { id: uuidv4(), ...form, abn: form.abn || undefined };
      await saveSupplierToDb(sup);
      if (editingId) {
        setSuppliers((prev) => prev.map((s) => (s.id === editingId ? sup : s)));
      } else {
        setSuppliers((prev) => [...prev, sup]);
      }
      setDialogOpen(false);
      toast.success(editingId ? "Supplier updated" : "Supplier added");
    } catch (err) {
      console.error("Failed to save supplier:", err);
      toast.error("Failed to save supplier");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this supplier?")) return;
    try {
      await deleteSupplierFromDb(id);
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Failed to delete supplier:", err);
    }
  }

  function toggleTrade(code: string) {
    setForm((prev) => ({
      ...prev,
      trades: prev.trades.includes(code)
        ? prev.trades.filter((c) => c !== code)
        : [...prev.trades, code],
    }));
  }

  function toggleRegion(region: string) {
    setForm((prev) => ({
      ...prev,
      regions: prev.regions.includes(region)
        ? prev.regions.filter((r) => r !== region)
        : [...prev.regions, region],
    }));
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[];
        let skipped = 0;

        // Group rows by email — merge trades and regions for same supplier
        const supplierMap: Record<string, {
          company: string;
          contact: string;
          email: string;
          phone: string;
          trades: string[];
          regions: string[];
        }> = {};

        for (const row of rows) {
          const email = (row.email || "").trim().toLowerCase();
          if (!email) { skipped++; continue; }

          const tradeName = (row.trade || "").trim().toUpperCase();
          const tradeMatch = TRADES.find(
            (t) => t.name === tradeName || t.code === tradeName
          );
          const region = (row.region || "").trim();

          const existing = supplierMap[email];
          if (existing) {
            if (tradeMatch && !existing.trades.includes(tradeMatch.code)) existing.trades.push(tradeMatch.code);
            if (region && !existing.regions.includes(region)) existing.regions.push(region);
          } else {
            supplierMap[email] = {
              company: (row.company || "").trim(),
              contact: (row.contact || "").trim(),
              email,
              phone: (row.phone || "").trim(),
              trades: tradeMatch ? [tradeMatch.code] : [],
              regions: region ? [region] : [],
            };
          }
        }

        // Split into new suppliers vs existing ones that need trade/region updates
        const toCreate: Supplier[] = [];
        const toUpdate: Supplier[] = [];

        Object.entries(supplierMap).forEach(([email, data]) => {
          const existingSupplier = suppliers.find((s) => s.email.toLowerCase() === email);
          if (existingSupplier) {
            // Merge new trades and regions into existing supplier
            const mergedTrades = existingSupplier.trades.slice();
            data.trades.forEach((t) => { if (!mergedTrades.includes(t)) mergedTrades.push(t); });
            const mergedRegions = existingSupplier.regions.slice();
            data.regions.forEach((r) => { if (!mergedRegions.includes(r)) mergedRegions.push(r); });
            if (mergedTrades.length > existingSupplier.trades.length || mergedRegions.length > existingSupplier.regions.length) {
              toUpdate.push({
                ...existingSupplier,
                trades: mergedTrades,
                regions: mergedRegions,
              });
            }
          } else {
            toCreate.push({
              id: uuidv4(),
              company: data.company,
              contact: data.contact,
              email: data.email,
              phone: data.phone,
              trades: Array.from(data.trades),
              regions: Array.from(data.regions),
              status: "unverified",
              rating: 3,
              notes: "",
            });
          }
        });

        // Save new suppliers
        if (toCreate.length > 0) {
          await saveSuppliersBulk(toCreate);
        }
        // Update existing suppliers with merged trades/regions
        for (const sup of toUpdate) {
          await saveSupplierToDb(sup);
        }

        // Refresh list
        if (toCreate.length > 0 || toUpdate.length > 0) {
          const refreshed = await fetchSuppliers();
          setSuppliers(refreshed);
        }

        const parts: string[] = [];
        if (toCreate.length > 0) parts.push(`${toCreate.length} new suppliers added`);
        if (toUpdate.length > 0) parts.push(`${toUpdate.length} existing suppliers updated with new trades`);
        if (skipped > 0) parts.push(`${skipped} rows skipped (no email)`);
        setCsvResult(parts.join(", ") + ".");
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });
  }

  async function handleScraperSearch() {
    if (!scraperTrade || !scraperRegion) return;
    setScraperLoading(true);
    setScraperResults([]);
    setSelectedResults(new Set());
    try {
      // Check if it's a custom category (starts with "custom_")
      let tradeName: string;
      let searchKeywords: string | undefined;
      if (scraperTrade.startsWith("custom_")) {
        const catKey = scraperTrade.replace("custom_", "");
        const cat = customCategories.find((c) => c.key === catKey);
        tradeName = cat?.label || catKey;
        searchKeywords = cat?.keywords.join(" ") || tradeName;
      } else {
        tradeName = TRADES.find((t) => t.code === scraperTrade)?.name || scraperTrade;
      }
      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trade: searchKeywords || tradeName,
          region: scraperRegion,
          preview: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setScraperResults(data.results || []);
    } catch (err) {
      console.error("Scraper search failed:", err);
    } finally {
      setScraperLoading(false);
    }
  }

  function toggleScraperResult(index: number) {
    setSelectedResults((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleAddSelected() {
    if (selectedResults.size === 0) return;
    setScraperSaving(true);
    try {
      const newSuppliers: Supplier[] = [];
      for (const idx of Array.from(selectedResults)) {
        const r = scraperResults[idx];
        if (!r) continue;
        newSuppliers.push({
          id: uuidv4(),
          company: r.company,
          contact: "",
          email: "",
          phone: r.phone,
          trades: scraperTrade ? [scraperTrade] : [],
          regions: scraperRegion ? [scraperRegion] : [],
          status: "unverified",
          rating: 3,
          notes: r.website ? `Website: ${r.website}` : "",
        });
      }
      await saveSuppliersBulk(newSuppliers);
      setSuppliers((prev) => [...prev, ...newSuppliers]);
      setScraperOpen(false);
      setScraperResults([]);
      setSelectedResults(new Set());
    } catch (err) {
      console.error("Failed to add suppliers:", err);
    } finally {
      setScraperSaving(false);
    }
  }

  // Category management functions
  async function handleAddCategory() {
    if (!newCatLabel.trim()) return;
    const key = newCatLabel.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const keywords = newCatKeywords.split(",").map((k) => k.trim()).filter(Boolean);
    const newCat: SupplierCategory = { key, label: newCatLabel.trim(), keywords };
    const updated = [...customCategories, newCat];
    setCustomCategories(updated);
    setNewCatLabel("");
    setNewCatKeywords("");
    // Save to settings
    const settings = await getSettings();
    await saveSettings({ ...settings, supplierCategories: updated });
    toast.success(`Category "${newCat.label}" added`);
  }

  async function handleUpdateCategory() {
    if (!editingCatKey || !editCatLabel.trim()) return;
    const keywords = editCatKeywords.split(",").map((k) => k.trim()).filter(Boolean);
    const updated = customCategories.map((c) =>
      c.key === editingCatKey ? { ...c, label: editCatLabel.trim(), keywords } : c
    );
    setCustomCategories(updated);
    setEditingCatKey(null);
    const settings = await getSettings();
    await saveSettings({ ...settings, supplierCategories: updated });
    toast.success("Category updated");
  }

  async function handleDeleteCategory(key: string) {
    const updated = customCategories.filter((c) => c.key !== key);
    setCustomCategories(updated);
    const settings = await getSettings();
    await saveSettings({ ...settings, supplierCategories: updated });
    toast.success("Category removed");
  }

  // Custom trade functions
  async function handleAddTrade() {
    const code = newTradeCode.trim();
    const name = newTradeName.trim().toUpperCase();
    if (!code || !name) return;
    // Check for duplicate code
    if (TRADES.some((t) => t.code === code) || customTrades.some((t) => t.code === code)) {
      toast.error(`Trade code ${code} already exists`);
      return;
    }
    const updated = [...customTrades, { code, name }];
    setCustomTrades(updated);
    setNewTradeCode("");
    setNewTradeName("");
    const settings = await getSettings();
    await saveSettings({ ...settings, customTrades: updated });
    toast.success(`Trade "${code} ${name}" added`);
  }

  async function handleDeleteTrade(code: string) {
    const updated = customTrades.filter((t) => t.code !== code);
    setCustomTrades(updated);
    const settings = await getSettings();
    await saveSettings({ ...settings, customTrades: updated });
    toast.success("Trade removed");
  }

  // Export dialog state
  const [exportOpen, setExportOpen] = useState(false);

  function downloadCsv(rows: Supplier[], filename: string) {
    const header = "company,contact,email,phone,abn,trades,regions,status,rating,notes";
    const csvRows = rows.map((s) => {
      const escape = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
      const tradeNames = s.trades
        .map((code) => TRADES.find((t) => t.code === code)?.name || code)
        .join("; ");
      return [
        escape(s.company),
        escape(s.contact),
        escape(s.email),
        escape(s.phone),
        escape(s.abn || ""),
        escape(tradeNames),
        escape(s.regions.join("; ")),
        escape(s.status),
        String(s.rating),
        escape(s.notes),
      ].join(",");
    });
    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportAll() {
    if (suppliers.length === 0) { toast.error("No suppliers to export"); return; }
    downloadCsv(suppliers, "suppliers_all.csv");
    toast.success(`Exported ${suppliers.length} suppliers`);
    setExportOpen(false);
  }

  function exportByCategory(categoryKey: string, categoryLabel: string) {
    const group = GROUPED_TRADES.find((g) => g.key === categoryKey);
    if (!group) return;
    const tradeCodes: string[] = group.trades.map((t) => t.code);
    const matching = suppliers.filter((s) => s.trades.some((t) => tradeCodes.includes(t)));
    if (matching.length === 0) { toast.error(`No suppliers in ${categoryLabel}`); return; }
    downloadCsv(matching, `suppliers_${categoryKey}.csv`);
    toast.success(`Exported ${matching.length} suppliers (${categoryLabel})`);
    setExportOpen(false);
  }

  const filtered = suppliers.filter(
    (s) =>
      s.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Split into missing email vs has email
  const needsEmail = filtered.filter((s) => !s.email || s.email.trim() === "");
  const hasEmail = filtered.filter((s) => s.email && s.email.trim() !== "");

  // Quick trade reassignment — move supplier to a different category
  async function handleQuickCategoryChange(supplier: Supplier, newCategoryKey: string) {
    // Check built-in categories first
    const group = GROUPED_TRADES.find((g) => g.key === newCategoryKey);
    if (group) {
      const newTradeCodes = group.trades.map((t) => t.code);
      const updated = { ...supplier, trades: newTradeCodes };
      try {
        await saveSupplierToDb(updated);
        setSuppliers((prev) => prev.map((s) => (s.id === supplier.id ? updated : s)));
        toast.success(`${supplier.company} moved to ${group.label}`);
      } catch {
        toast.error("Failed to update supplier");
      }
      return;
    }
    // Custom category — store the category key as a special trade code
    const customCat = customCategories.find((c) => c.key === newCategoryKey);
    if (customCat) {
      // For custom categories, keep existing trades but add a tag prefix
      const updated = { ...supplier, trades: [`cat_${customCat.key}`] };
      try {
        await saveSupplierToDb(updated);
        setSuppliers((prev) => prev.map((s) => (s.id === supplier.id ? updated : s)));
        toast.success(`${supplier.company} moved to ${customCat.label}`);
      } catch {
        toast.error("Failed to update supplier");
      }
    }
  }

  // Get the primary category for a supplier (based on majority of their trades)
  function getSupplierCategory(sup: Supplier): string {
    if (sup.trades.length === 0) return "";
    // Check for custom category tag
    const customTag = sup.trades.find((t) => t.startsWith("cat_"));
    if (customTag) return customTag.replace("cat_", "");
    const counts: Record<string, number> = {};
    for (const code of sup.trades) {
      const cat = getTradeCategory(code);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  const statusColor = (status: Supplier["status"]) =>
    STATUS_OPTIONS.find((o) => o.value === status)?.color || "";

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setExportOpen(true)} variant="outline" className="min-h-[44px]">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <label className="cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
              />
              <Button variant="outline" className="min-h-[44px]" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Import CSV
                </span>
              </Button>
            </label>
            <Button onClick={() => setCategoryOpen(true)} variant="outline" className="min-h-[44px]">
              <Tags className="w-4 h-4 mr-2" />
              Categories
            </Button>
            <Button onClick={() => { setScraperOpen(true); setScraperResults([]); setSelectedResults(new Set()); }} variant="outline" className="min-h-[44px]">
              <Search className="w-4 h-4 mr-2" />
              Find Local Trades
            </Button>
            <Button onClick={openCreate} className="min-h-[44px]">
              <Plus className="w-4 h-4 mr-2" />
              Add Supplier
            </Button>
            {/* Scraper Modal */}
            <Dialog open={scraperOpen} onOpenChange={setScraperOpen}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Find Local Trades</DialogTitle>
                  <DialogDescription>
                    Search Google Places for local suppliers by trade and region.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Trade</Label>
                      <Select value={scraperTrade} onValueChange={setScraperTrade}>
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue placeholder="Select trade" />
                        </SelectTrigger>
                        <SelectContent>
                          {customCategories.length > 0 && (
                            <>
                              {customCategories.map((cat) => (
                                <SelectItem key={`custom_${cat.key}`} value={`custom_${cat.key}`}>
                                  {cat.label} {cat.keywords.length > 0 && <span className="text-muted-foreground">({cat.keywords.length} keywords)</span>}
                                </SelectItem>
                              ))}
                              <div className="border-t my-1" />
                            </>
                          )}
                          {TRADES.filter((t) => t.quotable).map((t) => (
                            <SelectItem key={t.code} value={t.code}>
                              {t.code} {t.name}
                            </SelectItem>
                          ))}
                          {customTrades.length > 0 && (
                            <>
                              <div className="border-t my-1" />
                              {customTrades.map((t) => (
                                <SelectItem key={t.code} value={t.code}>
                                  {t.code} {t.name}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Region</Label>
                      <Select value={scraperRegion} onValueChange={setScraperRegion}>
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue placeholder="Select region" />
                        </SelectTrigger>
                        <SelectContent>
                          {scraperRegions.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    onClick={handleScraperSearch}
                    disabled={!scraperTrade || !scraperRegion || scraperLoading}
                    className="w-full min-h-[44px]"
                  >
                    {scraperLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching...</>
                    ) : (
                      <><Search className="w-4 h-4 mr-2" /> Search</>
                    )}
                  </Button>
                  {scraperResults.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{scraperResults.length} results found</p>
                      <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                        {scraperResults.map((r, i) => (
                          <label key={i} className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer min-h-[44px]">
                            <input
                              type="checkbox"
                              checked={selectedResults.has(i)}
                              onChange={() => toggleScraperResult(i)}
                              className="w-4 h-4"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{r.company}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {r.phone && <span>{r.phone}</span>}
                                {r.phone && r.website && <span> &middot; </span>}
                                {r.website && <span>{r.website}</span>}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={handleAddSelected}
                          disabled={selectedResults.size === 0 || scraperSaving}
                          className="flex-1 min-h-[44px]"
                        >
                          {scraperSaving ? "Adding..." : `Add Selected (${selectedResults.size})`}
                        </Button>
                        <Button variant="outline" onClick={() => setScraperOpen(false)} className="min-h-[44px]">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? "Edit Supplier" : "Add Supplier"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingId ? "Update supplier details." : "Add a new supplier to your database."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {/* Company + Email first — required fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Company *</Label>
                      <Input
                        value={form.company}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, company: e.target.value }))
                        }
                        className={`min-h-[44px] ${touched && !form.company ? "border-red-500" : ""}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, email: e.target.value }))
                        }
                        className={`min-h-[44px] ${touched && !form.email ? "border-red-500" : ""}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contact Person *</Label>
                      <Input
                        value={form.contact}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, contact: e.target.value }))
                        }
                        placeholder="Name for email greeting"
                        className={`min-h-[44px] ${touched && !form.contact ? "border-red-500" : ""}`}
                      />
                      {touched && !form.contact && <p className="text-xs text-red-500">Contact name is used in email greetings</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={form.phone}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, phone: e.target.value }))
                        }
                        className="min-h-[44px]"
                      />
                    </div>
                  </div>

                  {/* TRADES — grouped by category */}
                  <div className={`space-y-2 p-3 rounded-lg border-2 ${touched && form.trades.length === 0 ? "border-red-500 bg-red-50" : "border-[#2D5E3A]/30 bg-[#2D5E3A]/5"}`}>
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">
                        Trades * <span className="text-sm font-normal text-muted-foreground">({form.trades.length} selected)</span>
                      </Label>
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="sm" className="text-xs h-7 px-2"
                          onClick={() => setForm((p) => ({ ...p, trades: QUOTABLE_TRADES.map((t) => t.code) }))}>
                          All
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="text-xs h-7 px-2"
                          onClick={() => setForm((p) => ({ ...p, trades: [] }))}>
                          None
                        </Button>
                      </div>
                    </div>
                    {touched && form.trades.length === 0 && <p className="text-sm text-red-600 font-medium">You must select at least one trade or this supplier will not appear when quoting</p>}
                    <Input
                      placeholder="Search trades..."
                      value={tradeSearch}
                      onChange={(e) => setTradeSearch(e.target.value)}
                      className="min-h-[44px]"
                    />
                    <div className="max-h-64 overflow-y-auto border rounded-lg">
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
                          const allGroupSelected = groupCodes.every((c) => form.trades.includes(c));
                          const someGroupSelected = groupCodes.some((c) => form.trades.includes(c));

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
                                      setForm((p) => ({ ...p, trades: p.trades.filter((c) => !groupCodes.includes(c)) }));
                                    } else {
                                      setForm((p) => ({ ...p, trades: Array.from(new Set([...p.trades, ...groupCodes])) }));
                                    }
                                  }}
                                  className="w-4 h-4"
                                />
                                <span className="text-sm font-medium flex-1">{group.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {groupCodes.filter((c) => form.trades.includes(c)).length}/{groupCodes.length}
                                </span>
                              </div>
                              {!isCollapsed && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                                  {group.trades.map((trade) => (
                                    <label
                                      key={trade.code}
                                      className={`flex items-center gap-2 px-3 py-2 pl-10 cursor-pointer text-sm min-h-[44px] ${
                                        form.trades.includes(trade.code) ? "bg-[#2D5E3A]/10 font-medium" : "hover:bg-muted"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={form.trades.includes(trade.code)}
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
                      {tradeSearch && GROUPED_TRADES.every((g) =>
                        g.trades.every((t) =>
                          !t.name.toLowerCase().includes(tradeSearch.toLowerCase()) && !t.code.includes(tradeSearch)
                        )
                      ) && (
                        <p className="text-sm text-muted-foreground text-center py-4">No trades match your search.</p>
                      )}
                    </div>
                  </div>

                  {/* Regions */}
                  <div className="space-y-2">
                    <Label>Regions</Label>
                    <div className="flex flex-wrap gap-2">
                      {DEFAULT_REGIONS.map((region) => (
                        <label
                          key={region}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted cursor-pointer min-h-[44px]"
                        >
                          <input
                            type="checkbox"
                            checked={form.regions.includes(region)}
                            onChange={() => toggleRegion(region)}
                            className="w-4 h-4"
                          />
                          {region}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Status + ABN + Rating — less important, at bottom */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={form.status}
                        onValueChange={(v) =>
                          setForm((p) => ({
                            ...p,
                            status: v as Supplier["status"],
                          }))
                        }
                      >
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>ABN</Label>
                      <Input
                        value={form.abn}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, abn: e.target.value }))
                        }
                        className="min-h-[44px]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={form.notes}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, notes: e.target.value }))
                      }
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-4 pt-2">
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="min-h-[44px] flex-1"
                    >
                      {saving ? "Saving..." : editingId ? "Update" : "Add"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      className="min-h-[44px]"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {/* Categories Dialog */}
            <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Manage Categories</DialogTitle>
                  <DialogDescription>
                    Add custom categories with search keywords. When you use &quot;Find Local Trades&quot;, these keywords tell Google what to look for.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {/* Existing custom categories */}
                  {customCategories.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Your Categories</Label>
                      <div className="border rounded-lg divide-y">
                        {customCategories.map((cat) => (
                          <div key={cat.key} className="p-3">
                            {editingCatKey === cat.key ? (
                              <div className="space-y-2">
                                <Input
                                  value={editCatLabel}
                                  onChange={(e) => setEditCatLabel(e.target.value)}
                                  placeholder="Category name"
                                  className="min-h-[44px]"
                                />
                                <Input
                                  value={editCatKeywords}
                                  onChange={(e) => setEditCatKeywords(e.target.value)}
                                  placeholder="Keywords (comma separated)"
                                  className="min-h-[44px]"
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={handleUpdateCategory} className="min-h-[44px]">Save</Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingCatKey(null)} className="min-h-[44px]">Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium">{cat.label}</p>
                                  {cat.keywords.length > 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Keywords: {cat.keywords.join(", ")}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="min-h-[44px] px-3"
                                    onClick={() => {
                                      setEditingCatKey(cat.key);
                                      setEditCatLabel(cat.label);
                                      setEditCatKeywords(cat.keywords.join(", "));
                                    }}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="min-h-[44px] px-3"
                                    onClick={() => handleDeleteCategory(cat.key)}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add new category */}
                  <div className="space-y-3 border-t pt-4">
                    <Label className="text-sm font-medium">Add New Category</Label>
                    <Input
                      value={newCatLabel}
                      onChange={(e) => setNewCatLabel(e.target.value)}
                      placeholder="Category name (e.g. Demolition)"
                      className="min-h-[44px]"
                    />
                    <div className="space-y-1">
                      <Input
                        value={newCatKeywords}
                        onChange={(e) => setNewCatKeywords(e.target.value)}
                        placeholder="Search keywords, comma separated"
                        className="min-h-[44px]"
                      />
                      <p className="text-xs text-muted-foreground">
                        These keywords are used when searching Google Places. E.g. for &quot;Framers&quot; you might use: timber framing contractor, house framing, wall frame installer
                      </p>
                    </div>
                    <Button
                      onClick={handleAddCategory}
                      disabled={!newCatLabel.trim()}
                      className="w-full min-h-[44px]"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Category
                    </Button>
                  </div>

                  {/* Custom Trades */}
                  <div className="space-y-3 border-t pt-4">
                    <Label className="text-base font-semibold">Custom Trades</Label>
                    <p className="text-xs text-muted-foreground">
                      Add new trade listings that appear in the trade selector when assigning suppliers or creating jobs. Use a 3-digit code that doesn&apos;t clash with existing Databuild codes.
                    </p>

                    {/* Existing custom trades */}
                    {customTrades.length > 0 && (
                      <div className="border rounded-lg divide-y">
                        {customTrades.map((t) => (
                          <div key={t.code} className="flex items-center justify-between p-3">
                            <div>
                              <span className="text-sm font-mono text-muted-foreground mr-2">{t.code}</span>
                              <span className="text-sm font-medium">{t.name}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="min-h-[44px] px-3"
                              onClick={() => handleDeleteTrade(t.code)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new trade */}
                    <div className="grid grid-cols-[80px_1fr] gap-2">
                      <div>
                        <Input
                          value={newTradeCode}
                          onChange={(e) => setNewTradeCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                          placeholder="Code"
                          className="min-h-[44px] font-mono text-center"
                          maxLength={3}
                        />
                      </div>
                      <div>
                        <Input
                          value={newTradeName}
                          onChange={(e) => setNewTradeName(e.target.value)}
                          placeholder="Trade name (e.g. DEMOLITION)"
                          className="min-h-[44px]"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleAddTrade}
                      disabled={!newTradeCode.trim() || !newTradeName.trim()}
                      className="w-full min-h-[44px]"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Trade
                    </Button>
                  </div>

                  {/* Built-in categories reference */}
                  <div className="space-y-2 border-t pt-4">
                    <Label className="text-xs text-muted-foreground">Built-in categories (always available)</Label>
                    <div className="flex flex-wrap gap-1">
                      {TRADE_CATEGORY_ORDER.map((cat) => (
                        <Badge key={cat.key} variant="secondary" className="text-xs">{cat.label}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {/* Export CSV Dialog */}
            <Dialog open={exportOpen} onOpenChange={setExportOpen}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Export Suppliers</DialogTitle>
                  <DialogDescription>Download as CSV — all suppliers or filtered by category.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 pt-4">
                  <Button onClick={exportAll} variant="default" className="w-full min-h-[44px] bg-[#2D5E3A] hover:bg-[#2D5E3A]/90">
                    <Download className="w-4 h-4 mr-2" />
                    Export All ({suppliers.length})
                  </Button>
                  <p className="text-xs text-muted-foreground pt-2 pb-1">Or export by category:</p>
                  {TRADE_CATEGORY_ORDER.map((cat) => {
                    const tradeCodes: string[] = GROUPED_TRADES.find((g) => g.key === cat.key)?.trades.map((t) => t.code) || [];
                    const count = suppliers.filter((s) => s.trades.some((t) => tradeCodes.includes(t))).length;
                    return (
                      <Button
                        key={cat.key}
                        onClick={() => exportByCategory(cat.key, cat.label)}
                        variant="outline"
                        className="w-full min-h-[44px] justify-between"
                        disabled={count === 0}
                      >
                        <span>{cat.label}</span>
                        <Badge variant="secondary" className="text-xs">{count}</Badge>
                      </Button>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {csvResult && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            {csvResult}
            <button
              onClick={() => setCsvResult(null)}
              className="ml-4 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex gap-4">
          <Input
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm min-h-[44px]"
          />
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading suppliers...</p>
        ) : suppliers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Truck className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No suppliers yet</h3>
              <p className="text-muted-foreground mt-1">
                Add suppliers manually or import from CSV.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
          {/* Needs Email Update — shown at top */}
          {needsEmail.length > 0 && (
            <Card className="border-amber-300 bg-amber-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                  <AlertCircle className="w-5 h-5" />
                  Needs Email Update ({needsEmail.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead className="hidden md:table-cell">Phone</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="w-[180px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {needsEmail.map((sup) => (
                      <TableRow key={sup.id} className="bg-amber-50/30">
                        <TableCell>
                          <div>
                            <p className="font-medium">{sup.company}</p>
                            {sup.contact && <p className="text-xs text-muted-foreground">{sup.contact}</p>}
                            {sup.notes && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{sup.notes}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {sup.phone || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={getSupplierCategory(sup)}
                            onValueChange={(val) => handleQuickCategoryChange(sup, val)}
                          >
                            <SelectTrigger className="min-h-[44px] w-[140px]">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              {TRADE_CATEGORY_ORDER.map((cat) => (
                                <SelectItem key={cat.key} value={cat.key}>{cat.label}</SelectItem>
                              ))}
                              {customCategories.length > 0 && <div className="border-t my-1" />}
                              {customCategories.map((cat) => (
                                <SelectItem key={cat.key} value={cat.key}>{cat.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(sup)}
                            className="min-h-[44px] px-3"
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                Suppliers ({hasEmail.length}
                {searchTerm ? ` of ${suppliers.length}` : ""})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[180px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hasEmail.map((sup) => (
                    <TableRow key={sup.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sup.company}</p>
                          <p className="text-xs text-muted-foreground md:hidden">
                            {sup.contact && <span>{sup.contact} &middot; </span>}
                            {sup.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {sup.contact}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {sup.email}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={getSupplierCategory(sup)}
                          onValueChange={(val) => handleQuickCategoryChange(sup, val)}
                        >
                          <SelectTrigger className="min-h-[44px] w-[140px]">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {TRADE_CATEGORY_ORDER.map((cat) => (
                              <SelectItem key={cat.key} value={cat.key}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColor(sup.status)}>
                          {sup.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(sup)}
                            className="min-h-[44px] px-3"
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(sup.id)}
                            className="min-h-[44px] px-3"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
