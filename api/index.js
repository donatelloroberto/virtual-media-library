const express = require('express');
const cors = require('cors');
const path = require('path');

// Import the Vercel-compatible scraper
const VercelMediaScraper = require('../enhanced-scraper-vercel');

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Initialize scraper (Vercel-compatible version)
let scraper;
try {
  scraper = new VercelMediaScraper();
} catch (error) {
  console.error('Failed to initialize scraper:', error);
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: 'vercel'
  });
});

// Get all studios
app.get('/api/studios', async (req, res) => {
  try {
    if (!scraper) {
      return res.status(500).json({ error: 'Scraper not initialized' });
    }
    const studios = await scraper.getStudios();
    res.json(studios);
  } catch (error) {
    console.error('Error fetching studios:', error);
    res.status(500).json({ error: 'Failed to fetch studios' });
  }
});

// Get videos by studio
app.get('/api/studios/:id/videos', async (req, res) => {
  try {
    if (!scraper) {
      return res.status(500).json({ error: 'Scraper not initialized' });
    }
    const studioId = req.params.id;
    const videos = await scraper.getVideosByStudio(studioId);
    res.json(videos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Get all videos
app.get('/api/videos', async (req, res) => {
  try {
    if (!scraper) {
      return res.status(500).json({ error: 'Scraper not initialized' });
    }
    const videos = await scraper.getAllVideos();
    res.json(videos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Get video by ID
app.get('/api/videos/:id', async (req, res) => {
  try {
    if (!scraper) {
      return res.status(500).json({ error: 'Scraper not initialized' });
    }
    const videoId = req.params.id;
    const video = await scraper.getVideoById(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    res.json(video);
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Get video streaming URL
app.get('/api/stream/:id', async (req, res) => {
  try {
    if (!scraper) {
      return res.status(500).json({ error: 'Scraper not initialized' });
    }
    const videoId = req.params.id;
    const video = await scraper.getVideoById(videoId);
    
    if (!video || !video.streaming_url) {
      return res.status(404).json({ error: 'Video stream not found' });
    }

    res.json({ streaming_url: video.streaming_url });
  } catch (error) {
    console.error('Error getting stream:', error);
    res.status(500).json({ error: 'Failed to get stream' });
  }
});

// Manual scraping endpoints (with timeout protection for Vercel)
app.post('/api/scrape/studios', async (req, res) => {
  try {
    if (!scraper) {
      return res.status(500).json({ error: 'Scraper not initialized' });
    }
    
    console.log('Manual studio scraping triggered');
    
    // Set a timeout to prevent Vercel function timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), 25000); // 25 seconds
    });
    
    const scrapePromise = scraper.scrapeStudios();
    
    const studios = await Promise.race([scrapePromise, timeoutPromise]);
    res.json({ message: `Scraped ${studios.length} studios`, studios });
  } catch (error) {
    console.error('Error scraping studios:', error);
    if (error.message === 'Operation timeout') {
      res.status(202).json({ message: 'Scraping started but may take longer than expected' });
    } else {
      res.status(500).json({ error: 'Failed to scrape studios' });
    }
  }
});

app.post('/api/scrape/videos/:studioId', async (req, res) => {
  try {
    if (!scraper) {
      return res.status(500).json({ error: 'Scraper not initialized' });
    }
    
    const studioId = req.params.studioId;
    const limit = req.body.limit || 10; // Reduced limit for Vercel
    
    const studios = await scraper.getStudios();
    const studio = studios.find(s => s.id == studioId);
    
    if (!studio) {
      return res.status(404).json({ error: 'Studio not found' });
    }

    console.log(`Manual video scraping triggered for studio: ${studio.name}`);
    
    // Set a timeout to prevent Vercel function timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), 25000);
    });
    
    const scrapePromise = scraper.scrapeVideosFromStudio(studio.url, studio.id, 1); // Only 1 page for Vercel
    
    const videos = await Promise.race([scrapePromise, timeoutPromise]);
    res.json({ message: `Scraped ${videos.length} videos`, videos });
  } catch (error) {
    console.error('Error scraping videos:', error);
    if (error.message === 'Operation timeout') {
      res.status(202).json({ message: 'Scraping started but may take longer than expected' });
    } else {
      res.status(500).json({ error: 'Failed to scrape videos' });
    }
  }
});

app.post('/api/scrape/streaming-urls', async (req, res) => {
  try {
    if (!scraper) {
      return res.status(500).json({ error: 'Scraper not initialized' });
    }
    
    console.log('Manual streaming URL extraction triggered');
    
    // Set a timeout to prevent Vercel function timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), 25000);
    });
    
    const updatePromise = scraper.updateVideoDetails();
    
    await Promise.race([updatePromise, timeoutPromise]);
    res.json({ message: 'Streaming URLs updated' });
  } catch (error) {
    console.error('Error updating streaming URLs:', error);
    if (error.message === 'Operation timeout') {
      res.status(202).json({ message: 'Update started but may take longer than expected' });
    } else {
      res.status(500).json({ error: 'Failed to update streaming URLs' });
    }
  }
});

// Handle all other routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Export for Vercel
module.exports = app;
