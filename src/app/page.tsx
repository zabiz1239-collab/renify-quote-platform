"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AuthLayout from "@/components/layout/AuthLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Clock,
  FileCheck,
  AlertTriangle,
  Plus,
  ArrowRight,
  FolderOpen,
} from "lucide-react";
import { readJsonFile, listFolder, itemExists } from "@/lib/onedrive";
import { getExpiringQuotes } from "@/lib/notifications";
import { PageSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorMessage } from "@/components/ui/error-boundary";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Job, AppSettings } from "@/types";
import { DEFAULT_ONEDRIVE_ROOT } from "@/types";

function getTrafficLight(job: Job): { color: string; label: string; bg: string } {
  const totalTrades = job.trades?.length || 0;
  if (totalTrades === 0) return { color: "text-gray-400", label: "No trades", bg: "bg-gray-100" };

  const quotedTrades = job.trades.filter((t) =>
    t.quotes?.some((q) => q.status === "received" || q.status === "accepted")
  ).length;

  if (quotedTrades === 0) return { color: "text-red-500", label: "No quotes", bg: "bg-red-50" };
  if (quotedTrades < totalTrades) return { color: "text-yellow-500", label: `${quotedTrades}/${totalTrades}`, bg: "bg-yellow-50" };
  return { color: "text-green-500", label: "All quoted", bg: "bg-green-50" };
}

function getOverdueAlerts(jobs: Job[]): { jobCode: string; tradeName: string; daysAgo: number }[] {
  const alerts: { jobCode: string; tradeName: string; daysAgo: number }[] = [];
  const now = Date.now();

  for (const job of jobs) {
    for (const trade of job.trades || []) {
      for (const quote of trade.quotes || []) {
        if (quote.status === "requested" && quote.requestedDate) {
          const daysAgo = Math.floor((now - new Date(quote.requestedDate).getTime()) / (1000 * 60 * 60 * 24));
          if (daysAgo >= 7) {
            alerts.push({ jobCode: job.jobCode, tradeName: trade.name, daysAgo });
          }
        }
      }
    }
  }

  return alerts.sort((a, b) => b.daysAgo - a.daysAgo).slice(0, 10);
}

function getWeeklyReceivedCount(jobs: Job[]): number {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let count = 0;
  for (const job of jobs) {
    for (const trade of job.trades || []) {
      for (const quote of trade.quotes || []) {
        if (quote.status === "received" && quote.receivedDate) {
          if (new Date(quote.receivedDate).getTime() >= weekAgo) count++;
        }
      }
    }
  }
  return count;
}

function getTotalPendingQuotes(jobs: Job[]): number {
  let count = 0;
  for (const job of jobs) {
    for (const trade of job.trades || []) {
      for (const quote of trade.quotes || []) {
        if (quote.status === "requested") count++;
      }
    }
  }
  return count;
}

function getJobCostSummary(job: Job): { totalQuoted: number; budget: number | null } {
  let totalQuoted = 0;
  for (const trade of job.trades || []) {
    // Use the accepted quote if any, otherwise the cheapest received
    const accepted = trade.quotes?.find((q) => q.status === "accepted");
    if (accepted?.priceExGST) {
      totalQuoted += accepted.priceExGST;
      continue;
    }
    const received = trade.quotes
      ?.filter((q) => q.status === "received" && q.priceExGST)
      .sort((a, b) => (a.priceExGST || 0) - (b.priceExGST || 0));
    if (received?.length) {
      totalQuoted += received[0].priceExGST || 0;
    }
  }
  return { totalQuoted, budget: job.budgetEstimate || null };
}

