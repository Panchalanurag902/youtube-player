// Runs daily on GitHub Actions. Reads channels.json, fetches each channel's latest uploads,
// keeps only embeddable public videos, writes public/feed.json. Uses no "search" quota.
import { readFile, writeFile, mkdir } from "node:fs/promises";

const KEY = process.env.YOUTUBE_API_KEY;
if (!KEY) { console.error("YOUTUBE_API_KEY is missing"); process.exit(1); }
const YT = "https://www.googleapis.com/youtube/v3";
const PER_CHANNEL = 5, PER_CATEGORY = 24;

async function yt(path, params) {
  const r = await fetch(`${YT}/${path}?${new URLSearchParams({ ...params, key: KEY })}`);
  const body = await r.json().catch(() => null);
  if (!r.ok || !body) throw new Error(`${path} ${r.status} ${body?.error?.errors?.[0]?.reason || ""}`);
  return body;
}
const secs = (iso = "") => { const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };

const channels = JSON.parse(await readFile("channels.json", "utf8"));
let ids = {};
try { ids = JSON.parse(await readFile("data/channel-cache.json", "utf8")); } catch {}

const perCategory = {};
for (const [category, handles] of Object.entries(channels)) {
  perCategory[category] = [];
  for (const handle of handles) {
    try {
      if (!ids[handle]) {
        const c = await yt("channels", { part: "contentDetails,snippet", forHandle: handle });
        const it = c.items?.[0];
        if (!it) throw new Error("channel not found");
        ids[handle] = { channelId: it.id, uploads: it.contentDetails.relatedPlaylists.uploads, title: it.snippet.title };
      }
      const { channelId, uploads, title } = ids[handle];
      const pl = await yt("playlistItems", { part: "snippet,contentDetails", playlistId: uploads, maxResults: "12" });
      const vids = (pl.items || []).map((i) => ({ videoId: i.contentDetails.videoId, publishedAt: i.contentDetails.videoPublishedAt || i.snippet.publishedAt, title: i.snippet.title, channelTitle: title, channelId, category }));
      if (!vids.length) continue;
      const det = await yt("videos", { part: "status,contentDetails,snippet", id: vids.map((v) => v.videoId).join(",") });
      const good = new Set((det.items || []).filter((v) =>
        v.status?.embeddable === true && v.status?.privacyStatus === "public" &&
        v.snippet?.liveBroadcastContent === "none" && secs(v.contentDetails?.duration) > 60 &&
        v.contentDetails?.contentRating?.ytRating !== "ytAgeRestricted" &&
        !v.contentDetails?.regionRestriction?.blocked?.includes("IN") &&
        (!v.contentDetails?.regionRestriction?.allowed || v.contentDetails.regionRestriction.allowed.includes("IN"))
      ).map((v) => v.id));
      const keep = vids.filter((v) => good.has(v.videoId)).slice(0, PER_CHANNEL);
      perCategory[category].push(...keep);
      console.log(`OK   ${category} ${handle}: ${keep.length} videos`);
    } catch (e) { console.warn(`SKIP ${category} ${handle}: ${e.message}`); }
  }
}

const seen = new Set(), videos = [];
for (const [category, list] of Object.entries(perCategory)) {
  list.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  for (const v of list.slice(0, PER_CATEGORY)) {
    if (seen.has(v.videoId + category)) continue;
    seen.add(v.videoId + category);
    videos.push({ ...v, thumbnailUrl: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg` });
  }
}
if (videos.length === 0) { console.error("No videos found; keeping the old feed.json"); process.exit(1); }
await mkdir("data", { recursive: true });
await writeFile("data/channel-cache.json", JSON.stringify(ids, null, 2));
await writeFile("public/feed.json", JSON.stringify({ updatedAt: new Date().toISOString(), videos }));
console.log(`Wrote ${videos.length} videos`);
