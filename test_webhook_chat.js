import 'dotenv/config';
import handler from './api/webhook.js';

const CHAT_ID = 8606557059;

const mockReq = {
    method: 'POST',
    body: {
        message: {
            chat: { id: CHAT_ID },
            text: ''
        }
    }
};

const mockRes = {
    status(code) {
        console.log(`[Status Code]: ${code}`);
        return this;
    },
    json(obj) {
        console.log('[JSON Response]:', obj);
        return this;
    }
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    console.log('==================================================');
    console.log('🤖 BẮT ĐẦU CHẠY THỬ NGHIỆM HỎI ĐÁP WEBHOOK');
    console.log('==================================================');

    console.log('\n1️⃣ THỬ NGHIỆM LỆNH /start...');
    mockReq.body.message.text = '/start';
    await handler(mockReq, mockRes);
    await sleep(2000);

    console.log('\n2️⃣ THỬ NGHIỆM CHỌN DỰ ÁN HỎI ĐÁP (/ask)...');
    // Ở đây ta chọn một repo đã có trong DB, ví dụ: 'simplex-chat/simplex-chat'
    mockReq.body.message.text = '/ask simplex-chat/simplex-chat';
    await handler(mockReq, mockRes);
    await sleep(2000);

    console.log('\n3️⃣ ĐẶT CÂU HỎI TRONG PHẠM VI (WITHIN README)...');
    mockReq.body.message.text = 'Dự án này viết bằng ngôn ngữ nào và mục đích chính là gì?';
    await handler(mockReq, mockRes);
    await sleep(4000);

    console.log('\n4️⃣ ĐẶT CÂU HỎI NGOÀI PHẠM VI README (OUT OF SCOPE -> GOOGLE SEARCH)...');
    mockReq.body.message.text = 'Thời tiết Hà Nội hôm nay thế nào?';
    await handler(mockReq, mockRes);
    await sleep(4000);

    console.log('\n5️⃣ THỬ NGHIỆM THOÁT CHẾ ĐỘ HỎI ĐÁP (/exit)...');
    mockReq.body.message.text = '/exit';
    await handler(mockReq, mockRes);
    
    console.log('\n🎉 HOÀN THÀNH TOÀN BỘ CÁC THỬ NGHIỆM!');
}

run();
