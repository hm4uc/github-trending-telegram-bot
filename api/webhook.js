import { summarizeWithAI, answerRepoQuestion, answerWithSearch, identifyReferencedRepo } from '../ai.js';
import { getGithubTrending, scrapeGithubRepo } from '../scraper.js';
import { supabase } from '../db.js';

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const body = req.body;
        const BOT_TOKEN = process.env.BOT_TOKEN;

        // Xử lý cả tin nhắn văn bản lẫn sự kiện bấm nút Inline Keyboard (callback_query)
        let message = body.message;

        if (body.callback_query) {
            // Xác nhận ngay với Telegram để tắt biểu tượng quay tròn loading trên nút bấm
            await answerCallbackQuery(body.callback_query.id, BOT_TOKEN);

            message = {
                chat: body.callback_query.message ? body.callback_query.message.chat : { id: body.callback_query.from.id },
                from: body.callback_query.from,
                text: body.callback_query.data
            };
        }

        if (message && message.text) {
            const chatId = message.chat.id;
            const from = message.from || {};
            const username = from.username || '';
            const firstName = from.first_name || '';
            const text = message.text.trim();
            const lowerText = text.toLowerCase();

            let replyText = '';
            let replyMarkup = null;

            try {
                // Hiển thị trạng thái "đang gõ tin nhắn" cho người dùng ngay lập tức
                await sendChatAction(chatId, 'typing', BOT_TOKEN);


                // 0. Rate limiting cơ bản: Giới hạn tối đa 15 tin nhắn/phút cho mỗi user
                const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
                const { count: recentMsgCount } = await supabase
                    .from('chat_history')
                    .select('*', { count: 'exact', head: true })
                    .eq('chat_id', chatId)
                    .eq('role', 'user')
                    .gte('created_at', oneMinuteAgo);

                if (recentMsgCount !== null && recentMsgCount >= 15) {
                    await sendMessage(chatId, '⚠️ *Bạn đang gửi tin nhắn quá nhanh!*\nVui lòng đợi 1 phút trước khi tiếp tục trò chuyện nhé.', BOT_TOKEN);
                    return res.status(200).json({ ok: true });
                }

                // Phát hiện xem tin nhắn có chứa link GitHub repository hay không
                const githubRegex = /https?:\/\/(www\.)?github\.com\/([a-zA-Z0-9-._]+)\/([a-zA-Z0-9-._]+)/i;
                const githubMatch = text.match(githubRegex);
                const reservedKeywords = new Set([
                    'trending', 'features', 'pricing', 'join', 'login', 'signup', 'explore', 
                    'topics', 'marketplace', 'notifications', 'settings', 'messages', 'issues', 
                    'pulls', 'sponsors', 'about', 'contact', 'careers', 'security', 'orgs', 
                    'search', 'collections', 'events', 'site'
                ]);

                // 1. Nhóm lệnh START / HELP
                if (lowerText === '/start' || lowerText === '/help') {
                    // Tự động đăng ký user mới vào danh sách nhận bản tin hàng ngày
                    await supabase.from('subscribers').upsert({
                        chat_id: chatId,
                        username: username,
                        first_name: firstName,
                        is_active: true
                    }, { onConflict: 'chat_id' });

                    const greetingName = firstName ? ` ${firstName}` : '';

                    replyText = `🤖 *Chào mừng${greetingName} đến với GitHub Trending AI Bot!*\n\n` +
                        `✅ _Bạn đã được tự động đăng ký nhận bản tin tổng hợp xu hướng mã nguồn mở mỗi ngày lúc 7h sáng._\n\n` +
                        `📌 *Chọn nhanh tính năng bằng các nút bên dưới hoặc gõ lệnh:*\n` +
                        `• */trending5* hoặc */trending10*: Xem top xu hướng hôm nay.\n` +
                        `• \`/ask <chủ_sở_hữu>/<tên_repo>\`: Kết nối hỏi đáp chuyên sâu theo README.\n` +
                        `• \`/status\`: Kiểm tra dự án đang kết nối hỏi đáp.\n` +
                        `• Gửi link GitHub: Tự động cào dữ liệu, tóm tắt và kích hoạt hỏi đáp.\n` +
                        `• \`/exit\` hoặc \`/clear\`: Thoát chế độ hỏi đáp dự án, về chat tự do.\n` +
                        `• \`/subscribe\` / \`/unsubscribe\`: Bật/tắt nhận bản tin 7h sáng.\n\n` +
                        `👇 _Chạm vào các nút bên dưới để trải nghiệm ngay:_`;

                    // Bàn phím nút bấm trực quan (Inline Keyboard) dưới tin nhắn
                    replyMarkup = {
                        inline_keyboard: [
                            [
                                { text: '🔥 Top 5 Trending', callback_data: '/trending5' },
                                { text: '⭐ Top 10 Trending', callback_data: '/trending10' }
                            ],
                            [
                                { text: '🎯 Trạng thái kết nối', callback_data: '/status' },
                                { text: '❓ Hướng dẫn sử dụng', callback_data: '/help' }
                            ],
                            [
                                { text: '🔔 Nhận tin 7h sáng', callback_data: '/subscribe' },
                                { text: '🔕 Tắt nhận tin', callback_data: '/unsubscribe' }
                            ],
                            [
                                { text: '🚪 Thoát hỏi đáp repo', callback_data: '/clear' }
                            ]
                        ]
                    };
                }

                // 1.1 Lệnh bật/tắt nhận bản tin định kỳ
                else if (lowerText === '/subscribe') {
                    await supabase.from('subscribers').upsert({
                        chat_id: chatId,
                        username: username,
                        first_name: firstName,
                        is_active: true
                    }, { onConflict: 'chat_id' });

                    replyText = `🔔 *Đã bật nhận bản tin thành công!*\n` +
                        `Bạn sẽ nhận được bản tin phân tích top dự án GitHub Trending mỗi ngày vào lúc 7h sáng.`;
                }
                else if (lowerText === '/unsubscribe') {
                    await supabase.from('subscribers').update({ is_active: false }).eq('chat_id', chatId);

                    replyText = `🔕 *Đã tắt nhận bản tin hàng ngày!*\n` +
                        `Bạn sẽ không còn nhận bản tin tự động nữa. Bạn vẫn có thể sử dụng các lệnh khác bình thường, hoặc gõ \`/subscribe\` để bật lại bất cứ lúc nào.`;
                }

                // 1.2 Lệnh kiểm tra trạng thái kết nối repo
                else if (lowerText === '/status') {
                    const { data: session } = await supabase
                        .from('user_sessions')
                        .select('active_repo')
                        .eq('chat_id', chatId)
                        .maybeSingle();

                    if (session && session.active_repo) {
                        replyText = `🎯 Bạn đang kết nối với dự án: *${session.active_repo}*.\n\n` +
                            `Mọi câu hỏi của bạn sẽ được AI giải đáp dựa trên tài liệu README thật của dự án này.\n` +
                            `👉 Gõ \`/exit\` hoặc \`/clear\` để thoát về chế độ trợ lý tự do.`;
                    } else {
                        replyText = `🌐 Bạn hiện đang ở chế độ *Trò chuyện tự do* (chưa kết nối với dự án cụ thể nào).\n\n` +
                            `👉 Để kết nối với một dự án: Gõ \`/ask <chủ_sở_hữu>/<tên_repo>\` hoặc gửi thẳng link GitHub vào đây.`;
                    }
                }

                // 1.5 Tự động phát hiện link GitHub repo
                else if (githubMatch && !reservedKeywords.has(githubMatch[2].toLowerCase())) {
                    const owner = githubMatch[2];
                    const repoPart = githubMatch[3];
                    const cleanRepo = repoPart.split('/')[0].split('#')[0].split('?')[0];
                    const fullRepoName = `${owner}/${cleanRepo}`;
                    const repoUrl = `https://github.com/${fullRepoName}`;

                    replyText = `📥 Phát hiện link GitHub repo: *${fullRepoName}*.\nĐang tiến hành cào dữ liệu và phân tích dự án, vui lòng chờ trong giây lát...`;
                    await sendMessage(chatId, replyText, BOT_TOKEN);

                    try {
                        // Cào dữ liệu từ GitHub
                        const repoData = await scrapeGithubRepo(repoUrl);

                        // Lưu hoặc cập nhật vào Supabase
                        const { error: dbError } = await supabase
                            .from('repositories')
                            .upsert({
                                repo_name: repoData.repo_name,
                                link: repoData.link,
                                description: repoData.description,
                                readme: repoData.readme,
                                language: repoData.language,
                                scraped_at: new Date().toISOString()
                            });

                        if (dbError) {
                            console.error('❌ Lỗi lưu DB:', dbError);
                        }

                        // Tự động thiết lập session hỏi đáp cho user sang repo này
                        await supabase
                            .from('user_sessions')
                            .upsert({ chat_id: chatId, active_repo: repoData.repo_name, last_active: new Date().toISOString() });

                        // Reset lịch sử chat cũ
                        await supabase.from('chat_history').delete().eq('chat_id', chatId);

                        // Gọi AI tóm tắt dự án mới cào về
                        const summary = await summarizeWithAI([{
                            top: 1,
                            name: repoData.repo_name,
                            link: repoData.link,
                            description: repoData.description,
                            readme: repoData.readme,
                            language: repoData.language
                        }]);

                        replyText = `✅ Đã cào và lưu thành công dự án *${repoData.repo_name}* vào hệ thống!\n\n` +
                                    `🎯 _Hệ thống đã tự động chuyển sang chế độ hỏi đáp cho dự án này. Bạn có thể hỏi bất kỳ câu hỏi nào liên quan đến dự án này ngay bây giờ._\n\n` +
                                    `${summary}`;

                    } catch (scrapeErr) {
                        console.error('❌ Lỗi khi cào dữ liệu repo lẻ:', scrapeErr);
                        replyText = `❌ Không thể cào dữ liệu dự án từ link này: ${scrapeErr.message}`;
                    }
                }
                // 2. Lệnh xem trending (hỗ trợ /trending, /trending5, /trending10 hoặc trending 10)
                else if (lowerText.startsWith('trending') || lowerText.startsWith('/trending')) {
                    let limit = 5;
                    const match = lowerText.match(/^\/?trending\s*(\d+)/);
                    if (match && match[1]) {
                        limit = Math.min(Math.max(parseInt(match[1]), 1), 10);
                    }

                    replyText = `⏳ Đang đọc dữ liệu top ${limit} từ database và phân tích, anh đợi xíu nhé...`;
                    await sendMessage(chatId, replyText, BOT_TOKEN);


                    // Lấy các dự án mới nhất từ Database (không đi cào lại trực tiếp để tránh timeout trên Vercel)
                    const { data: reposData } = await supabase
                        .from('repositories')
                        .select('repo_name, link, description, readme, language')
                        .order('scraped_at', { ascending: false })
                        .limit(limit);

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
                            await sendChatAction(chatId, 'typing', BOT_TOKEN);
                            let answer = await answerRepoQuestion(repo.readme, repo.repo_name, text, history || []);

                            // Nếu AI xác định câu hỏi nằm ngoài README, tiến hành tìm kiếm Google
                            if (answer.includes('[OUT_OF_SCOPE]')) {
                                await sendMessage(chatId, `🔍 Câu hỏi nằm ngoài tài liệu README của dự án *${repo.repo_name}*. Đang tìm kiếm thêm thông tin trên internet...`, BOT_TOKEN);
                                await sendChatAction(chatId, 'typing', BOT_TOKEN);

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
                        await sendChatAction(chatId, 'typing', BOT_TOKEN);
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
                await sendMessage(chatId, replyText, BOT_TOKEN, replyMarkup);
            }
        }
    }

    res.status(200).json({ ok: true });
}

