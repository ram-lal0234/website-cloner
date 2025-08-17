#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import pLimit from "p-limit";
import express from "express";
import { createServer } from "http";
import { uiManager, startCloningUI, startServerUI, showHelpUI } from "./src/ui/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global state
const downloadedAssets = new Map(); // remote URL -> local path
const processedUrls = new Set();
const pageQueue = [];
let visitedPages = 0;
let baseOriginUrl = "";

// Create axios instance
const axiosInstance = axios.create({
  timeout: 30000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
});

// Main clone function with UI integration
async function cloneWebsite(url, options = {}) {
  const {
    outputDir = "cloned-site",
    maxPages = 50,
    concurrency = 5,
    respectRobots = false,
    sameOriginOnly = true,
    usePuppeteer = false,
  } = options;

  let ui = null;

  try {
    // Start the beautiful UI
    ui = await startCloningUI(url, {
      outputDir,
      maxPages,
      concurrency,
      usePuppeteer
    });

    const baseUrl = new URL(url);
    baseOriginUrl = baseUrl.origin;
    await ensureDir(outputDir);

    // Initialize concurrency limiter
    const limit = pLimit(concurrency);

    // Add starting URL to queue
    pageQueue.push(url);

    // Update initial progress
    if (ui && ui.updateProgress) {
      ui.updateProgress({ total: 1 }, { total: 0 });
    }

    // Process pages
    while (pageQueue.length > 0 && visitedPages < maxPages) {
      const currentUrl = pageQueue.shift();
      if (!currentUrl || processedUrls.has(currentUrl)) continue;

      if (ui && ui.logProcessing) {
        ui.logProcessing(currentUrl);
      }
      await processPage(currentUrl, baseUrl, outputDir, limit, usePuppeteer, ui);
      visitedPages++;

      // Update progress in UI
      if (ui && ui.updateProgress) {
        ui.updateProgress(
          { current: visitedPages, total: Math.min(pageQueue.length + visitedPages, maxPages) },
          { current: downloadedAssets.size, total: downloadedAssets.size }
        );
      }
    }

    // Generate improved service worker for SPA routing
    // await generateServiceWorker(outputDir, baseUrl);

    // Create fallback routing file
    // await createRoutingFallback(outputDir);

    // Mark as complete
    if (ui && ui.markComplete) {
      ui.markComplete();
    }

    // Keep UI running for a moment to show completion
    await new Promise(resolve => setTimeout(resolve, 3000));
    
  } catch (error) {
    if (ui && ui.logError) {
      ui.logError(error.message, url);
    } else {
      console.error("❌ Error cloning website:", error.message);
    }
    throw error;
  }
}

// Process individual page with UI integration
async function processPage(url, baseUrl, outputDir, limit, usePuppeteer, ui) {
  if (processedUrls.has(url)) return;
  processedUrls.add(url);

  try {
    let html;

    if (usePuppeteer) {
      html = await getHtmlWithPuppeteer(url);
    } else {
      const response = await axiosInstance.get(url);
      html = response.data;
    }

    if (!html) return;

    // Process HTML with cheerio
    const $ = cheerio.load(html, { decodeEntities: false });

    // Extract and download assets
    const assetUrls = extractAssetUrls($, url, baseUrl);
    await Promise.all(
      assetUrls.map((assetUrl) =>
        limit(() => downloadAsset(assetUrl, outputDir, baseUrl, ui))
      )
    );

    // Extract page links for further crawling
    const pageLinks = extractPageLinks($, url, baseUrl);
    pageLinks.forEach((link) => {
      if (!processedUrls.has(link) && visitedPages < 50) {
        pageQueue.push(link);
      }
    });

    // Rewrite HTML links to local paths
    rewriteHtmlForOffline($, baseUrl, outputDir, url);

    // Save processed HTML
    const localPath = urlToLocalPath(url, baseUrl);
    const outputPath = path.join(outputDir, localPath);
    await ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, $.html(), "utf-8");
    
    // For SPA support, also create a direct route file if this is a sub-page
    const urlObj = new URL(url);
    if (urlObj.pathname !== '/' && !urlObj.pathname.endsWith('.html')) {
      const routePath = path.join(outputDir, urlObj.pathname + '.html');
      await ensureDir(path.dirname(routePath));
      await fs.writeFile(routePath, $.html(), "utf-8");
    }

    if (ui && ui.logSuccess) {
      ui.logSuccess(url);
    }
  } catch (error) {
    if (ui && ui.logError) {
      ui.logError(error.message, url);
    } else {
      console.error(`❌ Failed to process ${url}:`, error.message);
    }
  }
}

