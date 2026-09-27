"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Side-by-side on large screens; on small screens show the list at /inbox and the thread elsewhere. */
export function InboxPanes({ list, children }: { list: ReactNode; children: ReactNode }) {
  const atIndex = usePathname() === "/inbox";
  return (
    <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className={atIndex ? "" : "hidden lg:block"}>{list}</div>
      <div className={`min-w-0 ${atIndex ? "hidden lg:block" : ""}`}>{children}</div>
    </div>
  );
}
