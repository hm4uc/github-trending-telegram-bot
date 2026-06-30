import { summarizeWithAI, answerRepoQuestion, answerWithSearch, identifyReferencedRepo } from '../ai.js';
import { getGithubTrending } from '../scraper.js';
import { supabase } from '../db.js';

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const body = req.body;

        if (body.message && body.message.text) {
            const chatId = body.message.chat.id;
            const text = body.message.text.trim();
            const lowerText = text.toLowerCase();
            const BOT_TOKEN = process.env.BOT_TOKEN;

            let replyText = '';

            try {
                // 1. Nhóm lệnh START / HELP
                if (lowerText === '/start' || lowerText === '/help') {
                    replyText = `🤖 *Chào mừng bạn đến với GitHub Trending AI Bot!*\n\n` +
                        `Các lệnh bạn có thể sử dụng:\n` +
                        `1️⃣ Gõ *trending* hoặc */trending* để xem danh sách xu hướng hôm nay.\n` +
                        `2️⃣ Gõ \`/ask <chủ_sở_hữu>/<tên_repo>\` để chọn dự án cần hỏi đáp.\n` +
                        `   _Ví dụ: /ask commaai/openpilot_\n` +
                        `3️⃣ Gõ \`/exit\` hoặc \`/clear\` để thoát chế độ hỏi đáp dự án, chuyển về trò chuyện chung.\n` +
                        `4️⃣ Khi đã chọn dự án, bạn cứ hỏi thoải mái. Tôi sẽ tự tra cứu README của dự án trước, nếu không có mới tìm kiếm Google.`;
                }
                // 2. Lệnh xem trending
                else if (lowerText === 'trending' || lowerText === '/trending') {
                    replyText = '⏳ Đang đọc dữ liệu từ database và phân tích, anh đợi xíu nhé...';
                    await sendMessage(chatId, replyText, BOT_TOKEN);

                    // Lấy 5 dự án mới nhất từ Database (không đi cào lại trực tiếp để tránh timeout trên Vercel)
                    const { data: reposData } = await supabase
                        .from('repositories')
                        .select('repo_name, link, description, readme, language')
                        .order('scraped_at', { ascending: false })
                        .limit(5);

                    if (reposData && reposData.length > 0) {
                        const formattedRepos = reposData.map((repo, i) => ({
                            top: i + 1,
                            name: repo.repo_name,
                            link: repo.link,
                            description: repo.description,
                            readme: repo.readme,
                            language: repo.language
                        }));
                        replyText = await summarizeWithAI(formattedRepos);
                    } else {
                        replyText = '⚠️ Hiện tại database đang trống. Hãy đợi Vercel Cron chạy cào dữ liệu hoặc chạy cục bộ bằng `main.js` để cập nhật dữ liệu.';
                    }
                }
                // 3. Lệnh chọn dự án để hỏi đáp
                else if (lowerText.startsWith('/ask')) {
                    const parts = text.split(/\s+/);
                    const repoName = parts[1] ? parts[1].trim() : null;

                    if (!repoName) {
                        const { data: session } = await supabase
                            .from('user_sessions')
                            .select('active_repo')
                            .eq('chat_id', chatId)
                            .maybeSingle();

                        if (session && session.active_repo) {
                            replyText = `🎯 Bạn đang chọn hỏi đáp về dự án: *${session.active_repo}*.\n` +
                                `Hãy nhập câu hỏi của bạn. Gõ \`/exit\` để quay về chế độ bình thường.`;
                        } else {
                            replyText = `💡 Vui lòng nhập đúng cú pháp để chọn dự án: \`/ask <chủ_sở_hữu>/<tên_repo>\`.\n` +
                                `Ví dụ: \`/ask cupy/cupy\``;
                        }
                    } else {
                        // Kiểm tra xem repo có tồn tại trong database chưa
                        const { data: repo, error } = await supabase
                            .from('repositories')
                            .select('repo_name')
                            .ilike('repo_name', repoName)
                            .maybeSingle();

                        if (repo) {
                            // Lưu session của user
                            await supabase
                                .from('user_sessions')
                                .upsert({ chat_id: chatId, active_repo: repo.repo_name, last_active: new Date().toISOString() });

                            // Reset lịch sử chat khi đổi dự án để tránh xung đột ngữ cảnh
                            await supabase.from('chat_history').delete().eq('chat_id', chatId);

                            replyText = `✅ Đã kết nối với dự án *${repo.repo_name}*!\n` +
                                `Bây giờ, mọi câu hỏi của bạn sẽ được giải đáp dựa trên dữ liệu README thật của dự án này. Gõ \`/exit\` để thoát.`;
                        } else {
                            replyText = `❌ Không tìm thấy dự án *${repoName}* trong database.\n` +
                                `Vui lòng gõ chính xác tên repo trên GitHub (ví dụ: \`commaai/openpilot\`) hoặc chạy /trending để cập nhật dữ liệu mới nhất.`;
                        }
                    }
                }
                // 4. Lệnh thoát hỏi đáp
                else if (lowerText === '/exit' || lowerText === '/clear') {
                    await supabase.from('user_sessions').delete().eq('chat_id', chatId);
                    await supabase.from('chat_history').delete().eq('chat_id', chatId);
                    replyText = `🚪 Đã thoát khỏi chế độ hỏi đáp dự án. Chuyển về chế độ hỏi đáp tự do với Trợ lý AI.`;
                }
                // 5. Hội thoại thông thường
                else {
                    // Kiểm tra session hiện tại của người dùng
                    let { data: session } = await supabase
                        .from('user_sessions')
                        .select('active_repo')
                        .eq('chat_id', chatId)
                        .maybeSingle();

                    // Nếu chưa chọn repo, thử phân tích ngôn ngữ tự nhiên để nhận diện repo được nhắc tới
                    if (!session || !session.active_repo) {
                        const { data: repos } = await supabase
                            .from('repositories')
                            .select('repo_name, description');

                        if (repos && repos.length > 0) {
                            // 1. Thử match nhanh bằng từ khóa cục bộ để tiết kiệm API Quota
                            let matchedRepoName = quickMatchRepo(text, repos);

                            // 2. Nếu không match cục bộ, mới dùng Gemini AI để nhận diện
                            if (!matchedRepoName) {
                                matchedRepoName = await identifyReferencedRepo(text, repos);
                            }

                            if (matchedRepoName) {
                                const exists = repos.some(r => r.repo_name === matchedRepoName);
                                if (exists) {
                                    // Tự động kích hoạt session
                                    await supabase
                                        .from('user_sessions')
                                        .upsert({ chat_id: chatId, active_repo: matchedRepoName, last_active: new Date().toISOString() });

                                    await sendMessage(chatId, `🎯 _Tự động kết nối hỏi đáp về dự án *${matchedRepoName}* dựa trên câu hỏi của bạn._`, BOT_TOKEN);

                                    session = { active_repo: matchedRepoName };
                                    // Xóa lịch sử cũ khi tự động chuyển dự án để tránh loạn ngữ cảnh
                                    await supabase.from('chat_history').delete().eq('chat_id', chatId);
                                }
                            }
                        }
                    }

                    // Lấy lịch sử chat (tối đa 8 câu gần nhất để tiết kiệm token và giữ context)
                    const { data: history } = await supabase
                        .from('chat_history')
                        .select('role, content')
                        .eq('chat_id', chatId)
                        .order('created_at', { ascending: true })
                        .limit(8);

                    if (session && session.active_repo) {
                        // Lấy dữ liệu README thật từ database
                        const { data: repo } = await supabase
                            .from('repositories')
                            .select('repo_name, readme')
                            .eq('repo_name', session.active_repo)
                            .maybeSingle();

                        if (repo) {
                            let answer = await answerRepoQuestion(repo.readme, repo.repo_name, text, history || []);

                            // Nếu AI xác định câu hỏi nằm ngoài README, tiến hành tìm kiếm Google
                            if (answer.includes('[OUT_OF_SCOPE]')) {
                                await sendMessage(chatId, `🔍 Câu hỏi nằm ngoài tài liệu README của dự án *${repo.repo_name}*. Đang tìm kiếm thêm thông tin trên internet...`, BOT_TOKEN);

                                const searchAnswer = await answerWithSearch(text, repo.repo_name, history || []);
                                replyText = `🌐 *[Kết quả tìm kiếm internet về ${repo.repo_name}]*:\n\n${searchAnswer}`;
                            } else {
                                replyText = answer;
                            }
                        } else {
                            replyText = `⚠️ Không tìm thấy dữ liệu của dự án *${session.active_repo}*. Bạn vui lòng chọn dự án khác hoặc cập nhật lại.`;
                        }
                    } else {
                        // Hỏi đáp tự do ngoài dự án
                        const searchAnswer = await answerWithSearch(text, null, history || []);
                        replyText = `🌐 *[Trợ lý AI]*:\n\n${searchAnswer}`;
                    }

                    // Lưu lịch sử chat
                    await supabase.from('chat_history').insert([
                        { chat_id: chatId, role: 'user', content: text },
                        { chat_id: chatId, role: 'model', content: replyText }
                    ]);
                }
            } catch (err) {
                console.error('❌ Lỗi xử lý tin nhắn:', err);
                replyText = `❌ Đã xảy ra lỗi hệ thống: ${err.message}. Vui lòng thử lại sau!`;
            }

            // Gửi kết quả cuối cùng cho người dùng
            if (replyText) {
                await sendMessage(chatId, replyText, BOT_TOKEN);
            }
        }
    }

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

// Hàm so khớp nhanh tên dự án bằng từ khóa cục bộ (0ms, tiết kiệm API Quota)
function quickMatchRepo(text, repos) {
    const lowerText = text.toLowerCase();
    for (const repo of repos) {
        const repoName = repo.repo_name.toLowerCase();
        const parts = repoName.split('/');
        const name = parts[1];
        // Match tên đầy đủ hoặc tên phần đuôi của repo (ví dụ: "openpilot", "maigret")
        if (lowerText.includes(name) || lowerText.includes(name.replace(/-/g, '')) || lowerText.includes(name.replace(/_/g, ''))) {
            return repo.repo_name;
        }
    }
    return null;
}