// Get HTML using Puppeteer for JS-heavy sites
async function getHtmlWithPuppeteer(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    );

    // Navigate and wait for content
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Get final HTML after JS execution
    const html = await page.content();
    return html;
  } catch (error) {
    console.error(`❌ Puppeteer failed for ${url}:`, error.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Extract asset URLs from HTML with enhanced detection
function extractAssetUrls($, pageUrl, baseUrl) {
  const urls = new Set();

  // CSS files
  $('link[rel="stylesheet"], link[rel="preload"][as="style"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) urls.add(resolveUrl(href, pageUrl));
  });

  // JavaScript files (including module preloads)
  $("script[src], link[rel='preload'][as='script'], link[rel='modulepreload']").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("href");
    if (src && !src.startsWith("data:")) urls.add(resolveUrl(src, pageUrl));
  });

  // Images
  $("img[src], img[data-src]").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (src && !src.startsWith("data:")) urls.add(resolveUrl(src, pageUrl));
  });

  // Background images and other CSS assets
  $("*").each((_, el) => {
    const style = $(el).attr("style");
    if (style) {
      const urlMatches = style.match(/url\(['"]?([^'")]+)['"]?\)/g);
      if (urlMatches) {
        urlMatches.forEach((match) => {
          const url = match.match(/url\(['"]?([^'")]+)['"]?\)/)[1];
          if (url && !url.startsWith("data:")) {
            urls.add(resolveUrl(url, pageUrl));
          }
        });
      }
    }
  });

  // Srcset attributes
  $("img[srcset], source[srcset]").each((_, el) => {
    const srcset = $(el).attr("srcset");
    if (srcset) {
      const srcsetUrls = srcset.split(",").map((s) => s.trim().split(/\s+/)[0]);
      srcsetUrls.forEach((url) => {
        if (url && !url.startsWith("data:")) {
          urls.add(resolveUrl(url, pageUrl));
        }
      });
    }
  });

  // Extract dynamic imports and chunks from inline scripts
  $("script:not([src])").each((_, el) => {
    const scriptContent = $(el).html() || "";
    
    // Next.js specific patterns
    const nextChunkPatterns = [
      /_next\/static\/chunks\/[^'"]+/g,
      /_next\/static\/[^'"]+/g,
      /\/_next\/[^'"]+\.js/g,
      /static\/chunks\/[^'"]+/g,
      /static\/[^'"]+\.js/g
    ];

    // General dynamic import patterns
    const dynamicPatterns = [
      /import\(['"]([^'"]+)['"]\)/g,
      /chunks\/[^'"]+\.js/g,
      /['"]([^'"]*\.js)['"]/g
    ];

    [...nextChunkPatterns, ...dynamicPatterns].forEach(pattern => {
      let match;
      while ((match = pattern.exec(scriptContent)) !== null) {
        const url = match[1] || match[0];
        if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
          try {
            const resolvedUrl = resolveUrl(url, pageUrl);
            urls.add(resolvedUrl);
          } catch (e) {
            // Invalid URL, skip
          }
        }
      }
    });

    // Extract webpack chunk manifest URLs
    const webpackPatterns = [
      /__webpack_require__\.p\s*\+\s*['"]([^'"]+)['"]/g,
      /webpackChunkName:\s*['"]([^'"]+)['"]/g
    ];

    webpackPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(scriptContent)) !== null) {
        const chunkPath = match[1];
        if (chunkPath && chunkPath.endsWith('.js')) {
          try {
            const resolvedUrl = resolveUrl(chunkPath, pageUrl);
            urls.add(resolvedUrl);
          } catch (e) {
            // Invalid URL, skip
          }
        }
      }
    });
  });

  return Array.from(urls);
}

