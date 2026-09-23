export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow ? (
        <span className="brand-gradient-text text-sm font-bold">{eyebrow}</span>
      ) : null}
      <h2 className="mt-2 text-2xl font-extrabold text-[var(--jaddid-navy)] sm:text-3xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 text-base leading-7 text-slate-600">{subtitle}</p>
      ) : null}
    </div>
  );
}
