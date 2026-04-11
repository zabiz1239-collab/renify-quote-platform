"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import AuthLayout from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Briefcase } from "lucide-react";
import { readJsonFile } from "@/lib/onedrive";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Job, AppSettings } from "@/types";
import { DEFAULT_ONEDRIVE_ROOT } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 text-blue-800",
  quoting: "bg-yellow-100 text-yellow-800",
  quoted: "bg-green-100 text-green-800",
  tendered: "bg-purple-100 text-purple-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-red-100 text-red-800",
};

export default function JobsPage() {
  usePageTitle("Jobs");
  const { data: session } = useSession();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadJobs() {
      if (!session?.accessToken) return;
      try {
        const settings = await readJsonFile<AppSettings>(
          session.accessToken,
          `${DEFAULT_ONEDRIVE_ROOT}/settings.json`
        );
        const rootPath = settings?.oneDriveRootPath || DEFAULT_ONEDRIVE_ROOT;

        // List job folders and read each job-config.json
        const { listFolder } = await import("@/lib/onedrive");
        const items = await listFolder(session.accessToken, rootPath);
        const jobFolders = items.filter((item) => item.folder && !item.name.endsWith(".json"));

        const jobPromises = jobFolders.map(async (folder) => {
          try {
            const job = await readJsonFile<Job>(
              session.accessToken!,
              `${rootPath}/${folder.name}/job-config.json`
            );
            return job;
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
    }

    loadJobs();
  }, [session?.accessToken]);

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Jobs</h1>
          <Link href="/jobs/new">
            <Button className="min-h-[44px]">
              <Plus className="w-4 h-4 mr-2" />
              New Job
            </Button>
          </Link>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading jobs from OneDrive...</p>
        ) : jobs.length === 0 ? (
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
              const totalTrades = job.trades?.length || 0;
              const quotedTrades =
                job.trades?.filter((t) =>
                  t.quotes?.some((q) => q.status === "received" || q.status === "accepted")
                ).length || 0;

              return (
                <Card key={job.jobCode} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{job.jobCode}</CardTitle>
                      <Badge className={STATUS_COLORS[job.status] || ""}>
                        {job.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{job.address}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Client</span>
                        <span>{job.client.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Region</span>
                        <span>{job.region}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span>{job.buildType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Quotes</span>
                        <span>
                          {quotedTrades}/{totalTrades} trades
                        </span>
                      </div>
                      {job.budgetEstimate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Budget</span>
                          <span>${job.budgetEstimate.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
