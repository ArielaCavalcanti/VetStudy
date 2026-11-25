import { cn } from "@/lib/utils";

/** Bento, o beagle estudante de veterinária. */
export function Mascot({ className, mood = "happy" }: { className?: string; mood?: "happy" | "sad" | "think" }) {
  return (
    <svg viewBox="0 0 120 120" className={cn("text-primary", className)} role="img" aria-label="Bento, o mascote do VetStudy">
      <ellipse cx="60" cy="112" rx="34" ry="5" className="fill-foreground/10" />
      <path d="M26 44c-10 4-14 26-6 38 5 7 12 2 14-8l2-26z" className="fill-accent" />
      <path d="M94 44c10 4 14 26 6 38-5 7-12 2-14-8l-2-26z" className="fill-accent" />
      <rect x="30" y="28" width="60" height="62" rx="28" className="fill-card stroke-foreground/20" strokeWidth="2" />
      <path d="M44 30c4 10 28 10 32 0" className="fill-accent/70" />
      <circle cx="47" cy="56" r="5" className="fill-foreground" />
      <circle cx="73" cy="56" r="5" className="fill-foreground" />
      <circle cx="48.5" cy="54.5" r="1.6" className="fill-card" />
      <circle cx="74.5" cy="54.5" r="1.6" className="fill-card" />
      <ellipse cx="60" cy="68" rx="7" ry="5" className="fill-foreground" />
      {mood === "happy" && <path d="M52 76c4 5 12 5 16 0" className="stroke-foreground" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
      {mood === "sad" && <path d="M52 80c4-4 12-4 16 0" className="stroke-foreground" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
      {mood === "think" && <path d="M53 78h14" className="stroke-foreground" strokeWidth="2.5" strokeLinecap="round" />}
      <path d="M38 88c0 12 10 18 22 18s22-6 22-18" className="stroke-primary" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <circle cx="82" cy="98" r="5" className="fill-primary" />
      <path d="M22 26h24l-12-8z" className="fill-primary" />
      <rect x="31" y="24" width="6" height="4" className="fill-primary" />
    </svg>
  );
}