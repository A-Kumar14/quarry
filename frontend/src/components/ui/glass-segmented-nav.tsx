import React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "../../lib/utils";
import { GlassFilter } from "./liquid-radio";

export type GlassSegmentItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
};

type GlassSegmentedNavProps = {
  items: GlassSegmentItem[];
  activeIndex: number;
  className?: string;
  ariaLabel?: string;
};

export function GlassSegmentedNav({
  items,
  activeIndex,
  className,
  ariaLabel = "Primary navigation",
}: GlassSegmentedNavProps) {
  const count = Math.max(1, items.length);
  const safeIndex = Math.min(Math.max(activeIndex, 0), count - 1);
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const el = document.documentElement;
    const update = () => setIsDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex h-9 rounded-lg border border-border p-0.5",
        className,
      )}
    >
      <div
        className="absolute top-0 left-0 isolate -z-10 h-full w-full overflow-hidden rounded-lg"
        style={{ filter: 'url("#radio-glass")' }}
      />

      <div
        className={cn(
          "group relative inline-grid h-full items-center gap-0 text-sm font-medium rounded-md overflow-hidden",
          'bg-[rgba(255,255,255,0.18)] dark:bg-[rgba(20,16,14,0.42)] backdrop-blur-[14px]',
          "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[color:var(--accent)]",
        )}
        style={{
          gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
          // highlight pill sizing & position
          ["--seg-w" as any]: `${100 / count}%`,
          ["--seg-x" as any]: `${(100 / count) * safeIndex}%`,
        }}
      >
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-md"
          style={{
            width: "var(--seg-w)",
            transform: "translateX(var(--seg-x))",
            background: isDark ? "rgba(20,16,14,0.62)" : "rgba(255,255,255,0.42)",
            boxShadow:
              "0 0 6px rgba(0,0,0,0.03),0 2px 6px rgba(0,0,0,0.08),inset 3px 3px 0.5px -3px rgba(0,0,0,0.9),inset -3px -3px 0.5px -3px rgba(0,0,0,0.85),inset 1px 1px 1px -0.5px rgba(0,0,0,0.6),inset -1px -1px 1px -0.5px rgba(0,0,0,0.6),inset 0 0 6px 6px rgba(0,0,0,0.12),inset 0 0 2px 2px rgba(0,0,0,0.06),0 0 12px rgba(255,255,255,0.15)",
            transition:
              "transform 300ms cubic-bezier(0.16,1,0.3,1), background-color 200ms ease",
          }}
        />

        {items.map((item, idx) => {
          const Icon = item.icon;
          const isActive = idx === safeIndex;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              aria-label={item.label}
              className={cn(
                "relative z-10 inline-flex h-full min-w-8 cursor-pointer select-none items-center justify-center whitespace-nowrap px-3 transition-colors",
                "text-[color:var(--fg-dim)] hover:text-[color:var(--fg-primary)]",
                isActive && "text-[color:var(--fg-primary)]",
              )}
            >
              <Icon size={18} strokeWidth={2} aria-hidden />
            </button>
          );
        })}

        <GlassFilter />
      </div>
    </nav>
  );
}

