# Virtual Media Library

A comprehensive web-based media library that scrapes and organizes video content from gay.xtapes.in, providing a Netflix-like streaming interface for local network viewing.

## Features

### ✅ Enhanced Web Scraper
- **Correct detail-page selectors** for title, poster, iframe, tags, duration, views, rating
- **Collects video links** from `ul.listing-videos` elements
- **Handles pagination** with `a.next` links automatically
- **Retries with exponential backoff** for robust scraping
- **Follows iframe sources** to extract final .mp4 stream URLs
- **Graceful quit functionality** - press 'q' + Enter to stop cleanly and save progress

### 🎬 Media Library Features
- **Studio Organization**: Browse content by 60+ studios
- **Video Streaming**: Direct streaming without downloads
- **Search & Filter**: Find videos by title, studio, or metadata
- **Responsive Design**: Optimized for TV viewing and mobile devices
- **Modern UI**: Netflix-inspired interface with smooth animations

### 🔧 Technical Features
- **Node.js Backend**: Express.js API with SQLite database
- **Real-time Updates**: Background scraping scheduler
- **CORS Support**: Cross-origin requests for frontend-backend communication
- **Error Handling**: Comprehensive error handling and retry logic
- **Rate Limiting**: Respectful scraping with delays between requests

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Internet connection for scraping

### Installation

1. **Clone/Download the project**
   ```bash
   cd virtual-media-library
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   node server.js
   ```

4. **Access the application**
   - Local: http://localhost:3000
   - Network: http://YOUR_PC_IP:3000

## Usage

### Initial Setup

1. **Open the application** in your web browser
2. **Go to Settings** tab
3. **Click "Scrape Studios"** to populate the studio list
4. **Click "Scrape Videos"** to start collecting video content
5. **Click "Update Streaming URLs"** to extract playable video links

### Browsing Content

- **Home**: View recently added videos and statistics
- **Studios**: Browse content organized by studio
- **All Videos**: View all videos with sorting and filtering options
- **Search**: Use the search bar to find specific content

### Video Playback

- Click any video thumbnail to open the player
- Videos stream directly without downloading
- Player supports fullscreen and standard video controls

## Network Access

### For TV Viewing

1. **Ensure your PC and TV are on the same WiFi network**
2. **Find your PC's IP address**:
   - Windows: `ipconfig` in Command Prompt
   - Mac/Linux: `ifconfig` or `ip addr show`
3. **On your TV browser, navigate to**: `http://YOUR_PC_IP:3000`

### For Mobile Devices

The interface is fully responsive and works on:
- Smart TVs with web browsers
- Tablets and smartphones
- Desktop computers
- Streaming devices with browser support

## Configuration

### Scraping Settings

- **Auto-refresh**: Set automatic content updates (5min, 15min, 1hr)
- **Videos per page**: Adjust pagination (20, 50, 100)
- **Manual controls**: Trigger scraping operations manually

### Performance Tuning

- **Rate Limiting**: Built-in delays prevent overwhelming the source site
- **Retry Logic**: Automatic retries with exponential backoff
- **Database Optimization**: SQLite with indexed queries for fast access

## API Endpoints

### Studios
- `GET /api/studios` - List all studios
- `GET /api/studios/:id/videos` - Get videos by studio
- `POST /api/scrape/studios` - Trigger studio scraping

### Videos
- `GET /api/videos` - List all videos
- `GET /api/videos/:id` - Get specific video
- `POST /api/scrape/videos/:studioId` - Scrape videos from studio
- `POST /api/scrape/streaming-urls` - Update streaming URLs

### System
- `GET /api/health` - Health check
- `GET /api/stream/:id` - Get video streaming URL

## File Structure

```
virtual-media-library/
├── server.js              # Main Express server
├── enhanced-scraper.js    # Enhanced scraping engine
├── media_library.db       # SQLite database
├── public/                # Frontend files
│   ├── index.html        # Main HTML
│   ├── styles.css        # CSS styles
│   └── app.js            # JavaScript application
├── package.json          # Node.js dependencies
└── README.md             # This file
```

## Troubleshooting

### Common Issues

1. **No videos showing**
   - Go to Settings and run "Scrape Studios" first
   - Then run "Scrape Videos" to populate content

2. **Videos won't play**
   - Run "Update Streaming URLs" in Settings
   - Check that the source site is accessible

3. **Slow loading**
   - Reduce "Videos per page" in Settings
   - Check network connection

4. **Can't access from TV**
   - Verify PC and TV are on same network
   - Check firewall settings on PC
   - Use PC's IP address, not localhost

### Performance Tips

- **Initial Setup**: First scraping may take 10-15 minutes
- **Regular Updates**: Enable auto-refresh for fresh content
- **Network**: Use wired connection for best streaming quality
- **Storage**: Database grows with content, monitor disk space

## Security Notes

- **Local Network Only**: Designed for home network use
- **No Authentication**: Open access within network
- **Content Source**: Respects rate limits and robots.txt
- **Privacy**: All data stored locally, no external tracking

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify network connectivity
3. Restart the server if needed
4. Clear browser cache if interface issues occur

## License

This project is for educational and personal use only. Respect copyright laws and terms of service of content sources.

---

**Enjoy your Virtual Media Library!** 🎬✨
