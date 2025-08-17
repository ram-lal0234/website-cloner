import React, { useState, useEffect } from 'react';
import { Box, Text, Static, Newline } from 'ink';
import Spinner from 'ink-spinner';
import ProgressBar from 'ink-progress-bar';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';

// Main header component with gradient effect
export const Header = ({ title, subtitle }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Gradient name="rainbow">
      <BigText text={title} />
    </Gradient>
    {subtitle && (
      <Box marginTop={1}>
        <Text color="cyan" bold>
          {subtitle}
        </Text>
      </Box>
    )}
  </Box>
);

// Configuration display component
export const ConfigDisplay = ({ config }) => (
  <Box flexDirection="column" borderStyle="round" borderColor="blue" padding={1} marginBottom={1}>
    <Text color="blue" bold>⚙️  Configuration:</Text>
    <Box marginLeft={2}>
      <Text>📁 Output Directory: <Text color="yellow">{config.outputDir}</Text></Text>
    </Box>
    <Box marginLeft={2}>
      <Text>📄 Max Pages: <Text color="yellow">{config.maxPages}</Text></Text>
    </Box>
    <Box marginLeft={2}>
      <Text>🚀 Concurrency: <Text color="yellow">{config.concurrency}</Text></Text>
    </Box>
    <Box marginLeft={2}>
      <Text>🤖 Use Puppeteer: <Text color="yellow">{config.usePuppeteer ? "Yes" : "No"}</Text></Text>
    </Box>
  </Box>
);

// Progress tracking component
export const ProgressTracker = ({ 
  currentPage, 
  totalPages, 
  currentAsset, 
  totalAssets, 
  isComplete = false 
}) => {
  const pageProgress = totalPages > 0 ? currentPage / totalPages : 0;
  const assetProgress = totalAssets > 0 ? currentAsset / totalAssets : 0;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" padding={1} marginBottom={1}>
      <Text color="green" bold>📊 Progress Tracker</Text>
      
      <Box marginTop={1}>
        <Box width={20}>
          <Text>Pages:</Text>
        </Box>
        <Box width={30}>
          <ProgressBar percent={pageProgress} />
        </Box>
        <Box marginLeft={2}>
          <Text color={isComplete ? "green" : "yellow"}>
            {currentPage}/{totalPages}
          </Text>
        </Box>
      </Box>

      <Box>
        <Box width={20}>
          <Text>Assets:</Text>
        </Box>
        <Box width={30}>
          <ProgressBar percent={assetProgress} />
        </Box>
        <Box marginLeft={2}>
          <Text color={isComplete ? "green" : "yellow"}>
            {currentAsset}/{totalAssets}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

// Status indicator component
export const StatusIndicator = ({ status, url, isSpinning = false }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'processing': return 'blue';
      case 'downloading': return 'yellow';
      case 'success': return 'green';
      case 'error': return 'red';
      case 'warning': return 'orange';
      default: return 'white';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing': return '📄';
      case 'downloading': return '⬇️';
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return '🔄';
    }
  };

  return (
    <Box>
      {isSpinning && <Spinner type="dots" />}
      <Text color={getStatusColor(status)}>
        {!isSpinning && getStatusIcon(status)} {status === 'processing' ? 'Processing' : 
         status === 'downloading' ? 'Downloading' :
         status === 'success' ? 'Downloaded' :
         status === 'error' ? 'Failed' :
         status === 'warning' ? 'Warning' : 'Processing'}: 
      </Text>
      <Text dimColor> {url}</Text>
    </Box>
  );
};

// Live log component for real-time updates
export const LiveLog = ({ logs = [] }) => {
  const recentLogs = logs.slice(-10); // Show only last 10 logs

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1} height={12}>
      <Text color="gray" bold>📋 Live Activity Log</Text>
      <Box flexDirection="column" marginTop={1}>
        {recentLogs.map((log, index) => (
          <StatusIndicator 
            key={index} 
            status={log.status} 
            url={log.url}
            isSpinning={log.status === 'processing' && index === recentLogs.length - 1}
          />
        ))}
      </Box>
    </Box>
  );
};

