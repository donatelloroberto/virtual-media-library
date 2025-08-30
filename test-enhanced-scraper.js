const EnhancedMediaScraper = require('./enhanced-scraper');

async function testEnhancedScraper() {
    const scraper = new EnhancedMediaScraper();
    
    try {
        console.log('🧪 Testing Enhanced Media Scraper...');
        console.log('💡 Press "q" + Enter to gracefully quit at any time\n');
        
        // Run a limited full scrape for testing
        await scraper.runFullScrape(3, 2); // 3 studios, 2 pages each
        
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        if (error.message === 'Graceful quit requested') {
            console.log('\n✅ Test stopped gracefully');
        } else {
            console.error('❌ Test failed:', error);
        }
    } finally {
        scraper.close();
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, exiting...');
    process.exit(0);
});

testEnhancedScraper();