// Extract page links for crawling with enhanced detection
function extractPageLinks($, pageUrl, baseUrl) {
  const links = new Set();

  // Traditional anchor links
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (
      href &&
      !href.startsWith("#") &&
      !href.startsWith("mailto:") &&
      !href.startsWith("tel:")
    ) {
      try {
        const absoluteUrl = resolveUrl(href, pageUrl);
        const urlObj = new URL(absoluteUrl);

        // Only same origin links
        if (urlObj.origin === baseUrl.origin) {
          links.add(absoluteUrl);
        }
      } catch (error) {
        // Invalid URL, skip
      }
    }
  });

  // Extract routes from Next.js/React Router configurations
  $("script:not([src])").each((_, el) => {
    const scriptContent = $(el).html() || "";
    
    // Next.js route patterns
    const routePatterns = [
      /"\/[^"]*"/g,  // Routes in quotes
      /'\/[^']*'/g,  // Routes in single quotes
      /router\.push\(['"]([^'"]+)['"]\)/g,  // Router.push calls
      /href:\s*['"]([^'"]+)['"]/g,  // href properties
      /path:\s*['"]([^'"]+)['"]/g,  // path properties
    ];

    routePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(scriptContent)) !== null) {
        const route = match[1] || match[0].replace(/['"]/g, '');
        if (route && route.startsWith('/') && !route.includes('api') && !route.includes('_next')) {
          try {
            const absoluteUrl = resolveUrl(route, pageUrl);
            const urlObj = new URL(absoluteUrl);
            if (urlObj.origin === baseUrl.origin) {
              links.add(absoluteUrl);
            }
          } catch (e) {
            // Invalid URL, skip
          }
        }
      }
    });
  });

  // Common route patterns for popular frameworks
  const commonRoutes = ['/about', '/contact', '/blog', '/services', '/portfolio', '/work'];
  commonRoutes.forEach(route => {
    try {
      const absoluteUrl = resolveUrl(route, baseUrl.href);
      links.add(absoluteUrl);
    } catch (e) {
      // Skip if invalid
    }
  });

  return Array.from(links);
}

// Rewrite HTML for offline use with fallback URLs
function rewriteHtmlForOffline($, baseUrl, outputDir, currentPageUrl) {
  // Rewrite CSS links
  $('link[rel="stylesheet"], link[rel="preload"][as="style"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const absoluteUrl = resolveUrl(href, currentPageUrl);
      const localPath = downloadedAssets.get(absoluteUrl);
      if (localPath) {
        $(el).attr("href", localPath);
      } else {
        // Fallback: keep original URL if download failed
        $(el).attr("href", absoluteUrl);
        $(el).attr("data-fallback", "true");
      }
    }
  });

  // Rewrite JS src
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src && !src.startsWith("data:")) {
      const absoluteUrl = resolveUrl(src, currentPageUrl);
      const localPath = downloadedAssets.get(absoluteUrl);
      if (localPath) {
        $(el).attr("src", localPath);
      } else {
        // Fallback: keep original URL if download failed
        $(el).attr("src", absoluteUrl);
        $(el).attr("data-fallback", "true");
      }
    }
  });

  // Rewrite image src with fallback handling
  $("img[src], img[data-src]").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (src && !src.startsWith("data:")) {
      const absoluteUrl = resolveUrl(src, currentPageUrl);
      const localPath = downloadedAssets.get(absoluteUrl);

      if (localPath) {
        if ($(el).attr("src")) $(el).attr("src", localPath);
        if ($(el).attr("data-src")) $(el).attr("data-src", localPath);
      } else {
        // Fallback: use original URL with error handling
        if ($(el).attr("src")) {
          $(el).attr("src", absoluteUrl);
          $(el).attr("data-fallback", "true");
          $(el).attr(
            "onerror",
            `this.style.display='none'; console.warn('Failed to load image: ${absoluteUrl}');`
          );
        }
        if ($(el).attr("data-src")) {
          $(el).attr("data-src", absoluteUrl);
          $(el).attr("data-fallback", "true");
        }
      }
    }
  });

  // Handle srcset with fallbacks
  $("img[srcset], source[srcset]").each((_, el) => {
    const srcset = $(el).attr("srcset");
    if (srcset) {
      const newSrcset = srcset
        .split(",")
        .map((entry) => {
          const parts = entry.trim().split(/\s+/);
          const url = parts[0];
          const descriptor = parts[1] || "";

          if (url && !url.startsWith("data:")) {
            const absoluteUrl = resolveUrl(url, currentPageUrl);
            const localPath = downloadedAssets.get(absoluteUrl);
            return localPath
              ? `${localPath} ${descriptor}`.trim()
              : `${absoluteUrl} ${descriptor}`.trim();
          }
          return entry;
        })
        .join(", ");

      $(el).attr("srcset", newSrcset);
    }
  });

  // Rewrite page links with SPA routing support
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (
      href &&
      !href.startsWith("#") &&
      !href.startsWith("mailto:") &&
      !href.startsWith("tel:")
    ) {
      try {
        const absoluteUrl = resolveUrl(href, currentPageUrl);
        const urlObj = new URL(absoluteUrl);

        if (urlObj.origin === baseUrl.origin) {
          const localPath = urlToLocalPath(absoluteUrl, baseUrl);
          $(el).attr("href", localPath);
          // Add data attribute for SPA routing
          $(el).attr("data-original-href", absoluteUrl);
        }
      } catch (error) {
        // Keep original href if URL is invalid
      }
    }
  });

  // Handle inline styles with fallbacks
  $("*[style]").each((_, el) => {
    const style = $(el).attr("style");
    if (style) {
      let newStyle = style;
      const urlMatches = style.match(/url\(['"]?([^'")]+)['"]?\)/g);
      if (urlMatches) {
        urlMatches.forEach((match) => {
          const url = match.match(/url\(['"]?([^'")]+)['"]?\)/)[1];
          if (url && !url.startsWith("data:")) {
            const absoluteUrl = resolveUrl(url, currentPageUrl);
            const localPath = downloadedAssets.get(absoluteUrl);
            if (localPath) {
              newStyle = newStyle.replace(match, `url('${localPath}')`);
            } else {
              // Fallback: keep original URL
              newStyle = newStyle.replace(match, `url('${absoluteUrl}')`);
            }
          }
        });
      }
      $(el).attr("style", newStyle);
    }
  });

  // Process inline <style> blocks with fallbacks
  $("style").each((_, el) => {
    let cssText = $(el).html() || "";
    const urlMatches = cssText.match(/url\(['"]?([^'")]+)['"]?\)/g);
    if (urlMatches) {
      urlMatches.forEach((match) => {
        const url = match.match(/url\(['"]?([^'")]+)['"]?\)/)[1];
        if (url && !url.startsWith("data:")) {
          const absoluteUrl = resolveUrl(url, currentPageUrl);
          const localPath = downloadedAssets.get(absoluteUrl);
          if (localPath) {
            cssText = cssText.replace(match, `url('${localPath}')`);
          } else {
            // Fallback: keep original URL
            cssText = cssText.replace(match, `url('${absoluteUrl}')`);
          }
        }
      });
    }
    $(el).html(cssText);
  });
}

