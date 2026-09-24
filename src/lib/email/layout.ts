/**
 * Shared HTML shell for every transactional email JADDID sends.
 *
 * Email clients are not browsers: no <style> reliability, no flexbox, no
 * CSS variables, and Outlook still renders through Word's engine. So this
 * is deliberately table-based with inline styles only — the same shape
 * every serious transactional email uses.
 *
 * Pure string functions on purpose (no `server-only`): they carry no
 * secrets and are unit-tested directly.
 */

export const BRAND = {
  blue: "#2f6bff",
  cyan: "#22d3ee",
  purple: "#8b5cf6",
  navy: "#1e2a5e",
  ink: "#0b1030",
  surface: "#f6f8ff",
  border: "#e6eaf7",
  amber: "#f59e0b",
  emerald: "#10b981",
  muted: "#64748b",
} as const;

/** The public origin, used for absolute asset + link URLs inside emails. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://j-addid.com").replace(/\/+$/, "");
}

/**
 * Every interpolated value below comes from the database (org names,
 * customer names, product titles) — all user-controlled. Escaping is not
 * optional: an unescaped `<` breaks the message, and an unescaped tag
 * could smuggle markup into the rendered email.
 */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type InfoRow = { label: string; value: string };
export type EmailButton = { label: string; url: string };

export type LayoutInput = {
  /** The grey preview line shown next to the subject in the inbox list. */
  preheader: string;
  heading: string;
  /** Intro paragraphs, plain text — escaped for you. */
  paragraphs: string[];
  /** Optional key/value card (dates, amounts, account numbers). */
  info?: InfoRow[];
  button?: EmailButton;
  /** Closing paragraphs, rendered smaller/muted. */
  outro?: string[];
};

function infoTable(info: InfoRow[]): string {
  const rows = info
    .map(
      (row, i) => `
              <tr>
                <td style="padding:${i === 0 ? "0" : "10px"} 0 0 0;font-family:Tahoma,Arial,sans-serif;font-size:14px;color:${BRAND.muted};">${esc(row.label)}</td>
                <td align="left" style="padding:${i === 0 ? "0" : "10px"} 0 0 0;font-family:Tahoma,Arial,sans-serif;font-size:14px;font-weight:bold;color:${BRAND.navy};">${esc(row.value)}</td>
              </tr>`,
    )
    .join("");

  return `
          <tr>
            <td style="padding:8px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:14px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function buttonBlock(button: EmailButton): string {
  return `
          <tr>
            <td align="center" style="padding:26px 32px 4px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="${BRAND.blue}" style="border-radius:12px;">
                    <a href="${esc(button.url)}" target="_blank" style="display:inline-block;padding:13px 30px;font-family:Tahoma,Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px;">${esc(button.label)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

export function renderLayout(input: LayoutInput): string {
  const base = siteUrl();
  const year = new Date().getFullYear();

  const paragraphs = input.paragraphs
    .map(
      (p) =>
        `
          <tr>
            <td style="padding:0 32px 14px 32px;font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.9;color:#334155;">${esc(p)}</td>
          </tr>`,
    )
    .join("");

  const outro = (input.outro ?? [])
    .map(
      (p) =>
        `
          <tr>
            <td style="padding:0 32px 12px 32px;font-family:Tahoma,Arial,sans-serif;font-size:13px;line-height:1.85;color:${BRAND.muted};">${esc(p)}</td>
          </tr>`,
    )
    .join("");

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="ar" dir="rtl">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.surface};" dir="rtl">
<div style="display:none;font-size:1px;color:${BRAND.surface};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.surface};">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;border:1px solid ${BRAND.border};border-radius:20px;overflow:hidden;">

        <!-- brand accent bar: solid bgcolor first so Outlook still gets a brand colour -->
        <tr>
          <td bgcolor="${BRAND.blue}" style="height:5px;line-height:5px;font-size:0;background-color:${BRAND.blue};background-image:linear-gradient(90deg, ${BRAND.blue} 0%, ${BRAND.cyan} 45%, ${BRAND.purple} 100%);">&nbsp;</td>
        </tr>

        <!-- logo: forced white plate so the navy wordmark stays legible in dark-mode clients -->
        <tr>
          <td align="center" bgcolor="#ffffff" style="padding:30px 32px 6px 32px;background-color:#ffffff;">
            <a href="${esc(base)}" target="_blank" style="text-decoration:none;">
              <img src="${esc(base)}/brand/jaddid-email-logo.png" width="112" height="112" alt="جَدِّد | JADDID" style="display:block;width:112px;height:112px;border:0;outline:none;text-decoration:none;" />
            </a>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:10px 32px 18px 32px;font-family:Tahoma,Arial,sans-serif;font-size:21px;font-weight:bold;color:${BRAND.navy};line-height:1.6;">${esc(input.heading)}</td>
        </tr>
${paragraphs}${input.info && input.info.length > 0 ? infoTable(input.info) : ""}${input.button ? buttonBlock(input.button) : ""}
        <tr><td style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>
${outro}
        <tr>
          <td style="padding:8px 32px 0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="border-top:1px solid ${BRAND.border};height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:18px 32px 28px 32px;font-family:Tahoma,Arial,sans-serif;font-size:12px;line-height:1.9;color:#94a3b8;">
            <a href="${esc(base)}" target="_blank" style="color:${BRAND.blue};text-decoration:none;font-weight:bold;">جَدِّد</a> — منصّة إدارة وتجديد الاشتراكات<br />
            هذي رسالة تلقائية من نظام جَدِّد، ما تحتاج ترد عليها.<br />
            &copy; ${year} جَدِّد
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Plain-text alternative. Every email ships one — spam filters expect it. */
export function renderText(input: LayoutInput): string {
  const base = siteUrl();
  const parts: string[] = ["جَدِّد | JADDID", "", input.heading, ""];
  parts.push(...input.paragraphs, "");
  if (input.info?.length) {
    for (const row of input.info) parts.push(`${row.label}: ${row.value}`);
    parts.push("");
  }
  if (input.button) parts.push(`${input.button.label}: ${input.button.url}`, "");
  if (input.outro?.length) parts.push(...input.outro, "");
  parts.push("—", "جَدِّد — منصّة إدارة وتجديد الاشتراكات", base, "رسالة تلقائية، ما تحتاج ترد عليها.");
  return parts.join("\n");
}
