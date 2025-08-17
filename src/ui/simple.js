import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';

// Simple help component using React.createElement
export const SimpleHelpApp = () => {
  return React.createElement(Box, { flexDirection: 'column', padding: 1 },
    React.createElement(Gradient, { name: 'rainbow' },
      React.createElement(BigText, { text: 'Website Cloner' })
    ),
    React.createElement(Text, { color: 'cyan', bold: true }, '🕷️  Advanced Website Cloner CLI'),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'yellow', bold: true }, 'Usage:')
    ),
    React.createElement(Box, { marginLeft: 2 },
      React.createElement(Text, null, 'Clone: ', 
        React.createElement(Text, { color: 'green' }, 'node cloner.js <url> [output-directory] [options]')
      )
    ),
    React.createElement(Box, { marginLeft: 2 },
      React.createElement(Text, null, 'Serve: ',
        React.createElement(Text, { color: 'green' }, 'node cloner.js --serve [directory] [port]')
      )
    ),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'yellow', bold: true }, 'Quick Commands:')
    ),
    React.createElement(Box, { marginLeft: 2 },
      React.createElement(Text, null, '• ',
        React.createElement(Text, { color: 'green' }, 'npm run clone:piyush'),
        ' - Clone piyushgarg.dev'
      )
    ),
    React.createElement(Box, { marginLeft: 2 },
      React.createElement(Text, null, '• ',
        React.createElement(Text, { color: 'green' }, 'npm run clone:hitesh'),
        ' - Clone hitesh.ai'
      )
    ),
    React.createElement(Box, { marginLeft: 2 },
      React.createElement(Text, null, '• ',
        React.createElement(Text, { color: 'green' }, 'npm run serve:piyush'),
        ' - Serve cloned site'
      )
    ),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'yellow', bold: true }, '✨ Features:')
    ),
    React.createElement(Box, { marginLeft: 2 },
      React.createElement(Text, null, '✅ Multi-page crawling with smart queuing')
    ),
    React.createElement(Box, { marginLeft: 2 },
      React.createElement(Text, null, '✅ Enhanced SPA routing support')
    ),
    React.createElement(Box, { marginLeft: 2 },
      React.createElement(Text, null, '✅ Built-in development server')
    )
  );
};

// Simple server status component
export const SimpleServerApp = ({ outputDir, port }) => {
  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Gradient, { name: 'rainbow' },
      React.createElement(BigText, { text: 'Server' })
    ),
    React.createElement(Box, { borderStyle: 'round', borderColor: 'green', padding: 1, marginTop: 1 },
      React.createElement(Box, null,
        React.createElement(Spinner, { type: 'dots' }),
        React.createElement(Text, { color: 'green', bold: true }, ' 🚀 Server Status')
      ),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, null, '📍 ',
          React.createElement(Text, { color: 'cyan' }, 'Address: '),
          React.createElement(Text, { color: 'yellow' }, `http://localhost:${port}`)
        )
      ),
      React.createElement(Box, null,
        React.createElement(Text, null, '📁 ',
          React.createElement(Text, { color: 'cyan' }, 'Serving: '),
          React.createElement(Text, { color: 'yellow' }, outputDir)
        )
      ),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { color: 'cyan', bold: true }, `🌐 Open http://localhost:${port} in your browser`)
      ),
      React.createElement(Box, null,
        React.createElement(Text, { color: 'gray' }, '⏹️  Press Ctrl+C to stop the server')
      )
    )
  );
};

// Simple cloning status component
export const SimpleCloningApp = ({ url, config, onComplete }) => {
  const [logs, setLogs] = React.useState([]);
  const [progress, setProgress] = React.useState({ pages: 0, assets: 0 });
  const [isComplete, setIsComplete] = React.useState(false);

  React.useEffect(() => {
    if (onComplete) {
      onComplete({
        addLog: (status, url) => {
          setLogs(prev => [...prev.slice(-5), { status, url, time: Date.now() }]);
        },
        updateProgress: (pages, assets) => {
          setProgress({ 
            pages: pages.current || 0, 
            assets: assets.current || 0 
          });
        },
        markComplete: () => setIsComplete(true)
      });
    }
  }, [onComplete]);

  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Gradient, { name: 'rainbow' },
      React.createElement(BigText, { text: 'Cloner' })
    ),
    React.createElement(Text, { color: 'cyan', bold: true }, `Cloning ${url}`),
    
    React.createElement(Box, { borderStyle: 'round', borderColor: 'blue', padding: 1, marginY: 1 },
      React.createElement(Text, { color: 'blue', bold: true }, '⚙️  Configuration:'),
      React.createElement(Box, { marginLeft: 2 },
        React.createElement(Text, null, '📁 Output: ',
          React.createElement(Text, { color: 'yellow' }, config.outputDir)
        )
      ),
      React.createElement(Box, { marginLeft: 2 },
        React.createElement(Text, null, '📄 Max Pages: ',
          React.createElement(Text, { color: 'yellow' }, config.maxPages)
        )
      )
    ),

    React.createElement(Box, { borderStyle: 'round', borderColor: 'green', padding: 1, marginY: 1 },
      React.createElement(Text, { color: 'green', bold: true }, '📊 Progress:'),
      React.createElement(Box, { marginLeft: 2 },
        React.createElement(Text, null, `Pages: ${progress.pages} | Assets: ${progress.assets}`)
      )
    ),

    React.createElement(Box, { borderStyle: 'single', borderColor: 'gray', padding: 1, height: 8 },
      React.createElement(Text, { color: 'gray', bold: true }, '📋 Activity Log:'),
      ...logs.slice(-5).map((log, i) => 
        React.createElement(Box, { key: i },
          React.createElement(Text, { color: log.status === 'success' ? 'green' : 'yellow' },
            log.status === 'success' ? '✅' : '⬇️'
          ),
          React.createElement(Text, { dimColor: true }, ` ${log.url.slice(0, 60)}...`)
        )
      )
    ),

    isComplete && React.createElement(Box, { borderStyle: 'double', borderColor: 'green', padding: 1, marginTop: 1 },
      React.createElement(Gradient, { name: 'rainbow' },
        React.createElement(Text, { bold: true }, '🎉 Cloning Completed!')
      ),
      React.createElement(Text, { color: 'cyan' }, 'Your site is ready to serve!')
    )
  );
}; 