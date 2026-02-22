const footerLinks = [
  { label: "Documentation", href: "#" },
  { label: "Privacy Policy", href: "#" },
  { label: "GitHub Repo", href: "#" },
  { label: "Contact", href: "#" },
];

export default function FooterSection() {
  return (
    <footer className="border-t border-warm-grey-200 bg-warm-white py-12">
      <div className="mx-auto max-w-7xl px-6">
        {/* Main footer row */}
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          {/* Brand */}
          <div className="flex flex-col gap-3 max-w-xs">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-semibold text-warm-grey-900">Comply</span>
            </div>
            <p className="text-sm text-warm-grey-500 leading-relaxed">
              Autonomous compliance for your infrastructure — audit, remediate,
              and ship fixes in minutes.
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {footerLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-warm-grey-600 transition-colors hover:text-warm-grey-900"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col gap-2 border-t border-warm-grey-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-warm-grey-400">
            &copy; {new Date().getFullYear()} Comply. Built with Next.js & Tailwind CSS.
          </p>
          <p className="text-xs text-warm-grey-400">
            Powered by multi-agent AI &mdash; Auditor · Strategist · Legal Advisor
          </p>
        </div>
      </div>
    </footer>
  );
}
