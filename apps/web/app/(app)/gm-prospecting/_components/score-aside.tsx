"use client";

import { motion } from "motion/react";

import { cn } from "@kit/ui/lib/utils";

import {
  auditBand,
  type AuditBand,
  type AuditSectionScore,
} from "@/lib/audit/score";

type Props = {
  overall: number;
  sections: AuditSectionScore[];
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

export function ScoreAside({ overall, sections }: Props) {
  return (
    <motion.aside
      className="space-y-1.5"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <ScoreRow label="Overall Score" score={overall} highlight />
      {sections.map((s) => (
        <ScoreRow
          key={s.key}
          label={s.label}
          score={s.score}
          status={s.status}
        />
      ))}
    </motion.aside>
  );
}

function ScoreRow({
  label,
  score,
  status = "implemented",
  highlight = false,
}: {
  label: string;
  score: number;
  status?: "implemented" | "placeholder";
  highlight?: boolean;
}) {
  const band: AuditBand = auditBand(score);
  const badgeStyles: Record<AuditBand, string> = {
    weak: "border-destructive/30 bg-destructive/10 text-destructive",
    warming:
      "border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/15%)] text-[oklch(0.85_0.14_90)]",
    strong:
      "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
  };

  return (
    <motion.div
      variants={rowVariants}
      className={cn(
        "flex items-center justify-between rounded-md border px-4 py-3 transition-colors",
        highlight
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-card hover:bg-muted/30",
      )}
    >
      <span
        className={cn(
          "text-sm",
          highlight ? "font-medium text-primary" : "text-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "rounded-md border px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider",
          status === "placeholder"
            ? "border-border bg-muted/40 text-muted-foreground/60"
            : badgeStyles[band],
        )}
      >
        {score}%
      </span>
    </motion.div>
  );
}
