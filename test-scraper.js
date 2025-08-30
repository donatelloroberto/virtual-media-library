const MediaScraper = require('./scraper');

async function testScraper() {
    const scraper = new MediaScraper();
    
    try {
        console.log('Starting scraper test...');
        
        // Test studio scraping
        console.log('\n1. Scraping studios...');
        const studios = await scraper.scrapeStudios();
        console.log(`Scraped ${studios.length} studios`);
        
        // Test video scraping for first few studios
        console.log('\n2. Scraping videos from first 3 studios...');
        const dbStudios = await scraper.getStudios();
        
        for (let i = 0; i < Math.min(3, dbStudios.length); i++) {
            const studio = dbStudios[i];
            console.log(`\nScraping videos from: ${studio.name}`);
            await scraper.scrapeVideosFromStudio(studio.url, studio.id, 5);
            await scraper.delay(2000); // Rate limiting
        }
        
        // Test streaming URL extraction for a few videos
        console.log('\n3. Extracting streaming URLs...');
        await scraper.updateVideoStreamingUrls();
        
        // Display results
        console.log('\n4. Results summary:');
        const allStudios = await scraper.getStudios();
        const allVideos = await scraper.getAllVideos();
        
        console.log(`Total studios: ${allStudios.length}`);
        console.log(`Total videos: ${allVideos.length}`);
        
        console.log('\nFirst 5 videos:');
        allVideos.slice(0, 5).forEach(video => {
            console.log(`- ${video.title} (${video.studio_name})`);
            console.log(`  URL: ${video.url}`);
            console.log(`  Streaming: ${video.streaming_url || 'Not extracted'}`);
            console.log(`  Poster: ${video.poster_image_url || 'None'}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        scraper.close();
    }
}


testScraper();