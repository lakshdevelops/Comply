interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export default function Badge({ children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-warm-brown-300/50 bg-warm-brown-100/40 px-3 py-1 text-xs font-medium text-warm-brown-700 ${className}`}
    >
      {children}
    </span>
  );
}
