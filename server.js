const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const EnhancedMediaScraper = require('./enhanced-scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize enhanced scraper
const scraper = new EnhancedMediaScraper();

// API Routes

// Get all studios
app.get('/api/studios', async (req, res) => {
    try {
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

// Proxy video streaming
app.get('/api/stream/:id', async (req, res) => {
    try {
        const videoId = req.params.id;
        const video = await scraper.getVideoById(videoId);
        
        if (!video || !video.streaming_url) {
            return res.status(404).json({ error: 'Video stream not found' });
        }

        // Return the streaming URL for the frontend to handle
        res.json({ streaming_url: video.streaming_url });
    } catch (error) {
        console.error('Error getting stream:', error);
        res.status(500).json({ error: 'Failed to get stream' });
    }
});

// Manual scraping trigger
app.post('/api/scrape/studios', async (req, res) => {
    try {
        console.log('Manual studio scraping triggered');
        const studios = await scraper.scrapeStudios();
        res.json({ message: `Scraped ${studios.length} studios`, studios });
    } catch (error) {
        console.error('Error scraping studios:', error);
        res.status(500).json({ error: 'Failed to scrape studios' });
    }
});

app.post('/api/scrape/videos/:studioId', async (req, res) => {
    try {
        const studioId = req.params.studioId;
        const limit = req.body.limit || 20;
        
        const studios = await scraper.getStudios();
        const studio = studios.find(s => s.id == studioId);
        
        if (!studio) {
            return res.status(404).json({ error: 'Studio not found' });
        }

        console.log(`Manual video scraping triggered for studio: ${studio.name}`);
        const videos = await scraper.scrapeVideosFromStudio(studio.url, studio.id, limit);
        res.json({ message: `Scraped ${videos.length} videos`, videos });
    } catch (error) {
        console.error('Error scraping videos:', error);
        res.status(500).json({ error: 'Failed to scrape videos' });
    }
});

app.post('/api/scrape/streaming-urls', async (req, res) => {
    try {
        console.log('Manual streaming URL extraction triggered');
        await scraper.updateVideoStreamingUrls();
        res.json({ message: 'Streaming URLs updated' });
    } catch (error) {
        console.error('Error updating streaming URLs:', error);
        res.status(500).json({ error: 'Failed to update streaming URLs' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Background scraping scheduler
// Run every 6 hours to update content
cron.schedule('0 */6 * * *', async () => {
    console.log('Running scheduled scraping...');
    try {
        // Scrape studios
        await scraper.scrapeStudios();
        
        // Scrape videos from a few random studios
        const studios = await scraper.getStudios();
        const randomStudios = studios.sort(() => 0.5 - Math.random()).slice(0, 5);
        
        for (const studio of randomStudios) {
            await scraper.scrapeVideosFromStudio(studio.url, studio.id, 10);
            await scraper.delay(5000); // Rate limiting
        }
        
        // Update streaming URLs
        await scraper.updateVideoStreamingUrls();
        
        console.log('Scheduled scraping completed');
    } catch (error) {
        console.error('Scheduled scraping failed:', error);
    }
});

// Add method to scraper for getting video by ID
scraper.getVideoById = function(videoId) {
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
};

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Media Library API server running on http://0.0.0.0:${PORT}`);
    console.log('Background scraping scheduled every 6 hours');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    scraper.close();
    process.exit(0);
});
