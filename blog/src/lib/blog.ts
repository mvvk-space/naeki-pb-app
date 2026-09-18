import type { CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"blog">;

/* Thai dates sit better on Thai content — th-TH gives Thai month names and
   the Buddhist era (2025 → พ.ศ. 2568) for free. */
export function fmtDate(d: Date, month: "long" | "short" = "long") {
  return d.toLocaleDateString("th-TH", { day: "numeric", month, year: "numeric" });
}

/* tags are free-form and often Thai, so there is no transliteration step —
   the tag itself is the slug, URL-encoded at the link site. Tag pages build
   from the raw value so Astro's own path encoding lines up with the links. */
export function tagHref(tag: string) {
  return `/tags/${encodeURIComponent(tag)}`;
}

export function tagSlug(tag: string) {
  return encodeURIComponent(tag);
}

export function publishedPosts(posts: Post[]) {
  return posts
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/* reading-time: markdown is stripped first, then Latin words and Thai
   characters are counted separately — Thai runs without spaces, so a
   whitespace word count would badly undercount Thai posts. Speeds chosen
   for a comfortable read (200 latin wpm / 400 Thai chars per minute). */
export function readingMinutes(body: string | undefined) {
  const text = String(body ?? "")
    .replace(/```[\s\S]*?```/g, " ")      // fenced code
    .replace(/`[^`]*`/g, " ")             // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → link text
    .replace(/[#>*_~\-|]+/g, " ")
    .replace(/<[^>]+>/g, " ");
  const thai = (text.match(/[\u0E00-\u0E7F]/g) ?? []).length;
  const latin = (text.replace(/[\u0E00-\u0E7F]/g, " ").match(/[A-Za-z0-9]+/g) ?? []).length;
  return Math.max(1, Math.round(latin / 200 + thai / 400));
}

export function readingLabel(body: string | undefined) {
  return `${readingMinutes(body)} นาที`;
}

/** every tag across published posts, with counts, most-used first then A→Z */
export function tagCounts(posts: Post[]) {
  const counts = new Map<string, number>();
  for (const post of publishedPosts(posts)) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "th"));
}
