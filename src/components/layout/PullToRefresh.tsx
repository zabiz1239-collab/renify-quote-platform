'use client';

import { useRef, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const THRESHOLD = 80;

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isRefreshing) return;
      if (!('ontouchstart' in window)) return;
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    },
    [isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling.current || isRefreshing) return;
      if (window.scrollY > 0) {
        isPulling.current = false;
        setPullDistance(0);
        return;
      }
      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, currentY - touchStartY.current);
      // Apply resistance: the further you pull, the harder it gets
      const resistedDistance = Math.min(distance * 0.5, 150);
      setPullDistance(resistedDistance);
    },
    [isRefreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current || isRefreshing) return;
    isPulling.current = false;

    if (pullDistance >= THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, onRefresh]);

  const thresholdReached = pullDistance >= THRESHOLD;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center overflow-hidden z-50"
        style={{
          height: pullDistance > 0 || isRefreshing ? `${pullDistance}px` : 0,
          transition: isPulling.current ? 'none' : 'height 0.3s ease',
        }}
      >
        <RefreshCw
          className={`h-6 w-6 text-[#2D5E3A] transition-transform duration-200 ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          style={{
            transform: isRefreshing
              ? undefined
              : `rotate(${thresholdReached ? 180 : (pullDistance / THRESHOLD) * 180}deg)`,
          }}
        />
      </div>

      {/* Content */}
      <div
        style={{
          transform: pullDistance > 0 || isRefreshing ? `translateY(${pullDistance}px)` : 'none',
          transition: isPulling.current ? 'none' : 'transform 0.3s ease',
        }}
      >
        {children}
      </div>
    </div>
  );
}
