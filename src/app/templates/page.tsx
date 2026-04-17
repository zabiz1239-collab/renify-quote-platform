"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import AuthLayout from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { getTemplates, saveTemplate, deleteTemplate as deleteTemplateFromDb, saveTemplatesBulk } from "@/lib/supabase";
import { TRADES } from "@/data/trades";
import { PLACEHOLDERS, renderTemplate, getSampleContext, getDefaultTemplates } from "@/lib/templates";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { EmailTemplate } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

const TYPE_OPTIONS = [
  { value: "request", label: "Quote Request" },
  { value: "followup_1", label: "First Follow-Up" },
  { value: "followup_2", label: "Second Follow-Up" },
  { value: "acceptance", label: "Acceptance" },
  { value: "decline", label: "Decline" },
] as const;

export default function TemplatesPage() {
  usePageTitle("Templates");
  useSession();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [type, setType] = useState<EmailTemplate["type"]>("request");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tradeCodes, setTradeCodes] = useState<string[]>([]);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      let data = await getTemplates();
      // Seed defaults if empty
      if (data.length === 0) {
        const defaults = getDefaultTemplates();
        await saveTemplatesBulk(defaults);
        data = defaults;
      }
      setTemplates(data);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setName("");
    setType("request");
    setSubject("");
    setBody("");
    setTradeCodes([]);
    setDialogOpen(true);
  }

  function openEdit(tmpl: EmailTemplate) {
    setEditingId(tmpl.id);
    setName(tmpl.name);
    setType(tmpl.type);
    setSubject(tmpl.subject);
    setBody(tmpl.body);
    setTradeCodes([...tmpl.tradeCodes]);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name || !subject || !body) {
      toast.error("Name, subject, and body are required");
      return;
    }
    setSaving(true);
    try {
      const tmpl: EmailTemplate = {
        id: editingId || uuidv4(),
        name,
        type,
        subject,
        body,
        tradeCodes,
      };
      await saveTemplate(tmpl);
      if (editingId) {
        setTemplates((prev) => prev.map((t) => (t.id === editingId ? tmpl : t)));
      } else {
        setTemplates((prev) => [...prev, tmpl]);
      }
      setDialogOpen(false);
      toast.success(editingId ? "Template updated" : "Template created");
    } catch (err) {
      console.error("Failed to save template:", err);
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    try {
      await deleteTemplateFromDb(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template deleted");
    } catch {
      toast.error("Failed to delete template");
    }
  }

  function insertPlaceholder(placeholder: string) {
    setBody((prev) => prev + placeholder);
  }

  // Preview rendering
  const sampleContext = getSampleContext();
  const previewSubject = subject ? renderTemplate(subject, sampleContext) : "";
  const previewBody = body ? renderTemplate(body, sampleContext).replace(/\n/g, "<br>") : "";

  function toggleTradeCode(code: string) {
    setTradeCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Email Templates</h1>
          <Button onClick={openCreate} className="min-h-[44px]">
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading templates...</p>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No templates yet</h3>
              <p className="text-muted-foreground mt-1">Create your first email template.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {templates.map((tmpl) => (
              <Card key={tmpl.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{tmpl.name}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {TYPE_OPTIONS.find((o) => o.value === tmpl.type)?.label || tmpl.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">{tmpl.subject}</p>
                    {tmpl.tradeCodes.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {tmpl.tradeCodes.slice(0, 3).map((code) => (
                          <Badge key={code} variant="outline" className="text-xs">{code}</Badge>
                        ))}
                        {tmpl.tradeCodes.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{tmpl.tradeCodes.length - 3}</Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => openEdit(tmpl)}
                      className="p-2 hover:bg-muted rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(tmpl.id)}
                      className="p-2 hover:bg-muted rounded text-destructive min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit/Create Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Template" : "New Template"}</DialogTitle>
              <DialogDescription>
                Use placeholders like {"{supplier}"} that get replaced when sending.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="min-h-[44px]" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as EmailTemplate["type"])}>
                    <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Subject *</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="min-h-[44px]" />
              </div>

              <div className="space-y-2">
                <Label>Body *</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
              </div>

              {/* Placeholder buttons */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Insert placeholder:</Label>
                <div className="flex flex-wrap gap-1">
                  {PLACEHOLDERS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => insertPlaceholder(p.key)}
                      className="px-2 py-1 text-xs border rounded hover:bg-muted min-h-[32px]"
                      title={p.description}
                    >
                      {p.key}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trade codes */}
              <div className="space-y-2">
                <Label>Specific trades (leave empty for all)</Label>
                <div className="grid grid-cols-3 gap-1 max-h-32 overflow-y-auto border rounded-lg p-2">
                  {TRADES.filter((t) => t.quotable).map((t) => (
                    <label key={t.code} className="flex items-center gap-1 text-xs cursor-pointer min-h-[28px]">
                      <input
                        type="checkbox"
                        checked={tradeCodes.includes(t.code)}
                        onChange={() => toggleTradeCode(t.code)}
                        className="w-3 h-3"
                      />
                      {t.code}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1 min-h-[44px]">
                  {saving ? "Saving..." : editingId ? "Update" : "Create"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPreviewOpen(true)}
                  className="min-h-[44px]"
                >
                  <Eye className="w-4 h-4 mr-2" /> Preview
                </Button>
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="min-h-[44px]">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Template Preview</DialogTitle>
              <DialogDescription>Preview with sample data.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <p className="font-medium">{previewSubject || "(empty)"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Body</Label>
                <div
                  className="p-4 border rounded-lg bg-white text-sm"
                  dangerouslySetInnerHTML={{ __html: previewBody || "<em>(empty)</em>" }}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AuthLayout>
  );
}
