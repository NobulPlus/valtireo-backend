/**
 * The Valtireo mark: a layered V built from two converging strokes (teal +
 * blue, echoing the product's core identity colors), a gold node marking
 * decision/approval/governance moments, and a cyan node marking AI and
 * automation moments. Source: docs/valtireo-brand-guide-v1.pdf.
 *
 * `withBackground` wraps the glyph in the pine rounded-square container used
 * in the brand guide's primary lockup. Pass `withBackground={false}` when
 * the mark already sits on a pine surface (e.g. the sidebar) to avoid a
 * double background.
 */
export function Logomark({ size = 28, withBackground = true }: { size?: number; withBackground?: boolean }) {
  const mark = (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="13.6" y="2.6" width="4.8" height="4.8" rx="1.2" fill="#FFCC29" />
      <path d="M9.4 9.4 L16 24.6" stroke="#2F8F8A" strokeWidth="3.1" strokeLinecap="round" />
      <path d="M22.6 9.4 L16 24.6" stroke="#244F7A" strokeWidth="3.1" strokeLinecap="round" />
      <circle cx="16" cy="25" r="2.35" fill="#16B6C9" />
    </svg>
  );

  if (!withBackground) return mark;

  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-lg bg-pine"
      style={{ width: size + 12, height: size + 12 }}
    >
      {mark}
    </div>
  );
}