// Enhanced asset download with better fallback handling and UI integration
async function downloadAsset(url, outputDir, baseUrl, ui) {
  if (downloadedAssets.has(url)) {
    return downloadedAssets.get(url);
  }

  // Skip data URLs and invalid URLs
  if (url.startsWith("data:") || !url.startsWith("http")) {
    return null;
  }

  if (ui && ui.logDownloading) {
    ui.logDownloading(url);
  }

  // Generate local filename
  const filename = generateAssetFilename(url);
  const assetDir = getAssetTypeDir(url);
  const localPath = path.join("assets", assetDir, filename);
  const outputPath = path.join(outputDir, localPath);

  // Method 1: Try axios first
  try {
    const response = await axiosInstance.get(url, {
      responseType: "stream",
      timeout: 30000,
      headers: {
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    await ensureDir(path.dirname(outputPath));
    await pipeline(response.data, createWriteStream(outputPath));
    const normalizedPath = localPath.replace(/\\/g, "/");
    downloadedAssets.set(url, normalizedPath);
    if (ui && ui.logSuccess) {
      ui.logSuccess(url);
    }
    return normalizedPath;
  } catch (axiosError) {
    if (ui && ui.logWarning) {
      ui.logWarning(`Axios failed: ${axiosError.message}`, url);
    }

    // Method 2: Fallback to Puppeteer
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-web-security",
        ],
      });
      const page = await browser.newPage();

      // Set headers to mimic real browser
      await page.setExtraHTTPHeaders({
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
      });

      const response = await page.goto(url, { timeout: 30000 });

      if (response && response.ok()) {
        const buffer = await response.buffer();
        await ensureDir(path.dirname(outputPath));
        await fs.writeFile(outputPath, buffer);
        const normalizedPath = localPath.replace(/\\/g, "/");
        downloadedAssets.set(url, normalizedPath);
        if (ui && ui.logSuccess) {
          ui.logSuccess(url);
        }
        await browser.close();
        return normalizedPath;
      }

      await browser.close();
    } catch (puppeteerError) {
      if (ui && ui.logWarning) {
        ui.logWarning(`Puppeteer failed: ${puppeteerError.message}`, url);
      }

      // Method 3: Try native fetch
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "*/*",
          },
        });

        if (response.ok) {
          const buffer = await response.arrayBuffer();
          await ensureDir(path.dirname(outputPath));
          await fs.writeFile(outputPath, new Uint8Array(buffer));
          const normalizedPath = localPath.replace(/\\/g, "/");
          downloadedAssets.set(url, normalizedPath);
          if (ui && ui.logSuccess) {
            ui.logSuccess(url);
          }
          return normalizedPath;
        }
      } catch (fetchError) {
        if (ui && ui.logError) {
          ui.logError(`All download methods failed: ${fetchError.message}`, url);
        }
      }
    }
  }

  // If all methods fail, we'll use the original URL as fallback in rewriteHtmlForOffline
  if (ui && ui.logWarning) {
    ui.logWarning("Will use original URL as fallback", url);
  }
  return null;
}

