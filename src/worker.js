// Cloudflare Worker: serves /api/search (YouTube search, cached 24h). Everything else is static files in /public.
const YT = "https://www.googleapis.com/youtube/v3";
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...extra } });
const limited = (message) => json({ items: [], nextPageToken: null, limited: true, message });

async function yt(path, params, key) {
  const r = await fetch(`${YT}/${path}?${new URLSearchParams({ ...params, key })}`, { signal: AbortSignal.timeout(10000) });
  const body = await r.json().catch(() => null);
  if (!r.ok || !body) throw new Error(`YouTube ${path} failed: ${r.status} ${body?.error?.errors?.[0]?.reason || ""}`);
  return body;
}

async function search(request, env, ctx) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const pageToken = url.searchParams.get("pageToken") || "";
  if (q.length < 2 || q.length > 100) return json({ error: "Enter 2 to 100 characters." }, 400);
  if (pageToken && !/^[A-Za-z0-9_-]{1,100}$/.test(pageToken)) return json({ error: "Bad page token." }, 400);
  if (!env.YOUTUBE_API_KEY) return limited("Search is not configured yet.");

  // Same search = same cached answer for 24 hours (saves YouTube quota)
  const cacheKey = new Request(`${url.origin}/__cache/search?q=${encodeURIComponent(q.toLowerCase())}&p=${pageToken}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const params = { part: "snippet", type: "video", videoEmbeddable: "true", safeSearch: "strict", maxResults: "12", regionCode: "IN", q };
    if (pageToken) params.pageToken = pageToken;
    const found = await yt("search", params, env.YOUTUBE_API_KEY);
    const ids = (found.items || []).map((i) => i.id?.videoId).filter(Boolean);
    let ok = new Set();
    if (ids.length) {
      const det = await yt("videos", { part: "status,contentDetails", id: ids.join(",") }, env.YOUTUBE_API_KEY);
      ok = new Set((det.items || []).filter((v) =>
        v.status?.embeddable === true && v.status?.privacyStatus === "public" &&
        v.contentDetails?.contentRating?.ytRating !== "ytAgeRestricted" &&
        !v.contentDetails?.regionRestriction?.blocked?.includes("IN") &&
        (!v.contentDetails?.regionRestriction?.allowed || v.contentDetails.regionRestriction.allowed.includes("IN"))
      ).map((v) => v.id));
    }
    const items = (found.items || []).filter((i) => ok.has(i.id?.videoId)).map((i) => ({
      videoId: i.id.videoId, title: decode(i.snippet.title), channelTitle: decode(i.snippet.channelTitle),
      channelId: i.snippet.channelId, publishedAt: i.snippet.publishedAt,
      thumbnailUrl: `https://i.ytimg.com/vi/${i.id.videoId}/hqdefault.jpg`, category: "other",
    }));
    const res = json({ items, nextPageToken: found.nextPageToken || null, updatedAt: new Date().toISOString() }, 200, { "cache-control": "public, max-age=86400" });
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    return limited("Live search limit reached for now."); // errors are never cached
  }
}

function decode(s = "") {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/search" && request.method === "GET") return search(request, env, ctx);
    if (pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
