/**
 * Life OS — Pulse News
 * Runs at 8am IST via GitHub Actions (cron 30 2 * * *)
 * Fetches news from 5 sources → saves top 15 to Notion → ntfy top 5
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Client } = require("@notionhq/client");
const https = require("https");
const Parser = require("rss-parser");

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const NTFY_TOPIC = process.env.NTFY_TOPIC;
const NOTES_DB_ID = process.env.NOTION_NOTES_DB_ID;

const parser = new Parser({ timeout: 10000 });

const FEEDS = [
  { url: "https://feeds.bbci.co.uk/news/rss.xml", label: "BBC" },
  { url: "https://feeds.feedburner.com/ndtvnews-top-stories", label: "NDTV" },
  { url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms", label: "ET Markets" },
  { url: "https://www.producthunt.com/feed", label: "Product Hunt" },
];

const HN_API = "https://hacker-news.firebaseio.com/v0";

const RELEVANCE_KEYWORDS = [
  "ai", "artificial intelligence", "startup", "india", "market", "tech",
  "saas", "product", "llm", "gpt", "openai", "automation", "funding",
  "acquisition", "launch", "api", "developer", "software",
];

function isRelevant(text) {
  const lower = (text || "").toLowerCase();
  return RELEVANCE_KEYWORDS.some((kw) => lower.includes(kw));
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { timeout: 8000 }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      })
      .on("error", () => resolve(null))
      .on("timeout", () => resolve(null));
  });
}

async function getHackerNewsTop() {
  const ids = await fetchJSON(`${HN_API}/topstories.json`);
  if (!ids) return [];

  const top10 = ids.slice(0, 15);
  const stories = await Promise.all(
    top10.map((id) => fetchJSON(`${HN_API}/item/${id}.json`))
  );

  return stories
    .filter((s) => s && s.title)
    .filter((s) => isRelevant(s.title))
    .slice(0, 5)
    .map((s) => ({
      title: s.title,
      url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
      source: "HN",
    }));
}

async function fetchRSSFeed(feed) {
  try {
    const result = await parser.parseURL(feed.url);
    return result.items
      .filter((item) => isRelevant(item.title) || isRelevant(item.contentSnippet))
      .slice(0, 5)
      .map((item) => ({
        title: item.title?.replace(/<[^>]*>/g, "").trim() || "Untitled",
        url: item.link || "",
        source: feed.label,
      }));
  } catch {
    console.warn(`⚠️  Failed to fetch ${feed.label}`);
    return [];
  }
}

async function notify(title, message, tags = []) {
  if (!NTFY_TOPIC) return;
  return new Promise((resolve) => {
    const body = JSON.stringify({ topic: NTFY_TOPIC, title, message, tags });
    const req = https.request(
      {
        hostname: "ntfy.sh",
        port: 443,
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => resolve(res.statusCode)
    );
    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  });
}

async function getTagsPropertyName() {
  try {
    const db = await notion.databases.retrieve({ database_id: NOTES_DB_ID });
    const match = Object.entries(db.properties).find(
      ([, v]) => v.type === "multi_select"
    );
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

function toBlocks(items) {
  // One paragraph block per item — each stays well under 2000 chars
  return items.map((item, i) => ({
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [
        {
          type: "text",
          text: {
            content: `${i + 1}. [${item.source}] ${item.title}\n${item.url}`,
          },
        },
      ],
    },
  }));
}

async function saveToNotion(dateStr, items) {
  const tagsKey = await getTagsPropertyName();
  const extraProps = tagsKey
    ? { [tagsKey]: { multi_select: [{ name: "[Pulse]" }, { name: "News" }] } }
    : {};

  await notion.pages.create({
    parent: { database_id: NOTES_DB_ID },
    properties: {
      Name: {
        title: [{ text: { content: `[Pulse] News — ${dateStr}` } }],
      },
      ...extraProps,
    },
    children: toBlocks(items),
  });
}

async function main() {
  const dateStr = todayISO();
  console.log(`\n📰 Pulse News — ${dateStr}\n`);

  // Fetch all sources in parallel
  const [hnItems, ...rssResults] = await Promise.all([
    getHackerNewsTop(),
    ...FEEDS.map((f) => fetchRSSFeed(f)),
  ]);

  const allItems = [hnItems, ...rssResults].flat();
  console.log(`Fetched ${allItems.length} relevant items across all sources`);

  // Deduplicate by title similarity
  const seen = new Set();
  const deduped = allItems.filter((item) => {
    const key = item.title.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const top15 = deduped.slice(0, 15);
  const top5 = top15.slice(0, 5);

  if (top15.length === 0) {
    console.log("No relevant items found today.");
    return;
  }

  // Save full list to Notion
  await saveToNotion(dateStr, top15);
  console.log(`✅ Saved ${top15.length} items to Notion Notes ([Pulse] tag)`);

  // Send top 5 via ntfy
  const ntfyMsg = top5
    .map((item, i) => `${i + 1}. [${item.source}] ${item.title}`)
    .join("\n");

  await notify("📰 Pulse — Today's Top News", ntfyMsg, ["newspaper", "mega"]);
  console.log("✅ Top 5 headlines sent via ntfy\n");

  top5.forEach((item, i) => {
    console.log(`${i + 1}. [${item.source}] ${item.title}`);
  });
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
