import { Icon } from "./icons";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${light ? "bg-lime text-strong" : "bg-strong text-lime"}`}>
        <Icon name="cap" size={19} strokeWidth={2.2} />
      </span>
      <span className={`font-display text-[21px] font-bold tracking-[-0.04em] ${light ? "text-white" : "text-ink"}`}>EduPrep</span>
    </span>
  );
}
