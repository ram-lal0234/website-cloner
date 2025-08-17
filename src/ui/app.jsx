import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useApp } from 'ink';
import { 
  Header, 
  ConfigDisplay, 
  ProgressTracker, 
  LiveLog, 
  Summary, 
  ErrorDisplay, 
  ServerStatus, 
  HelpDisplay 
} from './components.jsx';

// Main cloning app component
export const CloningApp = ({ 
  url, 
  config, 
  onComplete,
  onError,
  mode = 'clone' // 'clone', 'serve', or 'help'
}) => {
  const { exit } = useApp();
  const [state, setState] = useState({
    currentPage: 0,
    totalPages: 0,
    currentAsset: 0,
    totalAssets: 0,
    logs: [],
    isComplete: false,
    startTime: Date.now(),
    errors: []
  });

  // Add log entry
  const addLog = (status, url) => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, { status, url, timestamp: Date.now() }]
    }));
  };

  // Update progress
  const updateProgress = (pages, assets) => {
    setState(prev => ({
      ...prev,
      currentPage: pages.current || prev.currentPage,
      totalPages: pages.total || prev.totalPages,
      currentAsset: assets.current || prev.currentAsset,
      totalAssets: assets.total || prev.totalAssets
    }));
  };

  // Add error
  const addError = (error, url) => {
    setState(prev => ({
      ...prev,
      errors: [...prev.errors, { error, url, timestamp: Date.now() }]
    }));
  };

  // Mark as complete
  const markComplete = () => {
    setState(prev => ({
      ...prev,
      isComplete: true
    }));
  };

  // Expose methods to parent component
  useEffect(() => {
    if (onComplete) {
      onComplete({ addLog, updateProgress, addError, markComplete });
    }
  }, [onComplete]);

  const timeTaken = Math.round((Date.now() - state.startTime) / 1000);
  const successfulPages = state.logs.filter(log => log.status === 'success' && log.url.includes('html')).length;
  const failedPages = state.errors.filter(error => error.url && error.url.includes('html')).length;
  const successfulAssets = state.logs.filter(log => log.status === 'success' && !log.url.includes('html')).length;
  const failedAssets = state.errors.filter(error => error.url && !error.url.includes('html')).length;

  if (mode === 'help') {
    return <HelpDisplay />;
  }

  if (mode === 'serve') {
    return (
      <Box flexDirection="column">
        <Header title="🌐 Server" subtitle="Local Development Server" />
        <ServerStatus 
          port={config.port} 
          outputDir={config.outputDir} 
          isRunning={true} 
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Header title="🕷️ Cloner" subtitle={`Cloning ${url}`} />
      
      <ConfigDisplay config={config} />
      
      <ProgressTracker
        currentPage={state.currentPage}
        totalPages={state.totalPages}
        currentAsset={state.currentAsset}
        totalAssets={state.totalAssets}
        isComplete={state.isComplete}
      />

      <LiveLog logs={state.logs} />

      {state.errors.map((error, index) => (
        <ErrorDisplay key={index} error={error.error} url={error.url} />
      ))}

      {state.isComplete && (
        <Summary
          totalPages={state.totalPages}
          totalAssets={state.totalAssets}
          outputDir={config.outputDir}
          timeTaken={timeTaken}
          successfulPages={successfulPages}
          failedPages={failedPages}
          successfulAssets={successfulAssets}
          failedAssets={failedAssets}
        />
      )}
    </Box>
  );
};

// Simple server app component
export const ServerApp = ({ outputDir, port }) => {
  return (
    <Box flexDirection="column">
      <Header title="🌐 Server" subtitle="Local Development Server" />
      <ServerStatus 
        port={port} 
        outputDir={outputDir} 
        isRunning={true} 
      />
    </Box>
  );
};

// Help app component
export const HelpApp = () => {
  return <HelpDisplay />;
}; 