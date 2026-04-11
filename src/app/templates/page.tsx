"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
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
import { Plus, Pencil, Trash2, FileText, Eye } from "lucide-react";
import { readJsonFile, writeJsonFile } from "@/lib/onedrive";
import {
  PLACEHOLDERS,
  renderTemplate,
  getSampleContext,
  getDefaultTemplates,
} from "@/lib/templates";
import { TRADES } from "@/data/trades";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { EmailTemplate } from "@/types";
import { DEFAULT_ONEDRIVE_ROOT } from "@/types";
import { v4 as uuidv4 } from "uuid";

const TEMPLATE_TYPES = [
  { value: "request", label: "Quote Request" },
  { value: "followup_1", label: "1st Follow-Up" },
  { value: "followup_2", label: "2nd Follow-Up" },
  { value: "acceptance", label: "Acceptance" },
  { value: "decline", label: "Decline" },
] as const;

const TYPE_COLORS: Record<string, string> = {
  request: "bg-blue-100 text-blue-800",
  followup_1: "bg-yellow-100 text-yellow-800",
  followup_2: "bg-orange-100 text-orange-800",
  acceptance: "bg-green-100 text-green-800",
  decline: "bg-red-100 text-red-800",
};

const EMPTY_FORM = {
  name: "",
  subject: "",
  body: "",
  type: "request" as EmailTemplate["type"],
  tradeCodes: [] as string[],
};

