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
  DialogTrigger,
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
import { getEstimators as fetchEstimators, saveEstimator as saveEstimatorToDb, deleteEstimator as deleteEstimatorFromDb } from "@/lib/supabase";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Estimator } from "@/types";
import { v4 as uuidv4 } from "uuid";

const EMPTY_FORM: Omit<Estimator, "id"> = {
  name: "",
  email: "",
  phone: "",
  signature: "",
  microsoftAccount: "",
};

export default function EstimatorsPage() {
  usePageTitle("Estimators");
  useSession(); // auth status check
  const [estimators, setEstimators] = useState<Estimator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    loadEstimators();
  }, []);

  async function loadEstimators() {
    try {
      const data = await fetchEstimators();
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
    setValidationError("");
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
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.email) {
      setValidationError("Name and Email are required.");
      return;
    }
    setValidationError("");
    setSaving(true);
    try {
      const est: Estimator = editingId
        ? { id: editingId, ...form }
        : { id: uuidv4(), ...form };
      await saveEstimatorToDb(est);
      if (editingId) {
        setEstimators((prev) => prev.map((e) => (e.id === editingId ? est : e)));
      } else {
        setEstimators((prev) => [...prev, est]);
      }
      setDialogOpen(false);
    } catch (err) {
      console.error("Failed to save estimator:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this estimator?")) return;
    try {
      await deleteEstimatorFromDb(id);
      setEstimators((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Failed to delete estimator:", err);
    }
  }

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Estimators</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="min-h-[44px]">
                <Plus className="w-4 h-4 mr-2" />
                Add Estimator
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Edit Estimator" : "Add Estimator"}
                </DialogTitle>
                <DialogDescription>
                  {editingId ? "Update estimator details." : "Add a new team member to assign jobs."}
                </DialogDescription>
              </DialogHeader>
              {validationError && (
                <p className="text-sm text-destructive">{validationError}</p>
              )}
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="microsoftAccount">Microsoft Account</Label>
                  <Input
                    id="microsoftAccount"
                    placeholder="user@domain.com"
                    value={form.microsoftAccount}
                    onChange={(e) => updateField("microsoftAccount", e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signature">Email Signature</Label>
                  <Textarea
                    id="signature"
                    rows={4}
                    placeholder="Plain text or HTML signature block"
                    value={form.signature}
                    onChange={(e) => updateField("signature", e.target.value)}
                  />
                </div>
                <div className="flex gap-4 pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving || !form.name || !form.email}
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

        {loading ? (
          <p className="text-muted-foreground">Loading estimators...</p>
        ) : estimators.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No estimators yet</h3>
              <p className="text-muted-foreground mt-1">
                Add your team members to assign jobs.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Team ({estimators.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead className="hidden lg:table-cell">Microsoft</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estimators.map((est) => (
                    <TableRow key={est.id}>
                      <TableCell className="font-medium">{est.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{est.email}</TableCell>
                      <TableCell className="hidden md:table-cell">{est.phone}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {est.microsoftAccount}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(est)}
                            className="p-2 hover:bg-muted rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
                            aria-label="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(est.id)}
                            className="p-2 hover:bg-muted rounded text-destructive min-w-[44px] min-h-[44px] flex items-center justify-center"
                            aria-label="Delete"
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
      </div>
    </AuthLayout>
  );
}
