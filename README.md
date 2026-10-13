# GitHub Trending Telegram Bot with Gemini AI

A serverless Telegram Bot that tracks top trending repositories on GitHub, summarizes their README files using Gemini AI (Gemini 2.5 Flash), and sends a daily summary directly to a Telegram channel or chat. It can run locally or deploy to Vercel with automated cron jobs and webhooks.

## Features

- **GitHub Trending Scraper**: Fetches top trending repositories on GitHub and reads their full `README` file content.
- **AI Summary**: Uses Google Gemini API (`gemini-2.5-flash`) to analyze and summarize the core value of each trending repository in Vietnamese (or any desired language) with high quality.
- **Telegram Integration**: Delivers clean, formatted, and readable Markdown reports directly to your Telegram chat/channel.
- **Serverless & Cron Ready**: Configured for Vercel Serverless Functions with a built-in cron schedule and webhook capability.

## Project Structure

```text
├── api/
│   ├── cron.js             # Vercel Cron Handler (sends daily automated updates)
│   └── webhook.js          # Telegram Webhook Handler (responds to interactive Q&A and commands)
├── ai.js                   # Gemini API helper for summaries and intelligent Q&A (with Google Search tool)
├── db.js                   # Supabase Database client initialization
├── main.js                 # Main orchestrator script to run the bot and update cache locally
├── scraper.js              # Scrapes the trending list and updates Supabase cache
├── setup.sql               # Database schema setup queries
├── vercel.json             # Vercel cron and configuration file
├── package.json            # Node.js dependencies
└── .gitignore              # Ignores local environment files and node_modules
```

## Setup & Configuration

### Prerequisites
- Node.js (v20.6.0+ recommended for built-in env file support, or uses `dotenv` package)
- A Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- A Telegram Chat ID or Channel ID
- A Google Gemini API Key (from Google AI Studio)
- A Supabase Project (PostgreSQL database)

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone https://github.com/hm4uc/github-trending-telegram-bot.git
   cd github-trending-telegram-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup your Database:
   - Go to your Supabase Project Dashboard -> **SQL Editor**.
   - Create a new query, paste the contents of `setup.sql`, and click **Run**.

4. Create a `.env` file in the root directory:
   ```env
   BOT_TOKEN=your_telegram_bot_token
   CHAT_ID=your_telegram_chat_id
   GEMINI_API_KEY=your_gemini_api_key
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your_supabase_service_role_key
   ```

## Usage & Commands

### Interactive Q&A & Multi-User Commands

Your bot supports multi-user conversational Q&A and automated notifications:
- **/start** or **/help**: Welcome menu with interactive inline buttons. Automatically registers the user as an active subscriber for daily trending broadcasts.
- **/trending5** / **/trending10**: Displays top 5 or 10 trending repositories.
- **/model**: Switch between `gemini-2.5-flash-lite` (ultra fast, high throughput) and `gemini-2.5-flash` (deep reasoning).
- **/status**: Shows your currently active repository and currently selected AI model.
- **/ask <owner/repo>**: Connects you to a specific repository in the database (e.g. `/ask commaai/openpilot`). Your subsequent messages will be answered using its actual `README.md` content (RAG).
- **Send GitHub Link**: Paste any GitHub repo URL (e.g. `https://github.com/simplex-chat/simplex-chat`) and the bot will scrape, summarize, and start a Q&A session on that repo automatically.
- **/subscribe**: Turn ON daily trending news digest at 7:00 AM (00:00 UTC).
- **/unsubscribe**: Turn OFF daily trending news digest.
- **Auto Google Search Grounding**: If you ask a question outside the scope of the project's README, the bot will automatically fall back to internet search to retrieve the correct answer.
- **/exit** or **/clear**: Clears the current active repository session and returns to free-form AI chat.


### Running Locally

To run the scraper and update your database cache manually:
```bash
node main.js
```

### Deploying to Vercel & Setting Webhook

1. Install the Vercel CLI or deploy via the Vercel Dashboard connected to your GitHub repository.
2. Set the following Environment Variables in your Vercel Project Settings:
   - `BOT_TOKEN`
   - `GEMINI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `CHAT_ID` (optional fallback for admin notification)
3. Set your Telegram Bot Webhook:
   Replace `<BOT_TOKEN>` and `<YOUR_VERCEL_URL>` in the following URL and open it in your browser:
   ```text
   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<YOUR_VERCEL_URL>/api/webhook
   ```
4. The cron job is configured in `vercel.json` to trigger every day at midnight (`0 0 * * *`) via `/api/cron`, broadcasting to all active subscribers.

