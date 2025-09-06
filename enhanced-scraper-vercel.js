const axios = require('axios');
const cheerio = require('cheerio');
const { connectDB } = require('./mongoClient');

class EnhancedMediaScraper {
  constructor() {
    this.baseUrl = 'https://gay.xtapes.in';
    this.shouldStop = false;
  }

  setupGracefulQuit() {
    const readline = require('readline');
    if (process.stdin.isTTY) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
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
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async fetchPage(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
      if (this.shouldStop) throw new Error('Graceful quit requested');
      try {
        console.log(`📥 Fetching: ${url}`);
        const resp = await axios.get(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            Connection: 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          },
          timeout: 15000,
        });
        return resp.data;
      } catch (err) {
        const backoff = 2000 * Math.pow(2, i);
        console.error(`❌ Error fetching ${url} (try ${i + 1}): ${err.message}`);
        if (i === retries - 1) throw err;
        console.log(`⏳ Retrying in ${backoff / 1000}s...`);
        await this.delay(backoff);
      }
    }
  }

  async saveStudio(studio) {
    const db = await connectDB();
    const studios = db.collection('studios');
    await studios.updateOne(
      { url: studio.url },
      { $set: { name: studio.name, url: studio.url, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  async scrapeStudios() {
    try {
      const html = await this.fetchPage(this.baseUrl);
      const $ = cheerio.load(html);
      const studios = [];
      $(".footer-widget .menu a").each((i, el) => {
        const name = $(el).text().trim();
        const url = $(el).attr('href');
        if (name && url && url.includes('/category/')) {
          studios.push({ name, url });
        }
      });
      console.log(`🏢 Found ${studios.length} studios`);
      for (const studio of studios) {
        if (this.shouldStop) break;
        await this.saveStudio(studio);
      }
      return studios;
    } catch (err) {
      console.error('❌ Error scraping studios:', err);
      throw err;
    }
  }

  async saveVideo(video) {
    const db = await connectDB();
    const videos = db.collection('videos');
    await videos.updateOne(
      { url: video.url },
      { $set: { ...video, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  async scrapeStudioIdByUrl(url) {
    const db = await connectDB();
    const studios = db.collection('studios');
    const studio = await studios.findOne({ url });
    return studio ? studio._id : null;
  }

  async scrapeVideosFromStudio(studioUrl, studioId = null) {
    if (!studioId) {
      studioId = await this.scrapeStudioIdByUrl(studioUrl);
      if (!studioId) throw new Error(`Studio not found for URL ${studioUrl}`);
    }
    let allVideos = [];
    let currentPage = 1;
    let hasNextPage = true;
    while (hasNextPage && !this.shouldStop) {
      try {
        const pageUrl = currentPage === 1 ? studioUrl : `${studioUrl}page/${currentPage}/`;
        console.log(`📄 Scraping page ${currentPage} for studio ID: ${studioId}`);
        const html = await this.fetchPage(pageUrl);
        const $ = cheerio.load(html);
        const videos = [];
        $("ul.listing-videos li").each((_, el) => {
          const $el = $(el);
          const title = $el.find("a span").text().trim();
          const url = $el.find("a").attr("href");
          const poster = $el.find("img").attr("src");
          const duration = $el.find(".time-infos").text().trim();
          const viewsRaw = $el.find(".views-infos").text().trim().replace(/\D/g, "");
          const rating = $el.find(".rating-infos").text().trim();
          if (title && url) {
            videos.push({
              title,
              url,
              poster_image_url: poster,
              duration,
              views: parseInt(viewsRaw, 10) || 0,
              rating,
              studio_id: studioId.toString(),
            });
          }
        });
        console.log(`📹 Found ${videos.length} videos on page ${currentPage}`);
        for (const video of videos) {
          if (this.shouldStop) break;
          await this.saveVideo(video);
        }
        allVideos = allVideos.concat(videos);
        const nextLink = $("a.next").attr("href") || $("a.next-page").attr("href");
        hasNextPage = !!nextLink;
        currentPage++;
        if (hasNextPage) await this.delay(2000);
      } catch (err) {
        console.error(`❌ Error scraping videos on page ${currentPage} of ${studioUrl}:`, err);
        break;
      }
    }
    return allVideos;
  }

  async getStudios() {
    const db = await connectDB();
    return db.collection('studios').find({}).toArray();
  }

  async getVideos() {
    const db = await connectDB();
    return db.collection('videos').find({}).toArray();
  }

  async getVideosByStudio(studioId) {
    const db = await connectDB();
    return db.collection('videos').find({ studio_id: studioId }).toArray();
  }

  async getVideoById(videoId) {
    const db = await connectDB();
    const { ObjectId } = require('mongodb');
    if (!ObjectId.isValid(videoId)) return null;
    return db.collection('videos').findOne({ _id: new ObjectId(videoId) });
  }

  async scrapeVideoDetails(videoUrl) {
    try {
      const html = await this.fetchPage(videoUrl);
      const $ = cheerio.load(html);
      const details = {
        title: $('h1[itemprop="name"] span').text().trim() || $('h1').first().text().trim(),
        poster: $('img').first().attr('src') || '',
        duration: $(".time-infos").text().trim(),
        views: parseInt($(".views-infos").text().trim().replace(/\D/g, ""), 10) || 0,
        rating: $(".rating").text().trim() || $(".rating-infos").text().trim(),
        tags: [],
      };
      $("#cat-tag a").each((i, el) => {
        const tag = $(el).text().trim();
        if (tag) details.tags.push(tag);
      });
      details.tags_string = details.tags.join(",");
      const iframes = $("iframe");
      const streamingUrls = [];
      for (let i = 0; i < iframes.length; i++) {
        if (this.shouldStop) break;
        const src = $(iframes[i]).attr("src");
        if (src && (src.includes("74k.io") || src.includes("88z.io"))) {
          streamingUrls.push(src);
          try {
            const finalUrl = await this._extractFinalStreamUrl(src);
            if (finalUrl) {
              details.final_url = finalUrl;
              break;
            }
          } catch (err) {
            console.warn("Streaming URL extraction failed:", err);
          }
        }
      }
      details.streaming_url = streamingUrls.length > 0 ? streamingUrls[0] : null;
      return details;
    } catch (err) {
      console.error(`❌ Failed to scrape video details: ${videoUrl}`, err);
      return null;
    }
  }

  async _extractFinalStreamUrl(iframeUrl) {
    try {
      const html = await this.fetchPage(iframeUrl);
      const $ = cheerio.load(html);
      const videoSources = [];
      $("video source").each((_, el) => {
        const src = $(el).attr("src");
        if (src && src.includes(".mp4")) videoSources.push(src);
      });
      $("script").each((_, el) => {
        const scriptContent = $(el).html();
        if (!scriptContent) return;
        const matches = scriptContent.match(/["']([^"']*\.mp4[^"']*)["']/g);
        if (matches)
          matches.forEach((m) => {
            const url = m.replace(/["']/g, "");
            if (url.startsWith("http")) videoSources.push(url);
          });
      });
      return videoSources.length > 0 ? videoSources[0] : null;
    } catch (err) {
      console.error("❌ Error extracting final video stream URL:", err);
      return null;
    }
  }

  async updateStreamingUrls() {
    const videosToUpdate = this.videos.filter((v) => !v.streaming_url);
    for (const video of videosToUpdate) {
      if (this.shouldStop) break;
      try {
        const details = await this.scrapeVideoDetails(video.url);
        if (details && details.streaming_url) {
          video.streaming_url = details.streaming_url;
          video.final_url = details.final_url;
          video.tags = details.tags_string;
          await this.saveVideo(video);
          console.log(`✅ Updated streaming URL for video: ${video.title}`);
        }
        await this.delay(3000);
      } catch (err) {
        console.warn(`Failed to update streaming URL for video ${video.title}:`, err);
      }
    }
  }

  async close() {
    const db = await connectDB();
    db.client.close();
  }
}

module.exports = EnhancedMediaScraper;
