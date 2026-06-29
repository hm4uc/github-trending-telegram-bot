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
│   ├── cron.js        # Vercel Cron Handler (sends daily automated updates)
│   └── webhook.js     # Telegram Webhook Handler (responds to interactive commands)
├── ai.js              # Gemini API helper to summarize repository data
├── main.js            # Main orchestrator script to run the bot locally
├── scraper.js         # Scrapes the trending list and reads README files
├── test.js            # Quick test script for Telegram API connection
├── vercel.json        # Vercel cron and configuration file
├── package.json       # Node.js dependencies
└── .gitignore         # Ignores local environment files and node_modules
```

## Setup & Configuration

### Prerequisites
- Node.js (v20.6.0+ recommended for built-in env file support, or uses `dotenv` package)
- A Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- A Telegram Chat ID or Channel ID
- A Google Gemini API Key (from Google AI Studio)

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <your-repo-url>
   cd <repo-name>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:
   ```env
   BOT_TOKEN=your_telegram_bot_token
   CHAT_ID=your_telegram_chat_id
   GEMINI_API_KEY=your_gemini_api_key
   ```

## Usage

### Running Locally

To scrape, summarize, and send the update to Telegram manually:
```bash
node main.js
```

To test only the Telegram integration:
```bash
node test.js
```

### Deploying to Vercel

1. Install the Vercel CLI or deploy via the Vercel Dashboard connected to your GitHub repository.
2. Set the following environment variables in your Vercel Project Settings:
   - `BOT_TOKEN`
   - `CHAT_ID`
   - `GEMINI_API_KEY`
3. The cron job is configured in `vercel.json` to trigger every day at midnight (`0 0 * * *`) via `/api/cron`.
