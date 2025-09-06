# Virtual Media Library - Vercel Deployment Guide

This guide will help you deploy the Virtual Media Library to Vercel for permanent hosting.

## Prerequisites

1. **Vercel Account**: Make sure you have a Vercel account at [vercel.com](https://vercel.com)
2. **Git Repository**: The project should be in a Git repository (GitHub, GitLab, or Bitbucket)

## Deployment Steps

### Option 1: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy the project**:
   ```bash
   cd virtual-media-library
   vercel
   ```

4. **Follow the prompts**:
   - Set up and deploy? `Y`
   - Which scope? Choose your account
   - Link to existing project? `N`
   - What's your project's name? `virtual-media-library`
   - In which directory is your code located? `./`

### Option 2: Deploy via Vercel Dashboard

1. **Push to Git**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_REPO_URL
   git push -u origin main
   ```

2. **Import on Vercel**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your Git repository
   - Configure project settings (use defaults)
   - Click "Deploy"

## Project Structure for Vercel

The project has been restructured for Vercel serverless deployment:

```
virtual-media-library/
├── api/
│   └── index.js              # Serverless API functions
├── public/                   # Static frontend files
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── enhanced-scraper-vercel.js # Vercel-compatible scraper
├── vercel.json              # Vercel configuration
├── package.json             # Dependencies (SQLite removed)
└── README-VERCEL.md         # This file
```

## Key Changes for Vercel

### 1. Serverless Architecture
- API moved to `/api/index.js` for Vercel Functions
- SQLite replaced with in-memory storage
- Function timeout protection (25 seconds)

### 2. Configuration Files
- `vercel.json`: Defines build and routing configuration
- Updated `package.json`: Removed SQLite dependency
- `.gitignore`: Added Vercel-specific ignores

### 3. Limitations on Vercel
- **No Persistent Database**: Data resets on each function cold start
- **Function Timeouts**: 30-second limit on Hobby plan
- **Memory Limits**: 1024MB on Hobby plan
- **No Background Jobs**: Cron jobs not supported on serverless

## Environment Variables (Optional)

If you need to configure any environment variables:

1. **Via Vercel Dashboard**:
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add variables as needed

2. **Via Vercel CLI**:
   ```bash
   vercel env add VARIABLE_NAME
   ```

## Custom Domain (Optional)

To use a custom domain:

1. **Via Vercel Dashboard**:
   - Go to your project settings
   - Navigate to "Domains"
   - Add your custom domain
   - Configure DNS as instructed

## Monitoring and Logs

- **Function Logs**: Available in Vercel Dashboard under "Functions"
- **Analytics**: Built-in analytics in Vercel Dashboard
- **Performance**: Real-time performance metrics

## Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check that all dependencies are in `package.json`
   - Ensure Node.js version compatibility (18+)

2. **API Timeouts**:
   - Scraping operations may timeout on Hobby plan
   - Consider upgrading to Pro plan for longer timeouts

3. **Memory Issues**:
   - Large scraping operations may hit memory limits
   - Reduce batch sizes in scraping functions

### Performance Tips

1. **Optimize Scraping**:
   - Reduce the number of pages scraped per request
   - Implement pagination for large datasets

2. **Caching**:
   - Consider using external storage (Redis, MongoDB Atlas)
   - Implement client-side caching

3. **CDN**:
   - Vercel automatically provides CDN for static assets
   - Optimize images and assets for faster loading

## Upgrading Vercel Plan

For production use, consider upgrading to Vercel Pro:
- Longer function timeouts (5 minutes)
- More memory (3008MB)
- Better performance
- Advanced analytics

## Support

- **Vercel Documentation**: [vercel.com/docs](https://vercel.com/docs)
- **Vercel Community**: [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions)

## Post-Deployment

After successful deployment:

1. **Test the Application**: Visit your Vercel URL
2. **Configure Settings**: Use the Settings tab to trigger scraping
3. **Monitor Performance**: Check Vercel Dashboard for metrics
4. **Set Up Monitoring**: Consider external monitoring tools

Your Virtual Media Library is now live on Vercel! 🚀
