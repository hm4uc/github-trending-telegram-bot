import { summarizeWithAI } from '../ai.js';
import { getGithubTrending } from '../scraper.js';

export default async function handler(req, res) {
    // Khi bạn chat, Telegram sẽ bắn request POST vào đây
    if (req.method === 'POST') {
        const body = req.body;

        // Kiểm tra xem có tin nhắn không
        if (body.message && body.message.text) {
            const chatId = body.message.chat.id;
            const text = body.message.text.trim().toLowerCase();
            const BOT_TOKEN = process.env.BOT_TOKEN;

            let replyText = 'Dạ em chưa hiểu ý anh. Anh gõ "trending" để lấy bản tin Github nhé!';

            // Dạy bot hiểu lệnh "trending"
            if (text === 'trending') {
                replyText = '⏳ Đang đi cào dữ liệu và phân tích, anh đợi xíu nhé...';
                // Bắn tin nhắn phản hồi trước để tránh timeout
                await sendMessage(chatId, replyText, BOT_TOKEN);

                // Đi lấy dữ liệu
                const reposData = await getGithubTrending();
                replyText = await summarizeWithAI(reposData);
            }

            // Gửi tin nhắn kết quả lại cho bạn
            await sendMessage(chatId, replyText, BOT_TOKEN);
        }
    }

    // Luôn phải trả về 200 OK để Telegram biết là đã nhận được tin
    res.status(200).json({ ok: true });
}

// Hàm phụ gửi tin với cơ chế fallback nếu lỗi Markdown
async function sendMessage(chatId, text, token) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        let response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: chatId, 
                text: text, 
                parse_mode: 'Markdown',
                disable_web_page_preview: true 
            })
        });

        if (!response.ok) {
            console.warn('⚠️ Gửi Markdown thất bại, thử lại dưới dạng văn bản thường...');
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    chat_id: chatId, 
                    text: text,
                    disable_web_page_preview: true 
                })
            });
        }
    } catch (error) {
        console.error('❌ Lỗi kết nối Telegram:', error);
    }
}