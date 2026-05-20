import type { Booking, Payment } from "./types";

function suffixFromId(value: string | undefined, length = 4) {
  const source = String(value || "");
  const digits = source.replace(/\D/g, "");
  if (digits.length) return digits.slice(-length).padStart(length, "0");
  return source.replace(/[^a-z0-9]/gi, "").slice(-length).toUpperCase().padStart(length, "0");
}

function servicePrefix(value: string | undefined) {
  const normalized = String(value || "").toLowerCase();
  if (/aircon|air con|air-condition|air condition|cooling|a\/c/.test(normalized)) return "AIR";
  if (/electric|wiring|power/.test(normalized)) return "ELEC";
  if (/plumb|pipe|water/.test(normalized)) return "PLMB";
  if (/weld|metal|fabricat/.test(normalized)) return "WELD";
  if (/construct|mason|build/.test(normalized)) return "CONS";
  if (/roof/.test(normalized)) return "ROOF";
  if (/paint/.test(normalized)) return "PNT";
  if (/car|auto/.test(normalized)) return "AUTO";
  if (/motor|motorcycle|bike/.test(normalized)) return "MOTO";

  const words = normalized
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "SRV";
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase().padEnd(3, "X");
  return words.map((word) => word[0]).join("").slice(0, 4).toUpperCase().padEnd(3, "X");
}

export function formatBookingReference(
  bookingOrId: Pick<Booking, "bookingId" | "serviceName" | "serviceCategoryId"> | string | undefined,
  serviceName?: string
) {
  const bookingId = typeof bookingOrId === "string" ? bookingOrId : bookingOrId?.bookingId;
  const service = typeof bookingOrId === "string" ? serviceName : bookingOrId?.serviceName || bookingOrId?.serviceCategoryId;
  return `${servicePrefix(service)}-${suffixFromId(bookingId)}`;
}

export function formatPaymentReference(paymentOrId: Pick<Payment, "paymentId"> | string | undefined) {
  const paymentId = typeof paymentOrId === "string" ? paymentOrId : paymentOrId?.paymentId;
  return `PAY-${suffixFromId(paymentId)}`;
}
