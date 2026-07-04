import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { BleIllustration } from "./BleIllustration";

type Props = {
  icon?: LucideIcon;
  illustration?: "ble" | "none";
  title: string;
  description: string;
  ctaLabel?: string;
  ctaTo?: string;
  onCta?: () => void;
};

export function EmptyState({ icon: Icon, illustration = "none", title, description, ctaLabel, ctaTo, onCta }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl glass p-8 md:p-12 flex flex-col items-center text-center"
    >
      {illustration === "ble" ? (
        <BleIllustration size={200} />
      ) : Icon ? (
        <div className="h-14 w-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center glow-primary">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <h3 className="mt-5 font-display text-xl md:text-2xl">{title}</h3>
      <p className="mt-3 text-sm text-muted-foreground max-w-md leading-relaxed">{description}</p>
      {ctaLabel && (ctaTo ? (
        <Link to={ctaTo} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 glow-primary">
          {ctaLabel}
        </Link>
      ) : (
        <button onClick={onCta} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 glow-primary">
          {ctaLabel}
        </button>
      ))}
    </motion.div>
  );
}
