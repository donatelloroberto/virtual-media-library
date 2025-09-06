const express = require('express');
const cors = require('cors');
const path = require('path');

<<<<<<< HEAD
// Import the Vercel-compatible scraper
const VercelMediaScraper = require('../enhanced-scraper-vercel');

// Create Express app
const app = express();

// Middleware
=======
// Import the updated enhanced scraper with MongoDB integration
const EnhancedMediaScraper = require('../enhanced-media-scraper');

const app = express();
const PORT = process.env.PORT || 3000;

>>>>>>> master
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
<<<<<<< HEAD
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
=======

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
>>>>>>> master
    timestamp: new Date().toISOString(),
    environment: 'vercel'
  });
});

<<<<<<< HEAD
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
=======
// Get All Studios
app.get('/api/studios', async (req, res) => {
  try {
    if (!scraper) throw new Error('Scraper not initialized');
    const studios = await scraper.getStudios();
    res.json(studios);
  } catch (err) {
    console.error('Error fetching studios:', err);
>>>>>>> master
    res.status(500).json({ error: 'Failed to fetch studios' });
  }
});

<<<<<<< HEAD
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
=======
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
>>>>>>> master
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

<<<<<<< HEAD
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
=======
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
>>>>>>> master
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

<<<<<<< HEAD
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
=======
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
>>>>>>> master
    } else {
      res.status(500).json({ error: 'Failed to scrape studios' });
    }
  }
});

<<<<<<< HEAD
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
=======
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
>>>>>>> master
    } else {
      res.status(500).json({ error: 'Failed to scrape videos' });
    }
  }
});

<<<<<<< HEAD
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
=======
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
>>>>>>> master
    } else {
      res.status(500).json({ error: 'Failed to update streaming URLs' });
    }
  }
});

<<<<<<< HEAD
// Handle all other routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Export for Vercel
=======
// Default catch-all route
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});

>>>>>>> master
module.exports = app;
