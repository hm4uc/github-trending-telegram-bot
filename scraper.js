import * as cheerio from 'cheerio';

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

        // Lấy top 5 repo chạy song song để tăng tốc độ
        const rows = $('article.Box-row').slice(0, 5).toArray();
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