"use client";

import { AppShell } from "@/components/AppShell";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="manager">{children}</AppShell>;
}
