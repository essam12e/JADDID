"use client";

import { useRef, useState } from "react";

export default function OtpInput({
  onChange,
  disabled,
}: {
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  function emit(next: string[]) {
    setDigits(next);
    onChange(next.join(""));
  }

  function handleChange(index: number, raw: string) {
    const value = raw.replace(/\D/g, "");
    if (!value) {
      const next = [...digits];
      next[index] = "";
      emit(next);
      return;
    }
    const next = [...digits];
    next[index] = value[value.length - 1];
    emit(next);
    if (index < 5) inputsRef.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    emit(next);
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
  }

  return (
    <div dir="ltr" className="flex justify-center gap-2" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          inputMode="numeric"
          maxLength={1}
          aria-label={`رقم ${i + 1} من رمز التحقق`}
          className="h-12 w-11 rounded-lg border border-[var(--jaddid-border)] text-center text-lg font-bold outline-none focus:border-[var(--jaddid-blue)] focus:ring-2 focus:ring-[var(--jaddid-blue)]/20 disabled:opacity-50"
        />
      ))}
    </div>
  );
}
