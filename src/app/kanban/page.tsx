"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback, useRef } from "react";
import AuthLayout from "@/components/layout/AuthLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GripVertical } from "lucide-react";
import { getJobs, saveJob } from "@/lib/supabase";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { toast } from "sonner";
import type { Job, Quote } from "@/types";

type ColumnKey = "requested" | "chase_7" | "chase_14" | "received";

const COLUMNS: { key: ColumnKey; label: string; color: string }[] = [
  { key: "requested", label: "Requested", color: "bg-blue-50 border-blue-300" },
  { key: "chase_7", label: "7 Day Chase Up", color: "bg-yellow-50 border-yellow-300" },
  { key: "chase_14", label: "14 Day Chase Up", color: "bg-orange-50 border-orange-300" },
  { key: "received", label: "Received", color: "bg-green-50 border-green-300" },
];

interface KanbanCard {
  tradeCode: string;
  tradeName: string;
  supplierId: string;
  supplierName: string;
  status: Quote["status"];
  column: ColumnKey;
  priceExGST?: number;
  quoteExpiry?: string;
  requestedDate?: string;
  daysAgo: number;
  followUpCount: number;
}

export default function KanbanPage() {
  usePageTitle("Quote Board");
  useSession();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobCode, setSelectedJobCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [draggedCard, setDraggedCard] = useState<KanbanCard | null>(null);
  const dragOverCol = useRef<ColumnKey | null>(null);
  const [highlightCol, setHighlightCol] = useState<ColumnKey | null>(null);

  // Touch drag state
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchCardRef = useRef<KanbanCard | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async () => {
    try {
      const jobsData = await getJobs();
      setJobs(jobsData);
      if (jobsData.length > 0 && !selectedJobCode) {
        const active = jobsData.find((j) => j.status === "active" || j.status === "quoting");
        if (active) setSelectedJobCode(active.jobCode);
      }
    } catch (err) {
      console.error("Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedJobCode]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedJob = jobs.find((j) => j.jobCode === selectedJobCode);

  // Build kanban cards — only requested and received quotes
  const cards: KanbanCard[] = [];
  const now = Date.now();
  if (selectedJob) {
    for (const trade of selectedJob.trades || []) {
      for (const quote of trade.quotes || []) {
        if (quote.status !== "requested" && quote.status !== "received" && quote.status !== "accepted") continue;

        const daysAgo = quote.requestedDate
          ? Math.floor((now - new Date(quote.requestedDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        let column: ColumnKey;
        if (quote.status === "received" || quote.status === "accepted") {
          column = "received";
        } else if (daysAgo >= 14) {
          column = "chase_14";
        } else if (daysAgo >= 7) {
          column = "chase_7";
        } else {
          column = "requested";
        }

        cards.push({
          tradeCode: trade.code,
          tradeName: trade.name,
          supplierId: quote.supplierId,
          supplierName: quote.supplierName,
          status: quote.status,
          column,
          priceExGST: quote.priceExGST,
          quoteExpiry: quote.quoteExpiry,
          requestedDate: quote.requestedDate,
          daysAgo,
          followUpCount: quote.followUpCount,
        });
      }
    }
  }

  function getColumnCards(col: ColumnKey) {
    return cards.filter((c) => c.column === col);
  }

  async function moveCard(card: KanbanCard, targetCol: ColumnKey) {
    if (!selectedJob || card.column === targetCol) return;

    // Only "received" column changes the actual status
    const newStatus: Quote["status"] = targetCol === "received" ? "received" : "requested";
    if (card.status === newStatus) return;

    const updatedJob = { ...selectedJob };
    updatedJob.trades = updatedJob.trades.map((trade) => {
      if (trade.code !== card.tradeCode) return trade;
      return {
        ...trade,
        quotes: (trade.quotes || []).map((q) => {
          if (q.supplierId !== card.supplierId) return q;
          return {
            ...q,
            status: newStatus,
            ...(newStatus === "received" ? { receivedDate: new Date().toISOString() } : {}),
          };
        }),
      };
    });

    try {
      await saveJob(updatedJob);
      setJobs((prev) => prev.map((j) => (j.jobCode === updatedJob.jobCode ? updatedJob : j)));
      toast.success(`${card.tradeName} → ${targetCol === "received" ? "Received" : "Requested"}`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  // Desktop drag handlers
  function handleDragStart(card: KanbanCard) {
    setDraggedCard(card);
  }

  function handleDragOver(e: React.DragEvent, col: ColumnKey) {
    e.preventDefault();
    dragOverCol.current = col;
    setHighlightCol(col);
  }

  function handleDragLeave() {
    setHighlightCol(null);
  }

  function handleDrop(col: ColumnKey) {
    if (draggedCard) {
      moveCard(draggedCard, col);
    }
    setDraggedCard(null);
    setHighlightCol(null);
  }

  // Touch drag handlers
  function handleTouchStart(e: React.TouchEvent, card: KanbanCard) {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    touchCardRef.current = card;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchCardRef.current || !touchStartRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
    if (dx > 30) {
      // Show ghost element
      if (!ghostRef.current) {
        const ghost = document.createElement("div");
        ghost.className = "fixed z-50 bg-white border rounded-lg shadow-xl p-2 text-sm pointer-events-none opacity-90";
        ghost.textContent = `${touchCardRef.current.tradeName} — ${touchCardRef.current.supplierName}`;
        document.body.appendChild(ghost);
        ghostRef.current = ghost;
      }
      ghostRef.current.style.left = `${touch.clientX - 60}px`;
      ghostRef.current.style.top = `${touch.clientY - 20}px`;

      // Detect which column we're over
      const columns = document.querySelectorAll("[data-kanban-col]");
      columns.forEach((col) => {
        const rect = col.getBoundingClientRect();
        if (touch.clientX >= rect.left && touch.clientX <= rect.right) {
          setHighlightCol(col.getAttribute("data-kanban-col") as ColumnKey);
        }
      });
    }
  }

  function handleTouchEnd() {
    if (touchCardRef.current && highlightCol) {
      moveCard(touchCardRef.current, highlightCol);
    }
    touchCardRef.current = null;
    touchStartRef.current = null;
    setHighlightCol(null);
    if (ghostRef.current) {
      ghostRef.current.remove();
      ghostRef.current = null;
    }
  }

  const { containerRef, pullDistance, refreshing: ptr } = usePullToRefresh({
    onRefresh: loadData,
  });

  if (loading) {
    return (
      <AuthLayout>
        <p className="text-muted-foreground">Loading...</p>
      </AuthLayout>
    );
  }

  const activeJobs = jobs.filter((j) => j.status === "active" || j.status === "quoting");

  return (
    <AuthLayout>
      <div ref={containerRef} className="space-y-4">
        {(pullDistance > 0 || ptr) && (
          <div
            className="flex items-center justify-center text-sm text-muted-foreground transition-all"
            style={{ height: pullDistance > 0 ? pullDistance : 40 }}
          >
            {ptr ? "Refreshing..." : pullDistance >= 80 ? "Release to refresh" : "Pull to refresh"}
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Quote Board</h1>
          <Select value={selectedJobCode} onValueChange={setSelectedJobCode}>
            <SelectTrigger className="min-h-[44px] w-full sm:w-[300px]">
              <SelectValue placeholder="Select a job..." />
            </SelectTrigger>
            <SelectContent>
              {activeJobs.map((j) => (
                <SelectItem key={j.jobCode} value={j.jobCode}>
                  {j.jobCode} — {j.address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedJob ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">Select a job to view its quote board.</p>
            </CardContent>
          </Card>
        ) : cards.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No trades on this job yet. Add trades when creating or editing the job.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Column counts */}
            <div className="flex gap-2 flex-wrap">
              {COLUMNS.map((col) => (
                <Badge key={col.key} variant="secondary" className="text-xs">
                  {col.label}: {getColumnCards(col.key).length}
                </Badge>
              ))}
            </div>

            {/* Kanban columns — horizontal scroll on mobile */}
            <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
              {COLUMNS.map((col) => {
                const colCards = getColumnCards(col.key);
                return (
                  <div
                    key={col.key}
                    data-kanban-col={col.key}
                    className={`flex-shrink-0 w-[260px] sm:w-[240px] lg:flex-1 rounded-lg border-2 p-3 transition-colors ${col.color} ${
                      highlightCol === col.key ? "ring-2 ring-[#2D5E3A] border-[#2D5E3A]" : ""
                    }`}
                    onDragOver={(e) => handleDragOver(e, col.key)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(col.key)}
                  >
                    <h3 className="text-sm font-semibold mb-3 flex items-center justify-between">
                      {col.label}
                      <span className="text-xs font-normal text-muted-foreground bg-white rounded-full px-2 py-0.5">
                        {colCards.length}
                      </span>
                    </h3>

                    <div className="space-y-2">
                      {colCards.map((card, idx) => (
                          <div
                            key={`${card.tradeCode}-${card.supplierId}-${idx}`}
                            draggable={!!card.supplierId}
                            onDragStart={() => handleDragStart(card)}
                            onTouchStart={(e) => handleTouchStart(e, card)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            className={`bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${
                              card.column === "chase_14" ? "border-orange-400" : ""
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <GripVertical className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{card.tradeName}</p>
                                <p className="text-xs text-muted-foreground truncate">{card.supplierName}</p>
                                {card.priceExGST && (
                                  <p className="text-sm font-mono font-medium mt-1 text-[#2D5E3A]">
                                    ${card.priceExGST.toLocaleString()}
                                  </p>
                                )}
                                {card.status === "requested" && card.daysAgo > 0 && (
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    {card.daysAgo}d ago
                                    {card.followUpCount > 0 && ` · ${card.followUpCount}x chased`}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
