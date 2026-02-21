export default function OrDivider() {
  return (
    <div className="relative flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-dust-grey-200" />
      <span className="text-xs font-medium uppercase tracking-widest text-dust-grey-400">
        or
      </span>
      <div className="h-px flex-1 bg-dust-grey-200" />
    </div>
  );
}