export default function TemplatesPage() {
  usePageTitle("Templates");
  const { data: session } = useSession();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const rootPath = DEFAULT_ONEDRIVE_ROOT;
  const sampleContext = getSampleContext();

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  async function loadTemplates() {
    if (!session?.accessToken) return;
    try {
      const data = await readJsonFile<EmailTemplate[]>(
        session.accessToken,
        `${rootPath}/templates.json`
      );
      if (data && data.length > 0) {
        setTemplates(data);
      } else {
        // Initialize with defaults
        const defaults = getDefaultTemplates();
        await writeJsonFile(session.accessToken, `${rootPath}/templates.json`, defaults);
        setTemplates(defaults);
      }
    } catch {
      const defaults = getDefaultTemplates();
      setTemplates(defaults);
    } finally {
      setLoading(false);
    }
  }

  async function saveTemplates(updated: EmailTemplate[]) {
    if (!session?.accessToken) return;
    await writeJsonFile(session.accessToken, `${rootPath}/templates.json`, updated);
    setTemplates(updated);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(tmpl: EmailTemplate) {
    setForm({
      name: tmpl.name,
      subject: tmpl.subject,
      body: tmpl.body,
      type: tmpl.type,
      tradeCodes: [...tmpl.tradeCodes],
    });
    setEditingId(tmpl.id);
    setDialogOpen(true);
  }

  function openPreview(tmpl: EmailTemplate) {
    setForm({
      name: tmpl.name,
      subject: tmpl.subject,
      body: tmpl.body,
      type: tmpl.type,
      tradeCodes: [...tmpl.tradeCodes],
    });
    setPreviewOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.subject || !form.body) return;
    setSaving(true);
    try {
      let updated: EmailTemplate[];
      if (editingId) {
        updated = templates.map((t) =>
          t.id === editingId ? { ...t, ...form } : t
        );
      } else {
        const newTemplate: EmailTemplate = { id: uuidv4(), ...form };
        updated = [...templates, newTemplate];
      }
      await saveTemplates(updated);
      setDialogOpen(false);
    } catch (err) {
      console.error("Failed to save template:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    setConfirmDeleteId(null);
    const updated = templates.filter((t) => t.id !== id);
    await saveTemplates(updated);
  }

  function toggleTrade(code: string) {
    setForm((prev) => ({
      ...prev,
      tradeCodes: prev.tradeCodes.includes(code)
        ? prev.tradeCodes.filter((c) => c !== code)
        : [...prev.tradeCodes, code],
    }));
  }

  const renderedSubject = renderTemplate(form.subject, sampleContext);
  const renderedBody = renderTemplate(form.body, sampleContext);

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Email Templates</h1>
          <Button onClick={openCreate} className="min-h-[44px]">
            <Plus className="w-4 h-4 mr-2" />
            Add Template
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading templates...</p>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No templates yet</h3>
              <p className="text-muted-foreground mt-1">
                Create email templates for quote requests and follow-ups.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((tmpl) => (
              <Card key={tmpl.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{tmpl.name}</CardTitle>
                    <Badge className={TYPE_COLORS[tmpl.type] || ""}>
                      {TEMPLATE_TYPES.find((t) => t.value === tmpl.type)?.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2 truncate">
                    Subject: {tmpl.subject}
                  </p>
                  {tmpl.tradeCodes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tmpl.tradeCodes.map((code) => (
                        <Badge key={code} variant="secondary" className="text-xs">
                          {code}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {tmpl.tradeCodes.length === 0 && (
                    <p className="text-xs text-muted-foreground mb-3">
                      Applies to all trades
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPreview(tmpl)}
                      className="min-h-[44px] flex-1"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Preview
                    </Button>
                    <button
                      onClick={() => openEdit(tmpl)}
                      className="p-2 hover:bg-muted rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
                      aria-label="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(tmpl.id)}
                      className={`p-2 rounded min-w-[44px] min-h-[44px] flex items-center justify-center ${
                        confirmDeleteId === tmpl.id
                          ? "bg-red-100 text-red-700 text-xs font-medium"
                          : "hover:bg-muted text-destructive"
                      }`}
                      aria-label="Delete"
                    >
                      {confirmDeleteId === tmpl.id ? "Confirm?" : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Template" : "Create Template"}
              </DialogTitle>
              <DialogDescription>
                {editingId ? "Update email template details." : "Create a new email template for quote requests."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
              {/* Editor */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Template Name *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, name: e.target.value }))
                      }
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={form.type}
                      onValueChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          type: v as EmailTemplate["type"],
                        }))
                      }
                    >
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Subject *</Label>
                  <Input
                    value={form.subject}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, subject: e.target.value }))
                    }
                    className="min-h-[44px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Body * (HTML supported)</Label>
                  <Textarea
                    value={form.body}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, body: e.target.value }))
                    }
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Applies to Trades (leave empty for all)</Label>
                  <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto border rounded-lg p-2">
                    {TRADES.filter((t) => t.quotable).map((trade) => (
                      <label
                        key={trade.code}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-xs min-h-[32px]"
                      >
                        <input
                          type="checkbox"
                          checked={form.tradeCodes.includes(trade.code)}
                          onChange={() => toggleTrade(trade.code)}
                          className="w-3 h-3"
                        />
                        {trade.code} {trade.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Available Placeholders</Label>
                  <div className="flex flex-wrap gap-1">
                    {PLACEHOLDERS.map((p) => (
                      <Badge
                        key={p.key}
                        variant="outline"
                        className="cursor-pointer text-xs hover:bg-muted"
                        title={p.description}
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            body: prev.body + p.key,
                          }));
                        }}
                      >
                        {p.key}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving || !form.name || !form.subject || !form.body}
                    className="min-h-[44px] flex-1"
                  >
                    {saving ? "Saving..." : editingId ? "Update" : "Create"}
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

              {/* Live Preview */}
              <div className="space-y-2">
                <Label>Live Preview</Label>
                <Card className="bg-white">
                  <CardHeader className="pb-2">
                    <p className="text-xs text-muted-foreground">Subject:</p>
                    <p className="text-sm font-medium">{renderedSubject || "—"}</p>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="text-sm whitespace-pre-wrap prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: renderedBody || "—" }}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Template Preview — {form.name}</DialogTitle>
              <DialogDescription>
                Preview with sample data. Actual values substituted when sending.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Subject:</p>
                <p className="font-medium">{renderedSubject}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Body:</p>
                <Card className="bg-white">
                  <CardContent className="pt-4">
                    <div
                      className="text-sm whitespace-pre-wrap prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: renderedBody }}
                    />
                  </CardContent>
                </Card>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Preview uses sample data. Actual values will be substituted when sending.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AuthLayout>
  );
}
