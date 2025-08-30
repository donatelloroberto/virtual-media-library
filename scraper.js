const axios = require('axios');
const cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class MediaScraper {
    constructor() {
        this.baseUrl = 'https://gay.xtapes.in';
        this.db = new sqlite3.Database(path.join(__dirname, 'media_library.db'));
        this.initDatabase();
    }

    initDatabase() {
        this.db.serialize(() => {
            // Create studios table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS studios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    url TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create videos table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS videos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    studio_id INTEGER,
                    url TEXT NOT NULL,
                    streaming_url TEXT,
                    poster_image_url TEXT,
                    duration TEXT,
                    views INTEGER DEFAULT 0,
                    rating TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (studio_id) REFERENCES studios (id)
                )
            `);
        });
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchPage(url, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                console.log(`Fetching: ${url}`);
                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    },
                    timeout: 10000
                });
                return response.data;
            } catch (error) {
                console.error(`Error fetching ${url} (attempt ${i + 1}):`, error.message);
                if (i === retries - 1) throw error;
                await this.delay(2000 * (i + 1)); // Exponential backoff
            }
        }
    }

    async scrapeStudios() {
        try {
            const html = await this.fetchPage(this.baseUrl);
            const $ = cheerio.load(html);
            const studios = [];

            // Extract studios from footer menu (based on HTML analysis)
            $('.footer-widget .menu a').each((index, element) => {
                const name = $(element).text().trim();
                const url = $(element).attr('href');
                
                if (name && url && url.includes('/category/')) {
                    studios.push({
                        name: name,
                        url: url
                    });
                }
            });

            console.log(`Found ${studios.length} studios`);
            
            // Save studios to database
            for (const studio of studios) {
                await this.saveStudio(studio);
            }

            return studios;
        } catch (error) {
            console.error('Error scraping studios:', error);
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

    async scrapeVideosFromStudio(studioUrl, studioId, limit = 20) {
        try {
            const html = await this.fetchPage(studioUrl);
            const $ = cheerio.load(html);
            const videos = [];

            // Extract videos from listing (based on HTML analysis)
            $('.listing-videos li').slice(0, limit).each((index, element) => {
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

            console.log(`Found ${videos.length} videos for studio`);
            
            // Save videos to database
            for (const video of videos) {
                await this.saveVideo(video);
            }

            return videos;
        } catch (error) {
            console.error(`Error scraping videos from ${studioUrl}:`, error);
            return [];
        }
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

    async extractStreamingUrl(videoUrl) {
        try {
            const html = await this.fetchPage(videoUrl);
            const $ = cheerio.load(html);
            
            // Look for iframe sources (based on HTML analysis)
            const iframes = $('iframe');
            const streamingUrls = [];
            
            iframes.each((index, element) => {
                const src = $(element).attr('src');
                if (src && (src.includes('74k.io') || src.includes('88z.io'))) {
                    streamingUrls.push(src);
                }
            });

            return streamingUrls.length > 0 ? streamingUrls[0] : null;
        } catch (error) {
            console.error(`Error extracting streaming URL from ${videoUrl}:`, error);
            return null;
        }
    }

    async updateVideoStreamingUrls() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT id, url FROM videos WHERE streaming_url IS NULL LIMIT 10',
                async (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    for (const row of rows) {
                        try {
                            const streamingUrl = await this.extractStreamingUrl(row.url);
                            if (streamingUrl) {
                                await this.updateVideoStreamingUrl(row.id, streamingUrl);
                                console.log(`Updated streaming URL for video ${row.id}`);
                            }
                            await this.delay(1000); // Rate limiting
                        } catch (error) {
                            console.error(`Error updating video ${row.id}:`, error);
                        }
                    }
                    resolve();
                }
            );
        });
    }

    async updateVideoStreamingUrl(videoId, streamingUrl) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE videos SET streaming_url = ? WHERE id = ?',
                [streamingUrl, videoId],
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

    close() {
        this.db.close();
    }
}

module.exports = MediaScraper;
