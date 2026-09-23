export default function SubmitButton({
  loading,
  children,
}: {
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-transform disabled:cursor-not-allowed disabled:opacity-70"
      style={{ background: "var(--gradient-brand)" }}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden
        />
      ) : null}
      {children}
    </button>
  );
}