// Generate appropriate asset directory based on file type
function getAssetTypeDir(url) {
  const urlLower = url.toLowerCase();

  if (urlLower.match(/\.(css)$/)) return "css";
  if (urlLower.match(/\.(js|mjs)$/)) return "js";
  if (urlLower.match(/\.(jpg|jpeg|png|gif|svg|webp|ico|bmp)$/)) return "images";
  if (urlLower.match(/\.(woff|woff2|ttf|eot|otf)$/)) return "fonts";
  if (urlLower.match(/\.(mp4|webm|ogg|mp3|wav|flac)$/)) return "media";

  return "misc";
}

// Generate unique filename for assets
function generateAssetFilename(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = path.basename(pathname) || "index";
    const ext = path.extname(filename) || getExtensionFromUrl(url);
    const name = path.basename(filename, path.extname(filename)) || "asset";

    // Create hash to avoid conflicts
    const hash = simpleHash(url);
    return `${name}-${hash}${ext}`;
  } catch {
    const hash = simpleHash(url);
    return `asset-${hash}`;
  }
}

// Get file extension from URL or content type
function getExtensionFromUrl(url) {
  const urlLower = url.toLowerCase();

  if (urlLower.includes(".css")) return ".css";
  if (urlLower.includes(".js")) return ".js";
  if (urlLower.includes(".png")) return ".png";
  if (urlLower.includes(".jpg") || urlLower.includes(".jpeg")) return ".jpg";
  if (urlLower.includes(".gif")) return ".gif";
  if (urlLower.includes(".svg")) return ".svg";
  if (urlLower.includes(".woff2")) return ".woff2";
  if (urlLower.includes(".woff")) return ".woff";
  if (urlLower.includes(".ttf")) return ".ttf";

  return "";
}

// Convert URL to local file path
function urlToLocalPath(url, baseUrl) {
  try {
    const urlObj = new URL(url);
    let pathname = urlObj.pathname;

    // Handle root and directory URLs
    if (pathname === "/" || pathname.endsWith("/")) {
      pathname += "index.html";
    } else if (!path.extname(pathname)) {
      pathname += ".html";
    }

    // Remove leading slash and normalize
    let localPath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
    if (!localPath) localPath = "index.html";

    // Sanitize path for file system
    return localPath.replace(/[<>:"|?*]/g, "_");
  } catch {
    return "index.html";
  }
}

// Resolve relative URLs
function resolveUrl(url, baseUrl) {
  if (url.startsWith("//")) {
    const base = new URL(baseUrl);
    return base.protocol + url;
  }
  if (url.startsWith("http")) {
    return url;
  }
  if (url.startsWith("data:")) {
    return url;
  }
  return new URL(url, baseUrl).href;
}

// Simple hash function
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).substr(0, 8);
}

