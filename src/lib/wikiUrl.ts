const CHINESE_WIKI_ORIGIN = "https://warframe.huijiwiki.com";
const CHINESE_TEXT = /[\u3400-\u9fff]/;

function encodeWikiTitle(title: string): string {
  return title
    .trim()
    .replace(/ /g, "_")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function buildWikiUrl(name: string): string {
  return `${CHINESE_WIKI_ORIGIN}/wiki/${encodeWikiTitle(name)}`;
}

/** Keep the canonical article path when available, but prefer a Chinese in-game
 *  name because Huiji's localized redirects commonly point to that article. */
export function toChineseWikiUrl(url: string | null | undefined, fallbackName: string): string {
  const fallback = String(fallbackName || "").trim();
  if (CHINESE_TEXT.test(fallback)) return buildWikiUrl(fallback);

  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === "warframe.huijiwiki.com") return parsed.toString();

      const isWarframeWiki =
        parsed.hostname === "wiki.warframe.com" ||
        parsed.hostname === "www.wiki.warframe.com" ||
        parsed.hostname === "warframe.fandom.com" ||
        parsed.hostname === "www.warframe.fandom.com" ||
        parsed.hostname === "warframe.wikia.com";
      const match = isWarframeWiki && /^\/(?:wiki|w)\/(.+)$/.exec(parsed.pathname);
      if (match) {
        const page = decodeURIComponent(match[1]);
        return `${CHINESE_WIKI_ORIGIN}/wiki/${encodeWikiTitle(page)}${parsed.hash}`;
      }
    } catch {
      /* Invalid or unsupported source URL: use the safe Chinese Wiki fallback. */
    }
  }

  return buildWikiUrl(fallback || "WARFRAME");
}
