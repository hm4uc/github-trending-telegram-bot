# Design Specification: GitHub Trending Telegram Bot README Enhancement

- **Date:** 2026-10-25
- **Project:** `Duc's Github trending` (`github-trending-telegram-bot`)
- **Repository:** `https://github.com/hm4uc/github-trending-telegram-bot.git`
- **Goal:** Transform `README.md` into a top-tier GitHub trending showcase with a clean high-level architecture diagram featuring official technology vector logos and concise flows.

---

## 1. Objectives & Scope

1. **International Standard with Vietnamese Localization Note**: Provide an English-first showcase README (standard across top trending GitHub open-source repositories) while emphasizing the bot's native Vietnamese summaries and developer-oriented tone.
2. **Simplified High-Level Architecture Diagram**:
   - Single high-resolution vector SVG diagram (`assets/architecture.svg`) embedded directly in README with official technology logos: Telegram, Vercel, Node.js, GitHub, Google Gemini AI, and Supabase.
   - Collapsible Mermaid source code block (`flowchart LR`) showing concise component connections.
   - Removed overly complex sequence and deep webhook flowchart diagrams to keep the README focused, punchy, and readable.
3. **Showcase Visuals & Badges**:
   - Standard Shields.io flat badges (Node, Vercel, Gemini 2.5/3.8 Flash, Supabase, Telegram Bot API, License).
   - Actionable CTAs: Try Live Demo, 1-Click Deploy with Vercel, Star on GitHub.
4. **Command & Interaction Matrix**:
   - Clear table detailing all commands, inputs (like `/ask`, GitHub URLs), and Inline Keyboard actions.
5. **Database Schema & Architecture Documentation**:
   - Document tables: `repositories`, `user_sessions`, `subscribers`, `chat_history`.
6. **Setup, Configuration & Deployment**:
   - Step-by-step local execution instructions.
   - Vercel Serverless & Cron setup with automated webhook configuration.
