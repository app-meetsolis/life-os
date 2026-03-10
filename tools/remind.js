/**
 * Life OS — Reminder Script
 * Sends a push notification for a specific time-based reminder.
 * Called by Task Scheduler with a TYPE argument.
 *
 * Usage: node tools/remind.js <type>
 * Types: work | content | evening | habit
 *
 * Examples:
 *   node tools/remind.js work      → 10am work nudge
 *   node tools/remind.js content   → 5pm content nudge
 *   node tools/remind.js evening   → 9pm evening check-in
 *   node tools/remind.js habit     → 11pm sleep habit reminder
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const https = require("https");

const NTFY_TOPIC = process.env.NTFY_TOPIC;

const REMINDERS = {
  work: {
    title: "💼 Work block",
    message: "Time to open Nexus → 'business check'\nWhat's today's #1 priority?",
    tags: ["briefcase"],
  },
  content: {
    title: "🎨 Content time",
    message: "Have you filmed today's Day X reel?\nOpen Nexus → 'content check'",
    tags: ["camera"],
  },
  evening: {
    title: "🌿 Evening check-in",
    message: "Tell Nexus what you got done today.\nLog your energy + habits.",
    tags: ["moon"],
  },
  habit: {
    title: "😴 Sleep reminder",
    message: "Sleep by midnight is a habit.\nWrap up and wind down.",
    tags: ["zzz"],
  },
};

async function notify(title, message, tags = "") {
  if (!NTFY_TOPIC) {
    console.error("❌ NTFY_TOPIC not set in .env");
    process.exit(1);
  }
  return new Promise((resolve, reject) => {
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
        console.log(`✅ Notification sent (${res.statusCode}): ${title}`);
        resolve();
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const type = process.argv[2];
  if (!type || !REMINDERS[type]) {
    console.error(`❌ Unknown type: "${type}"`);
    console.error(`   Valid types: ${Object.keys(REMINDERS).join(", ")}`);
    process.exit(1);
  }
  const r = REMINDERS[type];
  await notify(r.title, r.message, r.tags);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
