export function InfoDot({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="ml-1 inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-zinc-600 align-middle text-[9px] leading-none text-zinc-400"
    >
      i
    </span>
  );
}
