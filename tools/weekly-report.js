/**
 * Life OS — Weekly Report
 * Runs Sunday 9pm IST via GitHub Actions (cron 30 15 * * 0)
 * Reads last 7 Daily Log entries → creates Note → sends ntfy
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Client } = require("@notionhq/client");
const https = require("https");

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const NTFY_TOPIC = process.env.NTFY_TOPIC;
const DAILY_LOG_DB_ID = process.env.NOTION_DAILY_LOG_DB_ID;
const NOTES_DB_ID = process.env.NOTION_NOTES_DB_ID;

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
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

async function getLast7Entries() {
  const sevenDaysAgo = daysAgoISO(7);
  const res = await notion.databases.query({
    database_id: DAILY_LOG_DB_ID,
    filter: {
      property: "Date",
      title: { is_not_empty: true },
    },
    sorts: [{ property: "Date", direction: "descending" }],
    page_size: 7,
  });
  return res.results;
}

function getProp(page, name, type) {
  const prop = page.properties[name];
  if (!prop) return null;
  if (type === "number") return prop.number;
  if (type === "rich_text") return prop.rich_text?.[0]?.plain_text || "";
  if (type === "title") return prop.title?.[0]?.plain_text || "";
  return null;
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

async function createWeekNote(weekOf, summary) {
  const tagsKey = await getTagsPropertyName();
  const extraProps = tagsKey
    ? { [tagsKey]: { multi_select: [{ name: "[Nova]" }, { name: "Weekly" }] } }
    : {};

  await notion.pages.create({
    parent: { database_id: NOTES_DB_ID },
    properties: {
      Name: {
        title: [{ text: { content: `Week of ${weekOf} — Life OS Report` } }],
      },
      ...extraProps,
    },
    children: [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: summary } }],
        },
      },
    ],
  });
}

async function main() {
  const today = todayISO();
  const weekOf = daysAgoISO(6);
  console.log(`\n📊 Weekly Report — Week of ${weekOf}\n`);

  const entries = await getLast7Entries();

  if (entries.length === 0) {
    console.log("No Daily Log entries found this week.");
    await notify("📊 Weekly Report", "No entries logged this week. Start fresh next week.", ["chart_increasing"]);
    return;
  }

  // Calculate averages
  const energies = entries.map((e) => getProp(e, "Energy (1-5)", "number")).filter((v) => v !== null);
  const moods = entries.map((e) => getProp(e, "Mood (1-5)", "number")).filter((v) => v !== null);

  const avgEnergy = energies.length ? (energies.reduce((a, b) => a + b, 0) / energies.length).toFixed(1) : "N/A";
  const avgMood = moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : "N/A";

  // Find best day
  let bestDay = null;
  let bestScore = -1;
  for (const entry of entries) {
    const e = getProp(entry, "Energy (1-5)", "number") || 0;
    const m = getProp(entry, "Mood (1-5)", "number") || 0;
    const score = e + m;
    if (score > bestScore) {
      bestScore = score;
      bestDay = getProp(entry, "Date", "title") || "Unknown";
    }
  }

  // Count tasks logged
  const tasksLogged = entries.filter((e) => {
    const top3 = getProp(e, "Top 3 Tasks", "rich_text");
    return top3 && top3.trim() !== "" && top3.trim() !== "None scheduled";
  }).length;

  const reflectionPrompts = [
    "What habit do you want to double down on next week?",
    "What's one thing you'd do differently?",
    "What gave you the most energy this week?",
    "What drained you most this week?",
    "What are you most proud of this week?",
  ];
  const prompt = reflectionPrompts[Math.floor(Math.random() * reflectionPrompts.length)];

  const summary = [
    `📊 Week of ${weekOf} — ${entries.length} days logged`,
    ``,
    `Avg Energy: ${avgEnergy}/5`,
    `Avg Mood: ${avgMood}/5`,
    `Days with tasks: ${tasksLogged}/${entries.length}`,
    `Best day: ${bestDay} (energy+mood = ${bestScore})`,
    ``,
    `Reflection: ${prompt}`,
  ].join("\n");

  console.log(summary);

  await createWeekNote(weekOf, summary);
  console.log("✅ Week note created in Notion Notes DB");

  const ntfyMsg = [
    `${entries.length} days logged | Avg energy: ${avgEnergy} | Avg mood: ${avgMood}`,
    `Best day: ${bestDay}`,
    `→ ${prompt}`,
  ].join("\n");

  await notify("📊 Weekly Report — Life OS", ntfyMsg, ["chart_increasing", "calendar"]);
  console.log("✅ Weekly report sent.\n");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
