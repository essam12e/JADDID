export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "start";
}) {
  return (
    <div
      className={
        align === "center"
          ? "mx-auto max-w-2xl text-center"
          : "max-w-2xl text-right"
      }
    >
      {eyebrow ? (
        <span className="inline-flex items-center gap-2 text-sm font-bold text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--jaddid-blue)]" />
          {eyebrow}
        </span>
      ) : null}
      <h2 className="text-h2 mt-2 text-[var(--jaddid-navy)]">{title}</h2>
      {subtitle ? (
        <p
          className={
            "text-body mt-3 text-base text-slate-600 " +
            (align === "center" ? "mx-auto" : "")
          }
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
