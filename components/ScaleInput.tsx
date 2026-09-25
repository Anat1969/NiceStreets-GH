"use client";

/** 1 = גרוע … 5 = מצוין. The word is part of every button, never colour alone. */
export const SCALE_STEPS = [
  { value: 1, label: "גרוע" },
  { value: 2, label: "חלש" },
  { value: 3, label: "בינוני" },
  { value: 4, label: "טוב" },
  { value: 5, label: "מצוין" },
] as const;

export default function ScaleInput({
  name,
  value,
  onChange,
}: {
  /** Used in the accessible label, so each group reads on its own. */
  name: string;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label={`דירוג ${name}`}>
      {SCALE_STEPS.map((step) => {
        const selected = value === step.value;
        return (
          <button
            key={step.value}
            type="button"
            aria-pressed={selected}
            aria-label={`${name}: ${step.value} — ${step.label}`}
            onClick={() => onChange(step.value)}
            style={{
              background: `var(--color-scale-${step.value}${selected ? "-on" : ""})`,
            }}
            className={`min-h-11 flex-1 rounded-[10px] px-1 py-1 text-ink transition-colors ${
              selected
                ? "border-2 border-ink font-bold shadow-[inset_0_0_0_2px_rgba(255,255,255,0.65)]"
                : "border border-line font-normal"
            }`}
          >
            <span className="block text-[15px] tabular-nums leading-tight">
              {step.value}
            </span>
            <span className="block text-[11px] leading-tight">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}
