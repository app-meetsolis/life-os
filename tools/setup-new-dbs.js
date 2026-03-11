/**
 * Life OS — Phase 2 DB Setup
 * Creates 5 new Notion databases under the Second Brain root page.
 * Run once: node tools/setup-new-dbs.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const ROOT_PAGE_ID = "2d2dc800-c36f-8048-a3e8-dd24f5345114";

async function createDB(title, properties) {
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: ROOT_PAGE_ID },
    title: [{ type: "text", text: { content: title } }],
    properties,
  });
  console.log(`✅ ${title}: ${db.id}`);
  return db.id;
}

async function main() {
  console.log("\n🚀 Creating Phase 2 Notion databases...\n");

  const storiesId = await createDB("MeetSolis Stories", {
    "Story ID": { title: {} },
    Epic: {
      select: {
        options: [
          { name: "Epic 1", color: "blue" },
          { name: "Epic 2", color: "green" },
          { name: "Epic 3", color: "yellow" },
          { name: "Epic 4", color: "orange" },
          { name: "Epic 5", color: "red" },
        ],
      },
    },
    Status: {
      select: {
        options: [
          { name: "Backlog", color: "gray" },
          { name: "In Progress", color: "blue" },
          { name: "QA", color: "yellow" },
          { name: "Done", color: "green" },
        ],
      },
    },
    "Files Touched": { rich_text: {} },
    "PR Link": { url: {} },
    Branch: { rich_text: {} },
    Notes: { rich_text: {} },
    "Completed Date": { date: {} },
  });

  const bugsId = await createDB("MeetSolis Bugs", {
    "Bug Title": { title: {} },
    Severity: {
      select: {
        options: [
          { name: "Critical", color: "red" },
          { name: "High", color: "orange" },
          { name: "Medium", color: "yellow" },
          { name: "Low", color: "gray" },
        ],
      },
    },
    Story: { rich_text: {} },
    "Root Cause": { rich_text: {} },
    Solution: { rich_text: {} },
    Status: {
      select: {
        options: [
          { name: "Open", color: "red" },
          { name: "Fixed", color: "green" },
          { name: "Won't Fix", color: "gray" },
        ],
      },
    },
    "Date Found": { date: {} },
  });

  const decisionsId = await createDB("MeetSolis Decisions", {
    Decision: { title: {} },
    Why: { rich_text: {} },
    Alternatives: { rich_text: {} },
    Date: { date: {} },
    Impact: {
      select: {
        options: [
          { name: "Architecture", color: "blue" },
          { name: "UX", color: "purple" },
          { name: "Performance", color: "green" },
          { name: "Security", color: "red" },
          { name: "Product", color: "orange" },
        ],
      },
    },
  });

  const researchId = await createDB("Research", {
    Topic: { title: {} },
    Type: {
      select: {
        options: [
          { name: "Topic", color: "blue" },
          { name: "Person", color: "purple" },
          { name: "Company", color: "green" },
          { name: "Market", color: "orange" },
        ],
      },
    },
    Summary: { rich_text: {} },
    "Key Findings": { rich_text: {} },
    Sources: { rich_text: {} },
    Date: { date: {} },
    Tags: { multi_select: {} },
  });

  const peopleId = await createDB("People", {
    Name: { title: {} },
    "Who They Are": { rich_text: {} },
    "Why Relevant": { rich_text: {} },
    "Key Insights": { rich_text: {} },
    Links: { rich_text: {} },
    "Last Updated": { date: {} },
  });

  console.log("\n📋 Add these to your .env and GitHub secrets:\n");
  console.log(`NOTION_MEETSOLIS_STORIES_DB_ID=${storiesId}`);
  console.log(`NOTION_MEETSOLIS_BUGS_DB_ID=${bugsId}`);
  console.log(`NOTION_MEETSOLIS_DECISIONS_DB_ID=${decisionsId}`);
  console.log(`NOTION_RESEARCH_DB_ID=${researchId}`);
  console.log(`NOTION_PEOPLE_DB_ID=${peopleId}`);
  console.log("\n✅ Done. Copy the IDs above into your .env file.\n");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
