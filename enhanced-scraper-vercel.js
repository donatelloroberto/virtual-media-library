const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

class VercelMediaScraper {

  constructor() {
    this.baseUrl = 'https://gay.xtapes.in';
    this.shouldStop = false;
    this.studios = []; // Each item is a category from URLs.txt
    this.videos = [];

    // Load URLs.txt as studios/categories
    this.loadStudiosFromFile(path.join(__dirname, 'URLs.txt'));
  }

  loadStudiosFromFile(filepath) {
    try {
      const lines = fs.readFileSync(filepath, 'utf8')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);
      this.studios = lines.map((url, idx) => ({
        id: idx + 1,
        name: this.extractCategoryName(url) || `Category ${idx + 1}`,
        url: url,
        video_count: 0
      }));
    } catch (error) {
      console.error("❌ Error loading category URLs:", error);
      this.studios = [];
    }
  }

  extractCategoryName(url) {
    // Try to derive logical name from URL, fallback to last segment
    const match = url.match(/category\/([^\/]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1])
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase()); // Capitalize words
    }
    return url.split('/').filter(Boolean).pop();
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchPage(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
      if (this.shouldStop) throw new Error('Graceful quit requested');
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
        const backoffTime = 2000 * Math.pow(2, i);
        console.error(`❌ Error fetching ${url} (attempt ${i + 1}/${retries}):`, error.message);
        if (i === retries - 1) throw error;
        console.log(`⏳ Retrying in ${backoffTime/1000}s...`);
        await this.delay(backoffTime);
      }
    }
  }

  async scrapeVideosFromStudio(studioUrl, studioId, maxPages = 9999) {
    let allVideos = [];
    let currentPage = 1;
    let hasNextPage = true;
    while (hasNextPage && currentPage <= maxPages && !this.shouldStop) {
      try {
        const pageUrl = currentPage === 1 ? studioUrl : `${studioUrl}page/${currentPage}/`;
        console.log(`📄 Scraping page ${currentPage} for studio/category id=${studioId}`);
        const html = await this.fetchPage(pageUrl);
        const $ = cheerio.load(html);
        const videos = [];
        $('ul.listing-videos li').each((index, element) => {
          if (this.shouldStop) return false;
          const $video = $(element);
          const title = $video.find('a span').text().trim();
          const url = $video.find('a').attr('href');
          const posterImg = $video.find('img').attr('src');
          const duration = $video.find('.time-infos').text().trim();
          const views = $video.find('.views-infos').text().trim().replace(/[^0-9]/g, '');
          const rating = $video.find('.rating-infos').text().trim();
          if (title && url) {
            const video = {
              id: this.videos.length + videos.length + 1,
              title: title,
              studio_id: studioId,
              url: url,
              poster_image_url: posterImg,
              duration: duration,
              views: parseInt(views) || 0,
              rating: rating,
              studio_name: this.studios.find(s => s.id === studioId)?.name || 'Unknown',
              created_at: new Date().toISOString()
            };
            videos.push(video);
          }
        });
        console.log(`📹 Found ${videos.length} videos on page ${currentPage}`);
        allVideos = allVideos.concat(videos);
        this.videos = this.videos.concat(videos);
        const nextLink = $('a.next').attr('href');
        hasNextPage = !!nextLink;
        currentPage++;
        if (hasNextPage && !this.shouldStop) {
          await this.delay(2000);
        }
      } catch (error) {
        console.error(`❌ Error scraping page ${currentPage} from ${studioUrl}:`, error);
        break;
      }
    }
    return allVideos;
  }

  async scrapeAllCategories(maxPages = 9999) {
    for (const studio of this.studios) {
      if (this.shouldStop) break;
      await this.scrapeVideosFromStudio(studio.url, studio.id, maxPages);
    }
  }

  async updateVideoDetails() {
    const videosToUpdate = this.videos.filter(v => !v.streaming_url).slice(0, 5); // Limit for Vercel
    for (const video of videosToUpdate) {
      if (this.shouldStop) break;
      try {
        console.log(`📝 Updating video ${video.id}`);
        const details = await this.scrapeVideoDetails(video.url);
        if (details && details.streaming_url) {
          video.streaming_url = details.streaming_url;
          video.final_mp4_url = details.final_mp4_url;
          video.tags = details.tags_string;
          console.log(`✅ Updated video ${video.id}`);
        }
        await this.delay(3000);
      } catch (error) {
        console.error(`❌ Error updating video ${video.id}:`, error);
      }
    }
  }

  async scrapeVideoDetails(videoUrl) {
    try {
      const html = await this.fetchPage(videoUrl);
      const $ = cheerio.load(html);
      const details = {
        title: $('h1[itemprop="name"] span').text().trim() || $('h1').first().text().trim(),
        poster: $('img').first().attr('src') || '',
        duration: $('.time-infos').text().trim(),
        views: $('.views-infos').text().trim().replace(/[^0-9]/g, ''),
        rating: $('.rating').text().trim() || $('.rating-infos').text().trim(),
        tags: []
      };
      $('#cat-tag a').each((index, element) => {
        const tag = $(element).text().trim();
        if (tag) details.tags.push(tag);
      });
      const iframes = $('iframe');
      const streamingUrls = [];
      for (let i = 0; i < iframes.length; i++) {
        if (this.shouldStop) break;
        const src = $(iframes[i]).attr('src');
        if (src && (src.includes('74k.io') || src.includes('88z.io'))) {
          streamingUrls.push(src);
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
      details.streaming_url = streamingUrls.length > 0 ? streamingUrls : null;
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
      const videoSources = [];
      $('video source').each((index, element) => {
        const src = $(element).attr('src');
        if (src && src.includes('.mp4')) {
          videoSources.push(src);
        }
      });
      const scriptTags = $('script');
      scriptTags.each((index, element) => {
        const scriptContent = $(element).html();
        if (scriptContent) {
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
      return videoSources.length > 0 ? videoSources : null;
    } catch (error) {
      console.error(`❌ Error extracting final stream URL:`, error.message);
      return null;
    }
  }

  async getStudios() {
    return this.studios;
  }

  async getVideosByStudio(studioId) {
    return this.videos.filter(v => v.studio_id == studioId);
  }

  async getAllVideos() {
    return this.videos;
  }

  async getVideoById(videoId) {
    return this.videos.find(v => v.id == videoId) || null;
  }

  close() {
    // No DB to close. For Vercel/serverless demo
  }
}

module.exports = VercelMediaScraper;
