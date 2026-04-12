"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, Loader2, AlertTriangle, FolderOpen, Folder } from "lucide-react";
import { FolderPicker } from "@/components/ui/folder-picker";
import { getSettings as fetchSettings, saveSettings as saveSettingsToDb } from "@/lib/supabase";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { AppSettings } from "@/types";

export default function SetupPage() {
  usePageTitle("Setup");
  useSession();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [existingPath, setExistingPath] = useState("");
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    async function checkSettings() {
      try {
        const s = await fetchSettings();
        setSettings(s);
        if (s?.oneDriveRootPath) {
          setExistingPath(s.oneDriveRootPath);
          setSelectedPath(s.oneDriveRootPath);
        }
      } catch {
        // No settings yet
      } finally {
        setLoadingSettings(false);
      }
    }
    checkSettings();
  }, []);

  function handleFolderSelect(path: string) {
    setSelectedPath(path);
    setPickerOpen(false);
    setError("");
  }

  async function handleSave() {
    if (!selectedPath) return;
    setSaving(true);
    setError("");
    try {
      await saveSettingsToDb({
        ...(settings || {
          oneDriveRootPath: "",
          regions: ["Western", "Northern", "South East", "Eastern", "Geelong", "Ballarat"],
          followUpDays: { first: 7, second: 14 },
          quoteExpiryWarningDays: [30, 60, 90],
          defaultMarkupPercent: 15,
          adminEmail: "",
        }),
        oneDriveRootPath: selectedPath,
      });
      setSaved(true);
      setTimeout(() => router.push("/"), 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to save settings: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Setup Guide</h1>

        <Card className="border-[#2D5E3A]/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-[#2D5E3A]" />
              OneDrive Folder for Quote PDFs
            </CardTitle>
            <CardDescription>
              Select the OneDrive folder where job folders and quote PDFs will be stored.
              All other data (suppliers, estimators, templates, settings) is stored securely in the cloud database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingSettings ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading settings...
              </div>
            ) : (
              <>
                {selectedPath ? (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <Folder className="w-5 h-5 text-[#2D5E3A] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedPath}</p>
                      <p className="text-xs text-muted-foreground">
                        {existingPath === selectedPath ? "Currently configured" : "New selection"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPickerOpen(true)}
                      className="min-h-[36px] shrink-0"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setPickerOpen(true)}
                    variant="outline"
                    className="w-full min-h-[44px] border-dashed border-2"
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Browse OneDrive...
                  </Button>
                )}

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                {saved && (
                  <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-green-800">
                      Settings saved! Redirecting to Dashboard...
                    </p>
                  </div>
                )}

                {selectedPath && !saved && (
                  <Button
                    onClick={handleSave}
                    disabled={saving || !selectedPath}
                    className="w-full min-h-[44px]"
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {saving ? "Saving..." : "Save & Continue to Dashboard"}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Where is my data stored?</strong><br />
                All your jobs, suppliers, estimators, templates, and settings are stored in
                a secure cloud database (Supabase). OneDrive is used only for storing
                quote PDF files in job folders.
              </p>
              <p>
                <strong className="text-foreground">What folder should I pick?</strong><br />
                Pick the folder that contains (or will contain) your job subfolders.
                Each job gets its own subfolder with a <code className="bg-muted px-1 rounded">Quotes</code> folder for PDFs.
              </p>
              <p>
                <strong className="text-foreground">Can I change this later?</strong><br />
                Yes — go to Settings any time to update.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <FolderPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleFolderSelect}
        title="Select Your Jobs Folder"
      />
    </AuthLayout>
  );
}