// Ensure directory exists
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// Create routing fallback for SPA applications
async function createRoutingFallback(outputDir) {
  const routingScript = `
<!-- Enhanced SPA routing fallback script -->
<script>
(function() {
  // Enhanced SPA routing handler
  function handleRouting() {
    const links = document.querySelectorAll('a[data-original-href]');
    links.forEach(link => {
      link.addEventListener('click', function(e) {
        const originalHref = this.getAttribute('data-original-href');
        const href = this.getAttribute('href');
        
        // For SPA apps, prevent default and update URL without reload
        if (originalHref && !originalHref.includes('#') && !originalHref.includes('mailto:') && !originalHref.includes('tel:')) {
          e.preventDefault();
          
          // Try to fetch the content
          fetch(href, { method: 'HEAD' })
            .then(response => {
              if (response.ok) {
                // File exists, navigate normally
                window.location.href = href;
              } else {
                // File doesn't exist, use client-side routing
                handleClientSideRouting(originalHref);
              }
            })
            .catch(() => {
              // Fetch failed, use client-side routing
              handleClientSideRouting(originalHref);
            });
        }
      });
    });
  }

  // Handle client-side routing for SPA
  function handleClientSideRouting(originalHref) {
    try {
      const url = new URL(originalHref, window.location.origin);
      
      // Update browser URL without reload
      if (history.pushState) {
        history.pushState({}, '', url.pathname + url.search + url.hash);
        
        // Trigger navigation event for SPA frameworks
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
        
        // Try to find and trigger router update
        if (window.next && window.next.router) {
          // Next.js router
          window.next.router.push(url.pathname);
        } else if (window.React && window.ReactRouterDOM) {
          // React Router
          const event = new CustomEvent('routechange', { detail: { path: url.pathname } });
          window.dispatchEvent(event);
        }
      } else {
        // Fallback for older browsers
        window.location.href = '/index.html' + url.hash;
      }
    } catch (error) {
      console.warn('Client-side routing failed:', error);
      window.location.href = '/index.html';
    }
  }

  // Handle dynamic import failures
  function handleScriptErrors() {
    const originalError = window.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
      if (message && message.includes('Failed to load script')) {
        console.warn('Script loading failed, continuing without:', source);
        return true; // Prevent default error handling
      }
      if (originalError) {
        return originalError.apply(this, arguments);
      }
      return false;
    };

    // Handle unhandled promise rejections (like failed dynamic imports)
    window.addEventListener('unhandledrejection', function(event) {
      if (event.reason && event.reason.message && event.reason.message.includes('Loading chunk')) {
        console.warn('Chunk loading failed, continuing without:', event.reason);
        event.preventDefault();
      }
    });
  }

  // Handle image loading errors
  function handleImageErrors() {
    const images = document.querySelectorAll('img[data-fallback="true"]');
    images.forEach(img => {
      if (!img.hasAttribute('data-error-handled')) {
        img.setAttribute('data-error-handled', 'true');
        img.addEventListener('error', function() {
          console.warn('Image failed to load:', this.src);
          this.style.opacity = '0.5';
          this.title = 'Image could not be loaded: ' + this.src;
        });
      }
    });
  }

  // Browser back/forward button handling
  window.addEventListener('popstate', function(event) {
    // Let the SPA framework handle the routing
    if (window.next && window.next.router) {
      window.next.router.push(window.location.pathname);
    }
  });

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      handleRouting();
      handleImageErrors();
      handleScriptErrors();
    });
  } else {
    handleRouting();
    handleImageErrors();
    handleScriptErrors();
  }
})();
</script>`;

  // Add routing script to all HTML files
  const htmlFiles = await getHtmlFiles(outputDir);
  for (const htmlFile of htmlFiles) {
    try {
      let content = await fs.readFile(htmlFile, "utf-8");
      if (!content.includes("Routing fallback script")) {
        content = content.replace("</body>", routingScript + "\n</body>");
        await fs.writeFile(htmlFile, content, "utf-8");
      }
    } catch (error) {
      console.log(`Could not add routing script to ${htmlFile}`);
    }
  }
}

// Get all HTML files
async function getHtmlFiles(dir) {
  const files = [];
  const items = await fs.readdir(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...(await getHtmlFiles(fullPath)));
    } else if (item.name.endsWith(".html")) {
      files.push(fullPath);
    }
  }

  return files;
}

