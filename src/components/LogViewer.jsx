// LogViewer.js
import React, { useState, useEffect, useRef, useCallback } from 'react';

const THEME = {
  background: '#1e1e1e',
  border: '#3d3d3d',
  text: '#e5e5e5',
  success: '#23d18b',
  error: '#f14c4c',
  muted: '#666666',
  highlight: '#11a8cd',
  control: '#2d2d2d'
};

// ANSI color codes
const COLORS = {
  0: 'inherit',   // Reset
  30: '#000000', // Black
  31: '#cd3131', // Red
  32: '#0dbc79', // Green
  33: '#e5e510', // Yellow
  34: '#2472c8', // Blue
  35: '#bc3fbc', // Magenta
  36: '#11a8cd', // Cyan
  37: '#e5e5e5', // White
  90: '#666666', // Bright Black
  91: '#f14c4c', // Bright Red
  92: '#23d18b', // Bright Green
  93: '#f5f543', // Bright Yellow
  94: '#3b8eea', // Bright Blue
  95: '#d670d6', // Bright Magenta
  96: '#29b8db', // Bright Cyan
  97: '#ffffff'  // Bright White
};

const BG_COLORS = {
  40: '#000000', // Black
  41: '#cd3131', // Red
  42: '#0dbc79', // Green
  43: '#e5e510', // Yellow
  44: '#2472c8', // Blue
  45: '#bc3fbc', // Magenta
  46: '#11a8cd', // Cyan
  47: '#e5e5e5', // White
  100: '#666666', // Bright Black
  101: '#f14c4c', // Bright Red
  102: '#23d18b', // Bright Green
  103: '#f5f543', // Bright Yellow
  104: '#3b8eea', // Bright Blue
  105: '#d670d6', // Bright Magenta
  106: '#29b8db', // Bright Cyan
  107: '#ffffff'  // Bright White
};

function parseAnsiString(text) {
  const result = [];
  let currentSpan = { text: '', style: {} };
  let buffer = '';
  let inEscape = false;
  let escapeCode = '';

  function pushCurrentSpan() {
    if (currentSpan.text) {
      result.push({ ...currentSpan });
      currentSpan = { text: '', style: { ...currentSpan.style } };
    }
  }

  function processEscapeCode(code) {
    const codes = code.split(';').map(num => parseInt(num, 10));
    let style = { ...currentSpan.style };

    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      
      if (code === 0) {
        // Reset all attributes
        style = {};
      } else if (code === 1) {
        style.fontWeight = 'bold';
      } else if (code === 3) {
        style.fontStyle = 'italic';
      } else if (code === 4) {
        style.textDecoration = 'underline';
      } else if (COLORS[code]) {
        style.color = COLORS[code];
      } else if (BG_COLORS[code]) {
        style.backgroundColor = BG_COLORS[code];
      }
    }

    return style;
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '\x1b') {
      inEscape = true;
      escapeCode = '';
      continue;
    }

    if (inEscape) {
      if (char === '[') {
        continue;
      }

      if (char === 'm') {
        inEscape = false;
        if (buffer) {
          currentSpan.text = buffer;
          pushCurrentSpan();
          buffer = '';
        }
        currentSpan.style = processEscapeCode(escapeCode);
        continue;
      }

      escapeCode += char;
      continue;
    }

    buffer += char;
  }

  if (buffer) {
    currentSpan.text = buffer;
    pushCurrentSpan();
  }

  return result;
}

const LogEntry = React.memo(({ timestamp, identifier, message }) => {
  const parsedSegments = parseAnsiString(message);
  
  return (
    <div style={{
      borderBottom: `1px solid ${THEME.border}`,
      padding: '2px 0',
      lineHeight: '1.2'
    }}>
      <span style={{ color: THEME.muted }}>
        {timestamp}
      </span>
      {' '}
      <span style={{ color: THEME.highlight }}>[{identifier}]</span>
      {' '}
      <span>
        {parsedSegments.map((segment, index) => (
          <span 
            key={index} 
            style={{
              ...segment.style,
              fontFamily: 'monospace'
            }}
          >
            {segment.text}
          </span>
        ))}
      </span>
    </div>
  );
});

