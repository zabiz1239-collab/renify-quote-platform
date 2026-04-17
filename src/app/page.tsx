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
  Send,
  Loader2,
} from "lucide-react";
import { getJobs, getSettings } from "@/lib/supabase";
import { getExpiringQuotes } from "@/lib/notifications";
import { PageSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorMessage } from "@/components/ui/error-boundary";
import { usePageTitle } from "@/hooks/usePageTitle";
import { toast } from "sonner";
import type { Job } from "@/types";

interface FollowUpPreview {
  jobCode: string;
  tradeName: string;
  supplierName: string;
  daysAgo: number;
  followUpType: string;
}

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
  useSession(); // auth status check
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUpPreview[]>([]);
  const [followUpDays, setFollowUpDays] = useState({ first: 7, second: 14 });
  const [sendingFollowUps, setSendingFollowUps] = useState(false);

  const loadJobs = useCallback(async () => {
    setError(null);
    setNeedsSetup(false);
    try {
      const [jobsData, settings] = await Promise.all([
        getJobs(),
        getSettings(),
      ]);
      if (!settings.oneDriveRootPath) {
        setNeedsSetup(true);
        setLoading(false);
        return;
      }
      setJobs(jobsData);
      // Load follow-up preview
      try {
        const fuRes = await fetch("/api/cron/follow-ups");
        if (fuRes.ok) {
          const fuData = await fuRes.json();
          setFollowUps(fuData.pending || []);
          setFollowUpDays(fuData.followUpDays || { first: 7, second: 14 });
        }
      } catch {
        // Non-critical — don't block dashboard
      }
    } catch (err: unknown) {
      console.error("Failed to load dashboard:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to load dashboard data — ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  async function handleSendFollowUps() {
    setSendingFollowUps(true);
    try {
      const res = await fetch("/api/cron/follow-ups", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send follow-ups");
      toast.success(`Sent ${data.followUpsSent} follow-up${data.followUpsSent !== 1 ? "s" : ""}`);
      if (data.errors?.length) {
        toast.error(`${data.errors.length} failed — check console`);
        console.error("Follow-up errors:", data.errors);
      }
      setFollowUps([]);
      loadJobs(); // Refresh data
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send";
      toast.error(msg);
    } finally {
      setSendingFollowUps(false);
    }
  }

  const activeJobs = jobs.filter((j) => j.status === "active" || j.status === "quoting");
  const pendingQuotes = getTotalPendingQuotes(jobs);
  const receivedThisWeek = getWeeklyReceivedCount(jobs);
  const overdueAlerts = getOverdueAlerts(jobs);
  const expiringQuotes = jobs.flatMap((job: Job) =>
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

            {/* Follow-Ups Ready to Send */}
            {followUps.length > 0 && (
              <Card className="border-blue-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Send className="w-4 h-4 text-blue-500" />
                      Follow-Ups Ready ({followUps.length})
                    </CardTitle>
                    <Button
                      onClick={handleSendFollowUps}
                      disabled={sendingFollowUps}
                      size="sm"
                      className="min-h-[36px] bg-[#2D5E3A] hover:bg-[#2D5E3A]/90"
                    >
                      {sendingFollowUps ? (
                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Sending...</>
                      ) : (
                        <><Send className="w-3 h-3 mr-1" /> Send All</>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    1st follow-up after {followUpDays.first} days, 2nd after {followUpDays.second} days.
                    Change in <Link href="/settings" className="underline">Settings</Link>.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {followUps.map((fu, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1">
                        <span>
                          <span className="font-medium">{fu.jobCode}</span>
                          {" — "}
                          {fu.tradeName} → {fu.supplierName}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {fu.daysAgo}d ago
                          </Badge>
                          <Badge className="text-xs bg-blue-100 text-blue-800">
                            {fu.followUpType}
                          </Badge>
                        </div>
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
