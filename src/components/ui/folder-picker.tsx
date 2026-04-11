"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Folder, ChevronRight, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { browseFolders, getFolderPath } from "@/lib/onedrive";
import type { DriveItem } from "@/lib/onedrive";

interface FolderPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  title?: string;
}

interface BreadcrumbItem {
  id: string | null; // null = root
  name: string;
}

export function FolderPicker({ open, onClose, onSelect, title = "Select OneDrive Folder" }: FolderPickerProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [folders, setFolders] = useState<DriveItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState<{ id: string; name: string; path: string } | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: "OneDrive" }]);
  const [selecting, setSelecting] = useState(false);

  const loadFolder = useCallback(async (folderId?: string, breadcrumb?: BreadcrumbItem) => {
    if (!session?.accessToken) {
      setError("Not signed in. Please sign in with your Microsoft account.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await browseFolders(session.accessToken, folderId);
      setFolders(result.folders);
      setCurrentFolder(result.current);

      if (breadcrumb) {
        // If navigating to a subfolder, append to breadcrumbs
        setBreadcrumbs((prev) => {
          const idx = prev.findIndex((b) => b.id === breadcrumb.id);
          if (idx >= 0) {
            // Navigating back — trim
            return prev.slice(0, idx + 1);
          }
          return [...prev, breadcrumb];
        });
      } else {
        // Root
        setBreadcrumbs([{ id: null, name: "OneDrive" }]);
      }
    } catch (err: unknown) {
      const graphErr = err as { statusCode?: number; message?: string };
      if (!graphErr.statusCode || graphErr.statusCode === 0) {
        setError("Could not connect to OneDrive. Please check your Microsoft account is connected.");
      } else {
        setError(`OneDrive error ${graphErr.statusCode}: ${graphErr.message || "Unknown"}`);
      }
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  // Load root when dialog opens
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      loadFolder();
    } else {
      onClose();
    }
  }, [loadFolder, onClose]);

  function navigateToFolder(folder: DriveItem) {
    loadFolder(folder.id, { id: folder.id, name: folder.name });
  }

  function navigateToBreadcrumb(crumb: BreadcrumbItem) {
    loadFolder(crumb.id || undefined, crumb);
  }

  async function handleSelect() {
    if (!currentFolder || !session?.accessToken) return;
    setSelecting(true);
    try {
      const path = await getFolderPath(session.accessToken, currentFolder.id);
      onSelect(path);
      onClose();
    } catch {
      setError("Failed to get folder path. Please try again.");
    } finally {
      setSelecting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap px-1">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.id ?? "root"} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3" />}
              <button
                onClick={() => navigateToBreadcrumb(crumb)}
                className="hover:text-foreground hover:underline"
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Folder list */}
        <div className="flex-1 min-h-[200px] max-h-[400px] overflow-y-auto border rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading folders...</span>
            </div>
          ) : folders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Folder className="w-10 h-10 mb-2" />
              <p className="text-sm">No subfolders here</p>
            </div>
          ) : (
            <div className="divide-y">
              {breadcrumbs.length > 1 && (
                <button
                  onClick={() => navigateToBreadcrumb(breadcrumbs[breadcrumbs.length - 2])}
                  className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-muted transition-colors min-h-[44px]"
                >
                  <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Back</span>
                </button>
              )}
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => navigateToFolder(folder)}
                  className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-muted transition-colors min-h-[44px]"
                >
                  <Folder className="w-5 h-5 text-[#2D5E3A]" />
                  <span className="text-sm flex-1">{folder.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {folder.folder?.childCount ?? 0} items
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Current selection + confirm */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="text-sm text-muted-foreground truncate flex-1">
            {currentFolder ? (
              <span>Selected: <strong className="text-foreground">{currentFolder.path}</strong></span>
            ) : (
              "Browse to your jobs folder"
            )}
          </div>
          <Button
            onClick={handleSelect}
            disabled={!currentFolder || selecting}
            className="min-h-[44px] shrink-0"
          >
            {selecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Select This Folder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
