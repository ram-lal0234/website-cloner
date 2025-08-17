import React from 'react';
import { render } from 'ink';
import { SimpleCloningApp, SimpleServerApp, SimpleHelpApp } from './simple.js';

// UI Manager class to handle all UI interactions
export class UIManager {
  constructor() {
    this.app = null;
    this.unmount = null;
    this.uiCallbacks = null;
  }

  // Start cloning UI
  startCloning(url, config) {
    return new Promise((resolve, reject) => {
      try {
        const { unmount } = render(
          React.createElement(SimpleCloningApp, {
            url: url,
            config: config,
            mode: "clone",
            onComplete: (callbacks) => {
              this.uiCallbacks = callbacks;
              resolve(callbacks);
            },
            onError: reject
          })
        );
        
        this.unmount = unmount;

        // Provide fallback methods immediately in case of errors
        const fallbackUI = {
          addLog: (status, url) => console.log(`${status}: ${url}`),
          updateProgress: (pages, assets) => console.log(`Progress: ${pages.current || 0} pages, ${assets.current || 0} assets`),
          addError: (error, url) => console.error(`Error: ${error} - ${url}`),
          markComplete: () => console.log('✅ Cloning completed!'),
          logProcessing: (url) => console.log(`📄 Processing: ${url}`),
          logDownloading: (url) => console.log(`⬇️ Downloading: ${url}`),
          logSuccess: (url) => console.log(`✅ Downloaded: ${url}`),
          logError: (error, url) => console.error(`❌ Error: ${error} - ${url}`),
          logWarning: (message, url) => console.warn(`⚠️ Warning: ${message} - ${url}`)
        };

        // Set fallbacks immediately
        this.uiCallbacks = fallbackUI;
        
        // Resolve with fallbacks immediately, will be replaced when onComplete fires
        resolve(fallbackUI);
        
      } catch (error) {
        console.error('Failed to initialize UI, falling back to console:', error.message);
        // Provide console fallbacks
        const consoleUI = {
          addLog: (status, url) => console.log(`${status}: ${url}`),
          updateProgress: (pages, assets) => console.log(`Progress: ${pages.current || 0} pages, ${assets.current || 0} assets`),
          addError: (error, url) => console.error(`Error: ${error} - ${url}`),
          markComplete: () => console.log('✅ Cloning completed!'),
          logProcessing: (url) => console.log(`📄 Processing: ${url}`),
          logDownloading: (url) => console.log(`⬇️ Downloading: ${url}`),
          logSuccess: (url) => console.log(`✅ Downloaded: ${url}`),
          logError: (error, url) => console.error(`❌ Error: ${error} - ${url}`),
          logWarning: (message, url) => console.warn(`⚠️ Warning: ${message} - ${url}`)
        };
        resolve(consoleUI);
      }
    });
  }

  // Start server UI
  startServer(outputDir, port) {
    const { unmount } = render(
      React.createElement(SimpleServerApp, {
        outputDir: outputDir,
        port: port
      })
    );
    
    this.unmount = unmount;
  }

  // Show help UI
  showHelp() {
    const { unmount } = render(React.createElement(SimpleHelpApp));
    this.unmount = unmount;
  }

  // UI callback methods
  logProcessing(url) {
    if (this.uiCallbacks) {
      this.uiCallbacks.addLog('processing', url);
    }
  }

  logDownloading(url) {
    if (this.uiCallbacks) {
      this.uiCallbacks.addLog('downloading', url);
    }
  }

  logSuccess(url) {
    if (this.uiCallbacks) {
      this.uiCallbacks.addLog('success', url);
    }
  }

  logError(error, url) {
    if (this.uiCallbacks) {
      this.uiCallbacks.addError(error, url);
    }
  }

  logWarning(message, url) {
    if (this.uiCallbacks) {
      this.uiCallbacks.addLog('warning', url || message);
    }
  }

  updateProgress(pages = {}, assets = {}) {
    if (this.uiCallbacks) {
      this.uiCallbacks.updateProgress(pages, assets);
    }
  }

  markComplete() {
    if (this.uiCallbacks) {
      this.uiCallbacks.markComplete();
    }
  }

  // Clean up
  cleanup() {
    if (this.unmount) {
      this.unmount();
      this.unmount = null;
    }
    this.uiCallbacks = null;
  }
}

// Global UI manager instance
export const uiManager = new UIManager();

// Helper functions for easier integration
export const startCloningUI = (url, config) => uiManager.startCloning(url, config);
export const startServerUI = (outputDir, port) => uiManager.startServer(outputDir, port);
export const showHelpUI = () => uiManager.showHelp();

// Legacy console methods for backward compatibility
export const legacyConsole = {
  log: (...args) => console.log(...args),
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args)
}; 