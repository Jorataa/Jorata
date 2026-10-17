/** For presentation only: never automatically fetch AI- or user-provided URLs. */
export function inspectExternalLink(
  raw: string,
): { url: string; warning: string | null } | null {
  if (raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    const local =
      /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[?::1\]?$)/i.test(
        url.hostname,
      );
    return {
      url: url.href,
      warning: local
        ? "Local network link; open only if you trust the sender."
        : url.protocol === "http:"
          ? "This link is not encrypted."
          : "External destination; verify it before opening.",
    };
  } catch {
    return null;
  }
}
