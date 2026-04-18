"use client";

import { useEffect, useRef, useState } from "react";

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number; // pixels to pull before triggering (default 80)
}

export function usePullToRefresh({ onRefresh, threshold = 80 }: PullToRefreshOptions) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleTouchStart(e: TouchEvent) {
      // Only trigger if scrolled to top
      if (container!.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        setPulling(true);
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && container!.scrollTop <= 0) {
        setPullDistance(Math.min(dy * 0.5, threshold * 1.5));
        if (dy > 10) e.preventDefault();
      }
    }

    function handleTouchEnd() {
      if (pullDistance >= threshold && !refreshing) {
        setRefreshing(true);
        onRefresh().finally(() => {
          setRefreshing(false);
          setPullDistance(0);
          setPulling(false);
        });
      } else {
        setPullDistance(0);
        setPulling(false);
      }
    }

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pulling, pullDistance, refreshing, threshold, onRefresh]);

  return { containerRef, pullDistance, refreshing };
}
