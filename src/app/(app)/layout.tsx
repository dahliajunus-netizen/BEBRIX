import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Spinner } from "@/components/ui";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={<Spinner />}>{children}</Suspense>
    </AppShell>
  );
}
