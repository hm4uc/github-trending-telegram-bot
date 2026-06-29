import * as cheerio from 'cheerio';

// Hàm phụ: Chui vào link của từng repo để cào text trong file README
async function getReadmeText(repoUrl) {
    try {
        const response = await fetch(repoUrl);
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
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);
        const trendingRepos = [];

        // Lấy top 5 repo (Dùng .toArray() để có thể chạy vòng lặp bất đồng bộ async/await)
        const rows = $('article.Box-row').slice(0, 5).toArray();

        for (let i = 0; i < rows.length; i++) {
            const element = rows[i];
            const titleElement = $(element).find('h2.h3 a');
            const relativeLink = titleElement.attr('href');
            const repoName = titleElement.text().replace(/\s+/g, '').trim();
            const fullLink = `https://github.com${relativeLink}`;

            const description = $(element).find('p.col-9').text().trim();
            const language = $(element).find('span[itemprop="programmingLanguage"]').text().trim();

            console.log(`📥 Đang đọc README của dự án: ${repoName}...`);
            // Chờ gọi hàm phụ để lấy README
            const readme = await getReadmeText(fullLink);

            trendingRepos.push({
                top: i + 1,
                name: repoName,
                language: language || 'Không xác định',
                description: description,
                link: fullLink,
                readme: readme // Gắn thêm ngữ cảnh khổng lồ vào đây!
            });
        }

        console.log('\n✅ HOÀN TẤT!');

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