const LogViewer = () => {
  const [sources, setSources] = useState({ daemons: [], containers: [] });
  const [selectedSource, setSelectedSource] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef(null);
  const logsDivRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const userScrolledRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const pollIntervalRef = useRef(null);

  // Fetch available sources
  const fetchSources = async () => {
    try {
      const response = await fetch('/api/sources');
      if (!response.ok) throw new Error('Failed to fetch sources');
      const data = await response.json();
      setSources(data);
    } catch (err) {
      setError('Failed to load available sources');
      console.error('Error fetching sources:', err);
    }
  };

  // Initialize sources polling
  useEffect(() => {
    fetchSources();
    pollIntervalRef.current = setInterval(fetchSources, 10000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Scroll handling
  const handleScroll = useCallback((e) => {
    const element = e.target;
    const { scrollTop, scrollHeight, clientHeight } = element;
    
    if (scrollTop < lastScrollTopRef.current) {
      userScrolledRef.current = true;
      setAutoScroll(false);
    }
    
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    if (isAtBottom) {
      userScrolledRef.current = false;
      setAutoScroll(true);
    }
    
    lastScrollTopRef.current = scrollTop;
  }, []);

  useEffect(() => {
    const logsDiv = logsDivRef.current;
    if (logsDiv) {
      logsDiv.addEventListener('scroll', handleScroll);
      return () => logsDiv.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    if (autoScroll && logsDivRef.current) {
      logsDivRef.current.scrollTop = logsDivRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Handle source selection and log streaming
  useEffect(() => {
    if (!selectedSource) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setIsConnected(false);
      }
      return;
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    setLogs([]);
    setError(null);
    setAutoScroll(true);
    userScrolledRef.current = false;
    
    const eventSource = new EventSource(`/api/logs/${selectedSource.type}/${selectedSource.id}`);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const logEntry = JSON.parse(event.data);
        setLogs(prevLogs => [...prevLogs.slice(-999), logEntry]);
      } catch (err) {
        console.error('Error parsing log entry:', err);
      }
    };
    
    eventSource.onerror = (event) => {
      console.error('EventSource error:', event);
      setIsConnected(false);
      setError('Connection lost. Retrying...');
    };
    
    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [selectedSource]);
  
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    try {
      const milliseconds = Math.floor(parseInt(timestamp) / 1000);
      const date = new Date(milliseconds);
      
      if (isNaN(date.getTime())) {
        return 'Invalid timestamp';
      }
      
      return date.toISOString()
        .replace('T', ' ')
        .replace('Z', '')
        .split('.')[0];
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Invalid timestamp';
    }
  };

  const connectToLogs = () => {
    if (!selectedSource) {
      setError('Please select a source');
      return;
    }
    setLogs([]);
    setAutoScroll(true);
    userScrolledRef.current = false;
  };

  return (
    <>
      <style>
        {`
          body {
            background: ${THEME.background};
            margin: 0;
            padding: 0;
          }
        `}
      </style>
      <div style={{ 
        maxWidth: '90%', 
        margin: '0 auto', 
        padding: '20px', 
        fontFamily: 'monospace',
        color: THEME.text,
        background: THEME.background,
        minHeight: '100vh'
      }}>
        <h1 style={{ 
          fontSize: '16px', 
          marginBottom: '20px',
          color: THEME.text
        }}>
          Log Stream Viewer
        </h1>
        
        <div style={{ margin: '20px 0' }}>
          <select
            style={{
              padding: '8px',
              marginRight: '10px',
              fontFamily: 'monospace',
              fontSize: '9pt',
              minWidth: '400px',
              background: THEME.control,
              color: THEME.text,
              border: `1px solid ${THEME.border}`,
              borderRadius: '4px'
            }}
            onChange={(e) => {
              if (e.target.value) {
                const [type, id] = e.target.value.split(':');
                const source = type === 'systemd' 
                  ? sources.daemons.find(d => d.id === id)
                  : sources.containers.find(c => c.id === id);
                setSelectedSource(source);
              } else {
                setSelectedSource(null);
              }
            }}
            value={selectedSource ? `${selectedSource.type}:${selectedSource.id}` : ''}
          >
            <option value="">Select a source</option>
            <optgroup label="Systemd Services">
              {sources.daemons.map(daemon => (
                <option key={`systemd:${daemon.id}`} value={`systemd:${daemon.id}`}>
                  {daemon.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Docker Containers">
              {sources.containers.map(container => (
                <option key={`docker:${container.id}`} value={`docker:${container.id}`}>
                  {container.name} ({container.status})
                </option>
              ))}
            </optgroup>
          </select>
          <button
            onClick={connectToLogs}
            style={{
              padding: '8px 16px',
              fontFamily: 'monospace',
              fontSize: '9pt',
              background: THEME.control,
              color: THEME.text,
              border: `1px solid ${THEME.border}`,
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            Connect
          </button>
        </div>

        {error && (
          <div style={{
            color: THEME.error,
            marginBottom: '10px',
            fontFamily: 'monospace',
            fontSize: '9pt'
          }}>
            {error}
          </div>
        )}

        {isConnected && (
          <div style={{
            color: THEME.success,
            marginBottom: '10px',
            fontFamily: 'monospace',
            fontSize: '9pt'
          }}>
            Connected to {selectedSource?.name} ({selectedSource?.type})
          </div>
        )}

        <div
          ref={logsDivRef}
          style={{
            height: '700px',
            overflowY: 'auto',
            background: THEME.background,
            padding: '10px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '9pt',
            whiteSpace: 'pre-wrap',
            width: '100%',
            margin: '0 auto',
            border: `1px solid ${THEME.border}`
          }}
        >
          {logs.map((log, index) => (
            <LogEntry
              key={`${log.timestamp}-${index}`}
              timestamp={formatTimestamp(log.timestamp)}
              identifier={log.syslogIdentifier || 'system'}
              message={log.message}
            />
          ))}
        </div>

        <div style={{
          textAlign: 'right',
          marginTop: '5px',
          fontSize: '9pt',
          color: autoScroll ? THEME.success : THEME.muted
        }}>
          {autoScroll ? 'Auto-scrolling' : 'Scroll paused'}
        </div>
      </div>
    </>
  );
};

export default LogViewer;
