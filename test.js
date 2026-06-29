import 'dotenv/config';

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// Nội dung bạn muốn gửi
const textMessage = '🚀 Em chào anh Đức! Em là bot. Bot đã hoạt động trơn tru rồi nhé!';

// Gửi request đến Telegram API
async function sendTelegramMessage() {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: textMessage,
            })
        });

        if (response.ok) {
            console.log('✅ Đã gửi tin nhắn Telegram thành công!');
        } else {
            console.log('❌ Lỗi gửi tin:', await response.text());
        }
    } catch (error) {
        console.error('❌ Lỗi kết nối:', error);
    }
}

sendTelegramMessage();