"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function WebsiteVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    let referrer: string | null = null;
    try {
      referrer = document.referrer ? new URL(document.referrer).origin : null;
    } catch {
      referrer = null;
    }
    const payload = JSON.stringify({ path: pathname, referrer });
    const sent = navigator.sendBeacon("/api/analytics/visit", new Blob([payload], { type: "application/json" }));
    if (!sent) {
      void fetch("/api/analytics/visit", { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
    }
  }, [pathname]);

  return null;
}
