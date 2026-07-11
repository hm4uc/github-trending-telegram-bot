import * as cheerio from 'cheerio';
import { supabase } from './db.js';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// Hàm phụ: Chui vào link của từng repo để cào text trong file README
async function getReadmeText(repoUrl) {
    try {
        const response = await fetch(repoUrl, { headers: HEADERS });
        const html = await response.text();
        const $ = cheerio.load(html);

        // Cào nội dung trong thẻ article (nơi chứa README)
        let readmeText = $('article.markdown-body').text();

        // Cleanup: Giữ nguyên các dòng mới và định dạng của README, chỉ trim khoảng trắng đầu cuối
        readmeText = readmeText.trim();

        return readmeText;
    } catch (error) {
        console.error(`❌ Không lấy được README của ${repoUrl}`);
        return 'Không có thông tin README.';
    }
}

export async function getGithubTrending() {
    console.log('⏳ Đang tải danh sách GitHub Trending...');
    const url = 'https://github.com/trending';

    try {
        const response = await fetch(url, { headers: HEADERS });
        const html = await response.text();
        const $ = cheerio.load(html);

        // Lấy top 10 repo chạy song song để tăng tốc độ
        const rows = $('article.Box-row').slice(0, 10).toArray();
        const promises = rows.map(async (element, i) => {
            const titleElement = $(element).find('h2.h3 a');
            const relativeLink = titleElement.attr('href');
            const repoName = titleElement.text().replace(/\s+/g, '').trim();
            const fullLink = `https://github.com${relativeLink}`;

            const description = $(element).find('p.col-9').text().trim();
            const language = $(element).find('span[itemprop="programmingLanguage"]').text().trim();

            console.log(`📥 Đang đọc README của dự án: ${repoName}...`);
            const readme = await getReadmeText(fullLink);

            return {
                top: i + 1,
                name: repoName,
                language: language || 'Không xác định',
                description: description,
                link: fullLink,
                readme: readme
            };
        });

        const trendingRepos = await Promise.all(promises);
        
        // Sắp xếp lại theo thứ tự xếp hạng (top) do bất đồng bộ có thể làm lệch thứ tự
        trendingRepos.sort((a, b) => a.top - b.top);

        console.log('\n✅ HOÀN TẤT!');

        if (trendingRepos.length === 0) {
            console.log('⚠️ Không tìm thấy dự án trending nào.');
            return [];
        }

        // Lưu dữ liệu vào Supabase
        console.log('💾 Đang lưu dữ liệu vào Supabase...');
        const upsertData = trendingRepos.map(repo => ({
            repo_name: repo.name,
            link: repo.link,
            description: repo.description,
            readme: repo.readme,
            language: repo.language,
            scraped_at: new Date().toISOString()
        }));

        const { error } = await supabase
            .from('repositories')
            .upsert(upsertData, { onConflict: 'repo_name' });

        if (error) {
            console.error('❌ Lỗi khi lưu vào Supabase:', error.message);
        } else {
            console.log('✅ Đã cập nhật database thành công!');
        }

        // In thử dự án Top 1 ra xem dữ liệu đã "đầy đặn" chưa
        console.log('\n--- THÔNG TIN DỰ ÁN TOP 1 ---');
        console.log(`Tên: ${trendingRepos[0].name}`);
        console.log(`Mô tả ngắn: ${trendingRepos[0].description}`);
        console.log(`\n📄 README:\n${trendingRepos[0].readme}`);

        return trendingRepos;

    } catch (error) {
        console.error('❌ Lỗi khi lấy dữ liệu:', error);
    }
}

// Cào thông tin chi tiết của một repo GitHub lẻ từ URL
export async function scrapeGithubRepo(repoUrl) {
    try {
        const response = await fetch(repoUrl, { headers: HEADERS });
        if (!response.ok) {
            throw new Error(`Không thể truy cập repo: ${response.statusText}`);
        }
        const html = await response.text();
        const $ = cheerio.load(html);

        // 1. Phân tích tên repo từ URL
        const urlObj = new URL(repoUrl);
        const paths = urlObj.pathname.split('/').filter(p => p);
        if (paths.length < 2) {
            throw new Error('Đường dẫn link GitHub không đúng định dạng repo (thiếu owner hoặc name).');
        }
        const repoName = `${paths[0]}/${paths[1]}`;

        // 2. Lấy description từ meta tags hoặc từ sidebar
        let description = $('p.f4.my-3').text().trim();
        if (!description) {
            description = $('meta[name="description"]').attr('content') || 
                          $('meta[property="og:description"]').attr('content') || 
                          '';
        }
        if (description.includes('Contribute to')) {
            description = ''; // Loại bỏ mô tả mặc định của Github
        }

        // 3. Lấy programming language
        const language = $('span.color-fg-default.text-bold.mr-1').first().text().trim() || 
                         $('.BorderGrid-cell a span.color-fg-default').first().text().trim() || 
                         'TypeScript';

        // 4. Lấy README
        let readme = $('article.markdown-body').text().trim();
        if (!readme) {
            readme = 'Không có thông tin README hoặc không thể đọc được nội dung.';
        }

        return {
            repo_name: repoName,
            link: `https://github.com/${repoName}`,
            description: description || 'Không có mô tả.',
            language: language,
            readme: readme
        };
    } catch (error) {
        console.error(`❌ Lỗi khi cào dữ liệu repo lẻ:`, error);
        throw error;
    }
}