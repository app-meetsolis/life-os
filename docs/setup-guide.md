# Life OS Setup Guide

## Step 1 — Get a Free Notion API Key

1. Go to https://www.notion.so/my-integrations
2. Click **"+ New integration"**
3. Name it: `Life OS`
4. Select your workspace
5. Click **Submit** → copy the `Internal Integration Secret` (starts with `secret_...`)
6. Paste it into `.env` as `NOTION_API_KEY`

## Step 2 — Connect Integration to Your Databases

For EACH database (Daily Log, Habits, Tasks, Projects, Notes, Resources):
1. Open the database in Notion
2. Click **"..." (3 dots)** top right → **"Connections"**
3. Find **"Life OS"** → click **Connect**

Without this step, the API cannot read or write to that database.

## Step 3 — Get Database IDs

For each database, open it in Notion in your browser. The URL looks like:
```
https://www.notion.so/yourworkspace/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX?v=...
```
The 32-character string between the last `/` and `?v=` is the Database ID.

Copy each one into `.env`.

## Step 4 — Add Notion Schema Changes (Manual in Notion)

### Add `Agent` property to Tasks DB:
1. Open Tasks database
2. Click **+** to add a property
3. Type: **Agent** | Type: **Select**
4. Add options: Nexus, Aria, Atlas, James, Nova, Muse

Repeat for **Projects DB**.

### Create `Daily Log` database:
1. New page → full-page database
2. Name: **Daily Log**
3. Add properties:
   - Date (type: Date) — set as title replacement
   - Energy (1-5) (type: Number)
   - Mood (1-5) (type: Number)
   - Top 3 Tasks (type: Text)
   - Habits Due (type: Text)
   - Wins (type: Text)
   - Brain Dump (type: Text)
   - Tomorrow's #1 (type: Text)
   - Agent Notes (type: Text)

### Create `Habits` database:
1. New page → full-page database
2. Name: **Habits**
3. Add properties:
   - Habit Name (Title — already exists)
   - Area (type: Select — same options as Areas)
   - Agent (type: Select — same 6 agents)
   - Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday (all type: Checkbox)
   - Target per week (type: Number)
   - Notes (type: Text)
4. Pre-load 6 rows:
   | Habit Name | Agent | Area |
   |---|---|---|
   | Exercise | Aria | Health & Fitness |
   | Meditation & Book Reading | Aria | Health & Fitness |
   | Sleep by midnight | Aria | Health & Fitness |
   | Study block 1hr | Atlas | School |
   | Work on MeetSolis | James | Business |
   | Create content | Muse | Content Creation |

## Step 5 — Install & Run the Script

```bash
cd D:\life-os
npm install
cp .env.example .env
# Fill in .env with your API key + DB IDs
node tools/daily-brief.js
```

## Step 6 — Schedule for 7am (Windows Task Scheduler)

1. Open **Task Scheduler** (search in Start menu)
2. Click **Create Basic Task**
3. Name: `Life OS Daily Brief`
4. Trigger: **Daily** at **7:00 AM**
5. Action: **Start a program**
   - Program: `node`
   - Arguments: `D:\life-os\tools\daily-brief.js`
   - Start in: `D:\life-os`
6. Finish

## Step 7 — Set Up Claude Projects (6 agents)

1. Go to claude.ai → **Projects** → **New Project**
2. Create one project per agent, named as you like
3. In each project's **Instructions** (system prompt): paste the contents of `prompts/{agent}.md`
4. Connect Notion MCP: Claude.ai **Settings → Integrations → Notion → Connect**
5. Test: open each project → ask "morning brief" → verify it reads Notion

## Step 8 — Skills (Coming Later)

For **James** (Business) and **Muse** (Content):
- Check https://github.com/anthropics/claude-code for official skills
- When Anthropic publishes relevant skills (content creation, business analysis), install them in those projects
- For Muse's writing style: provide 5–10 sample posts → she'll adapt her voice

---

## Verification Checklist

- [ ] Daily Log entry auto-created when running script
- [ ] Aria: "morning brief" → lists today's habits + tasks from Notion
- [ ] Nexus: "add task: fix login bug" → appears in Tasks DB tagged correctly
- [ ] Projects kanban: Agent tag visible on cards
- [ ] Evening: tell Aria what you did → Daily Log updated