// Enhanced service worker with better routing support
async function generateServiceWorker(outputDir, baseUrl) {
  try {
    // Get all files to cache
    const files = await getAllFiles(outputDir);
    const cacheFiles = files.map((file) => {
      const relativePath = path.relative(outputDir, file).replace(/\\/g, "/");
      return "/" + relativePath;
    });

    const swContent = `
const CACHE_NAME = 'cloned-site-v1';
const ORIGINAL_ORIGIN = '${baseUrl.origin}';
const urlsToCache = ${JSON.stringify(cacheFiles, null, 2)};

self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching files:', urlsToCache.length, 'files');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
      .catch(error => console.error('Cache installation failed:', error))
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Handle requests for original domain assets
  if (url.origin === ORIGINAL_ORIGIN) {
    console.log('Proxying original domain request:', url.href);
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          console.log('Cache hit:', event.request.url);
          return response;
        }
        
        // Try to match by pathname only
        return caches.match(url.pathname)
          .then(response => {
            if (response) {
              console.log('Cache hit by pathname:', url.pathname);
              return response;
            }
            
            // Special handling for Next.js chunks and dynamic imports
            if (url.pathname.includes('/_next/') || url.pathname.includes('/chunks/') || url.pathname.endsWith('.js')) {
              console.log('Trying network for JS asset:', url.pathname);
              return fetch(event.request)
                .then(response => {
                  if (response.ok) {
                    // Cache successful responses
                    caches.open(CACHE_NAME).then(cache => {
                      cache.put(event.request, response.clone());
                    });
                    return response;
                  }
                  throw new Error('Network response not ok');
                })
                .catch(error => {
                  console.log('JS asset failed to load from network:', url.pathname, error);
                  return new Response('console.warn("Failed to load chunk: ' + url.pathname + '");', { 
                    status: 200, 
                    headers: { 'Content-Type': 'application/javascript' } 
                  });
                });
            }
            
            // For HTML requests, try common SPA routing patterns
            if (event.request.headers.get('accept')?.includes('text/html') || event.request.mode === 'navigate') {
              console.log('HTML/Navigation request, trying routing fallbacks for:', url.pathname);
              
              // Try specific page HTML first
              const pageHtml = url.pathname === '/' ? '/index.html' : url.pathname + '.html';
              return caches.match(pageHtml)
                .then(response => {
                  if (response) {
                    console.log('Found specific page:', pageHtml);
                    return response;
                  }
                  
                  // Try index.html in the same directory
                  const pathParts = url.pathname.split('/');
                  pathParts.pop(); // Remove filename
                  const dirPath = pathParts.join('/') || '';
                  const indexPath = dirPath + '/index.html';
                  
                  return caches.match(indexPath)
                    .then(response => {
                      if (response) {
                        console.log('Found directory index:', indexPath);
                        return response;
                      }
                      
                      // Fallback to root index.html for SPA routing
                      console.log('Falling back to root index.html');
                      return caches.match('/index.html')
                        .then(response => {
                          if (response) {
                            return response;
                          }
                          // Final fallback - try network
                          return fetch(event.request).catch(() => {
                            return new Response('Page not found', { status: 404 });
                          });
                        });
                    });
                });
            }
            
            // For other requests, try the network
            console.log('Trying network for:', event.request.url);
            return fetch(event.request).catch(error => {
              console.log('Network failed for:', event.request.url, error);
              return new Response('Resource not found', { status: 404 });
            });
          });
      })
  );
});
`;

    await fs.writeFile(path.join(outputDir, "sw.js"), swContent.trim());

    // Add service worker registration to index.html
    const indexPath = path.join(outputDir, "index.html");
    try {
      let indexContent = await fs.readFile(indexPath, "utf-8");
      const swScript = `
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered successfully');
        return registration.update();
      })
      .catch(error => console.log('SW registration failed:', error));
  });
}
</script>`;

      if (!indexContent.includes("serviceWorker")) {
        indexContent = indexContent.replace("</body>", swScript + "\n</body>");
        await fs.writeFile(indexPath, indexContent);
      }
    } catch (error) {
      console.log("Could not add service worker to index.html");
    }
  } catch (error) {
    console.error("❌ Failed to generate service worker:", error.message);
  }
}

