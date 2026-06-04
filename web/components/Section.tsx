import type { ReactNode } from "react";

/** Editorial eyebrow/kicker — the only all-caps in the system. */
export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`kicker ${className}`}>{children}</div>;
}

/** The "standfirst" — a confident lead sentence under a headline/kicker. */
export function Standfirst({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mt-3 max-w-measure text-[0.95rem] leading-relaxed text-muted ${className}`}>{children}</p>;
}

/** A numbered editorial "Act" — a major feature with a hairline section break. */
export function Section({
  kicker, act, children, className = "", id,
}: { kicker?: string; act?: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`mt-16 border-t border-keyline pt-10 ${className}`}>
      {kicker && (
        <Kicker>
          {act && <span className="text-accent">{act} · </span>}
          {kicker}
        </Kicker>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}
