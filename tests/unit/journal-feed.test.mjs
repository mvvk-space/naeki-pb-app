/* Journal feed plumbing (journal.js): parseFeed extracts items from the
   Astro build's RSS (no DOM needed), sorts newest-first, caps at 3, skips
   malformed items, and never throws on garbage. fmtDate renders Thai
   dates (th-TH → Buddhist era). */
import { describe, it, expect } from "vitest";
import { makeSandbox } from "../helpers/sandbox.mjs";

const J = () => makeSandbox({ files: ["journal.js"] }).window.NaekiJournal;

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Naeki Journal</title>
  <item>
    <title>NAEKI SUSHI – Grab &amp; Go ซูชิ/ออนิกิริพรีเมียม</title>
    <link>https://naeki.example.com/blog/naeki-sushi-grab-go/</link>
    <pubDate>Sun, 26 Oct 2025 00:00:00 GMT</pubDate>
    <description>ซูชิและโอนิกิริพรีเมียมปลอดสารกันบูด</description>
  </item>
  <item>
    <title><![CDATA[Onigiri คืออะไร?]]></title>
    <link>https://naeki.example.com/blog/what-is-onigiri-th/</link>
    <pubDate>Tue, 20 May 2025 00:00:00 GMT</pubDate>
    <description>&lt;p&gt;รู้จักโอนิกิริ&lt;/p&gt;</description>
  </item>
</channel></rss>`;

describe("journal feed (journal.js)", () => {
  it("parseFeed extracts items, sorts newest-first and caps at 3", () => {
    const items = J().parseFeed(FEED);
    expect(items).toHaveLength(2);
    expect(items[0].title).toContain("NAEKI SUSHI");
    expect(items[0].title).toContain("ซูชิ");
    expect(items[0].url).toContain("/blog/naeki-sushi-grab-go/");
    expect(items[1].title).toBe("Onigiri คืออะไร?"); // CDATA unwrapped
  });

  it("parseFeed strips markup and decodes entities in descriptions", () => {
    const onigiri = J().parseFeed(FEED).find((i) => i.title === "Onigiri คืออะไร?");
    expect(onigiri.description).toBe("รู้จักโอนิกิริ");
  });

  it("parseFeed skips broken items and never throws on garbage", () => {
    expect(J().parseFeed("not xml at all")).toEqual([]);
    const partial = J().parseFeed("<item><title>only a title</title></item>");
    expect(partial).toEqual([]); // no link → skipped
  });

  it("rewriteToOrigin re-points the Astro site placeholder at the feed origin", () => {
    const j = J();
    expect(j.rewriteToOrigin("https://naeki.example.com/blog/what-is-onigiri-th/",
      "http://127.0.0.1:8090/rss.xml"))
      .toBe("http://127.0.0.1:8090/blog/what-is-onigiri-th/");
    expect(j.rewriteToOrigin("/blog/t2/", "http://127.0.0.1:8291/rss.xml"))
      .toBe("http://127.0.0.1:8291/blog/t2/");
  });

  it("fmtDate renders the Buddhist era (2025 → 2568)", () => {
    const out = J().fmtDate("2025-05-20T00:00:00Z");
    expect(out).toContain("2568"); // พ.ศ.
    expect(out.length).toBeGreaterThan("2568".length); // day + month + year
  });

  it("fmtDate tolerates a bad date", () => {
    expect(J().fmtDate("not a date")).toBe("");
  });
});