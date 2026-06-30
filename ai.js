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

export async function answerRepoQuestion(readme, repoName, question, history = []) {
    const systemInstruction = `
Bạn là một chatbot hỗ trợ lập trình viên. Nhiệm vụ của bạn là giải đáp thắc mắc về dự án "${repoName}" dựa vào tài liệu README được cung cấp dưới đây.

Nội dung README của dự án:
=== BẮT ĐẦU README ===
${readme}
=== KẾT THÚC README ===

Nguyên tắc trả lời:
1. CHỈ sử dụng thông tin có trong tài liệu README ở trên để trả lời.
2. Nếu câu hỏi KHÔNG THỂ trả lời được bằng thông tin trong tài liệu README trên, bạn BẮT BUỘC phải bắt đầu câu trả lời bằng cụm từ "[OUT_OF_SCOPE]" và giải thích ngắn gọn rằng thông tin này không có trong tài liệu README của dự án. Không được tự bịa ra thông tin hoặc dùng kiến thức cũ của bạn để trả lời.
`;

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemInstruction
        });

        const geminiHistory = history.map(h => ({
            role: h.role,
            parts: [{ text: h.content }]
        }));

        const chat = model.startChat({
            history: geminiHistory
        });

        const result = await chat.sendMessage(question);
        return result.response.text();
    } catch (error) {
        console.error('❌ Lỗi khi hỏi đáp về repo:', error);
        return 'Xin lỗi, đã xảy ra lỗi trong quá trình xử lý câu hỏi của bạn.';
    }
}

export async function answerWithSearch(question, repoName = null, history = []) {
    let systemInstruction = 'Bạn là một trợ lý ảo thông minh. Hãy trả lời câu hỏi của người dùng và sử dụng công cụ tìm kiếm Google khi cần để cung cấp thông tin mới nhất và chính xác nhất.';
    if (repoName) {
        systemInstruction += ` Câu hỏi này liên quan đến dự án "${repoName}" nhưng thông tin nằm ngoài tài liệu README của họ. Hãy tìm kiếm thông tin trên internet để hỗ trợ trả lời.`;
    }

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: systemInstruction,
            tools: [{ googleSearch: {} }]
        });

        const geminiHistory = history.map(h => ({
            role: h.role,
            parts: [{ text: h.content }]
        }));

        const chat = model.startChat({
            history: geminiHistory
        });

        const result = await chat.sendMessage(question);
        return result.response.text();
    } catch (error) {
        console.error('❌ Lỗi khi hỏi đáp với Google Search:', error);
        return 'Xin lỗi, đã xảy ra lỗi khi tìm kiếm thông tin trực tuyến để trả lời câu hỏi của bạn.';
    }
}

export async function identifyReferencedRepo(question, repoList) {
    const prompt = `
Dưới đây là danh sách các dự án GitHub đang có trong hệ thống (chứa tên và mô tả ngắn):
${JSON.stringify(repoList)}

Câu hỏi/tin nhắn của người dùng: "${question}"

Hãy phân tích xem tin nhắn của người dùng có đang hỏi, nhắc đến hoặc muốn tìm hiểu về một dự án cụ thể nào trong danh sách trên hay không (chấp nhận việc viết sai chính tả, viết tắt, dịch nghĩa, hoặc nhắc đến tên một phần của dự án, ví dụ: "simple chat" tương ứng với "simplex-chat/simplex-chat").

Quy tắc phản hồi:
- Nếu xác định người dùng đang nhắc đến một dự án cụ thể, hãy trả về CHÍNH XÁC "repo_name" của dự án đó (không thêm bất kỳ từ ngữ nào khác). Ví dụ: "simplex-chat/simplex-chat".
- Nếu người dùng KHÔNG nhắc đến dự án nào, hoặc câu hỏi là chung chung, hãy trả về từ "NONE".
`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const matched = result.response.text().replace(/[`"']/g, '').trim();
        return matched !== 'NONE' ? matched : null;
    } catch (error) {
        console.error('❌ Lỗi khi phân tích dự án được nhắc đến:', error);
        return null;
    }
}