// Hàm phụ gửi tin với cơ chế fallback nếu lỗi Markdown và hỗ trợ Inline Keyboard
async function sendMessage(chatId, text, token, replyMarkup = null) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
    };
    if (replyMarkup) {
        payload.reply_markup = replyMarkup;
    }

    try {
        let response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.warn('⚠️ Gửi Markdown thất bại, thử lại dưới dạng văn bản thường...');
            payload.parse_mode = undefined;
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
    } catch (error) {
        console.error('❌ Lỗi kết nối Telegram:', error);
    }
}

// Hàm phản hồi sự kiện click nút bấm (để Telegram tắt icon loading xoay tròn)
async function answerCallbackQuery(callbackQueryId, token) {
    if (!token || !callbackQueryId) return;
    const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackQueryId })
        });
    } catch (e) {
        // Lỗi answerCallbackQuery không ảnh hưởng đến luồng chính
    }
}


// Hàm gửi tín hiệu trạng thái (ví dụ: typing - đang soạn tin)
async function sendChatAction(chatId, action = 'typing', token) {
    if (!token || !chatId) return;
    const url = `https://api.telegram.org/bot${token}/sendChatAction`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action: action })
        });
    } catch (e) {
        // Lỗi gửi typing không ảnh hưởng đến luồng chính
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