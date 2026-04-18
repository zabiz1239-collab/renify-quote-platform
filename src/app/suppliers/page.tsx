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
import { Plus, Pencil, Trash2, Upload, Truck, Star, Search, Loader2 } from "lucide-react";
import { getSuppliers as fetchSuppliers, saveSupplier as saveSupplierToDb, deleteSupplier as deleteSupplierFromDb, saveSuppliersBulk, getSettings } from "@/lib/supabase";
import { TRADES } from "@/data/trades";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Supplier } from "@/types";
import { v4 as uuidv4 } from "uuid";
import Papa from "papaparse";

const DEFAULT_REGIONS = ["Western", "Northern", "South East", "Eastern", "Geelong", "Ballarat"];

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

  useEffect(() => {
    loadSuppliers();
    // Load regions from settings
    getSettings().then((s) => {
      if (s.regions && s.regions.length > 0) setScraperRegions(s.regions);
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
    setSaving(true);
    try {
      const sup: Supplier = editingId
        ? { ...suppliers.find((s) => s.id === editingId)!, ...form, abn: form.abn || undefined }
        : { id: uuidv4(), ...form, abn: form.abn || undefined };
      console.log("[Supplier Save]", { trades: sup.trades, regions: sup.regions, company: sup.company });
      await saveSupplierToDb(sup);
      if (editingId) {
        setSuppliers((prev) => prev.map((s) => (s.id === editingId ? sup : s)));
      } else {
        setSuppliers((prev) => [...prev, sup]);
      }
      setDialogOpen(false);
    } catch (err) {
      console.error("Failed to save supplier:", err);
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
      const tradeName = TRADES.find((t) => t.code === scraperTrade)?.name || scraperTrade;
      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade: tradeName, region: scraperRegion, preview: true }),
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

  const filtered = suppliers.filter(
    (s) =>
      s.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColor = (status: Supplier["status"]) =>
    STATUS_OPTIONS.find((o) => o.value === status)?.color || "";

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <div className="flex gap-2">
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
                          {TRADES.filter((t) => t.quotable).map((t) => (
                            <SelectItem key={t.code} value={t.code}>
                              {t.code} {t.name}
                            </SelectItem>
                          ))}
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
                      {touched && !form.company && <p className="text-xs text-red-500">This field is required.</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Person</Label>
                      <Input
                        value={form.contact}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, contact: e.target.value }))
                        }
                        className="min-h-[44px]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      {touched && !form.email && <p className="text-xs text-red-500">This field is required.</p>}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Rating: {form.rating}/5
                    </Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, rating: n }))}
                          className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              n <= form.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Trades</Label>
                    <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto border rounded-lg p-2">
                      {TRADES.filter((t) => t.quotable).map((trade) => (
                        <label
                          key={trade.code}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm min-h-[36px]"
                        >
                          <input
                            type="checkbox"
                            checked={form.trades.includes(trade.code)}
                            onChange={() => toggleTrade(trade.code)}
                            className="w-4 h-4"
                          />
                          <span className="text-muted-foreground text-xs">
                            {trade.code}
                          </span>{" "}
                          {trade.name}
                        </label>
                      ))}
                    </div>
                  </div>
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
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={form.notes}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, notes: e.target.value }))
                      }
                      rows={3}
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
          <Card>
            <CardHeader>
              <CardTitle>
                Suppliers ({filtered.length}
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
                    <TableHead className="hidden lg:table-cell">Trades</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[180px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((sup) => (
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
                      <TableCell className="hidden lg:table-cell">
                        <button
                          onClick={() => openEdit(sup)}
                          className="flex flex-wrap gap-1 hover:opacity-70 transition-opacity"
                          title="Click to edit trades"
                        >
                          {sup.trades.length === 0 ? (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              + Add trades
                            </Badge>
                          ) : (
                            <>
                              {sup.trades.slice(0, 3).map((code) => {
                                const trade = TRADES.find((t) => t.code === code);
                                return (
                                  <Badge key={code} variant="secondary" className="text-xs" title={code}>
                                    {trade?.name || code}
                                  </Badge>
                                );
                              })}
                              {sup.trades.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{sup.trades.length - 3}
                                </Badge>
                              )}
                            </>
                          )}
                        </button>
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
        )}
      </div>
    </AuthLayout>
  );
}
