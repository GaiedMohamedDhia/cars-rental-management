export function resolveMediaUrl(value?: string | null) {
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith("/uploads/")) return `/api${value}`;
  return value.startsWith("/") ? value : `/${value}`;
}
