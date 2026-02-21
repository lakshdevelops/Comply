import { ShieldCheck } from "lucide-react";
import GitHubButton from "@/components/ui/GitHubButton";

const footerLinks = [
  { label: "Documentation", href: "#" },
  { label: "Privacy Policy", href: "#" },
  { label: "GitHub Repo", href: "#" },
  { label: "Contact", href: "#" },
];

export default function FooterSection() {
  return (
    <footer className="border-t border-dust-grey-200/60 bg-dust-grey-50 py-12">
      <div className="mx-auto max-w-7xl px-6">
        {/* Main footer row */}
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          {/* Brand */}
          <div className="flex flex-col gap-3 max-w-xs">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-hunter-green-300">
                <ShieldCheck className="h-4 w-4 text-hunter-green-900" />
              </div>
              <span className="font-display text-lg font-bold text-fern-800">Comply</span>
            </div>
            <p className="text-sm text-dry-sage-500 leading-relaxed">
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
                className="text-sm text-dry-sage-600 transition-colors hover:text-fern-800"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="shrink-0">
            <GitHubButton size="sm" label="Sign up with GitHub" />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col gap-2 border-t border-dust-grey-200/40 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-dust-grey-300">
            &copy; {new Date().getFullYear()} Comply. Built with Next.js & Tailwind CSS.
          </p>
          <p className="text-xs text-dust-grey-300">
            Powered by multi-agent AI &mdash; Auditor · Strategist · Legal Advisor
          </p>
        </div>
      </div>
    </footer>
  );
}
