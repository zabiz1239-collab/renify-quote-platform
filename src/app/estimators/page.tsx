"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import AuthLayout from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { getEstimators, saveEstimator as saveEstimatorToDb, deleteEstimator as deleteEstimatorFromDb } from "@/lib/supabase";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Estimator } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  signature: "",
  microsoftAccount: "",
};

export default function EstimatorsPage() {
  usePageTitle("Estimators");
  useSession();
  const [estimators, setEstimators] = useState<Estimator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    loadEstimators();
  }, []);

  async function loadEstimators() {
    try {
      const data = await getEstimators();
      setEstimators(data);
    } catch {
      setEstimators([]);
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

  function openEdit(est: Estimator) {
    setForm({
      name: est.name,
      email: est.email,
      phone: est.phone,
      signature: est.signature,
      microsoftAccount: est.microsoftAccount,
    });
    setEditingId(est.id);
    setTouched(false);
    setDialogOpen(true);
  }

  async function handleSave() {
    setTouched(true);
    if (!form.name || !form.email) return;
    setSaving(true);
    try {
      const est: Estimator = {
        id: editingId || uuidv4(),
        ...form,
      };
      await saveEstimatorToDb(est);
      if (editingId) {
        setEstimators((prev) => prev.map((e) => (e.id === editingId ? est : e)));
      } else {
        setEstimators((prev) => [...prev, est]);
      }
      setDialogOpen(false);
      toast.success(editingId ? "Estimator updated" : "Estimator added");
    } catch (err) {
      console.error("Failed to save estimator:", err);
      toast.error("Failed to save estimator");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this estimator?")) return;
    try {
      await deleteEstimatorFromDb(id);
      setEstimators((prev) => prev.filter((e) => e.id !== id));
      toast.success("Estimator deleted");
    } catch {
      toast.error("Failed to delete estimator");
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Estimators</h1>
          <Button onClick={openCreate} className="min-h-[44px]">
            <Plus className="w-4 h-4 mr-2" />
            Add Estimator
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading estimators...</p>
        ) : estimators.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No estimators yet</h3>
              <p className="text-muted-foreground mt-1">Add your first estimator to assign them to jobs.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>Estimators ({estimators.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead className="hidden lg:table-cell">Microsoft Account</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estimators.map((est) => (
                    <TableRow key={est.id}>
                      <TableCell className="font-medium">{est.name}</TableCell>
                      <TableCell>{est.email}</TableCell>
                      <TableCell className="hidden md:table-cell">{est.phone}</TableCell>
                      <TableCell className="hidden lg:table-cell">{est.microsoftAccount}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(est)}
                            className="p-2 hover:bg-muted rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(est.id)}
                            className="p-2 hover:bg-muted rounded text-destructive min-w-[44px] min-h-[44px] flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Edit/Create Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Estimator" : "Add Estimator"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Update estimator details." : "Add a new estimator to assign to jobs."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className={`min-h-[44px] ${touched && !form.name ? "border-red-500" : ""}`}
                />
                {touched && !form.name && <p className="text-xs text-red-500">Required</p>}
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className={`min-h-[44px] ${touched && !form.email ? "border-red-500" : ""}`}
                />
                {touched && !form.email && <p className="text-xs text-red-500">Required</p>}
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label>Microsoft Account</Label>
                <Input
                  value={form.microsoftAccount}
                  onChange={(e) => setForm((p) => ({ ...p, microsoftAccount: e.target.value }))}
                  className="min-h-[44px]"
                  placeholder="user@outlook.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Signature Block</Label>
                <Textarea
                  value={form.signature}
                  onChange={(e) => setForm((p) => ({ ...p, signature: e.target.value }))}
                  rows={4}
                  placeholder="Name&#10;Company&#10;Phone"
                />
              </div>
              <div className="flex gap-4 pt-2">
                <Button onClick={handleSave} disabled={saving} className="min-h-[44px] flex-1">
                  {saving ? "Saving..." : editingId ? "Update" : "Add"}
                </Button>
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="min-h-[44px]">
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
