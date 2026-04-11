"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
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
import { Star, Truck } from "lucide-react";
import { readJsonFile, listFolder } from "@/lib/onedrive";
import type { Job, Supplier, AppSettings } from "@/types";
import { DEFAULT_ONEDRIVE_ROOT } from "@/types";

interface SupplierStats {
  totalRequests: number;
  totalResponses: number;
  responseRate: number;
  avgResponseDays: number;
  quoteHistory: {
    jobCode: string;
    tradeName: string;
    status: string;
    priceExGST?: number;
    requestedDate?: string;
    receivedDate?: string;
    daysToRespond?: number;
  }[];
  avgPriceByTrade: Map<string, number>;
}

function computeStats(supplier: Supplier, jobs: Job[]): SupplierStats {
  let totalRequests = 0;
  let totalResponses = 0;
  let totalResponseDays = 0;
  let responseCount = 0;
  const pricesByTrade = new Map<string, number[]>();
  const quoteHistory: SupplierStats["quoteHistory"] = [];

  for (const job of jobs) {
    for (const trade of job.trades || []) {
      for (const quote of trade.quotes || []) {
        if (quote.supplierId !== supplier.id) continue;

        totalRequests++;
        if (quote.status === "received" || quote.status === "accepted") {
          totalResponses++;
        }

        let daysToRespond: number | undefined;
        if (quote.requestedDate && quote.receivedDate) {
          daysToRespond = Math.floor(
            (new Date(quote.receivedDate).getTime() - new Date(quote.requestedDate).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          totalResponseDays += daysToRespond;
          responseCount++;
        }

        if (quote.priceExGST) {
          const existing = pricesByTrade.get(trade.code) || [];
          existing.push(quote.priceExGST);
          pricesByTrade.set(trade.code, existing);
        }

        quoteHistory.push({
          jobCode: job.jobCode,
          tradeName: trade.name,
          status: quote.status,
          priceExGST: quote.priceExGST,
          requestedDate: quote.requestedDate,
          receivedDate: quote.receivedDate,
          daysToRespond,
        });
      }
    }
  }

  const avgPriceByTrade = new Map<string, number>();
  for (const [code, prices] of Array.from(pricesByTrade.entries())) {
    avgPriceByTrade.set(code, prices.reduce((a, b) => a + b, 0) / prices.length);
  }

  return {
    totalRequests,
    totalResponses,
    responseRate: totalRequests > 0 ? (totalResponses / totalRequests) * 100 : 0,
    avgResponseDays: responseCount > 0 ? totalResponseDays / responseCount : 0,
    quoteHistory: quoteHistory.sort(
      (a, b) =>
        new Date(b.requestedDate || 0).getTime() -
        new Date(a.requestedDate || 0).getTime()
    ),
    avgPriceByTrade,
  };
}

export default function SupplierProfilePage() {
  const { data: session } = useSession();
  const params = useParams();
  const supplierId = params.id as string;
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [stats, setStats] = useState<SupplierStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!session?.accessToken || !supplierId) return;
    try {
      const settings = await readJsonFile<AppSettings>(
        session.accessToken,
        `${DEFAULT_ONEDRIVE_ROOT}/settings.json`
      );
      const rootPath = settings?.oneDriveRootPath || DEFAULT_ONEDRIVE_ROOT;

      const suppliers = (await readJsonFile<Supplier[]>(
        session.accessToken,
        `${rootPath}/suppliers.json`
      )) || [];

      const sup = suppliers.find((s) => s.id === supplierId);
      if (!sup) {
        setLoading(false);
        return;
      }
      setSupplier(sup);

      // Load all jobs
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

      const jobs = (await Promise.all(jobPromises)).filter(
        (j): j is Job => j !== null
      );

      setStats(computeStats(sup, jobs));
    } catch (error) {
      console.error("Failed to load supplier profile:", error);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, supplierId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <AuthLayout>
        <p className="text-muted-foreground">Loading supplier profile...</p>
      </AuthLayout>
    );
  }

  if (!supplier) {
    return (
      <AuthLayout>
        <p className="text-muted-foreground">Supplier not found.</p>
      </AuthLayout>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    verified: "bg-green-100 text-green-800",
    unverified: "bg-yellow-100 text-yellow-800",
    blacklisted: "bg-red-100 text-red-800",
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-lg flex items-center justify-center bg-primary/10">
            <Truck className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{supplier.company}</h1>
            <p className="text-muted-foreground">{supplier.contact}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={STATUS_COLORS[supplier.status] || ""}>
                {supplier.status}
              </Badge>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`w-4 h-4 ${
                      n <= supplier.rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-muted-foreground text-xs">Email</p>
              <p className="font-medium truncate">{supplier.email || "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-muted-foreground text-xs">Phone</p>
              <p className="font-medium">{supplier.phone || "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-muted-foreground text-xs">Regions</p>
              <p className="font-medium">{supplier.regions.join(", ") || "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-muted-foreground text-xs">ABN</p>
              <p className="font-medium">{supplier.abn || "—"}</p>
            </CardContent>
          </Card>
        </div>

        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-2xl font-bold">{stats.totalRequests}</p>
                  <p className="text-xs text-muted-foreground">Total Requests</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-2xl font-bold">{stats.totalResponses}</p>
                  <p className="text-xs text-muted-foreground">Responses</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-2xl font-bold">{stats.responseRate.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">Response Rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-2xl font-bold">
                    {stats.avgResponseDays > 0 ? `${stats.avgResponseDays.toFixed(1)}d` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Response Time</p>
                </CardContent>
              </Card>
            </div>

            {stats.quoteHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Quote History</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead>Trade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Price ex GST</TableHead>
                        <TableHead className="hidden md:table-cell">Requested</TableHead>
                        <TableHead className="hidden md:table-cell">Response</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.quoteHistory.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.jobCode}</TableCell>
                          <TableCell>{row.tradeName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.priceExGST ? `$${row.priceExGST.toLocaleString()}` : "—"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            {row.requestedDate ? new Date(row.requestedDate).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            {row.daysToRespond !== undefined ? `${row.daysToRespond}d` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AuthLayout>
  );
}
