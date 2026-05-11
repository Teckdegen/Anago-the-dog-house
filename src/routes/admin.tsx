import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAccount } from "wagmi";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — The Dog House" }] }),
});

/**
 * Admin page now redirects to the Farm page's Admin tab.
 * All admin functionality (create farms, add rewards, manage) is in /farm.
 */
function AdminPage() {
  const { address } = useAccount();

  return (
    <AppShell>
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        <div className="rounded-xl p-8 text-center" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.05)" }}>
          <p className="font-grotesk uppercase text-[16px] tracking-wider mb-2" style={{ color: "#EDE0FF" }}>
            Admin Dashboard Moved
          </p>
          <p className="font-mono text-[11px] mb-4" style={{ color: "rgba(196,168,240,0.55)" }}>
            Farm management is now in the Farm page under the "Admin" tab.
          </p>
          <a href="/farm" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-grotesk text-[11px] uppercase tracking-wider transition hover:opacity-90"
            style={{ background: "rgba(155,127,212,0.25)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.55)" }}>
            Go to Farm Admin →
          </a>
        </div>
      </div>
    </AppShell>
  );
}
