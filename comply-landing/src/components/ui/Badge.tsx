interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export default function Badge({ children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-hunter-green-300/50 bg-hunter-green-100/40 px-3 py-1 text-xs font-medium text-hunter-green-700 ${className}`}
    >
      {children}
    </span>
  );
}
