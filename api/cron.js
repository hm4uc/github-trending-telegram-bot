import { getGithubTrending } from '../scraper.js';
import { summarizeWithAI } from '../ai.js';
import { supabase } from '../db.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendTelegramMessage(chatId, text, token) {
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

        // Nếu lỗi Markdown, gửi lại dạng text thường
        if (!response.ok && response.status !== 403) {
            console.warn(`⚠️ Gửi Markdown tới ${chatId} thất bại, thử lại dưới dạng văn bản thường...`);
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    chat_id: chatId, 
                    text: text,
                    disable_web_page_preview: true 
                })
            });
        }

        return response;
    } catch (err) {
        console.error(`❌ Lỗi gửi tin tới ${chatId}:`, err);
        return null;
    }
}

export default async function handler(req, res) {
    // Vercel Cron sẽ gọi vào link này (mỗi ngày một lần)
    try {
        console.log('⏰ Bắt đầu chạy Vercel Cron GitHub Trending...');
        const reposData = await getGithubTrending();
        if (!reposData || reposData.length === 0) {
            return res.status(200).json({ success: true, message: 'Không có dữ liệu trending mới.' });
        }

        const summary = await summarizeWithAI(reposData);
        const BOT_TOKEN = process.env.BOT_TOKEN;

        // 1. Lấy danh sách tất cả người dùng đang subscribe
        const { data: subscribers, error: subError } = await supabase
            .from('subscribers')
            .select('chat_id')
            .eq('is_active', true);

        let targetChatIds = [];

        if (!subError && subscribers && subscribers.length > 0) {
            targetChatIds = subscribers.map((s) => s.chat_id);
        } else if (process.env.CHAT_ID) {
            // Dự phòng cho cài đặt cũ nếu chưa có ai subscribe qua bot
            targetChatIds = [process.env.CHAT_ID];
        }

        if (targetChatIds.length === 0) {
            console.log('ℹ️ Chưa có người dùng nào đăng ký nhận bản tin.');
            return res.status(200).json({ success: true, message: 'Chưa có người dùng nào đăng ký.' });
        }

        console.log(`📢 Đang phát bản tin tới ${targetChatIds.length} người dùng...`);

        let sentSuccess = 0;
        let blockedCount = 0;

        for (const chatId of targetChatIds) {
            const resp = await sendTelegramMessage(chatId, summary, BOT_TOKEN);

            if (resp) {
                if (resp.status === 403) {
                    // Người dùng đã chặn bot -> Tự động hủy kích hoạt để tiết kiệm tài nguyên
                    console.warn(`🚫 User ${chatId} đã chặn bot. Đang đánh dấu ngừng nhận tin...`);
                    await supabase
                        .from('subscribers')
                        .update({ is_active: false })
                        .eq('chat_id', chatId);
                    blockedCount++;
                } else if (resp.ok) {
                    sentSuccess++;
                }
            }

            // Nghỉ 40ms giữa các lần gửi (~25 requests/giây) để đảm bảo không vượt giới hạn 30 req/s của Telegram
            await sleep(40);
        }

        console.log(`✅ Đã gửi thành công: ${sentSuccess}/${targetChatIds.length} (Bị chặn/Hủy: ${blockedCount})`);

        res.status(200).json({ 
            success: true, 
            message: `Đã gửi bản tin tới ${sentSuccess} người dùng!`,
            blocked: blockedCount 
        });
    } catch (error) {
        console.error('❌ Lỗi cron handler:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}