"use client";

import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useSwipeable } from "react-swipeable";
import { useCallback, useState } from "react";
import QuoteCard from "./QuoteCard";
import QuoteDetailDialog from "./QuoteDetailDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Quote } from "@/types";

export interface KanbanItem {
  id: string; // unique key: jobCode-tradeCode-supplierId
  quote: Quote;
  allVersions: Quote[]; // all versions from same supplier for this trade
  tradeCode: string;
  tradeName: string;
  jobCode: string;
}

const COLUMNS: { id: Quote["status"]; label: string; color: string }[] = [
  { id: "not_started", label: "Not Started", color: "bg-gray-100" },
  { id: "requested", label: "Requested", color: "bg-blue-50" },
  { id: "received", label: "Received", color: "bg-green-50" },
  { id: "accepted", label: "Accepted", color: "bg-emerald-50" },
  { id: "declined", label: "Declined", color: "bg-red-50" },
];

const STATUS_ORDER: Quote["status"][] = [
  "not_started", "requested", "received", "accepted", "declined",
];

interface KanbanBoardProps {
  items: KanbanItem[];
  onStatusChange: (itemId: string, newStatus: Quote["status"]) => void;
}

function SwipeableCard({
  item,
  onStatusChange,
  children,
}: {
  item: KanbanItem;
  onStatusChange: (itemId: string, newStatus: Quote["status"]) => void;
  children: React.ReactNode;
}) {
  const advanceStatus = useCallback(() => {
    const currentIdx = STATUS_ORDER.indexOf(item.quote.status);
    if (currentIdx < STATUS_ORDER.length - 1) {
      onStatusChange(item.id, STATUS_ORDER[currentIdx + 1]);
    }
  }, [item, onStatusChange]);

  const regressStatus = useCallback(() => {
    const currentIdx = STATUS_ORDER.indexOf(item.quote.status);
    if (currentIdx > 0) {
      onStatusChange(item.id, STATUS_ORDER[currentIdx - 1]);
    }
  }, [item, onStatusChange]);

  const handlers = useSwipeable({
    onSwipedRight: advanceStatus,
    onSwipedLeft: regressStatus,
    trackMouse: false,
    delta: 50,
    preventScrollOnSwipe: true,
  });

  return <div {...handlers}>{children}</div>;
}

export default function KanbanBoard({ items, onStatusChange }: KanbanBoardProps) {
  const [selectedItem, setSelectedItem] = useState<KanbanItem | null>(null);

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId as Quote["status"];
    const itemId = result.draggableId;
    onStatusChange(itemId, newStatus);
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:snap-none">
          {COLUMNS.map((col) => {
            const colItems = items.filter((item) => item.quote.status === col.id);
            return (
              <div
                key={col.id}
                className="flex-shrink-0 w-72 rounded-lg snap-center"
                style={{ backgroundColor: col.color.replace("bg-", "") }}
              >
                <div className={`rounded-lg ${col.color}`}>
                  <div className="p-3 border-b">
                    <h3 className="font-medium text-sm flex items-center justify-between">
                      {col.label}
                      <span className="text-muted-foreground text-xs bg-white px-2 py-0.5 rounded-full">
                        {colItems.length}
                      </span>
                    </h3>
                  </div>
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <ScrollArea className="h-[calc(100vh-280px)]">
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`p-2 space-y-2 min-h-[100px] transition-colors ${
                            snapshot.isDraggingOver ? "bg-primary/5" : ""
                          }`}
                        >
                          {colItems.map((item, index) => (
                            <Draggable
                              key={item.id}
                              draggableId={item.id}
                              index={index}
                            >
                              {(dragProvided) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  onClick={() => setSelectedItem(item)}
                                >
                                  <SwipeableCard
                                    item={item}
                                    onStatusChange={onStatusChange}
                                  >
                                    <QuoteCard
                                      quote={item.quote}
                                      tradeCode={item.tradeCode}
                                      tradeName={item.tradeName}
                                      jobCode={item.jobCode}
                                    />
                                  </SwipeableCard>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      </ScrollArea>
                    )}
                  </Droppable>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2 md:hidden">
          Swipe cards right to advance status, left to go back
        </p>
      </DragDropContext>

      {selectedItem && (
        <QuoteDetailDialog
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          quote={selectedItem.quote}
          allVersions={selectedItem.allVersions}
          tradeName={selectedItem.tradeName}
          tradeCode={selectedItem.tradeCode}
          jobCode={selectedItem.jobCode}
        />
      )}
    </>
  );
}
