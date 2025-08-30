class VirtualMediaLibrary {
    constructor() {
        this.apiBase = '/api';
        this.currentView = 'home';
        this.studios = [];
        this.videos = [];
        this.filteredVideos = [];
        this.searchTerm = '';
        this.selectedStudio = '';
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.showLoading(true);
        
        try {
            await this.loadData();
            this.updateStats();
            this.renderRecentVideos();
        } catch (error) {
            this.showToast('Failed to load data', 'error');
            console.error('Initialization error:', error);
        } finally {
            this.showLoading(false);
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });

        // Search
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.filterVideos();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });

        // Video sorting and filtering
        document.getElementById('videoSort').addEventListener('change', (e) => {
            this.sortVideos(e.target.value);
        });

        document.getElementById('studioFilter').addEventListener('change', (e) => {
            this.selectedStudio = e.target.value;
            this.filterVideos();
        });

        // Settings controls
        document.getElementById('scrapeStudiosBtn').addEventListener('click', () => {
            this.scrapeStudios();
        });

        document.getElementById('scrapeVideosBtn').addEventListener('click', () => {
            this.scrapeVideos();
        });

        document.getElementById('updateStreamingBtn').addEventListener('click', () => {
            this.updateStreamingUrls();
        });

        // Modal controls
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeVideoModal();
        });

        document.getElementById('videoModal').addEventListener('click', (e) => {
            if (e.target.id === 'videoModal') {
                this.closeVideoModal();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeVideoModal();
            }
        });
    }

    async loadData() {
        try {
            const [studiosResponse, videosResponse] = await Promise.all([
                fetch(`${this.apiBase}/studios`),
                fetch(`${this.apiBase}/videos`)
            ]);

            this.studios = await studiosResponse.json();
            this.videos = await videosResponse.json();
            this.filteredVideos = [...this.videos];

            // Populate studio filter
            this.populateStudioFilter();
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    populateStudioFilter() {
        const studioFilter = document.getElementById('studioFilter');
        studioFilter.innerHTML = '<option value="">All Studios</option>';
        
        this.studios.forEach(studio => {
            const option = document.createElement('option');
            option.value = studio.id;
            option.textContent = studio.name;
            studioFilter.appendChild(option);
        });
    }

    updateStats() {
        document.getElementById('totalStudios').textContent = this.studios.length;
        document.getElementById('totalVideos').textContent = this.videos.length;
    }

    switchView(viewName) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${viewName}View`).classList.add('active');

        this.currentView = viewName;

        // Load view-specific content
        switch (viewName) {
            case 'studios':
                this.renderStudios();
                break;
            case 'videos':
                this.renderVideos();
                break;
            case 'home':
                this.renderRecentVideos();
                break;
        }
    }

    renderStudios() {
        const container = document.getElementById('studiosList');
        container.innerHTML = '';

        this.studios.forEach(studio => {
            const studioCard = this.createStudioCard(studio);
            container.appendChild(studioCard);
        });
    }

    createStudioCard(studio) {
        const card = document.createElement('div');
        card.className = 'studio-card';
        card.innerHTML = `
            <div class="studio-name">${this.escapeHtml(studio.name)}</div>
            <div class="studio-info">
                ${studio.video_count || 0} videos
            </div>
        `;

        card.addEventListener('click', () => {
            this.showStudioVideos(studio.id);
        });

        return card;
    }

    async showStudioVideos(studioId) {
        this.showLoading(true);
        try {
            const response = await fetch(`${this.apiBase}/studios/${studioId}/videos`);
            const videos = await response.json();
            
            this.filteredVideos = videos;
            this.switchView('videos');
            this.renderVideos();
            
            // Update studio filter to show selected studio
            document.getElementById('studioFilter').value = studioId;
        } catch (error) {
            this.showToast('Failed to load studio videos', 'error');
            console.error('Error loading studio videos:', error);
        } finally {
            this.showLoading(false);
        }
    }

    renderVideos() {
        const container = document.getElementById('videosList');
        container.innerHTML = '';

        if (this.filteredVideos.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: rgba(255, 255, 255, 0.6);">
                    <i class="fas fa-video" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>No videos found</p>
                </div>
            `;
            return;
        }

        this.filteredVideos.forEach(video => {
            const videoCard = this.createVideoCard(video);
            container.appendChild(videoCard);
        });
    }

    renderRecentVideos() {
        const container = document.getElementById('recentVideos');
        container.innerHTML = '';

        const recentVideos = this.videos.slice(0, 8);
        recentVideos.forEach(video => {
            const videoCard = this.createVideoCard(video);
            container.appendChild(videoCard);
        });
    }

    createVideoCard(video) {
        const card = document.createElement('div');
        card.className = 'video-card';
        
        const posterUrl = video.poster_image_url || '/placeholder-video.jpg';
        const duration = video.duration || '';
        const views = video.views ? this.formatNumber(video.views) : '0';
        const rating = video.rating || '';
        const studioName = video.studio_name || 'Unknown Studio';

        card.innerHTML = `
            <img src="${posterUrl}" alt="${this.escapeHtml(video.title)}" class="video-poster" 
                 onerror="this.src='/placeholder-video.jpg'">
            <div class="video-info">
                <div class="video-title">${this.escapeHtml(video.title)}</div>
                <div class="video-meta">
                    <span class="studio-tag">${this.escapeHtml(studioName)}</span>
                    ${duration ? `<span class="duration"><i class="fas fa-clock"></i> ${duration}</span>` : ''}
                    ${views ? `<span class="views"><i class="fas fa-eye"></i> ${views}</span>` : ''}
                    ${rating ? `<span class="rating"><i class="fas fa-star"></i> ${rating}</span>` : ''}
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            this.playVideo(video);
        });

        return card;
    }

    async playVideo(video) {
        if (!video.streaming_url) {
            this.showToast('No streaming URL available for this video', 'error');
            return;
        }

        // Update modal content
        document.getElementById('videoTitle').textContent = video.title;
        document.getElementById('videoStudio').textContent = video.studio_name || 'Unknown Studio';
        document.getElementById('videoDuration').innerHTML = video.duration ? 
            `<i class="fas fa-clock"></i> ${video.duration}` : '';
        document.getElementById('videoViews').innerHTML = video.views ? 
            `<i class="fas fa-eye"></i> ${this.formatNumber(video.views)}` : '';
        document.getElementById('videoRating').innerHTML = video.rating ? 
            `<i class="fas fa-star"></i> ${video.rating}` : '';

        // Set video player source
        const videoPlayer = document.getElementById('videoPlayer');
        videoPlayer.src = video.streaming_url;

        // Show modal
        document.getElementById('videoModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeVideoModal() {
        const modal = document.getElementById('videoModal');
        const videoPlayer = document.getElementById('videoPlayer');
        
        modal.classList.add('hidden');
        videoPlayer.src = '';
        document.body.style.overflow = '';
    }

    filterVideos() {
        this.filteredVideos = this.videos.filter(video => {
            const matchesSearch = !this.searchTerm || 
                video.title.toLowerCase().includes(this.searchTerm) ||
                (video.studio_name && video.studio_name.toLowerCase().includes(this.searchTerm));
            
            const matchesStudio = !this.selectedStudio || 
                video.studio_id == this.selectedStudio;

            return matchesSearch && matchesStudio;
        });

        if (this.currentView === 'videos') {
            this.renderVideos();
        }
    }

    sortVideos(sortBy) {
        switch (sortBy) {
            case 'title':
                this.filteredVideos.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'views':
                this.filteredVideos.sort((a, b) => (b.views || 0) - (a.views || 0));
                break;
            case 'rating':
                this.filteredVideos.sort((a, b) => {
                    const ratingA = parseFloat(a.rating) || 0;
                    const ratingB = parseFloat(b.rating) || 0;
                    return ratingB - ratingA;
                });
                break;
            case 'recent':
            default:
                this.filteredVideos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
        }

        if (this.currentView === 'videos') {
            this.renderVideos();
        }
    }

    async refreshData() {
        this.showLoading(true);
        try {
            await this.loadData();
            this.updateStats();
            
            // Refresh current view
            switch (this.currentView) {
                case 'studios':
                    this.renderStudios();
                    break;
                case 'videos':
                    this.renderVideos();
                    break;
                case 'home':
                    this.renderRecentVideos();
                    break;
            }
            
            this.showToast('Data refreshed successfully', 'success');
        } catch (error) {
            this.showToast('Failed to refresh data', 'error');
            console.error('Refresh error:', error);
        } finally {
            this.showLoading(false);
        }
    }

    async scrapeStudios() {
        this.showLoading(true);
        try {
            const response = await fetch(`${this.apiBase}/scrape/studios`, {
                method: 'POST'
            });
            const result = await response.json();
            
            this.showToast(`Scraped ${result.studios?.length || 0} studios`, 'success');
            await this.refreshData();
        } catch (error) {
            this.showToast('Failed to scrape studios', 'error');
            console.error('Scrape studios error:', error);
        } finally {
            this.showLoading(false);
        }
    }

    async scrapeVideos() {
        if (this.studios.length === 0) {
            this.showToast('No studios available. Please scrape studios first.', 'error');
            return;
        }

        this.showLoading(true);
        try {
            // Scrape videos from first few studios
            const studiesToScrape = this.studios.slice(0, 3);
            
            for (const studio of studiesToScrape) {
                const response = await fetch(`${this.apiBase}/scrape/videos/${studio.id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ limit: 10 })
                });
                const result = await response.json();
                console.log(`Scraped ${result.videos?.length || 0} videos from ${studio.name}`);
            }
            
            this.showToast('Video scraping completed', 'success');
            await this.refreshData();
        } catch (error) {
            this.showToast('Failed to scrape videos', 'error');
            console.error('Scrape videos error:', error);
        } finally {
            this.showLoading(false);
        }
    }

    async updateStreamingUrls() {
        this.showLoading(true);
        try {
            const response = await fetch(`${this.apiBase}/scrape/streaming-urls`, {
                method: 'POST'
            });
            const result = await response.json();
            
            this.showToast('Streaming URLs updated', 'success');
            await this.refreshData();
        } catch (error) {
            this.showToast('Failed to update streaming URLs', 'error');
            console.error('Update streaming URLs error:', error);
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VirtualMediaLibrary();
});

// Service Worker for offline functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
