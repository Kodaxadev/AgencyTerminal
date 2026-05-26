export function rewriteVercelApiUrl(input: string): string {
  const url = new URL(input, "http://vercel.local");
  const path = url.searchParams.get("path");
  if (!path) return input;

  url.pathname = `/api/${path.replace(/^\/+/, "")}`;
  url.searchParams.delete("path");
  return `${url.pathname}${url.search}`;
}
