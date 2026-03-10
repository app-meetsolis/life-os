/**
 * Life OS — Daily Briefing Script
 * Runs at 7am via Windows Task Scheduler
 * Creates today's Daily Log + sends push notification to Android + laptop
 *
 * Setup: npm install @notionhq/client dotenv
 * Run:   node tools/daily-brief.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Client } = require("@notionhq/client");
const https = require("https");

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const NTFY_TOPIC = process.env.NTFY_TOPIC; // your private topic name

const DB = {
  dailyLog: process.env.NOTION_DAILY_LOG_DB_ID,
  habits: process.env.NOTION_HABITS_DB_ID,
  tasks: process.env.NOTION_TASKS_DB_ID,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function todayDayName() {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

// Send push notification via ntfy.sh (free, no account needed)
async function notify(title, message, tags = "") {
  if (!NTFY_TOPIC) return; // skip if not configured
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
      (res) => {
        resolve(res.statusCode);
      }
    );
    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  });
}

async function findTodayLog(dateStr) {
  const res = await notion.databases.query({
    database_id: DB.dailyLog,
    filter: { property: "Date", title: { equals: dateStr } },
  });
  return res.results[0] || null;
}

async function getTodayTasks(dateStr) {
  const res = await notion.databases.query({
    database_id: DB.tasks,
    filter: { property: "Date", date: { equals: dateStr } },
  });
  return res.results.map((t) => {
    const title = t.properties.Name?.title?.[0]?.plain_text || "Untitled";
    const agent = t.properties.Agent?.select?.name || "";
    return agent ? `[${agent}] ${title}` : title;
  });
}

async function getTodayHabits(dayName) {
  const res = await notion.databases.query({ database_id: DB.habits });
  return res.results
    .filter((h) => h.properties[dayName]?.checkbox === false)
    .map((h) => {
      const name = h.properties["Habit Name"]?.title?.[0]?.plain_text || "?";
      const agent = h.properties.Agent?.select?.name || "";
      return agent ? `[${agent}] ${name}` : name;
    });
}

async function createDailyLog(dateStr, tasks, habits) {
  const taskText = tasks.length
    ? tasks.map((t) => `• ${t}`).join("\n")
    : "None scheduled";
  const habitText = habits.length
    ? habits.map((h) => `• ${h}`).join("\n")
    : "All habits done or none set";

  await notion.pages.create({
    parent: { database_id: DB.dailyLog },
    properties: {
      Date: { title: [{ text: { content: dateStr } }] },
      "Energy (1-5)": { number: null },
      "Mood (1-5)": { number: null },
      "Top 3 Tasks": { rich_text: [{ text: { content: taskText } }] },
      "Habits Due": { rich_text: [{ text: { content: habitText } }] },
      Wins: { rich_text: [{ text: { content: "" } }] },
      "Brain Dump": { rich_text: [{ text: { content: "" } }] },
      "Tomorrow's #1": { rich_text: [{ text: { content: "" } }] },
      "Agent Notes": { rich_text: [{ text: { content: "" } }] },
    },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dateStr = todayISO();
  const dayName = todayDayName();

  console.log(`\n🌅 Life OS Daily Brief — ${dateStr} (${dayName})\n`);

  const existing = await findTodayLog(dateStr);
  if (existing) {
    console.log("✅ Daily Log already exists for today. Nothing to do.");
    // Still send a reminder notification
    await notify(
      "⚡ Life OS",
      `Good morning! Open Nexus for your daily brief.`,
      ["sunrise"]
    );
    return;
  }

  const [tasks, habits] = await Promise.all([
    getTodayTasks(dateStr),
    getTodayHabits(dayName),
  ]);

  console.log(`📋 Tasks due today: ${tasks.length}`);
  tasks.forEach((t) => console.log(`   ${t}`));

  console.log(`\n💪 Habits due today: ${habits.length}`);
  habits.forEach((h) => console.log(`   ${h}`));

  await createDailyLog(dateStr, tasks, habits);

  // Build notification message
  const habitNames = habits
    .map((h) => h.replace(/\[.*?\] /, "")) // strip agent tag
    .join(", ");
  const taskCount = tasks.length;
  const notifMessage = [
    habitNames ? `Habits: ${habitNames}` : "No habits due",
    taskCount ? `${taskCount} task(s) due today` : "No tasks scheduled",
    "Open Nexus → 'morning brief'",
  ].join("\n");

  await notify("🌅 Good morning — Life OS", notifMessage, ["sunrise", "calendar"]);

  console.log(`\n✅ Daily Log created for ${dateStr}`);
  console.log("   Notification sent to your devices.");
  console.log("   Open Nexus and say 'morning brief'.\n");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
