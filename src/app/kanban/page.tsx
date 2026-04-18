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
import { GripVertical, Clock, AlertTriangle } from "lucide-react";
import { getJobs, saveJob } from "@/lib/supabase";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { toast } from "sonner";
import type { Job, Quote } from "@/types";

const COLUMNS: { key: Quote["status"]; label: string; color: string }[] = [
  { key: "not_started", label: "Not Started", color: "bg-gray-100 border-gray-300" },
  { key: "requested", label: "Requested", color: "bg-blue-50 border-blue-300" },
  { key: "received", label: "Received", color: "bg-green-50 border-green-300" },
  { key: "accepted", label: "Accepted", color: "bg-emerald-50 border-emerald-300" },
  { key: "declined", label: "Declined", color: "bg-red-50 border-red-300" },
];

interface KanbanCard {
  tradeCode: string;
  tradeName: string;
  supplierId: string;
  supplierName: string;
  status: Quote["status"];
  priceExGST?: number;
  quoteExpiry?: string;
  requestedDate?: string;
  followUpCount: number;
}

export default function KanbanPage() {
  usePageTitle("Quote Board");
  useSession();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobCode, setSelectedJobCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [draggedCard, setDraggedCard] = useState<KanbanCard | null>(null);
  const dragOverCol = useRef<Quote["status"] | null>(null);
  const [highlightCol, setHighlightCol] = useState<Quote["status"] | null>(null);

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

  // Build kanban cards from job trades + quotes
  const cards: KanbanCard[] = [];
  if (selectedJob) {
    for (const trade of selectedJob.trades || []) {
      if (trade.quotes && trade.quotes.length > 0) {
        for (const quote of trade.quotes) {
          cards.push({
            tradeCode: trade.code,
            tradeName: trade.name,
            supplierId: quote.supplierId,
            supplierName: quote.supplierName,
            status: quote.status,
            priceExGST: quote.priceExGST,
            quoteExpiry: quote.quoteExpiry,
            requestedDate: quote.requestedDate,
            followUpCount: quote.followUpCount,
          });
        }
      } else {
        // Trade with no quotes = not started placeholder
        cards.push({
          tradeCode: trade.code,
          tradeName: trade.name,
          supplierId: "",
          supplierName: "No supplier yet",
          status: "not_started",
          followUpCount: 0,
        });
      }
    }
  }

  function getColumnCards(status: Quote["status"]) {
    return cards.filter((c) => c.status === status);
  }

  async function moveCard(card: KanbanCard, newStatus: Quote["status"]) {
    if (!selectedJob || card.status === newStatus) return;

    const updatedJob = { ...selectedJob };
    updatedJob.trades = updatedJob.trades.map((trade) => {
      if (trade.code !== card.tradeCode) return trade;
      return {
        ...trade,
        quotes: (trade.quotes || []).map((q) => {
          if (q.supplierId !== card.supplierId) return q;
          return { ...q, status: newStatus };
        }),
      };
    });

    try {
      await saveJob(updatedJob);
      setJobs((prev) => prev.map((j) => (j.jobCode === updatedJob.jobCode ? updatedJob : j)));
      toast.success(`${card.tradeName} → ${newStatus.replace("_", " ")}`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  // Desktop drag handlers
  function handleDragStart(card: KanbanCard) {
    setDraggedCard(card);
  }

  function handleDragOver(e: React.DragEvent, status: Quote["status"]) {
    e.preventDefault();
    dragOverCol.current = status;
    setHighlightCol(status);
  }

  function handleDragLeave() {
    setHighlightCol(null);
  }

  function handleDrop(status: Quote["status"]) {
    if (draggedCard) {
      moveCard(draggedCard, status);
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
          setHighlightCol(col.getAttribute("data-kanban-col") as Quote["status"]);
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

  function isExpired(expiry?: string) {
    if (!expiry) return false;
    return new Date(expiry) < new Date();
  }

  function isOverdue(requestedDate?: string) {
    if (!requestedDate) return false;
    const days = Math.floor((Date.now() - new Date(requestedDate).getTime()) / (1000 * 60 * 60 * 24));
    return days >= 7;
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
                      {colCards.map((card, idx) => {
                        const expired = isExpired(card.quoteExpiry);
                        const overdue = col.key === "requested" && isOverdue(card.requestedDate);
                        const followedUp2x = card.followUpCount >= 2;

                        return (
                          <div
                            key={`${card.tradeCode}-${card.supplierId}-${idx}`}
                            draggable={!!card.supplierId}
                            onDragStart={() => handleDragStart(card)}
                            onTouchStart={(e) => handleTouchStart(e, card)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            className={`bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${
                              followedUp2x && col.key === "requested" ? "border-red-400 bg-red-50" : ""
                            } ${expired ? "border-orange-400" : ""}`}
                          >
                            <div className="flex items-start gap-2">
                              <GripVertical className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {card.tradeName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {card.supplierName}
                                </p>
                                {card.priceExGST && (
                                  <p className="text-sm font-mono font-medium mt-1 text-[#2D5E3A]">
                                    ${card.priceExGST.toLocaleString()}
                                  </p>
                                )}
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {expired && (
                                    <Badge className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0">
                                      <AlertTriangle className="w-3 h-3 mr-0.5" />
                                      Expired
                                    </Badge>
                                  )}
                                  {overdue && (
                                    <Badge className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0">
                                      <Clock className="w-3 h-3 mr-0.5" />
                                      Overdue
                                    </Badge>
                                  )}
                                  {followedUp2x && col.key === "requested" && (
                                    <Badge className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0">
                                      2x followed up
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
