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
    Đóng vai một Senior Tech Lead đang tóm tắt xu hướng mã nguồn mở cho team.
    Dưới đây là mảng JSON chứa các dự án GitHub Trending hôm nay (có kèm trích đoạn README):
    
    ${JSON.stringify(reposData)}
    
    Nhiệm vụ: Viết một bản tin thật sắc bén bằng tiếng Việt để gửi thẳng qua Telegram.
    
    YÊU CẦU KHẮT KHE:
    1. Đi thẳng vào vấn đề: KHÔNG mở bài chào hỏi (kiểu "Chào bạn, dưới đây là..."), KHÔNG kết thúc vòng vo. Chỉ xuất ra nội dung bản tin.
    2. Chất lượng nội dung: Đọc hiểu README để rút ra BẢN CHẤT. Dự án này sinh ra để làm gì? Lợi ích là gì? (Dùng từ ngữ dân dã của lập trình viên, tuyệt đối không dịch máy móc word-by-word).
    3. An toàn Telegram API: HẠN CHẾ TỐI ĐA việc tự ý dùng các ký tự Markdown (như **, __, #, \`) bên ngoài format quy định để tránh lỗi parse text của bot Telegram.
    4. Trình bày mỗi dự án tuân thủ CHÍNH XÁC cấu trúc sau (giữa các dự án cách nhau một dòng trống):
    
    🔥 [Tên dự án](Link) | 💻 Ngôn ngữ
    💡 Insight: (2-4 câu giải thích ngắn gọn, đi thẳng vào "nỗi đau" mà dự án giải quyết).
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
    let systemInstruction = 'Bạn là một trợ lý ảo thông minh chuyên biệt về các dự án mã nguồn mở và lập trình trên GitHub. ' +
        'Nhiệm vụ của bạn chỉ được phép tìm kiếm và trả lời các câu hỏi liên quan đến các dự án, mã nguồn, thư viện hoặc lập trình viên trên GitHub. ' +
        'TUYỆT ĐỐI không trả lời và không cung cấp bất kỳ thông tin nào ngoài phạm vi GitHub (ví dụ: không trả lời về thời tiết, đời sống, tin tức xã hội, v.v.). Nếu người dùng hỏi các câu hỏi ngoài phạm vi GitHub, hãy lịch sự từ chối và nhắc họ rằng bạn chỉ hỗ trợ hỏi đáp về các dự án GitHub. ' +
        'Khi sử dụng công cụ tìm kiếm Google, hãy giới hạn phạm vi tìm kiếm chỉ trên github.com hoặc các tài liệu/website chính thức liên quan đến dự án GitHub đó. ' +
        'Tuyệt đối không tự bịa ra (hallucinate) các đường dẫn liên kết URL. Chỉ cung cấp link nếu chúng xuất hiện trực tiếp trong kết quả tìm kiếm đáng tin cậy của Google và bạn chắc chắn nó hoạt động.';
    if (repoName) {
        systemInstruction += ` Câu hỏi này liên quan đến dự án GitHub "${repoName}" nhưng thông tin nằm ngoài tài liệu README của họ. Hãy tìm kiếm thông tin trên internet liên quan đến dự án này để hỗ trợ trả lời.`;
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