// Get all files recursively
async function getAllFiles(dir) {
  const files = [];
  const items = await fs.readdir(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...(await getAllFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

// Local development server with UI integration
async function startServer(outputDir, port = 3000) {
  // Start beautiful server UI
  startServerUI(outputDir, port);

  const app = express();

  // Enable CORS for local development
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
  });

  // Serve static files
  app.use(
    express.static(outputDir, {
      setHeaders: (res, path) => {
        // Set appropriate MIME types
        if (path.endsWith(".js")) {
          res.setHeader("Content-Type", "application/javascript");
        } else if (path.endsWith(".css")) {
          res.setHeader("Content-Type", "text/css");
        } else if (path.endsWith(".html")) {
          res.setHeader("Content-Type", "text/html");
        }
      },
    })
  );

  // Handle SPA routing - catch-all for non-static files
  app.use((req, res, next) => {
    // Check if it's a request for a file (has extension)
    const hasExtension = path.extname(req.path) !== "";

    if (!hasExtension) {
      // Try to serve the specific HTML file first
      const htmlPath = path.join(outputDir, req.path + ".html");
      fs.access(htmlPath)
        .then(() => {
          res.sendFile(path.resolve(htmlPath));
        })
        .catch(() => {
          // Try directory index
          const indexPath = path.join(outputDir, req.path, "index.html");
          fs.access(indexPath)
            .then(() => {
              res.sendFile(path.resolve(indexPath));
            })
            .catch(() => {
              // Fallback to root index.html for SPA routing
              const rootIndex = path.join(outputDir, "index.html");
              fs.access(rootIndex)
                .then(() => {
                  res.sendFile(path.resolve(rootIndex));
                })
                .catch(() => {
                  res.status(404).send("Page not found");
                });
            });
        });
    } else {
      // File request that wasn't found by static middleware
      res.status(404).send("File not found");
    }
  });

  const server = createServer(app);

  server.listen(port, () => {
    // Server started successfully - UI will show the status
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    uiManager.cleanup();
    server.close(() => {
      process.exit(0);
    });
  });

  return server;
}

async function serveFolder(folder, port = 3000) {
  const app = express();

  // Enable CORS for local development
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
  });

  // serve static files
  app.use(express.static(folder));

  const server = createServer(app);

  server.listen(port, () => {
    console.log(`🚀 Serving "${folder}" at http://localhost:${port}`);
    console.log("Press CTRL+C to stop the server");
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down server...");
    server.close(() => {
      console.log("✅ Server stopped");
      process.exit(0);
    });
  });

  return server;
}

// Main CLI function
async function main() {
  const args = process.argv.slice(2);

  // Check for serve command
  if (args[0] === "--serve") {
    const outputDir = args[1] || "cloned-site";
    const port = parseInt(args[2]) || 3000;

    console.log(`🚀 Starting local server for: ${outputDir}`);
    try {
      await startServer(outputDir, port);
      // Server will run indefinitely until interrupted
    } catch (error) {
      console.error("❌ Failed to start server:", error.message);
      process.exit(1);
    }
    return; // This prevents fall-through to the cloning logic
  }

  if (!args[0]) {
    console.log(`
🕷️  Advanced Website Cloner CLI with Local Server

Usage: 
  Clone: node cloner.js <url> [output-directory] [options]
  Serve: node cloner.js --serve [directory] [port]

Clone Examples:
  node cloner.js https://piyushgarg.dev
  node cloner.js https://google.com google-clone
  node cloner.js https://hitesh.ai hitesh-clone --puppeteer
  node cloner.js https://code.visualstudio.com vscode-clone --max-pages=10

Server Examples:
  node cloner.js --serve cloned-site
  node cloner.js --serve my-site 8080

Clone Options:
  --max-pages=N     Maximum pages to crawl (default: 50)
  --puppeteer       Use Puppeteer for JS-heavy sites
  --concurrency=N   Concurrent downloads (default: 5)

Features:
✅ Multi-page crawling with smart queuing
✅ Asset downloading with fallback to original URLs
✅ Enhanced SPA routing support
✅ Service Worker for offline functionality  
✅ Built-in development server with proper routing
✅ Organized asset structure with error handling
✅ Support for JS-heavy sites via Puppeteer
✅ Image error handling and fallback display
✅ CORS support for local development

Workflow:
1. Clone: node cloner.js https://example.com my-site
2. Serve: node cloner.js --serve my-site 3000
3. Open: http://localhost:3000
`);
    process.exit(1);
  }

  if (!args[0].startsWith("http")) {
    console.error(
      "❌ Please provide a valid URL starting with http:// or https://"
    );
    process.exit(1);
  }

  // Parse options
  const options = {
    outputDir: args[1] || "cloned-site",
    maxPages: 50,
    concurrency: 5,
    usePuppeteer: false,
  };

  for (let i = 2; i < args.length; i++) {
    if (args[i].startsWith("--max-pages=")) {
      options.maxPages = parseInt(args[i].split("=")[1]) || 50;
    } else if (args[i] === "--puppeteer") {
      options.usePuppeteer = true;
    } else if (args[i].startsWith("--concurrency=")) {
      options.concurrency = parseInt(args[i].split("=")[1]) || 5;
    }
  }

  try {
    await cloneWebsite(args[0], options);
  } catch (error) {
    uiManager.cleanup();
    console.error("❌ Cloning failed:", error.message);
    process.exit(1);
  } finally {
    uiManager.cleanup();
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("❌ Unexpected error:", error.message);
    process.exit(1);
  });
}

export { cloneWebsite, downloadAsset, rewriteHtmlForOffline, startServer };
