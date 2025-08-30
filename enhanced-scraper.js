const axios = require('axios');
const cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const readline = require('readline');

class EnhancedMediaScraper {
    constructor() {
        this.baseUrl = 'https://gay.xtapes.in';
        this.db = new sqlite3.Database(path.join(__dirname, 'media_library.db'));
        this.shouldStop = false;
        this.initDatabase();
        this.setupGracefulQuit();
    }

    initDatabase() {
        this.db.serialize(() => {
            // Create studios table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS studios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    url TEXT NOT NULL,
                    video_count INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create videos table with additional fields
            this.db.run(`
                CREATE TABLE IF NOT EXISTS videos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    studio_id INTEGER,
                    url TEXT UNIQUE NOT NULL,
                    streaming_url TEXT,
                    final_mp4_url TEXT,
                    poster_image_url TEXT,
                    duration TEXT,
                    views INTEGER DEFAULT 0,
                    rating TEXT,
                    tags TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (studio_id) REFERENCES studios (id)
                )
            `);
        });
    }

    setupGracefulQuit() {
        // Only setup readline if stdin is available (not in background mode)
        if (process.stdin.isTTY) {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.on('line', (input) => {
                if (input.toLowerCase().trim() === 'q') {
                    console.log('\n🛑 Graceful quit requested. Finishing current operations...');
                    this.shouldStop = true;
                }
            });

            console.log('💡 Press "q" + Enter at any time to gracefully quit and save progress');
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchPage(url, retries = 3) {
        for (let i = 0; i < retries; i++) {
            if (this.shouldStop) {
                throw new Error('Graceful quit requested');
            }

            try {
                console.log(`📥 Fetching: ${url}`);
                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1'
                    },
                    timeout: 15000
                });
                return response.data;
            } catch (error) {
                const backoffTime = 2000 * Math.pow(2, i); // Exponential backoff
                console.error(`❌ Error fetching ${url} (attempt ${i + 1}/${retries}):`, error.message);
                if (i === retries - 1) throw error;
                console.log(`⏳ Retrying in ${backoffTime/1000}s...`);
                await this.delay(backoffTime);
            }
        }
    }

    async scrapeStudios() {
        try {
            const html = await this.fetchPage(this.baseUrl);
            const $ = cheerio.load(html);
            const studios = [];

            // Extract studios from footer menu (based on HTML analysis)
            $(".footer-widget .menu a").each((index, element) => {
                const name = $(element).text().trim();
                const url = $(element).attr('href');
                
                if (name && url && url.includes('/category/')) {
                    studios.push({
                        name: name,
                        url: url
                    });
                }
            });

            console.log(`🏢 Found ${studios.length} studios`);
            
            // Save studios to database
            for (const studio of studios) {
                if (this.shouldStop) break;
                await this.saveStudio(studio);
            }

            return studios;
        } catch (error) {
            console.error('❌ Error scraping studios:', error);
            throw error;
        }
    }

    async saveStudio(studio) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR IGNORE INTO studios (name, url) VALUES (?, ?)',
                [studio.name, studio.url],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    async scrapeVideosFromStudio(studioUrl, studioId, maxPages = 5) {
        let allVideos = [];
        let currentPage = 1;
        let hasNextPage = true;

        while (hasNextPage && currentPage <= maxPages && !this.shouldStop) {
            try {
                const pageUrl = currentPage === 1 ? studioUrl : `${studioUrl}page/${currentPage}/`;
                console.log(`📄 Scraping page ${currentPage} for studio`);
                
                const html = await this.fetchPage(pageUrl);
                const $ = cheerio.load(html);
                const videos = [];

                // ✅ Collect video links from ul.listing-videos
                $("ul.videos-listing li").each((index, element) => {
                    if (this.shouldStop) return false;

                    const $video = $(element);
                    const title = $video.find('a span').text().trim();
                    const url = $video.find('a').attr('href');
                    const posterImg = $video.find('img').attr('src');
                    const duration = $video.find('.time-infos').text().trim();
                    const views = $video.find('.views-infos').text().trim().replace(/[^0-9]/g, '');
                    const rating = $video.find('.rating-infos').text().trim();

                    if (title && url) {
                        videos.push({
                            title: title,
                            studio_id: studioId,
                            url: url,
                            poster_image_url: posterImg,
                            duration: duration,
                            views: parseInt(views) || 0,
                            rating: rating
                        });
                    }
                });

                console.log(`📹 Found ${videos.length} videos on page ${currentPage}`);
                allVideos = allVideos.concat(videos);

                // Save videos to database
                for (const video of videos) {
                    if (this.shouldStop) break;
                    await this.saveVideo(video);
                }

                const nextLink = $("a.next-page").attr("href");
                hasNextPage = !!nextLink;
                currentPage++;

                if (hasNextPage && !this.shouldStop) {
                    await this.delay(2000); // Rate limiting between pages
                }

            } catch (error) {
                console.error(`❌ Error scraping page ${currentPage} from ${studioUrl}:`, error);
                break;
            }
        }

        // Update studio video count
        await this.updateStudioVideoCount(studioId, allVideos.length);
        
        return allVideos;
    }

    async updateStudioVideoCount(studioId, count) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE studios SET video_count = video_count + ? WHERE id = ?',
                [count, studioId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async saveVideo(video) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR IGNORE INTO videos 
                 (title, studio_id, url, poster_image_url, duration, views, rating) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [video.title, video.studio_id, video.url, video.poster_image_url, 
                 video.duration, video.views, video.rating],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    async scrapeVideoDetails(videoUrl) {
        try {
            const html = await this.fetchPage(videoUrl);
            const $ = cheerio.load(html);
            
            // ✅ Correct detail-page selectors
            const details = {
                title: $('h1[itemprop="name"] span').text().trim() || $('h1').first().text().trim(),
                poster: $('img').first().attr('src') || '',
                duration: $('.time-infos').text().trim(),
                views: $('.views-infos').text().trim().replace(/[^0-9]/g, ''),
                rating: $('.rating').text().trim() || $('.rating-infos').text().trim(),
                tags: []
            };

            // Extract tags from categories and tags section
            $('#cat-tag a').each((index, element) => {
                const tag = $(element).text().trim();
                if (tag) {
                    details.tags.push(tag);
                }
            });

            // ✅ Extract iframe sources and follow to get final .mp4 URL
            const iframes = $('iframe');
            const streamingUrls = [];
            
            for (let i = 0; i < iframes.length; i++) {
                if (this.shouldStop) break;
                
                const src = $(iframes[i]).attr('src');
                if (src && (src.includes('74k.io') || src.includes('88z.io'))) {
                    streamingUrls.push(src);
                    
                    // ✅ Follow iframe to extract final .mp4 stream URL
                    try {
                        const finalUrl = await this.extractFinalStreamUrl(src);
                        if (finalUrl) {
                            details.final_mp4_url = finalUrl;
                            break;
                        }
                    } catch (error) {
                        console.error(`❌ Error extracting final stream URL from ${src}:`, error.message);
                    }
                }
            }

            details.streaming_url = streamingUrls.length > 0 ? streamingUrls[0] : null;
            details.tags_string = details.tags.join(', ');

            return details;
        } catch (error) {
            console.error(`❌ Error scraping video details from ${videoUrl}:`, error);
            return null;
        }
    }

    async extractFinalStreamUrl(iframeUrl) {
        try {
            console.log(`🔗 Following iframe: ${iframeUrl}`);
            const html = await this.fetchPage(iframeUrl);
            const $ = cheerio.load(html);
            
            // Look for video sources in various formats
            const videoSources = [];
            
            // Check for direct video tags
            $('video source').each((index, element) => {
                const src = $(element).attr('src');
                if (src && src.includes('.mp4')) {
                    videoSources.push(src);
                }
            });

            // Check for JavaScript variables containing video URLs
            const scriptTags = $('script');
            scriptTags.each((index, element) => {
                const scriptContent = $(element).html();
                if (scriptContent) {
                    // Look for common video URL patterns
                    const mp4Matches = scriptContent.match(/["']([^"']*\.mp4[^"']*)["']/g);
                    if (mp4Matches) {
                        mp4Matches.forEach(match => {
                            const url = match.replace(/["']/g, '');
                            if (url.startsWith('http')) {
                                videoSources.push(url);
                            }
                        });
                    }
                }
            });

            // Return the first valid MP4 URL found
            return videoSources.length > 0 ? videoSources[0] : null;
        } catch (error) {
            console.error(`❌ Error extracting final stream URL:`, error.message);
            return null;
        }
    }

    async updateVideoDetails() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT id, url FROM videos WHERE tags IS NULL OR final_mp4_url IS NULL LIMIT 10',
                async (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    console.log(`🔄 Updating details for ${rows.length} videos`);

                    for (const row of rows) {
                        if (this.shouldStop) break;

                        try {
                            console.log(`📝 Updating video ${row.id}`);
                            const details = await this.scrapeVideoDetails(row.url);
                            
                            if (details) {
                                await this.updateVideoDetailsInDb(row.id, details);
                                console.log(`✅ Updated video ${row.id}`);
                            }
                            
                            await this.delay(3000); // Rate limiting
                        } catch (error) {
                            console.error(`❌ Error updating video ${row.id}:`, error);
                        }
                    }
                    resolve();
                }
            );
        });
    }

    async updateVideoDetailsInDb(videoId, details) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE videos SET 
                 streaming_url = COALESCE(?, streaming_url),
                 final_mp4_url = COALESCE(?, final_mp4_url),
                 tags = COALESCE(?, tags),
                 poster_image_url = COALESCE(?, poster_image_url),
                 duration = COALESCE(?, duration),
                 views = COALESCE(?, views),
                 rating = COALESCE(?, rating)
                 WHERE id = ?`,
                [
                    details.streaming_url,
                    details.final_mp4_url,
                    details.tags_string,
                    details.poster,
                    details.duration,
                    parseInt(details.views) || 0,
                    details.rating,
                    videoId
                ],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async getStudios() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM studios ORDER BY name', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getVideosByStudio(studioId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM videos WHERE studio_id = ? ORDER BY created_at DESC',
                [studioId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    async getAllVideos() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT v.*, s.name as studio_name 
                 FROM videos v 
                 LEFT JOIN studios s ON v.studio_id = s.id 
                 ORDER BY v.created_at DESC`,
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    async getVideoById(videoId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT v.*, s.name as studio_name 
                 FROM videos v 
                 LEFT JOIN studios s ON v.studio_id = s.id 
                 WHERE v.id = ?`,
                [videoId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    async runFullScrape(maxStudios = 5, maxPagesPerStudio = 3) {
        try {
            console.log('🚀 Starting full scrape...');
            
            // Scrape studios
            if (!this.shouldStop) {
                console.log('\n📋 Step 1: Scraping studios...');
                await this.scrapeStudios();
            }

            // Get studios and scrape videos
            if (!this.shouldStop) {
                console.log('\n📹 Step 2: Scraping videos...');
                const studios = await this.getStudios();
                const selectedStudios = studios.slice(0, maxStudios);
                
                for (const studio of selectedStudios) {
                    if (this.shouldStop) break;
                    
                    console.log(`\n🏢 Scraping videos from: ${studio.name}`);
                    await this.scrapeVideosFromStudio(studio.url, studio.id, maxPagesPerStudio);
                    await this.delay(5000); // Rate limiting between studios
                }
            }

            // Update video details
            if (!this.shouldStop) {
                console.log('\n🔄 Step 3: Updating video details...');
                await this.updateVideoDetails();
            }

            // Final stats
            const studios = await this.getStudios();
            const videos = await this.getAllVideos();
            
            console.log('\n📊 Scraping completed!');
            console.log(`🏢 Total studios: ${studios.length}`);
            console.log(`📹 Total videos: ${videos.length}`);
            console.log(`🎬 Videos with streaming URLs: ${videos.filter(v => v.streaming_url).length}`);
            console.log(`🎥 Videos with final MP4 URLs: ${videos.filter(v => v.final_mp4_url).length}`);

            if (this.shouldStop) {
                console.log('\n⚠️  Scraping was stopped gracefully. Progress has been saved.');
            }

        } catch (error) {
            console.error('❌ Full scrape failed:', error);
            throw error;
        }
    }

    close() {
        this.db.close();
        process.exit(0);
    }
}

module.exports = EnhancedMediaScraper;
