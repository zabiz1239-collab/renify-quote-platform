"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import AuthLayout from "@/components/layout/AuthLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users } from "lucide-react";
import { getEstimators, getJobs } from "@/lib/supabase";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Estimator } from "@/types";

interface WorkloadEntry {
  estimator: Estimator;
  assignedJobs: number;
  pendingQuotes: number;
  receivedQuotes: number;
  overdueQuotes: number;
}

export default function WorkloadPage() {
  usePageTitle("Workload");
  useSession(); // auth status check
  const [workload, setWorkload] = useState<WorkloadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [estimators, jobs] = await Promise.all([
        getEstimators(),
        getJobs(),
      ]);

      const now = Date.now();
      const entries: WorkloadEntry[] = estimators.map((est) => {
        const assignedJobs = jobs.filter((j) => j.estimatorId === est.id);
        let pendingQuotes = 0;
        let receivedQuotes = 0;
        let overdueQuotes = 0;

        for (const job of assignedJobs) {
          for (const trade of job.trades || []) {
            for (const quote of trade.quotes || []) {
              if (quote.status === "requested") {
                pendingQuotes++;
                if (quote.requestedDate) {
                  const daysAgo = Math.floor(
                    (now - new Date(quote.requestedDate).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  if (daysAgo >= 7) overdueQuotes++;
                }
              } else if (quote.status === "received") {
                receivedQuotes++;
              }
            }
          }
        }

        return {
          estimator: est,
          assignedJobs: assignedJobs.length,
          pendingQuotes,
          receivedQuotes,
          overdueQuotes,
        };
      });

      setWorkload(entries);
    } catch (err: unknown) {
      console.error("Failed to load workload:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to load workload data: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <AuthLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Estimator Workload</h1>

        {loading ? (
          <p className="text-muted-foreground">Loading workload data...</p>
        ) : error ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : workload.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No estimators found</h3>
              <p className="text-muted-foreground mt-1">
                Add estimators to see their workload.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workload.map((entry) => (
                <Card key={entry.estimator.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{entry.estimator.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{entry.estimator.email}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-2 bg-muted rounded">
                        <p className="text-xl font-bold">{entry.assignedJobs}</p>
                        <p className="text-xs text-muted-foreground">Jobs</p>
                      </div>
                      <div className="text-center p-2 bg-yellow-50 rounded">
                        <p className="text-xl font-bold text-yellow-700">{entry.pendingQuotes}</p>
                        <p className="text-xs text-muted-foreground">Pending</p>
                      </div>
                      <div className="text-center p-2 bg-green-50 rounded">
                        <p className="text-xl font-bold text-green-700">{entry.receivedQuotes}</p>
                        <p className="text-xs text-muted-foreground">Received</p>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded">
                        <p className="text-xl font-bold text-red-700">{entry.overdueQuotes}</p>
                        <p className="text-xs text-muted-foreground">Overdue</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estimator</TableHead>
                      <TableHead className="text-center">Jobs</TableHead>
                      <TableHead className="text-center">Pending</TableHead>
                      <TableHead className="text-center">Received</TableHead>
                      <TableHead className="text-center">Overdue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workload.map((entry) => (
                      <TableRow key={entry.estimator.id}>
                        <TableCell className="font-medium">{entry.estimator.name}</TableCell>
                        <TableCell className="text-center">{entry.assignedJobs}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{entry.pendingQuotes}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-green-100 text-green-800">
                            {entry.receivedQuotes}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {entry.overdueQuotes > 0 ? (
                            <Badge variant="destructive">{entry.overdueQuotes}</Badge>
                          ) : (
                            <Badge variant="secondary">0</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
