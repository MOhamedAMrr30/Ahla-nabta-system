import { cn } from "@/lib/utils";

export function getMarginZone(margin: number): "green" | "yellow" | "red" {
  if (margin >= 75) return "green";
  if (margin >= 65) return "yellow";
  return "red";
}

export function MarginBadge({ margin }: { margin: number }) {
  const zone = getMarginZone(margin);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        zone === "green" && "bg-margin-green/15 text-margin-green",
        zone === "yellow" && "bg-margin-yellow/15 text-margin-yellow",
        zone === "red" && "bg-margin-red/15 text-margin-red"
      )}
    >
      {margin.toFixed(1)}%
    </span>
  );
}
