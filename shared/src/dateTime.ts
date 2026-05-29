const readableDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatReadableDateTime(value?: string | number | Date | null) {
  if (!value) return "Not available";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return readableDateTimeFormatter.format(date);
}

function monthLabel(date: Date) {
  const long = new Intl.DateTimeFormat("en-US", { month: "long" }).format(date);
  if (long.length <= 4) return long;
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
}

export function formatReadableMonthYear(value?: string | number | Date | null) {
  if (!value) return "Not available";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return `${monthLabel(date)} ${date.getFullYear()}`;
}

export function formatReadableDate(value?: string | number | Date | null) {
  if (!value) return "Not available";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return `${monthLabel(date)} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatReadableShortDateTime(value?: string | number | Date | null) {
  if (!value) return "Not available";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return `${formatReadableDate(date)} ${time}`;
}
