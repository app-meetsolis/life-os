/**
 * Life OS — Notion Setup Script
 * Runs once to set up all databases and properties.
 *
 * What it does:
 * 1. Adds "Agent" select property to Tasks + Projects DBs
 * 2. Creates Daily Log database
 * 3. Creates Habits database + pre-loads 6 habits
 * 4. Saves new DB IDs to .env
 *
 * Run: node tools/setup-notion.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Client } = require("@notionhq/client");
const fs = require("fs");
const path = require("path");

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const ENV_PATH = path.join(__dirname, "../.env");

const AGENT_OPTIONS = [
  { name: "Nexus", color: "blue" },
  { name: "Aria", color: "green" },
  { name: "Atlas", color: "purple" },
  { name: "James", color: "orange" },
  { name: "Nova", color: "pink" },
  { name: "Muse", color: "yellow" },
];

const AREA_OPTIONS = [
  { name: "Personal", color: "default" },
  { name: "Health & Fitness", color: "green" },
  { name: "Business", color: "blue" },
  { name: "Content Creation", color: "yellow" },
  { name: "School", color: "purple" },
  { name: "Travel", color: "pink" },
  { name: "Investing", color: "orange" },
];

function updateEnv(key, value) {
  let content = fs.readFileSync(ENV_PATH, "utf8");
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }
  fs.writeFileSync(ENV_PATH, content);
}

// ─── Step 1: Add Agent property to Tasks + Projects ─────────────────────────

async function addAgentProperty(dbId, dbName) {
  console.log(`\n⚙️  Adding "Agent" property to ${dbName}...`);
  try {
    // Check if already exists
    const db = await notion.databases.retrieve({ database_id: dbId });
    if (db.properties["Agent"]) {
      console.log(`   ✅ Already exists — skipping`);
      return;
    }
    await notion.databases.update({
      database_id: dbId,
      properties: {
        Agent: {
          select: { options: AGENT_OPTIONS },
        },
      },
    });
    console.log(`   ✅ Done`);
  } catch (e) {
    console.error(`   ❌ Failed: ${e.message}`);
  }
}

// ─── Step 2: Find a parent page to create new DBs under ─────────────────────

async function findParentPage() {
  // Second Brain root page
  return { type: "page_id", page_id: "2d2dc800-c36f-8048-a3e8-dd24f5345114" };
}

// ─── Step 3: Create Daily Log database ──────────────────────────────────────

async function createDailyLog(parent) {
  if (process.env.NOTION_DAILY_LOG_DB_ID) {
    console.log(`\n📓 Daily Log already in .env — skipping creation`);
    return;
  }
  console.log(`\n📓 Creating Daily Log database...`);
  const db = await notion.databases.create({
    parent,
    title: [{ type: "text", text: { content: "Daily Log" } }],
    icon: { type: "emoji", emoji: "📓" },
    properties: {
      Date: { title: {} },
      "Energy (1-5)": { number: { format: "number" } },
      "Mood (1-5)": { number: { format: "number" } },
      "Top 3 Tasks": { rich_text: {} },
      "Habits Due": { rich_text: {} },
      Wins: { rich_text: {} },
      "Brain Dump": { rich_text: {} },
      "Tomorrow's #1": { rich_text: {} },
      "Agent Notes": { rich_text: {} },
    },
  });
  updateEnv("NOTION_DAILY_LOG_DB_ID", db.id);
  console.log(`   ✅ Created — ID: ${db.id}`);
}

// ─── Step 4: Create Habits database + pre-load habits ───────────────────────

async function createHabits(parent) {
  if (process.env.NOTION_HABITS_DB_ID) {
    console.log(`\n💪 Habits DB already in .env — skipping creation`);
    return;
  }
  console.log(`\n💪 Creating Habits database...`);
  const db = await notion.databases.create({
    parent,
    title: [{ type: "text", text: { content: "Habits" } }],
    icon: { type: "emoji", emoji: "💪" },
    properties: {
      "Habit Name": { title: {} },
      Area: { select: { options: AREA_OPTIONS } },
      Agent: { select: { options: AGENT_OPTIONS } },
      Monday: { checkbox: {} },
      Tuesday: { checkbox: {} },
      Wednesday: { checkbox: {} },
      Thursday: { checkbox: {} },
      Friday: { checkbox: {} },
      Saturday: { checkbox: {} },
      Sunday: { checkbox: {} },
      "Target per week": { number: { format: "number" } },
      Notes: { rich_text: {} },
    },
  });
  updateEnv("NOTION_HABITS_DB_ID", db.id);
  console.log(`   ✅ Created — ID: ${db.id}`);

  // Pre-load 6 habits
  console.log(`\n   Loading 6 habits...`);
  const habits = [
    { name: "Exercise", agent: "Aria", area: "Health & Fitness", target: 5 },
    { name: "Meditation & Book Reading", agent: "Aria", area: "Health & Fitness", target: 7 },
    { name: "Sleep by midnight", agent: "Aria", area: "Health & Fitness", target: 7 },
    { name: "Study block 1hr", agent: "Atlas", area: "School", target: 5 },
    { name: "Work on MeetSolis", agent: "James", area: "Business", target: 5 },
    { name: "Create content", agent: "Muse", area: "Content Creation", target: 3 },
  ];

  for (const h of habits) {
    await notion.pages.create({
      parent: { database_id: db.id },
      properties: {
        "Habit Name": { title: [{ text: { content: h.name } }] },
        Agent: { select: { name: h.agent } },
        Area: { select: { name: h.area } },
        "Target per week": { number: h.target },
      },
    });
    console.log(`   ✅ ${h.name}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Life OS — Notion Setup\n");

  // Add Agent to existing DBs
  await addAgentProperty(process.env.NOTION_TASKS_DB_ID, "Tasks");
  await addAgentProperty(process.env.NOTION_PROJECTS_DB_ID, "Projects");

  // Find parent for new DBs
  const parent = await findParentPage();

  // Create new DBs
  await createDailyLog(parent);
  await createHabits(parent);

  console.log("\n✅ Setup complete!\n");
  console.log("Next steps:");
  console.log("  1. Find your new Daily Log + Habits databases in Notion");
  console.log("     (they're created in the same location as your Tasks DB)");
  console.log("  2. Add them to your dashboard by linking from your main page");
  console.log("  3. Run the daily brief: node tools/daily-brief.js");
}

main().catch((err) => {
  console.error("\n❌ Setup failed:", err.message);
  if (err.body) console.error("   Details:", err.body);
});
