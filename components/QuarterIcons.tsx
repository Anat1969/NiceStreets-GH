import QuarterIcon from "@/components/QuarterIcon";
import "./street-media.css";

/** אייקון לכל רובע שהרחוב עובר בו. דקורטיבי: השם לידו נושא את המשמעות. */
export default function QuarterIcons({
  ids,
  size = 18,
  max = 4,
}: {
  ids: string[];
  size?: number;
  max?: number;
}) {
  if (ids.length === 0) return null;
  const shown = ids.slice(0, max);
  return (
    <span className="quarter-icons" aria-hidden="true">
      {shown.map((id) => (
        <QuarterIcon key={id} id={id} size={size} className="text-accent" />
      ))}
      {ids.length > max ? <span className="quarter-icons-more">+{ids.length - max}</span> : null}
    </span>
  );
}
