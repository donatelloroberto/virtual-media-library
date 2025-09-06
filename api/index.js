const express = require('express');
const cors = require('cors');
const path = require('path');

// Import the updated enhanced scraper with MongoDB integration
const EnhancedMediaScraper = require('../enhanced-media-scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Initialize scraper instance
let scraper;
(async () => {
  try {
    scraper = new EnhancedMediaScraper();
    scraper.setupGracefulQuit();
  } catch (err) {
    console.error('Failed to initialize scraper:', err);
  }
})();

// Health Check Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: 'vercel'
  });
});

// Get All Studios
app.get('/api/studios', async (req, res) => {
  try {
    if (!scraper) throw new Error('Scraper not initialized');
    const studios = await scraper.getStudios();
    res.json(studios);
  } catch (err) {
    console.error('Error fetching studios:', err);
    res.status(500).json({ error: 'Failed to fetch studios' });
  }
});

// Get Videos by Studio
app.get('/api/studios/:id/videos', async (req, res) => {
  try {
    if (!scraper) throw new Error('Scraper not initialized');
    const studioId = req.params.id;
    const videos = await scraper.getVideosByStudio(studioId);
    res.json(videos);
  } catch (err) {
    console.error('Error fetching studio videos:', err);
    res.status(500).json({ error: 'Failed to fetch videos for studio' });
  }
});

// Get All Videos
app.get('/api/videos', async (req, res) => {
  try {
    if (!scraper) throw new Error('Scraper not initialized');
    const videos = await scraper.getVideos();
    res.json(videos);
  } catch (err) {
    console.error('Error fetching videos:', err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Get Video by ID
app.get('/api/videos/:id', async (req, res) => {
  try {
    if (!scraper) throw new Error('Scraper not initialized');
    const videoId = req.params.id;
    const video = await scraper.getVideoById(videoId);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json(video);
  } catch (err) {
    console.error('Error fetching video:', err);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Proxy Video Streaming URL
app.get('/api/stream/:id', async (req, res) => {
  try {
    if (!scraper) throw new Error('Scraper not initialized');
    const videoId = req.params.id;
    const video = await scraper.getVideoById(videoId);
    if (!video || !video.streaming_url) return res.status(404).json({ error: 'Streaming URL not found' });
    res.json({ streaming_url: video.streaming_url });
  } catch (err) {
    console.error('Error retrieving streaming URL:', err);
    res.status(500).json({ error: 'Failed to retrieve streaming URL' });
  }
});

// Trigger Studio Scraping
app.post('/api/scrape/studios', async (req, res) => {
  try {
    if (!scraper) throw new Error('Scraper not initialized');
    console.log('Scraping studios...');
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), 25000));
    const scrape = scraper.scrapeStudios();
    const studios = await Promise.race([scrape, timeout]);
    res.json({ message: `Scraped ${studios.length} studios`, studios });
  } catch (err) {
    console.error('Error scraping studios:', err);
    if (err.message === 'Operation timeout') {
      res.status(202).json({ message: 'Scraping started and may take more time' });
    } else {
      res.status(500).json({ error: 'Failed to scrape studios' });
    }
  }
});

// Trigger Video Scraping by Studio ID
app.post('/api/scrape/videos/:id', async (req, res) => {
  try {
    if (!scraper) throw new Error('Scraper not initialized');
    const studioId = req.params.id;
    const limit = parseInt(req.body.limit) || 10; // limit controlled; can be modified
    const studios = await scraper.getStudios();
    const studio = studios.find((s) => s._id.toString() === studioId || s._id == studioId);
    if (!studio) return res.status(404).json({ error: 'Studio not found' });
    console.log(`Scraping videos for studio ${studio.name}`);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), 25000));
    const scrape = scraper.scrapeVideosFromStudio(studio.url, studio._id, limit);
    const videos = await Promise.race([scrape, timeout]);
    res.json({ message: `Scraped ${videos.length} videos`, videos });
  } catch (err) {
    console.error('Error scraping videos:', err);
    if (err.message === 'Operation timeout') {
      res.status(202).json({ message: 'Scraping started and may take more time' });
    } else {
      res.status(500).json({ error: 'Failed to scrape videos' });
    }
  }
});

// Trigger Streaming URLs Update
app.post('/api/scrape/streaming-urls', async (req, res) => {
  try {
    if (!scraper) throw new Error('Scraper not initialized');
    console.log('Updating streaming URLs...');
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), 25000));
    const update = scraper.updateStreamingUrls();
    await Promise.race([update, timeout]);
    res.json({ message: 'Streaming URLs updated' });
  } catch (err) {
    console.error('Error updating streaming URLs:', err);
    if (err.message === 'Operation timeout') {
      res.status(202).json({ message: 'Update started and may take more time' });
    } else {
      res.status(500).json({ error: 'Failed to update streaming URLs' });
    }
  }
});

// Default catch-all route
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});

module.exports = app;
