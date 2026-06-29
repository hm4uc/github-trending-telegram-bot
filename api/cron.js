import { getGithubTrending } from '../scraper.js';
import { summarizeWithAI } from '../ai.js';

export default async function handler(req, res) {
    // Vercel Cron sẽ gọi vào link này
    try {
        const reposData = await getGithubTrending();
        const summary = await summarizeWithAI(reposData);

        const BOT_TOKEN = process.env.BOT_TOKEN;
        const CHAT_ID = process.env.CHAT_ID;

        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text: summary, parse_mode: 'Markdown' })
        });

        res.status(200).json({ success: true, message: 'Đã gửi bản tin cron!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}