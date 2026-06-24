// Small "(i)" affordance with a hover explanation — for inspector fields/columns
// whose meaning isn't obvious to a non-expert. Reused across the inspectors so
// the help pattern is consistent.
export function InfoTip({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span
      role="img"
      aria-label={text}
      title={text}
      className={`inline-flex h-[14px] w-[14px] flex-shrink-0 cursor-help items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold normal-case tracking-normal text-slate-500 align-middle ${className}`}
    >
      i
    </span>
  );
}
