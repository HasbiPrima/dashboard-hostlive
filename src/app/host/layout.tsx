"use client";

import { AppShell } from "@/components/AppShell";

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="host">{children}</AppShell>;
}
