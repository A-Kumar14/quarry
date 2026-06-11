import React from "react";
import { GlassFilter } from "./liquid-radio";
import { RadioGroup, RadioGroupItem } from "./radio-group";

type Environment = "offline" | "online";

type EnvironmentToggleProps = {
  value: Environment;
  onValueChange: (value: Environment) => void;
  className?: string;
  offlineLabel?: string;
  onlineLabel?: string;
};

export function EnvironmentToggle({
  value,
  onValueChange,
  className,
  offlineLabel = "Test",
  onlineLabel = "Prod",
}: EnvironmentToggleProps) {
  return (
    <div className={["inline-flex h-9 rounded-lg p-0.5 border border-border", className].filter(Boolean).join(" ")}>
      <RadioGroup
        value={value}
        onValueChange={v => onValueChange(v as Environment)}
        className={[
          "group relative inline-grid grid-cols-[1fr_1fr] items-center gap-0 text-sm font-medium rounded-md overflow-hidden",
          'bg-[rgba(255,255,255,0.18)] dark:bg-[rgba(20,16,14,0.42)] backdrop-blur-[14px]',
          "after:absolute after:inset-y-0 after:w-1/2 after:rounded-md",
          'after:bg-[rgba(255,255,255,0.42)] dark:after:bg-[rgba(20,16,14,0.62)]',
          "after:shadow-[0_0_6px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3px_rgba(0,0,0,0.9),inset_-3px_-3px_0.5px_-3px_rgba(0,0,0,0.85),inset_1px_1px_1px_-0.5px_rgba(0,0,0,0.6),inset_-1px_-1px_1px_-0.5px_rgba(0,0,0,0.6),inset_0_0_6px_6px_rgba(0,0,0,0.12),inset_0_0_2px_2px_rgba(0,0,0,0.06),0_0_12px_rgba(255,255,255,0.15)]",
          "after:transition-transform after:duration-300 after:[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
          "has-[:focus-visible]:after:outline has-[:focus-visible]:after:outline-2",
          "data-[state=offline]:after:translate-x-0 data-[state=online]:after:translate-x-full",
        ].join(" ")}
        data-state={value}
      >
        <div
          className="absolute top-0 left-0 isolate -z-10 h-full w-full overflow-hidden rounded-md"
          style={{ filter: 'url("#radio-glass")' }}
        />

        <label className="relative z-10 inline-flex h-full min-w-8 cursor-pointer select-none items-center justify-center whitespace-nowrap px-4 transition-colors text-[color:var(--fg-dim)] group-data-[state=online]:text-[color:var(--fg-dim)] group-data-[state=offline]:text-[color:var(--fg-primary)]">
          {offlineLabel}
          <RadioGroupItem id="env-offline" value="offline" className="sr-only" />
        </label>

        <label className="relative z-10 inline-flex h-full min-w-8 cursor-pointer select-none items-center justify-center whitespace-nowrap px-4 transition-colors text-[color:var(--fg-dim)] group-data-[state=offline]:text-[color:var(--fg-dim)] group-data-[state=online]:text-[color:var(--fg-primary)]">
          {onlineLabel}
          <RadioGroupItem id="env-online" value="online" className="sr-only" />
        </label>

        <GlassFilter />
      </RadioGroup>
    </div>
  );
}

