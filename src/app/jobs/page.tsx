"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import AuthLayout from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Briefcase, FolderOpen } from "lucide-react";
import { readJsonFile, listFolder, writeJsonFile } from "@/lib/onedrive";
import { usePageTitle } from "@/hooks/usePageTitle";
import { toast } from "sonner";
import type { Job, AppSettings } from "@/types";
import { DEFAULT_ONEDRIVE_ROOT } from "@/types";
import { TRADES } from "@/data/trades";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 text-blue-800",
  quoting: "bg-yellow-100 text-yellow-800",
  quoted: "bg-green-100 text-green-800",
  tendered: "bg-purple-100 text-purple-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-red-100 text-red-800",
};

interface UnconfiguredFolder {
  name: string;
  configuring: boolean;
}

export default function JobsPage() {
  usePageTitle("Jobs");
  const { data: session } = useSession();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [unconfiguredFolders, setUnconfiguredFolders] = useState<UnconfiguredFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [rootPath, setRootPath] = useState(DEFAULT_ONEDRIVE_ROOT);

  useEffect(() => {
    async function loadJobs() {
      if (!session?.accessToken) return;
      try {
        const settings = await readJsonFile<AppSettings>(
          session.accessToken,
          `${DEFAULT_ONEDRIVE_ROOT}/settings.json`
        );
        const path = settings?.oneDriveRootPath || DEFAULT_ONEDRIVE_ROOT;
        setRootPath(path);

        const items = await listFolder(session.accessToken, path);
        const jobFolders = items.filter((item) => item.folder && !item.name.endsWith(".json"));

        const configured: Job[] = [];
        const unconfigured: UnconfiguredFolder[] = [];

        await Promise.all(jobFolders.map(async (folder) => {
          try {
            const job = await readJsonFile<Job>(
              session.accessToken!,
              `${path}/${folder.name}/job-config.json`
            );
            if (job) {
              configured.push(job);
            } else {
              // readJsonFile returned null (404 or 503) — folder exists but no config
              unconfigured.push({ name: folder.name, configuring: false });
            }
          } catch {
            unconfigured.push({ name: folder.name, configuring: false });
          }
        }));

        setJobs(configured);
        setUnconfiguredFolders(unconfigured);
      } catch (error) {
        console.error("Failed to load jobs:", error);
      } finally {
        setLoading(false);
      }
    }

    loadJobs();
  }, [session?.accessToken]);

  async function configureFolder(folderName: string) {
    if (!session?.accessToken) return;

    setUnconfiguredFolders((prev) =>
      prev.map((f) => f.name === folderName ? { ...f, configuring: true } : f)
    );

    try {
      // Extract job code from folder name (format: "CODE - Address")
      const dashIndex = folderName.indexOf(" - ");
      const jobCode = dashIndex > 0 ? folderName.substring(0, dashIndex) : folderName;
      const address = dashIndex > 0 ? folderName.substring(dashIndex + 3) : folderName;

      const quotableTrades = TRADES.filter((t) => t.quotable);
      const job: Job = {
        jobCode,
        address,
        client: { name: "TBC" },
        region: "Western",
        buildType: "New Build",
        storeys: "Single",
        estimatorId: "",
        status: "active",
        documents: [],
        trades: quotableTrades.map((t) => ({ code: t.code, name: t.name, quotes: [] })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await writeJsonFile(
        session.accessToken,
        `${rootPath}/${folderName}/job-config.json`,
        job
      );

      setJobs((prev) => [...prev, job]);
      setUnconfiguredFolders((prev) => prev.filter((f) => f.name !== folderName));
      toast.success(`Configured ${jobCode} — edit the job to fill in details.`);
    } catch (err) {
      console.error("Failed to configure folder:", err);
      toast.error("Failed to create job-config.json — try again.");
      setUnconfiguredFolders((prev) =>
        prev.map((f) => f.name === folderName ? { ...f, configuring: false } : f)
      );
    }
  }

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
        ) : jobs.length === 0 && unconfiguredFolders.length === 0 ? (
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
          <>
            {unconfiguredFolders.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">Unconfigured Job Folders</h2>
                {unconfiguredFolders.map((folder) => (
                  <Card key={folder.name} className="border-dashed border-yellow-300 bg-yellow-50/50">
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <div className="flex items-center gap-3">
                        <FolderOpen className="w-5 h-5 text-yellow-600" />
                        <span className="text-sm font-medium">{folder.name}</span>
                        <Badge variant="outline" className="text-xs text-yellow-700 border-yellow-300">
                          No job-config.json
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-[36px]"
                        disabled={folder.configuring}
                        onClick={() => configureFolder(folder.name)}
                      >
                        {folder.configuring ? "Configuring..." : "Configure this job"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

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
          </>
        )}
      </div>
    </AuthLayout>
  );
}
