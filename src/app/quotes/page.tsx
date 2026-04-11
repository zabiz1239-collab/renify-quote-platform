"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import AuthLayout from "@/components/layout/AuthLayout";
import KanbanBoard, { type KanbanItem } from "@/components/quotes/KanbanBoard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Kanban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { readJsonFile, writeJsonFile, listFolder } from "@/lib/onedrive";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Job, Quote, AppSettings } from "@/types";
import { DEFAULT_ONEDRIVE_ROOT } from "@/types";

export default function QuoteBoardPage() {
  usePageTitle("Quote Board");
  const { data: session } = useSession();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string>("all");
  const [filterTrade, setFilterTrade] = useState<string>("all");

  const loadJobs = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const settings = await readJsonFile<AppSettings>(
        session.accessToken,
        `${DEFAULT_ONEDRIVE_ROOT}/settings.json`
      );
      const rootPath = settings?.oneDriveRootPath || DEFAULT_ONEDRIVE_ROOT;
      const items = await listFolder(session.accessToken, rootPath);
      const jobFolders = items.filter(
        (item) => item.folder && !item.name.endsWith(".json")
      );

      const jobPromises = jobFolders.map(async (folder) => {
        try {
          return await readJsonFile<Job>(
            session.accessToken!,
            `${rootPath}/${folder.name}/job-config.json`
          );
        } catch {
          return null;
        }
      });

      const results = await Promise.all(jobPromises);
      setJobs(results.filter((j): j is Job => j !== null));
    } catch (error) {
      console.error("Failed to load jobs:", error);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Build kanban items from all jobs
  const kanbanItems: KanbanItem[] = [];
  const filteredJobs =
    selectedJob === "all" ? jobs : jobs.filter((j) => j.jobCode === selectedJob);

  for (const job of filteredJobs) {
    for (const trade of job.trades || []) {
      if (filterTrade !== "all" && trade.code !== filterTrade) continue;
      // Group quotes by supplier to find all versions
      const quotesBySupplierId = new Map<string, Quote[]>();
      for (const quote of trade.quotes || []) {
        const existing = quotesBySupplierId.get(quote.supplierId) || [];
        existing.push(quote);
        quotesBySupplierId.set(quote.supplierId, existing);
      }
      for (const quote of trade.quotes || []) {
        kanbanItems.push({
          id: `${job.jobCode}-${trade.code}-${quote.supplierId}`,
          quote,
          allVersions: quotesBySupplierId.get(quote.supplierId) || [quote],
          tradeCode: trade.code,
          tradeName: trade.name,
          jobCode: job.jobCode,
        });
      }
    }
  }

  // Get unique trades across all visible jobs for filter
  const allTrades = new Map<string, string>();
  for (const job of filteredJobs) {
    for (const trade of job.trades || []) {
      allTrades.set(trade.code, trade.name);
    }
  }

  async function handleStatusChange(itemId: string, newStatus: Quote["status"]) {
    if (!session?.accessToken) return;

    // Parse the item ID
    const parts = itemId.split("-");
    const supplierId = parts.slice(2).join("-"); // UUID may contain dashes
    const tradeCode = parts[1];
    const jobCode = parts[0];

    // Find and update the job
    const jobIndex = jobs.findIndex((j) => j.jobCode === jobCode);
    if (jobIndex === -1) return;

    const updatedJobs = [...jobs];
    const job = { ...updatedJobs[jobIndex] };
    job.trades = job.trades.map((trade) => {
      if (trade.code !== tradeCode) return trade;
      return {
        ...trade,
        quotes: trade.quotes.map((q) => {
          if (q.supplierId !== supplierId) return q;
          return { ...q, status: newStatus };
        }),
      };
    });
    job.updatedAt = new Date().toISOString();
    updatedJobs[jobIndex] = job;
    setJobs(updatedJobs);

    // Persist to OneDrive
    try {
      const settings = await readJsonFile<AppSettings>(
        session.accessToken,
        `${DEFAULT_ONEDRIVE_ROOT}/settings.json`
      );
      const rootPath = settings?.oneDriveRootPath || DEFAULT_ONEDRIVE_ROOT;
      const folderName = `${job.jobCode} - ${job.address}`;
      await writeJsonFile(
        session.accessToken,
        `${rootPath}/${folderName}/job-config.json`,
        job
      );
    } catch (error) {
      console.error("Failed to update quote status:", error);
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Quote Board</h1>
          <div className="flex gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Job</Label>
              <Select value={selectedJob} onValueChange={setSelectedJob}>
                <SelectTrigger className="w-48 min-h-[44px]">
                  <SelectValue placeholder="All Jobs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  {jobs.map((job) => (
                    <SelectItem key={job.jobCode} value={job.jobCode}>
                      {job.jobCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Trade</Label>
              <Select value={filterTrade} onValueChange={setFilterTrade}>
                <SelectTrigger className="w-48 min-h-[44px]">
                  <SelectValue placeholder="All Trades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trades</SelectItem>
                  {Array.from(allTrades).map(([code, name]) => (
                    <SelectItem key={code} value={code}>
                      {code} {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading quote board...</p>
        ) : kanbanItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Kanban className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No quotes yet</h3>
              <p className="text-muted-foreground mt-1">
                Create jobs and send quote requests to see them here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <KanbanBoard items={kanbanItems} onStatusChange={handleStatusChange} />
        )}
      </div>
    </AuthLayout>
  );
}
