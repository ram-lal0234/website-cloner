# 🕷️ Advanced Website Cloner CLI

A powerful CLI tool that clones any website locally with full functionality, SPA routing support, and a built-in development server.

## ✨ Features

- 🔄 **Multi-page crawling** with intelligent link discovery
- 📦 **Asset downloading** with multiple fallback methods (axios, puppeteer, fetch)
- 🎯 **Smart rewriting** of all links, assets, and resources for offline use
- 🚀 **SPA routing support** with service worker and client-side routing
- 🌐 **Built-in development server** with CORS and proper MIME types
- 🤖 **Puppeteer support** for JavaScript-heavy sites
- 📱 **Responsive** - maintains original mobile/desktop layouts
- ⚡ **Concurrent downloads** for faster cloning
- 🛠️ **Error handling** with graceful fallbacks to original URLs

## 🚀 Quick Start

### Installation

```bash
# Clone and setup
git clone <repository-url>
cd website-cloner
npm install

# Make executable globally (optional)
npm link
```

### Basic Usage

```bash
# Clone any website
node cloner.js <url> [output-directory] [options]

# Serve cloned website
node cloner.js --serve [directory] [port]
```

## 📖 Usage Examples

### Manual Commands

```bash
# Basic cloning
node cloner.js https://piyushgarg.dev
node cloner.js https://google.com google-clone
node cloner.js https://hitesh.ai hitesh-clone --max-pages=20

# With Puppeteer for JS-heavy sites
node cloner.js https://code.visualstudio.com vscode-clone --puppeteer --max-pages=15

# Serve locally
node cloner.js --serve piyush-site 3000
```

### NPM Scripts (Recommended)

We've included convenient npm scripts for the requested websites:

#### Clone Websites
```bash
# Clone Piyush Garg's site (20 pages)
npm run clone:piyush

# Clone Google homepage (5 pages)
npm run clone:google

# Clone Hitesh Choudhary's site (15 pages)
npm run clone:hitesh

# Clone VS Code landing page (10 pages)
npm run clone:vscode
```

#### Serve Websites Locally
```bash
# Serve on different ports to avoid conflicts
npm run serve:piyush   # http://localhost:3000
npm run serve:google   # http://localhost:3001
npm run serve:hitesh   # http://localhost:3002
npm run serve:vscode   # http://localhost:3003
```

#### One-Command Clone & Serve
```bash
# Clone Piyush's site and immediately serve it
npm run clone-and-serve
```

## ⚙️ Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `--max-pages=N` | Maximum pages to crawl | 50 |
| `--puppeteer` | Use Puppeteer for JS-heavy sites | false |
| `--concurrency=N` | Concurrent downloads | 5 |

## 📁 Output Structure

```
cloned-site/
├── index.html              # Main entry point
├── about.html              # Other pages
├── contact.html
├── assets/
│   ├── css/                # Stylesheets
│   ├── js/                 # JavaScript files
│   ├── images/             # Images
│   ├── fonts/              # Web fonts
│   └── misc/               # Other assets
└── sw.js                   # Service worker for offline support
```

## 🌐 Website-Specific Examples

### Piyush Garg Dev (piyushgarg.dev)
```bash
# Clone with moderate page limit
npm run clone:piyush
npm run serve:piyush

# Or manually with custom options
node cloner.js https://piyushgarg.dev piyush-custom --max-pages=30 --puppeteer
```

### Google (google.com)
```bash
# Clone homepage and immediate links
npm run clone:google
npm run serve:google

# Note: Google has anti-bot measures, so some assets might fallback to original URLs
```

### Hitesh AI (hitesh.ai)
```bash
# Clone portfolio site
npm run clone:hitesh
npm run serve:hitesh

# Custom clone with more pages
node cloner.js https://hitesh.ai hitesh-extended --max-pages=25
```

### VS Code (code.visualstudio.com)
```bash
# Clone VS Code landing page
npm run clone:vscode
npm run serve:vscode

# With Puppeteer for better JS support
node cloner.js https://code.visualstudio.com vscode-full --puppeteer --max-pages=20
```

## 🔧 Advanced Usage

### Custom Cloning Script
```bash
#!/bin/bash
# Clone multiple sites in sequence
node cloner.js https://piyushgarg.dev piyush-site --max-pages=15
node cloner.js https://hitesh.ai hitesh-site --max-pages=10  
node cloner.js https://code.visualstudio.com vscode-site --puppeteer --max-pages=8

# Start all servers
node cloner.js --serve piyush-site 3000 &
node cloner.js --serve hitesh-site 3001 &
node cloner.js --serve vscode-site 3002 &

echo "All sites cloned and served!"
echo "Piyush: http://localhost:3000"
echo "Hitesh: http://localhost:3001" 
echo "VS Code: http://localhost:3002"
```

### Batch Processing
```bash
# Clone all example sites at once
npm run clone:piyush && npm run clone:hitesh && npm run clone:vscode && npm run clone:google

# Serve all on different ports
npm run serve:piyush & npm run serve:hitesh & npm run serve:vscode & npm run serve:google &
```

## 🚨 Important Notes

### Website-Specific Considerations

1. **Google.com**: Has anti-bot measures; some assets may fallback to original URLs
2. **VS Code**: JavaScript-heavy; use `--puppeteer` flag for better results
3. **Personal portfolios**: Usually clone completely with all assets
4. **SPA websites**: Service worker handles client-side routing automatically

### Fallback Behavior
- If assets fail to download, original URLs are preserved
- Images that fail to load will show placeholder with error message
- CSS/JS that fails will fallback to original CDN URLs
- Service worker provides offline-first caching strategy

### Performance Tips
- Use `--max-pages` to limit crawling for large sites
- Increase `--concurrency` for faster downloads (be respectful)
- Use `--puppeteer` only when necessary (slower but more comprehensive)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with the example websites
5. Submit a pull request

## 📄 License

MIT License - feel free to use and modify!

## 🆘 Support

- Check the built-in help: `npm run help`
- Review cloned output for any missing assets
- Use browser dev tools to debug loading issues
- For JS-heavy sites, try the `--puppeteer` option

---

**Happy Cloning! 🕷️✨** 