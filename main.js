import 'dotenv/config';
import { getGithubTrending } from './scraper.js';
import { summarizeWithAI } from './ai.js';

// --- CẤU HÌNH TELEGRAM ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

async function sendTelegramMessage(textMessage) {
    console.log('✈️ Đang gửi bản tin qua Telegram...');
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    try {
        let response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: textMessage,
                parse_mode: 'Markdown', // Yêu cầu Telegram render dạng Markdown cho đẹp
                disable_web_page_preview: true // Tắt cái hình ảnh preview link cho đỡ vướng
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`⚠️ Gửi với định dạng Markdown thất bại: ${errorText}`);
            console.log('🔄 Thử gửi lại dưới dạng văn bản thường (plain text)...');

            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    text: textMessage,
                    disable_web_page_preview: true
                })
            });
        }

        if (response.ok) {
            console.log('✅ BINGO! Đã gửi tin nhắn Telegram thành công!');
        } else {
            console.error('❌ Lỗi từ Telegram:', await response.text());
        }
    } catch (error) {
        console.error('❌ Lỗi kết nối Telegram:', error);
    }
}

// --- HÀM CHẠY CHÍNH (ORCHESTRATOR) ---
async function startBot() {
    console.log('🚀 BẮT ĐẦU KHỞI CHẠY TRENDING AI BOT 🚀\n');

    // 1. Cào dữ liệu
    const reposData = await getGithubTrending();
    if (!reposData || reposData.length === 0) {
        console.log('⚠️ Không lấy được dữ liệu, dừng chương trình.');
        return;
    }

    // 2. Nhờ AI tóm tắt
    const summary = await summarizeWithAI(reposData);
    if (!summary) {
        console.log('⚠️ AI không trả về kết quả, dừng chương trình.');
        return;
    }

    // 3. Gửi sang Telegram
    await sendTelegramMessage(summary);

    console.log('\n🎉 HOÀN TẤT TOÀN BỘ QUY TRÌNH!');
}

// Bấm nút khởi động!
startBot();