const ROW_A = [
  "Adobe Creative Cloud",
  "Microsoft 365",
  "Spotify",
  "Netflix",
  "YouTube Premium",
  "Canva Pro",
  "ChatGPT Plus",
  "Google Workspace",
];

const ROW_B = [
  "Notion",
  "Figma",
  "Dropbox",
  "GitHub Copilot",
  "Slack",
  "Zoom Pro",
  "Freepik",
  "PlayStation Plus",
  "Shahid VIP",
  "Claude Pro",
];

function Row({ items, dir }: { items: string[]; dir: "rtl" | "ltr" }) {
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden">
      <div className="marquee-track flex w-max gap-3" data-dir={dir}>
        {doubled.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className="flex shrink-0 items-center rounded-full border border-[var(--jaddid-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-600"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Dual-row infinite marquee of service wordmarks. Text chips rather than
 * hotlinked logos (no real brand assets on hand), so it never implies a
 * partnership. Pure CSS transform animation — no GSAP tick needed here,
 * and it is switched off entirely under prefers-reduced-motion via
 * globals.css.
 */
export default function Marquee() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-slate-400">
        يعمل جَدِّد مع أي اشتراك تبيعه — أمثلة شائعة
      </p>
      <div className="mt-6 space-y-3" dir="ltr">
        <Row items={ROW_A} dir="rtl" />
        <Row items={ROW_B} dir="ltr" />
      </div>
      <p className="mx-auto mt-6 max-w-lg text-center text-xs leading-6 text-slate-400">
        العلامات التجارية المعروضة لأغراض توضيحية فقط ولا تعني وجود شراكة أو
        اعتماد.
      </p>
    </div>
  );
}
