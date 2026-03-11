/**
 * Life OS — Evening Summary
 * Runs at 9pm IST via GitHub Actions (cron 30 15 * * *)
 * Reads today's Daily Log → sends ntfy summary
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Client } = require("@notionhq/client");
const https = require("https");

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const NTFY_TOPIC = process.env.NTFY_TOPIC;
const DAILY_LOG_DB_ID = process.env.NOTION_DAILY_LOG_DB_ID;

function todayISO() {
  return new Date().toISOString().split("T")[0];
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

async function getTodayLog(dateStr) {
  const res = await notion.databases.query({
    database_id: DAILY_LOG_DB_ID,
    filter: { property: "Date", title: { equals: dateStr } },
  });
  return res.results[0] || null;
}

function getProp(page, name, type) {
  const prop = page.properties[name];
  if (!prop) return null;
  if (type === "number") return prop.number;
  if (type === "rich_text") return prop.rich_text?.[0]?.plain_text || "";
  return null;
}

async function main() {
  const dateStr = todayISO();
  console.log(`\n🌙 Evening Summary — ${dateStr}\n`);

  const log = await getTodayLog(dateStr);

  if (!log) {
    console.log("No Daily Log entry found for today.");
    await notify(
      "🌙 Evening Check-in",
      "No log found today. Log tomorrow's #1 priority before sleep.",
      ["moon"]
    );
    return;
  }

  const energy = getProp(log, "Energy (1-5)", "number");
  const mood = getProp(log, "Mood (1-5)", "number");
  const wins = getProp(log, "Wins", "rich_text");
  const habitsDue = getProp(log, "Habits Due", "rich_text");
  const top3 = getProp(log, "Top 3 Tasks", "rich_text");

  // Count completed habits (lines with ✅ or "done" in agent notes as proxy)
  const habitLines = habitsDue
    ? habitsDue.split("\n").filter((l) => l.trim().startsWith("•")).length
    : 0;

  const parts = [];
  if (energy !== null) parts.push(`Energy: ${energy}/5`);
  if (mood !== null) parts.push(`Mood: ${mood}/5`);
  if (wins) parts.push(`Wins: ${wins}`);
  if (habitLines > 0) parts.push(`Habits logged: ${habitLines} today`);
  parts.push("Log tomorrow's #1 before sleep 🌙");

  const message = parts.join("\n");

  console.log("Evening summary:");
  console.log(message);

  await notify("🌙 Evening — Life OS", message, ["moon", "star"]);
  console.log("\n✅ Evening summary sent.\n");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
