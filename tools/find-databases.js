/**
 * Run this FIRST to find all your existing Notion database IDs.
 * It will print a list of all databases and their IDs.
 * Copy the IDs into your .env file.
 *
 * Run: node tools/find-databases.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function main() {
  console.log("\n🔍 Searching your Notion workspace for databases...\n");

  const res = await notion.search({
    filter: { value: "database", property: "object" },
    sort: { direction: "descending", timestamp: "last_edited_time" },
  });

  if (res.results.length === 0) {
    console.log("❌ No databases found.");
    console.log(
      "   Make sure you connected the 'Life OS' integration to your databases in Notion."
    );
    console.log(
      "   Go to each database → ... → Connections → Life OS → Connect"
    );
    return;
  }

  console.log(`Found ${res.results.length} database(s):\n`);
  console.log("Copy the relevant IDs into your .env file:\n");

  for (const db of res.results) {
    const title = db.title?.[0]?.plain_text || "(untitled)";
    const id = db.id.replace(/-/g, "");
    console.log(`📋 ${title}`);
    console.log(`   ID: ${db.id}`);
    console.log(`   Short ID: ${id}`);
    console.log();
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  if (err.code === "unauthorized") {
    console.error(
      "   Your API key is invalid or expired. Check NOTION_API_KEY in .env"
    );
  }
});
