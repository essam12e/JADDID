"use client";

import { useState } from "react";

export default function ProductImage({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ background: "var(--gradient-brand)" }}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
          <path
            d="M4 16l4.5-6 3.5 4.5 2.5-3L20 16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </div>
    );
  }

  // External, unknown domains from arbitrary imported stores --
  // next/image's domain allowlist can't cover hosts we don't know ahead
  // of time, so a plain <img> with a manual error fallback is used
  // instead.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 rounded-lg object-cover"
    />
  );
}
