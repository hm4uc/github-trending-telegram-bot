import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. Khởi tạo Gemini với API Key của bạn
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export async function summarizeWithAI(reposData) {
    console.log('🧠 Đang nhờ Gemini đọc README và viết tóm tắt...');

    // Dùng model gemini-2.5-flash (tốc độ cực nhanh, chuyên xử lý text dài)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 2. Kỹ năng Prompt Engineering: Ra lệnh cho AI
    const prompt = `
    Bạn là một Senior Developer đi trước. Tôi có danh sách các dự án GitHub đang trending hôm nay.
    Dưới đây là dữ liệu JSON (chứa tên, ngôn ngữ, mô tả và trích đoạn README của chúng):
    
    ${JSON.stringify(reposData)}
    
    Hãy viết một bản báo cáo ngắn gọn, sắc bén bằng tiếng Việt để tôi gửi qua Telegram.
    Nguyên tắc bắt buộc:
    - Giải thích bản chất dự án làm được gì, mang lại lợi ích gì (dựa vào phần README). Không dịch word-by-word một cách máy móc.
    - Dùng icon sinh động để dễ đọc trên điện thoại.
    - Mỗi dự án trình bày theo format:
      🔥 [Tên dự án](Link) - Ngôn ngữ
      💡 Tính năng cốt lõi: (2-3 câu tóm tắt cực chất)
    `;

    try {
        // 3. Gửi dữ liệu đi và chờ AI làm việc
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        console.log('✅ AI đã viết xong bản tin!');
        console.log('\n===============================\n');
        console.log(text);

        return text;
    } catch (error) {
        console.error('❌ Lỗi khi gọi Gemini API:', error);
    }
}