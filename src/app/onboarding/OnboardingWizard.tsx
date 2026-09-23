"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { storeNameSchema, storeUrlSchema } from "@/lib/validations/onboarding";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";

type StoreState = {
  id: string;
  name: string;
  url: string | null;
  onboarding_step: number;
} | null;

const STEP_LABELS = [
  "أهلًا بك",
  "اسم المتجر",
  "رابط المتجر",
  "استيراد المنتجات",
  "المراجعة",
];

export default function OnboardingWizard({
  initialStore,
}: {
  initialOrgId: string | null;
  initialStore: StoreState;
}) {
  const router = useRouter();
  const [step, setStep] = useState(
    initialStore ? Math.min(initialStore.onboarding_step, 5) : 1,
  );
  const [storeId, setStoreId] = useState(initialStore?.id ?? null);
  const [storeName, setStoreName] = useState(initialStore?.name ?? "");
  const [storeUrl, setStoreUrl] = useState(initialStore?.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  type ImportResult = {
    status: "completed" | "partial" | "failed";
    total: number;
    imported: number;
    unchanged: number;
    failed: number;
    attempts?: { adapter: string; reason: string }[];
  };
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualAdded, setManualAdded] = useState(false);

  const progressPct = ((step - 1) / (STEP_LABELS.length - 1)) * 100;

  async function runImport() {
    if (!storeId || !storeUrl) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, sourceUrl: storeUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportResult({ status: "failed", total: 0, imported: 0, unchanged: 0, failed: 0 });
      } else {
        setImportResult(data);
      }
    } catch {
      setImportResult({ status: "failed", total: 0, imported: 0, unchanged: 0, failed: 0 });
    }
    setImporting(false);
  }

  async function addManualProduct() {
    if (!storeId || !manualName.trim()) return;
    const supabase = createClient();
    const { data: storeRow } = await supabase
      .from("stores")
      .select("organization_id")
      .eq("id", storeId)
      .single();
    if (!storeRow) return;

    await supabase.from("products").insert({
      organization_id: storeRow.organization_id,
      store_id: storeId,
      name: manualName.trim(),
      price: manualPrice ? Number(manualPrice) : null,
      currency: "SAR",
    });
    setManualAdded(true);
    setManualName("");
    setManualPrice("");
  }

  async function submitStoreName(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = storeNameSchema.safeParse({ storeName });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "بيانات غير صحيحة");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("create_organization", {
      org_name: parsed.data.storeName,
      store_name: parsed.data.storeName,
      store_url: null,
    });
    setLoading(false);

    if (rpcError || !data) {
      setError("تعذّر إنشاء المتجر الآن. حاول مرة أخرى.");
      return;
    }

    const { data: storeRow } = await supabase
      .from("stores")
      .select("id")
      .eq("organization_id", data as string)
      .limit(1)
      .maybeSingle();

    if (storeRow) {
      setStoreId(storeRow.id);
      await supabase
        .from("stores")
        .update({ onboarding_step: 3 })
        .eq("id", storeRow.id);
    }

    setStep(3);
  }

  async function submitStoreUrl(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = storeUrlSchema.safeParse({ storeUrl });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "رابط غير صحيح");
      return;
    }
    if (!storeId) {
      setError("حدث خطأ غير متوقع. أعد تحميل الصفحة.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    await supabase
      .from("stores")
      .update({ url: parsed.data.storeUrl || null, onboarding_step: 4 })
      .eq("id", storeId);
    setLoading(false);
    setStep(4);
  }

  async function advanceFromImport() {
    if (!storeId) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("stores").update({ onboarding_step: 5 }).eq("id", storeId);
    setLoading(false);
    setStep(5);
  }

  async function finish() {
    if (!storeId) {
      router.push("/dashboard");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    await supabase.from("stores").update({ onboarding_step: 6 }).eq("id", storeId);
    setLoading(false);
    router.push("/dashboard");
  }

  return (
    <div
      className="flex min-h-full flex-1 items-center justify-center px-4 py-10"
      style={{ background: "linear-gradient(180deg, #ffffff 0%, #f6f8ff 100%)" }}
    >
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <Image
            src="/brand/jaddid-logo.png"
            alt="جَدِّد"
            width={44}
            height={44}
            className="mb-3 h-11 w-11 rounded-xl"
          />
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressPct}%`, background: "var(--gradient-brand)" }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-slate-400">
            الخطوة {step} من {STEP_LABELS.length} — {STEP_LABELS[step - 1]}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-6 shadow-sm">
          {step === 1 && (
            <div className="space-y-4 text-center">
              <h1 className="text-xl font-bold text-[var(--jaddid-navy)]">
                مرحبًا بك في جَدِّد
              </h1>
              <p className="text-sm leading-6 text-slate-600">
                في الخطوات القادمة سنجهّز متجرك: اسمه، رابطه، ومنتجاته —
                حتى تبدأ متابعة اشتراكات عملائك.
              </p>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white"
                style={{ background: "var(--gradient-brand)" }}
              >
                ابدأ
              </button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={submitStoreName} className="space-y-4">
              <FormField
                label="اسم متجرك"
                type="text"
                placeholder="مثال: متجر التقنية"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                error={error ?? undefined}
              />
              <SubmitButton loading={loading}>متابعة</SubmitButton>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={submitStoreUrl} className="space-y-4">
              <FormField
                label="رابط متجرك (اختياري)"
                type="url"
                dir="ltr"
                placeholder="https://example.com"
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                error={error ?? undefined}
              />
              <SubmitButton loading={loading}>متابعة</SubmitButton>
            </form>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-center text-lg font-bold text-[var(--jaddid-navy)]">
                استيراد المنتجات
              </h2>

              {!storeUrl ? (
                <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-sm leading-6 text-slate-600">
                  لم تُدخل رابط متجر، فلا يوجد ما نستورده تلقائيًا. يمكنك
                  إضافة منتج يدويًا الآن أو لاحقًا من لوحة التحكم.
                </p>
              ) : !importResult ? (
                <div className="text-center">
                  <p className="mb-4 text-sm leading-6 text-slate-600">
                    سنحاول قراءة منتجات متجرك من:{" "}
                    <span dir="ltr" className="font-medium text-slate-800">
                      {storeUrl}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={runImport}
                    disabled={importing}
                    className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
                    style={{ background: "var(--gradient-brand)" }}
                  >
                    {importing ? "جاري الاستيراد..." : "بدء الاستيراد"}
                  </button>
                </div>
              ) : importResult.status === "failed" ? (
                <div className="space-y-3">
                  <p className="rounded-lg bg-red-50 px-3 py-3 text-sm leading-6 text-red-700">
                    تعذّر استيراد أي منتجات من هذا الرابط.
                    {importResult.attempts && importResult.attempts.length > 0 ? (
                      <span className="mt-2 block text-xs text-red-600" dir="ltr">
                        {importResult.attempts.map((a) => a.reason).join(" — ")}
                      </span>
                    ) : null}
                  </p>
                  <button
                    type="button"
                    onClick={() => setImportResult(null)}
                    className="w-full rounded-xl border border-[var(--jaddid-border)] py-2.5 text-sm font-semibold text-slate-600"
                  >
                    حاول رابطًا آخر
                  </button>
                </div>
              ) : (
                <p
                  className={`rounded-lg px-3 py-3 text-center text-sm leading-6 ${
                    importResult.status === "completed"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  تم استيراد {importResult.imported} من {importResult.total} منتجًا
                  {importResult.failed > 0
                    ? `، وتعذّر استيراد ${importResult.failed}.`
                    : "."}
                </p>
              )}

              {(!storeUrl || importResult) && (
                <div className="border-t border-[var(--jaddid-border)] pt-4">
                  {!showManualAdd ? (
                    <button
                      type="button"
                      onClick={() => setShowManualAdd(true)}
                      className="w-full rounded-xl border border-[var(--jaddid-border)] py-2.5 text-sm font-semibold text-slate-600"
                    >
                      + إضافة منتج يدويًا
                    </button>
                  ) : manualAdded ? (
                    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-700">
                      تمت إضافة المنتج.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <FormField
                        label="اسم المنتج"
                        type="text"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                      />
                      <FormField
                        label="السعر (اختياري)"
                        type="number"
                        dir="ltr"
                        value={manualPrice}
                        onChange={(e) => setManualPrice(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={addManualProduct}
                        className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white"
                        style={{ background: "var(--gradient-brand)" }}
                      >
                        إضافة
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={advanceFromImport}
                disabled={loading}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
                style={{ background: "var(--gradient-brand)" }}
              >
                متابعة
              </button>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[var(--jaddid-navy)]">
                مراجعة سريعة
              </h2>
              <div className="space-y-2 rounded-xl bg-[var(--jaddid-surface)] p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">اسم المتجر</span>
                  <span className="font-semibold text-slate-700">{storeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">رابط المتجر</span>
                  <span dir="ltr" className="font-semibold text-slate-700">
                    {storeUrl || "—"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={finish}
                disabled={loading}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
                style={{ background: "var(--gradient-brand)" }}
              >
                الذهاب إلى لوحة التحكم
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
