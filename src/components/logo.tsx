import { cn } from "@/lib/utils";

/** BEBRIX wordmark: a beaver-tail "B" tile built from logic-grid squares. */
export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
        <rect width="30" height="30" rx="8" fill={light ? "#ffffff" : "#0b1f3a"} />
        <rect x="7" y="7" width="6" height="6" rx="1.5" fill={light ? "#0b1f3a" : "#ffffff"} />
        <rect x="7" y="17" width="6" height="6" rx="1.5" fill={light ? "#0b1f3a" : "#ffffff"} />
        <rect x="17" y="7" width="6" height="6" rx="1.5" fill="#06b6d4" />
        <rect x="17" y="17" width="6" height="6" rx="3" fill="#3b79f2" />
      </svg>
      <span className={cn("text-[19px] font-extrabold tracking-tight", light ? "text-white" : "text-navy-900")}>
        BEBR<span className="text-cyan-500">IX</span>
      </span>
    </span>
  );
}