// Summary component for completion
export const Summary = ({ 
  totalPages, 
  totalAssets, 
  outputDir, 
  timeTaken,
  successfulPages,
  failedPages,
  successfulAssets,
  failedAssets
}) => (
  <Box flexDirection="column" borderStyle="double" borderColor="green" padding={2} marginTop={1}>
    <Gradient name="rainbow">
      <Text bold>🎉 Cloning Completed Successfully!</Text>
    </Gradient>
    
    <Box flexDirection="column" marginTop={1}>
      <Text>📁 <Text color="cyan">Output Directory:</Text> <Text color="yellow">{outputDir}</Text></Text>
      <Text>⏱️  <Text color="cyan">Time Taken:</Text> <Text color="yellow">{timeTaken}s</Text></Text>
      <Text>📄 <Text color="cyan">Pages:</Text> <Text color="green">{successfulPages}</Text> successful, <Text color="red">{failedPages}</Text> failed</Text>
      <Text>📦 <Text color="cyan">Assets:</Text> <Text color="green">{successfulAssets}</Text> successful, <Text color="red">{failedAssets}</Text> failed</Text>
    </Box>

    <Box flexDirection="column" marginTop={1}>
      <Text color="cyan" bold>Next steps:</Text>
      <Text>1. Start the server: <Text color="yellow">node cloner.js --serve {outputDir}</Text></Text>
      <Text>2. Open your browser: <Text color="yellow">http://localhost:3000</Text></Text>
      <Text>3. Your cloned site is ready to use!</Text>
    </Box>
  </Box>
);

// Error display component
export const ErrorDisplay = ({ error, url }) => (
  <Box borderStyle="round" borderColor="red" padding={1} marginY={1}>
    <Text color="red" bold>❌ Error:</Text>
    <Text color="red"> {error}</Text>
    {url && <Text dimColor> URL: {url}</Text>}
  </Box>
);

// Server status component
export const ServerStatus = ({ port, outputDir, isRunning = false }) => (
  <Box flexDirection="column" borderStyle="round" borderColor="green" padding={1}>
    <Box>
      <Spinner type="dots" />
      <Text color="green" bold> 🚀 Server Status</Text>
    </Box>
    
    <Box marginTop={1}>
      <Text>📍 <Text color="cyan">Address:</Text> <Text color="yellow">http://localhost:{port}</Text></Text>
      <Text>📁 <Text color="cyan">Serving:</Text> <Text color="yellow">{outputDir}</Text></Text>
      <Text>🔄 <Text color="cyan">Status:</Text> <Text color={isRunning ? "green" : "red"}>{isRunning ? "Running" : "Stopped"}</Text></Text>
    </Box>

    <Box marginTop={1}>
      <Text color="cyan" bold>🌐 Open http://localhost:{port} in your browser</Text>
    </Box>
    <Box>
      <Text color="gray">⏹️  Press Ctrl+C to stop the server</Text>
    </Box>
  </Box>
);

// Help display component
export const HelpDisplay = () => (
  <Box flexDirection="column" padding={1}>
    <Gradient name="rainbow">
      <BigText text="Website Cloner" />
    </Gradient>
    
    <Text color="cyan" bold>🕷️  Advanced Website Cloner CLI with Local Server</Text>
    
    <Box marginTop={1}>
      <Text color="yellow" bold>Usage:</Text>
    </Box>
    <Box marginLeft={2}>
      <Text>Clone: <Text color="green">node cloner.js &lt;url&gt; [output-directory] [options]</Text></Text>
      <Text>Serve: <Text color="green">node cloner.js --serve [directory] [port]</Text></Text>
    </Box>

    <Box marginTop={1}>
      <Text color="yellow" bold>Quick Commands:</Text>
    </Box>
    <Box marginLeft={2}>
      <Text>• <Text color="green">npm run clone:piyush</Text> - Clone piyushgarg.dev</Text>
      <Text>• <Text color="green">npm run clone:hitesh</Text> - Clone hitesh.ai</Text>
      <Text>• <Text color="green">npm run clone:vscode</Text> - Clone VS Code site</Text>
      <Text>• <Text color="green">npm run serve:piyush</Text> - Serve cloned site</Text>
    </Box>

    <Box marginTop={1}>
      <Text color="yellow" bold>Options:</Text>
    </Box>
    <Box marginLeft={2}>
      <Text>--max-pages=N     Maximum pages to crawl (default: 50)</Text>
      <Text>--puppeteer       Use Puppeteer for JS-heavy sites</Text>
      <Text>--concurrency=N   Concurrent downloads (default: 5)</Text>
    </Box>

    <Box marginTop={1}>
      <Text color="yellow" bold>✨ Features:</Text>
    </Box>
    <Box marginLeft={2}>
      <Text>✅ Multi-page crawling with smart queuing</Text>
      <Text>✅ Asset downloading with fallback to original URLs</Text>
      <Text>✅ Enhanced SPA routing support</Text>
      <Text>✅ Service Worker for offline functionality</Text>
      <Text>✅ Built-in development server with proper routing</Text>
      <Text>✅ Support for JS-heavy sites via Puppeteer</Text>
    </Box>
  </Box>
); 