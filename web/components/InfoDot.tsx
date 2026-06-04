"use client";
import { useEffect, useId, useRef, useState } from "react";

/** A real, keyboard- and touch-reachable "?" glyph that reveals a short
 *  explanation. Replaces the old title-only span so the honesty footnotes are
 *  accessible: Tab to focus, Enter/Space to toggle, Esc (or outside click) to
 *  close. The popover is role="tooltip" and the trigger announces aria-expanded. */
export function InfoDot({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  // Close on outside pointer/touch and on Escape, only while open.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block align-super leading-none">
      <button
        type="button"
        aria-label="Explain"
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[8px] font-mono leading-none transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-faint ${
          open
            ? "border-muted text-muted"
            : "border-keyline text-faint hover:text-muted"
        }`}
      >
        <span aria-hidden>?</span>
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className="anim-fade-in absolute left-1/2 top-full z-20 mt-1.5 block w-max max-w-[16rem] -translate-x-1/2 rounded border border-keyline bg-surface p-3 text-left font-display text-[0.8rem] italic leading-snug text-muted shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
