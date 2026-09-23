"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

/**
 * Reads the `notifications` table, which was already being written to
 * (e.g. by admin_review_activation_request) but had no UI anywhere —
 * rows accumulated silently and no merchant ever saw them. RLS already
 * scopes reads to the caller's own org and allows updating only the
 * `is_read` column (see the phase2/phase11 migrations), so this is a
 * pure frontend addition, no schema change needed.
 */
export default function NotificationBell() {
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("notifications")
        .select("id, type, title, body, is_read, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!cancelled) setItems(data ?? []);
    }

    load();
    // Re-check on a light interval rather than a Realtime subscription —
    // this table isn't confirmed to be in the Realtime publication, and
    // a plain poll needs no extra infra to be correct.
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = items?.filter((n) => !n.is_read).length ?? 0;

  async function markRead(id: string) {
    setItems((prev) => prev?.map((n) => (n.id === id ? { ...n, is_read: true } : n)) ?? prev);
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }

  async function markAllRead() {
    const unreadIds = items?.filter((n) => !n.is_read).map((n) => n.id) ?? [];
    if (unreadIds.length === 0) return;
    setItems((prev) => prev?.map((n) => ({ ...n, is_read: true })) ?? prev);
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={async () => {
          setOpen((v) => !v);
          const supabase = createClient();
          const { data } = await supabase
            .from("notifications")
            .select("id, type, title, body, is_read, created_at")
            .order("created_at", { ascending: false })
            .limit(20);
          if (data) setItems(data);
        }}
        aria-label="الإشعارات"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
          <path d="M6 8a4 4 0 0 1 8 0c0 3.5 1.5 4.5 1.5 4.5h-11S6 11.5 6 8Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.5 15a1.5 1.5 0 0 0 3 0" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-40 mt-2 w-80 max-w-[90vw] rounded-2xl border border-[var(--jaddid-border)] bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--jaddid-border)] px-4 py-3">
            <p className="text-sm font-bold text-[var(--jaddid-navy)]">الإشعارات</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-semibold text-[var(--jaddid-blue)]"
              >
                تحديد الكل كمقروء
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items === null ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">جارٍ التحميل...</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">لا توجد إشعارات بعد.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markRead(n.id)}
                  className={`block w-full border-b border-[var(--jaddid-border)] px-4 py-3 text-right last:border-b-0 hover:bg-[var(--jaddid-surface)] ${
                    n.is_read ? "opacity-60" : ""
                  }`}
                >
                  <span className="flex items-start gap-2">
                    {!n.is_read ? (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--jaddid-blue)]" />
                    ) : (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--jaddid-navy)]">
                        {n.title}
                      </span>
                      {n.body ? (
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                          {n.body}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-[11px] text-slate-400" dir="ltr">
                        {new Date(n.created_at).toLocaleString("ar-SA")}
                      </span>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
