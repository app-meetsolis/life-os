/**
 * Life OS — Dashboard Data Generator
 * Reads Notion DBs → outputs dashboard/data.json
 * Run: node tools/generate-dashboard-data.js
 * Used by: .github/workflows/dashboard-update.yml (nightly)
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Client } = require("@notionhq/client");
const fs = require("fs");
const path = require("path");

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const DB = {
  dailyLog: process.env.NOTION_DAILY_LOG_DB_ID,
  habits: process.env.NOTION_HABITS_DB_ID,
  tasks: process.env.NOTION_TASKS_DB_ID,
  stories: process.env.NOTION_MEETSOLIS_STORIES_DB_ID,
  bugs: process.env.NOTION_MEETSOLIS_BUGS_DB_ID,
  decisions: process.env.NOTION_MEETSOLIS_DECISIONS_DB_ID,
};

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function getProp(page, name, type) {
  const prop = page.properties[name];
  if (!prop) return null;
  if (type === "number") return prop.number;
  if (type === "rich_text") return prop.rich_text?.[0]?.plain_text || "";
  if (type === "title") return prop.title?.[0]?.plain_text || "";
  if (type === "select") return prop.select?.name || null;
  if (type === "checkbox") return prop.checkbox || false;
  if (type === "date") return prop.date?.start || null;
  return null;
}

async function getDailyLogs(days = 30) {
  if (!DB.dailyLog) return [];
  try {
    const res = await notion.databases.query({
      database_id: DB.dailyLog,
      sorts: [{ property: "Date", direction: "descending" }],
      page_size: days,
    });
    return res.results.map((p) => ({
      date: getProp(p, "Date", "title"),
      energy: getProp(p, "Energy (1-5)", "number"),
      mood: getProp(p, "Mood (1-5)", "number"),
      wins: getProp(p, "Wins", "rich_text"),
      top3: getProp(p, "Top 3 Tasks", "rich_text"),
    }));
  } catch (e) {
    console.warn("⚠️  Daily log fetch failed:", e.message);
    return [];
  }
}

async function getHabits() {
  if (!DB.habits) return [];
  try {
    const res = await notion.databases.query({ database_id: DB.habits });
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return res.results.map((p) => {
      const name = getProp(p, "Habit Name", "title");
      const agent = getProp(p, "Agent", "select");
      const weekly = {};
      days.forEach((d) => {
        weekly[d] = getProp(p, d, "checkbox") || false;
      });
      const doneCount = Object.values(weekly).filter(Boolean).length;
      return { name, agent, weekly, doneCount, total: 7 };
    });
  } catch (e) {
    console.warn("⚠️  Habits fetch failed:", e.message);
    return [];
  }
}

async function getTasks(days = 30) {
  if (!DB.tasks) return [];
  try {
    const since = daysAgoISO(days);
    const res = await notion.databases.query({
      database_id: DB.tasks,
      filter: {
        and: [
          { property: "Date", date: { on_or_after: since } },
          { property: "Complete", checkbox: { equals: true } },
        ],
      },
      page_size: 100,
    });
    return res.results.map((p) => ({
      date: getProp(p, "Date", "date"),
      agent: getProp(p, "Agent", "select"),
      area: getProp(p, "Area", "select"),
    }));
  } catch (e) {
    console.warn("⚠️  Tasks fetch failed:", e.message);
    return [];
  }
}

async function getStories() {
  if (!DB.stories) return [];
  try {
    const res = await notion.databases.query({
      database_id: DB.stories,
      page_size: 100,
    });
    const counts = { Backlog: 0, "In Progress": 0, QA: 0, Done: 0 };
    res.results.forEach((p) => {
      const status = getProp(p, "Status", "select");
      if (status && counts[status] !== undefined) counts[status]++;
    });
    return counts;
  } catch (e) {
    console.warn("⚠️  Stories fetch failed:", e.message);
    return {};
  }
}

async function getBugs() {
  if (!DB.bugs) return [];
  try {
    const res = await notion.databases.query({
      database_id: DB.bugs,
      filter: { property: "Status", select: { equals: "Open" } },
      page_size: 50,
    });
    return res.results.map((p) => ({
      title: getProp(p, "Bug Title", "title"),
      severity: getProp(p, "Severity", "select"),
      story: getProp(p, "Story", "rich_text"),
      dateFound: getProp(p, "Date Found", "date"),
    }));
  } catch (e) {
    console.warn("⚠️  Bugs fetch failed:", e.message);
    return [];
  }
}

async function getDecisions() {
  if (!DB.decisions) return [];
  try {
    const res = await notion.databases.query({
      database_id: DB.decisions,
      sorts: [{ property: "Date", direction: "descending" }],
      page_size: 10,
    });
    return res.results.map((p) => ({
      decision: getProp(p, "Decision", "title"),
      why: getProp(p, "Why", "rich_text"),
      impact: getProp(p, "Impact", "select"),
      date: getProp(p, "Date", "date"),
    }));
  } catch (e) {
    console.warn("⚠️  Decisions fetch failed:", e.message);
    return [];
  }
}

async function main() {
  console.log("\n📊 Generating dashboard data...\n");

  const [dailyLogs, habits, tasks, stories, bugs, decisions] = await Promise.all([
    getDailyLogs(30),
    getHabits(),
    getTasks(30),
    getStories(),
    getBugs(),
    getDecisions(),
  ]);

  // Weekly task breakdown by area
  const weeklyByArea = {};
  const now = new Date();
  for (let week = 0; week < 4; week++) {
    const weekStart = daysAgoISO(week * 7 + 7);
    const weekEnd = daysAgoISO(week * 7);
    const label = `Week -${week + 1}`;
    const areas = {};
    tasks.forEach((t) => {
      if (t.date && t.date >= weekStart && t.date < weekEnd) {
        const area = t.area || t.agent || "Other";
        areas[area] = (areas[area] || 0) + 1;
      }
    });
    weeklyByArea[label] = areas;
  }

  const data = {
    generatedAt: new Date().toISOString(),
    dailyLogs: dailyLogs.slice(0, 30),
    habits,
    weeklyByArea,
    meetsolis: { stories, bugs, decisions },
  };

  const outPath = path.join(__dirname, "../dashboard/data.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));

  console.log(`✅ Dashboard data written to dashboard/data.json`);
  console.log(`   Daily logs: ${dailyLogs.length}`);
  console.log(`   Habits: ${habits.length}`);
  console.log(`   Open bugs: ${bugs.length}`);
  console.log(`   Decisions: ${decisions.length}`);
  if (stories && typeof stories === "object") {
    console.log(`   Stories: Backlog=${stories.Backlog} | In Progress=${stories["In Progress"]} | QA=${stories.QA} | Done=${stories.Done}`);
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
