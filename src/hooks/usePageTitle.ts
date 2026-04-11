"use client";

import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — Renify Quote Platform`;
  }, [title]);
}
