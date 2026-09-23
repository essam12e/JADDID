import type { InputHTMLAttributes } from "react";

export default function FormField({
  label,
  error,
  ...props
}: {
  label: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <input
        {...props}
        aria-invalid={!!error}
        className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-slate-400 focus:ring-2 ${
          error
            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
            : "border-[var(--jaddid-border)] focus:border-[var(--jaddid-blue)] focus:ring-[var(--jaddid-blue)]/20"
        }`}
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </label>
  );
}
