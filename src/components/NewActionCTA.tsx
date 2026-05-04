import { Plus } from "lucide-react";

type Props = {
  label: string;
  onClick: () => void;
};

/**
 * Two presentations of the primary "create" action:
 *
 *  - <DesktopCTA /> — larger inline button intended for the page header on
 *    desktop. Uses the rest of the available header space, doesn't feel
 *    crammed against the title like the old pill did.
 *
 *  - <MobileFAB />  — circular floating action button anchored just above
 *    the bottom nav on mobile. Always reachable, doesn't fight the title
 *    for space.
 *
 * Use both: the FAB hides on `lg:` and the inline CTA hides on `< lg:`.
 */

export function DesktopCTA({ label, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="hidden lg:inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-grotesk text-[12px] uppercase tracking-wider transition active:scale-[0.98]"
      style={{
        background: "rgba(255,255,255,0.08)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.18)",
      }}
    >
      <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
      {label}
    </button>
  );
}

export function MobileFAB({ label, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="lg:hidden fixed right-4 z-40 flex items-center gap-2 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition active:scale-[0.97]"
      style={{
        // sits comfortably above the 76px-tall bottom nav
        bottom: "calc(76px + env(safe-area-inset-bottom, 0px) + 16px)",
        padding: "12px 18px",
        background: "rgba(255,255,255,0.95)",
        color: "#0D0B14",
        boxShadow:
          "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset",
      }}
    >
      <Plus className="w-4 h-4" strokeWidth={2.4} />
      {label}
    </button>
  );
}

export function NewActionCTA({ label, onClick }: Props) {
  return (
    <>
      <DesktopCTA label={label} onClick={onClick} />
      <MobileFAB label={label} onClick={onClick} />
    </>
  );
}
