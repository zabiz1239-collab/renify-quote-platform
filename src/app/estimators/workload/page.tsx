"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AuthLayout from "@/components/layout/AuthLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Clock, CheckCircle, AlertTriangle, Briefcase } from "lucide-react";
import { getJobs, getEstimators } from "@/lib/supabase";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Job, Estimator } from "@/types";

interface EstimatorStats {
  estimator: Estimator;
  activeJobs: number;
  pendingQuotes: number;
  receivedQuotes: number;
  overdueQuotes: number;
  totalTrades: number;
  jobs: { jobCode: string; address: string; pending: number; received: number; overdue: number }[];
}

function computeWorkload(estimators: Estimator[], jobs: Job[]): EstimatorStats[] {
  return estimators.map((est) => {
    const estJobs = jobs.filter((j) => j.estimatorId === est.id);
    const activeJobs = estJobs.filter((j) => j.status === "active" || j.status === "quoting");

    let pendingQuotes = 0;
    let receivedQuotes = 0;
    let overdueQuotes = 0;
    let totalTrades = 0;
    const now = Date.now();

    const jobDetails = activeJobs.map((job) => {
      let jobPending = 0;
      let jobReceived = 0;
      let jobOverdue = 0;

      for (const trade of job.trades || []) {
        totalTrades++;
        for (const quote of trade.quotes || []) {
          if (quote.status === "requested") {
            jobPending++;
            if (quote.requestedDate) {
              const days = Math.floor((now - new Date(quote.requestedDate).getTime()) / (1000 * 60 * 60 * 24));
              if (days >= 7) jobOverdue++;
            }
          } else if (quote.status === "received" || quote.status === "accepted") {
            jobReceived++;
          }
        }
      }

      pendingQuotes += jobPending;
      receivedQuotes += jobReceived;
      overdueQuotes += jobOverdue;

      return {
        jobCode: job.jobCode,
        address: job.address,
        pending: jobPending,
        received: jobReceived,
        overdue: jobOverdue,
      };
    });

    return {
      estimator: est,
      activeJobs: activeJobs.length,
      pendingQuotes,
      receivedQuotes,
      overdueQuotes,
      totalTrades,
      jobs: jobDetails,
    };
  });
}

export default function WorkloadPage() {
  usePageTitle("Estimator Workload");
  useSession();

  const [stats, setStats] = useState<EstimatorStats[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [estimators, jobs] = await Promise.all([getEstimators(), getJobs()]);
      setStats(computeWorkload(estimators, jobs));
    } catch (err) {
      console.error("Failed to load workload:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <AuthLayout>
        <p className="text-muted-foreground">Loading...</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/estimators">
            <Button variant="ghost" size="sm" className="min-h-[44px]">
              <ChevronLeft className="w-4 h-4 mr-1" /> Estimators
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Estimator Workload</h1>
        </div>

        {stats.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No estimators found. Add estimators first.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {stats.map((s) => (
              <Card key={s.estimator.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{s.estimator.name}</CardTitle>
                    <Badge variant="secondary">{s.estimator.email}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Summary row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                      <Briefcase className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-xl font-bold">{s.activeJobs}</p>
                        <p className="text-xs text-muted-foreground">Active Jobs</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
                      <Clock className="w-5 h-5 text-yellow-500" />
                      <div>
                        <p className="text-xl font-bold">{s.pendingQuotes}</p>
                        <p className="text-xs text-muted-foreground">Pending</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="text-xl font-bold">{s.receivedQuotes}</p>
                        <p className="text-xs text-muted-foreground">Received</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <div>
                        <p className="text-xl font-bold">{s.overdueQuotes}</p>
                        <p className="text-xs text-muted-foreground">Overdue</p>
                      </div>
                    </div>
                  </div>

                  {/* Per-job breakdown */}
                  {s.jobs.length > 0 ? (
                    <div className="border rounded-lg divide-y">
                      {s.jobs.map((job) => (
                        <div key={job.jobCode} className="flex items-center justify-between p-3 text-sm">
                          <div>
                            <Link href={`/jobs/${encodeURIComponent(job.jobCode)}`} className="font-medium hover:underline">
                              {job.jobCode}
                            </Link>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{job.address}</p>
                          </div>
                          <div className="flex gap-2">
                            {job.pending > 0 && (
                              <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                                {job.pending} pending
                              </Badge>
                            )}
                            {job.received > 0 && (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                {job.received} received
                              </Badge>
                            )}
                            {job.overdue > 0 && (
                              <Badge className="bg-red-100 text-red-800 text-xs">
                                {job.overdue} overdue
                              </Badge>
                            )}
                            {job.pending === 0 && job.received === 0 && (
                              <Badge variant="secondary" className="text-xs">No quotes</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-3">No active jobs assigned</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