export default function DashboardPage() {
  usePageTitle("Dashboard");
  const { data: session } = useSession();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  const loadJobs = useCallback(async () => {
    if (!session?.accessToken) {
      setLoading(false);
      return;
    }
    if (session.error === "RefreshAccessTokenError") {
      setError("Your Microsoft session expired. Please sign out and sign back in.");
      setLoading(false);
      return;
    }
    setError(null);
    setNeedsSetup(false);
    try {
      // Try to find settings.json — check default path first
      const settings = await readJsonFile<AppSettings>(
        session.accessToken,
        `${DEFAULT_ONEDRIVE_ROOT}/settings.json`
      );
      const rootPath = settings?.oneDriveRootPath || DEFAULT_ONEDRIVE_ROOT;

      // Check if the root folder actually exists
      const rootExists = await itemExists(session.accessToken, rootPath);
      if (!rootExists) {
        // Folder doesn't exist — user needs to set up
        setNeedsSetup(true);
        setLoading(false);
        return;
      }

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
    } catch (err: unknown) {
      const graphErr = err as { statusCode?: number; message?: string; code?: string };
      const detail = graphErr.statusCode
        ? `Graph API ${graphErr.statusCode}: ${graphErr.code || graphErr.message || "Unknown"}`
        : err instanceof Error && err.message
          ? err.message
          : "";
      console.error("Failed to load dashboard:", { statusCode: graphErr.statusCode, code: graphErr.code, message: graphErr.message, err });
      setError(detail ? `Failed to load dashboard data — ${detail}` : "Failed to load dashboard data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const activeJobs = jobs.filter((j) => j.status === "active" || j.status === "quoting");
  const pendingQuotes = getTotalPendingQuotes(jobs);
  const receivedThisWeek = getWeeklyReceivedCount(jobs);
  const overdueAlerts = getOverdueAlerts(jobs);
  const expiringQuotes = jobs.flatMap((job) =>
    getExpiringQuotes(job, [30, 60, 90]).map((eq) => ({ ...eq, jobCode: job.jobCode }))
  ).slice(0, 10);

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Link href="/jobs/new">
            <Button className="min-h-[44px]">
              <Plus className="w-4 h-4 mr-2" />
              New Job
            </Button>
          </Link>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : needsSetup ? (
          <Card className="border-[#2D5E3A]/30">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="w-16 h-16 text-[#2D5E3A] mb-4" />
              <h2 className="text-xl font-semibold mb-2">Set up your OneDrive folder</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Connect Renify to your OneDrive by selecting the folder where your job data lives.
                This only takes a few seconds.
              </p>
              <Link href="/setup">
                <Button className="min-h-[44px]">
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Set Up OneDrive
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : error ? (
          <ErrorMessage message={error} onRetry={loadJobs} />
        ) : (
          <>
            {/* Quick Stats */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-8 h-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{activeJobs.length}</p>
                      <p className="text-xs text-muted-foreground">Active Jobs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Clock className="w-8 h-8 text-yellow-500" />
                    <div>
                      <p className="text-2xl font-bold">{pendingQuotes}</p>
                      <p className="text-xs text-muted-foreground">Pending Quotes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <FileCheck className="w-8 h-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{receivedThisWeek}</p>
                      <p className="text-xs text-muted-foreground">Received This Week</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                    <div>
                      <p className="text-2xl font-bold">{overdueAlerts.length}</p>
                      <p className="text-xs text-muted-foreground">Overdue Alerts</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Overdue Alerts */}
            {overdueAlerts.length > 0 && (
              <Card className="border-red-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Overdue Quote Requests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {overdueAlerts.map((alert, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm py-1"
                      >
                        <span>
                          <span className="font-medium">{alert.jobCode}</span>
                          {" — "}
                          {alert.tradeName}
                        </span>
                        <Badge variant="destructive" className="text-xs">
                          {alert.daysAgo}d ago
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Expiring Quotes */}
            {expiringQuotes.length > 0 && (
              <Card className="border-orange-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-500" />
                    Quote Expiry Warnings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {expiringQuotes.map((eq, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm py-1"
                      >
                        <span>
                          <span className="font-medium">{eq.jobCode}</span>
                          {" — "}
                          {eq.tradeName} ({eq.supplierName})
                        </span>
                        <Badge
                          className={`text-xs ${
                            eq.severity === "expired"
                              ? "bg-red-100 text-red-800"
                              : eq.severity === "danger"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {eq.daysUntilExpiry < 0
                            ? "EXPIRED"
                            : `${eq.daysUntilExpiry}d left`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Job Cards */}
            {jobs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Briefcase className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No jobs yet</h3>
                  <p className="text-muted-foreground mt-1">
                    Create your first job to get started.
                  </p>
                  <Link href="/jobs/new" className="mt-4">
                    <Button className="min-h-[44px]">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Job
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {jobs.map((job) => {
                  const traffic = getTrafficLight(job);
                  const cost = getJobCostSummary(job);
                  const allQuoted = job.trades.length > 0 && job.trades.every((t) =>
                    t.quotes?.some((q) => q.status === "received" || q.status === "accepted")
                  );

                  return (
                    <Card key={job.jobCode} className={`hover:shadow-md transition-shadow ${traffic.bg}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${traffic.color === "text-red-500" ? "bg-red-500" : traffic.color === "text-yellow-500" ? "bg-yellow-500" : traffic.color === "text-green-500" ? "bg-green-500" : "bg-gray-400"}`} />
                            <CardTitle className="text-lg">{job.jobCode}</CardTitle>
                          </div>
                          <div className="flex items-center gap-1">
                            {allQuoted && (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                Fully Quoted
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {job.status}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{job.address}</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Quotes</span>
                            <span className="font-medium">{traffic.label}</span>
                          </div>
                          {cost.totalQuoted > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Quoted Total</span>
                              <span className="font-medium">
                                ${cost.totalQuoted.toLocaleString()}
                              </span>
                            </div>
                          )}
                          {cost.budget && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Budget</span>
                              <span>${cost.budget.toLocaleString()}</span>
                            </div>
                          )}
                          <Link href="/quotes" className="block pt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full min-h-[44px] text-primary"
                            >
                              View Quotes
                              <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AuthLayout>
  );
}
