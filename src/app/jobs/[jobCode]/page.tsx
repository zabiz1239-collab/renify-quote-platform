"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AuthLayout from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Trash2, FileText, CheckCircle, Clock, XCircle } from "lucide-react";
import { getJob, getEstimators, saveJob } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { usePageTitle } from "@/hooks/usePageTitle";
import { toast } from "sonner";
import type { Job, Estimator } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 text-blue-800",
  quoting: "bg-yellow-100 text-yellow-800",
  quoted: "bg-green-100 text-green-800",
  tendered: "bg-purple-100 text-purple-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-red-100 text-red-800",
};

const QUOTE_STATUS_ICON: Record<string, React.ReactNode> = {
  not_started: <Clock className="w-4 h-4 text-gray-400" />,
  requested: <Clock className="w-4 h-4 text-blue-500" />,
  received: <CheckCircle className="w-4 h-4 text-green-500" />,
  accepted: <CheckCircle className="w-4 h-4 text-emerald-600" />,
  declined: <XCircle className="w-4 h-4 text-red-500" />,
};

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobCode = params.jobCode as string;
  usePageTitle(jobCode || "Job");
  useSession();

  const [job, setJob] = useState<Job | null>(null);
  const [estimator, setEstimator] = useState<Estimator | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [jobData, estimators] = await Promise.all([
        getJob(decodeURIComponent(jobCode)),
        getEstimators(),
      ]);
      setJob(jobData);
      if (jobData?.estimatorId) {
        setEstimator(estimators.find((e) => e.id === jobData.estimatorId) || null);
      }
    } catch (err) {
      console.error("Failed to load job:", err);
    } finally {
      setLoading(false);
    }
  }, [jobCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleDelete() {
    if (!job) return;
    if (!confirm(`Delete job ${job.jobCode}? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from("qp_jobs").delete().eq("job_code", job.jobCode);
      if (error) throw error;
      toast.success(`Job ${job.jobCode} deleted`);
      router.push("/jobs");
    } catch (err) {
      console.error("Failed to delete job:", err);
      toast.error("Failed to delete job");
    }
  }

  async function handleStatusChange(newStatus: Job["status"]) {
    if (!job) return;
    try {
      await saveJob({ ...job, status: newStatus });
      setJob({ ...job, status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  if (loading) {
    return (
      <AuthLayout>
        <p className="text-muted-foreground">Loading job...</p>
      </AuthLayout>
    );
  }

  if (!job) {
    return (
      <AuthLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Job not found.</p>
          <Link href="/jobs" className="mt-4 inline-block">
            <Button variant="outline">Back to Jobs</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const totalTrades = job.trades?.length || 0;
  const quotedTrades = job.trades?.filter((t) =>
    t.quotes?.some((q) => q.status === "received" || q.status === "accepted")
  ).length || 0;

  return (
    <AuthLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/jobs" className="hover:text-foreground">Jobs</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">{job.jobCode}</span>
        </nav>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{job.jobCode}</h1>
            <p className="text-muted-foreground">{job.address}</p>
          </div>
          <div className="flex gap-2">
            <Badge className={STATUS_COLORS[job.status] || ""}>{job.status}</Badge>
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive min-h-[36px]">
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          </div>
        </div>

        {/* Job Info */}
        <Card>
          <CardHeader><CardTitle>Job Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Client:</span> <span className="font-medium">{job.client.name}</span></div>
              {job.client.phone && <div><span className="text-muted-foreground">Phone:</span> {job.client.phone}</div>}
              {job.client.email && <div><span className="text-muted-foreground">Email:</span> {job.client.email}</div>}
              <div><span className="text-muted-foreground">Region:</span> {job.region}</div>
              <div><span className="text-muted-foreground">Build Type:</span> {job.buildType}</div>
              <div><span className="text-muted-foreground">Storeys:</span> {job.storeys}</div>
              {estimator && <div><span className="text-muted-foreground">Estimator:</span> {estimator.name}</div>}
              {job.targetDate && <div><span className="text-muted-foreground">Target Date:</span> {new Date(job.targetDate).toLocaleDateString()}</div>}
              {job.budgetEstimate && <div><span className="text-muted-foreground">Budget:</span> ${job.budgetEstimate.toLocaleString()}</div>}
            </div>
          </CardContent>
        </Card>

        {/* Status Actions */}
        <Card>
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(["active", "quoting", "quoted", "tendered", "won", "lost"] as const).map((s) => (
                <Button
                  key={s}
                  variant={job.status === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStatusChange(s)}
                  className="min-h-[36px] capitalize"
                >
                  {s}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        {job.documents && job.documents.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {job.documents.map((doc, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{doc.name}</span>
                    <Badge variant="secondary" className="text-xs">{doc.category}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trade Checklist */}
        <Card>
          <CardHeader>
            <CardTitle>Trades ({quotedTrades}/{totalTrades} quoted)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(job.trades || []).map((trade) => {
                const bestQuote = trade.quotes?.find((q) => q.status === "accepted") ||
                  trade.quotes?.find((q) => q.status === "received");
                const latestStatus = bestQuote?.status ||
                  trade.quotes?.[trade.quotes.length - 1]?.status || "not_started";

                return (
                  <div key={trade.code} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <div className="flex items-center gap-2">
                      {QUOTE_STATUS_ICON[latestStatus] || QUOTE_STATUS_ICON.not_started}
                      <span className="text-sm">
                        <span className="text-muted-foreground">{trade.code}</span>{" "}
                        {trade.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {bestQuote?.priceExGST && (
                        <span className="text-sm font-mono">${bestQuote.priceExGST.toLocaleString()}</span>
                      )}
                      <Badge variant="secondary" className="text-xs capitalize">
                        {latestStatus.replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {trade.quotes?.length || 0} quote{(trade.quotes?.length || 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Cost Summary */}
        {job.budgetEstimate && (
          <Card>
            <CardHeader><CardTitle>Cost Summary</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                let totalQuoted = 0;
                for (const trade of job.trades || []) {
                  const accepted = trade.quotes?.find((q) => q.status === "accepted");
                  if (accepted?.priceExGST) { totalQuoted += accepted.priceExGST; continue; }
                  const cheapest = trade.quotes?.filter((q) => q.status === "received" && q.priceExGST)
                    .sort((a, b) => (a.priceExGST || 0) - (b.priceExGST || 0))[0];
                  if (cheapest?.priceExGST) totalQuoted += cheapest.priceExGST;
                }
                const diff = totalQuoted - (job.budgetEstimate || 0);
                return (
                  <div className="grid grid-cols-3 gap-4 text-sm text-center">
                    <div>
                      <p className="text-muted-foreground">Budget</p>
                      <p className="text-lg font-bold">${job.budgetEstimate?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Quoted Total</p>
                      <p className="text-lg font-bold">${totalQuoted.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Difference</p>
                      <p className={`text-lg font-bold ${diff > 0 ? "text-red-600" : "text-green-600"}`}>
                        {diff > 0 ? "+" : ""}${diff.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </div>
    </AuthLayout>
  );
}
