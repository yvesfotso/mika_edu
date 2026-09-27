/** Check mark shown next to EduPrep staff names. */
export function VerifiedBadge({ label = "Verified" }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-ocean-soft px-2 py-0.5 text-xs font-medium text-ocean-strong"
      title="Verified EduPrep staff"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
        <path d="M10 1.5l2.2 1.6 2.7-.2.9 2.6 2.3 1.4-.8 2.6.8 2.6-2.3 1.4-.9 2.6-2.7-.2L10 18.5l-2.2-1.6-2.7.2-.9-2.6-2.3-1.4.8-2.6-.8-2.6 2.3-1.4.9-2.6 2.7.2L10 1.5zm-1.1 11.3l5-5-1.2-1.2-3.8 3.8-1.7-1.7-1.2 1.2 2.9 2.9z" />
      </svg>
      {label}
    </span>
  );
}
