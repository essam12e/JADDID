"use client";

import { useMemo, useState } from "react";
import { renderTemplate, buildWhatsAppLink, type TemplateVariables } from "@/lib/domain/whatsapp";

type TemplateOption = {
  id: string;
  name: string;
  body: string;
  trigger_days: number | null;
};

export default function ReminderButton({
  customerPhone,
  vars,
  templates,
}: {
  customerPhone: string;
  vars: TemplateVariables;
  templates: TemplateOption[];
}) {
  const defaultTemplateId = useMemo(() => {
    if (templates.length === 0) return "";
    // Prefer the template whose trigger_days most closely matches how
    // many days are actually left, falling back to the first template.
    const withTrigger = templates.filter((t) => t.trigger_days != null);
    if (withTrigger.length === 0) return templates[0].id;
    const closest = withTrigger.reduce((best, t) =>
      Math.abs((t.trigger_days ?? 0) - vars.remaining_days) <
      Math.abs((best.trigger_days ?? 0) - vars.remaining_days)
        ? t
        : best,
    );
    return closest.id;
  }, [templates, vars.remaining_days]);

  const [selectedId, setSelectedId] = useState(defaultTemplateId);
  const [markedSent, setMarkedSent] = useState(false);

  const selected = templates.find((t) => t.id === selectedId);

  if (templates.length === 0) {
    return (
      <a
        href="/dashboard/templates/new"
        className="rounded-lg bg-[var(--jaddid-surface)] px-3 py-1.5 text-xs font-semibold text-slate-500"
      >
        أنشئ قالبًا أولًا
      </a>
    );
  }

  const message = selected ? renderTemplate(selected.body, vars) : "";
  const link = selected ? buildWhatsAppLink(customerPhone, message) : "#";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {templates.length > 1 ? (
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-lg border border-[var(--jaddid-border)] bg-white px-2 py-1.5 text-xs"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      ) : null}
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setMarkedSent(true)}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
      >
        فتح واتساب
      </a>
      {markedSent ? (
        <span className="text-[11px] text-slate-400">
          (تم فتح واتساب — هذا لا يعني إرسال الرسالة فعليًا حتى تضغط إرسال هناك)
        </span>
      ) : null}
    </div>
  );
}
