import { Zap } from "lucide-react";

const techs = [
  { name: "GitHub", mono: "github" },
  { name: "Terraform", mono: "terraform" },
  { name: "Kubernetes", mono: "k8s" },
  { name: "AWS", mono: "aws" },
  { name: "GCP", mono: "gcp" },
];

const stats = [
  { value: "24/7", label: "Autonomous monitoring" },
  { value: "<5 min", label: "First audit time" },
  { value: "50+", label: "Compliance checks" },
  { value: "3", label: "Specialist AI agents" },
];

export default function SocialProofSection() {
  return (
    <section className="py-20 border-y border-dust-grey-200/60 bg-dust-grey-50/40">
      <div className="mx-auto max-w-7xl px-6">
        {/* Hackathon callout */}
        <div className="mb-12 flex items-center justify-center gap-3 text-center">
          <Zap className="h-5 w-5 text-hunter-green-600 shrink-0" />
          <p className="text-base italic font-medium text-dry-sage-700">
            &ldquo;Hackathon-ready, built by a multi-agent team&rdquo;
          </p>
          <Zap className="h-5 w-5 text-hunter-green-600 shrink-0" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 mb-14">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1 text-center">
              <span className="text-3xl font-extrabold tabular-nums text-fern-700">
                {stat.value}
              </span>
              <span className="text-xs text-dry-sage-500 uppercase tracking-wide">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Tech stack */}
        <p className="mb-5 text-center text-sm font-medium text-dust-grey-400 uppercase tracking-widest">
          Built for modern infrastructure stacks
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {techs.map((tech) => (
            <div
              key={tech.name}
              className="flex items-center gap-2 rounded-lg border border-dust-grey-200 bg-dust-grey-100/50 px-4 py-2"
            >
              <span className="font-mono text-xs text-dry-sage-500">{tech.mono}</span>
              <span className="text-sm font-medium text-dry-sage-700">{tech.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
