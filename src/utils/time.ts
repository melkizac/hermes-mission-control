const SINGAPORE_TZ = "Asia/Singapore";

function parseTimestamp(value?: string | null): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw || raw === "—" || raw.toLowerCase() === "now") return null;

  let normalized = raw;
  if (/ UTC$/i.test(normalized)) normalized = normalized.replace(/ UTC$/i, "Z");
  if (/ SGT$/i.test(normalized)) normalized = normalized.replace(/ SGT$/i, "+08:00");
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(normalized)) normalized = normalized.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(normalized)) normalized = `${normalized}Z`;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatSingaporeTime(value?: string | null, options: Intl.DateTimeFormatOptions = {}) {
  const date = parseTimestamp(value);
  if (!date) return value || "—";
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: SINGAPORE_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset",
    ...options,
  }).format(date).replace("GMT+8", "SGT");
}

export function formatSingaporeShort(value?: string | null) {
  return formatSingaporeTime(value, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", year: undefined });
}

export function formatSingaporeDate(value?: string | null) {
  return formatSingaporeTime(value, { year: "numeric", month: "short", day: "2-digit", hour: undefined, minute: undefined, timeZoneName: undefined });
}

export function singaporeHour() {
  return Number(new Intl.DateTimeFormat("en-SG", { timeZone: SINGAPORE_TZ, hour: "2-digit", hour12: false }).format(new Date()));
}
