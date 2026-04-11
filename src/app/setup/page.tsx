"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, Loader2, AlertTriangle, FolderOpen, Folder } from "lucide-react";
import { FolderPicker } from "@/components/ui/folder-picker";
import { readJsonFile, writeJsonFile } from "@/lib/onedrive";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { AppSettings } from "@/types";
import { DEFAULT_ONEDRIVE_ROOT } from "@/types";

const DEFAULT_SETTINGS: AppSettings = {
  oneDriveRootPath: "",
  regions: ["Western", "Northern", "South East", "Eastern", "Geelong", "Ballarat"],
  followUpDays: { first: 7, second: 14 },
  quoteExpiryWarningDays: [30, 60, 90],
  defaultMarkupPercent: 15,
  adminEmail: "",
};

export default function SetupPage() {
  usePageTitle("Setup");
  const { data: session } = useSession();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [existingPath, setExistingPath] = useState("");

  // Check if already configured
  useEffect(() => {
    async function checkSettings() {
      if (!session?.accessToken) {
        setLoadingSettings(false);
        return;
      }
      try {
        // Try reading settings from the default location first
        const settings = await readJsonFile<AppSettings>(
          session.accessToken,
          `${DEFAULT_ONEDRIVE_ROOT}/settings.json`
        );
        if (settings?.oneDriveRootPath) {
          setExistingPath(settings.oneDriveRootPath);
          setSelectedPath(settings.oneDriveRootPath);
        }
      } catch {
        // No settings yet — that's fine
      } finally {
        setLoadingSettings(false);
      }
    }
    checkSettings();
  }, [session?.accessToken]);

  function handleFolderSelect(path: string) {
    setSelectedPath(path);
    setPickerOpen(false);
    setError("");
  }

  async function handleSave() {
    if (!session?.accessToken || !selectedPath) return;
    setSaving(true);
    setError("");
    try {
      const settings: AppSettings = {
        ...DEFAULT_SETTINGS,
        oneDriveRootPath: selectedPath,
      };
      // Save settings.json inside the selected folder
      await writeJsonFile(
        session.accessToken,
        `${selectedPath}/settings.json`,
        settings
      );
      setSaved(true);
      // Redirect to dashboard after 1.5 seconds
      setTimeout(() => router.push("/"), 1500);
    } catch (err: unknown) {
      const graphErr = err as { statusCode?: number; message?: string };
      if (!graphErr.statusCode || graphErr.statusCode === 0) {
        setError("Could not connect to OneDrive. Please check your Microsoft account is connected.");
      } else {
        setError(`Failed to save settings: OneDrive error ${graphErr.statusCode}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Set Up OneDrive</h1>

        {/* Main card — folder picker */}
        <Card className="border-[#2D5E3A]/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-[#2D5E3A]" />
              Select Your Jobs Folder
            </CardTitle>
            <CardDescription>
              Browse your OneDrive and select the folder where your job folders live.
              Renify will read and create job data inside this folder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingSettings ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking OneDrive connection...
              </div>
            ) : (
              <>
                {/* Current selection */}
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

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                {/* Success */}
                {saved && (
                  <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-green-800">
                      OneDrive folder configured! Redirecting to Dashboard...
                    </p>
                  </div>
                )}

                {/* Save button */}
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

        {/* Help text */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">What folder should I pick?</strong><br />
                Pick the folder that contains (or will contain) your job subfolders.
                For example, if your jobs are at <code className="bg-muted px-1 rounded">OneDrive/Renify Business/Jobs</code>,
                select that <code className="bg-muted px-1 rounded">Jobs</code> folder.
              </p>
              <p>
                <strong className="text-foreground">What happens next?</strong><br />
                Renify will look for job folders inside this folder. Each job gets its own subfolder
                with a <code className="bg-muted px-1 rounded">job-config.json</code> file and a <code className="bg-muted px-1 rounded">Quotes</code> folder.
              </p>
              <p>
                <strong className="text-foreground">Can I change this later?</strong><br />
                Yes — go to Settings any time to pick a different folder.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Folder picker dialog */}
      <FolderPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleFolderSelect}
        title="Select Your Jobs Folder"
      />
    </AuthLayout>
  );
}
