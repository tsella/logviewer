// src/components/LogViewer.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { THEME } from '../constants/theme';
import LogEntry from './LogEntry';
import SourceSelector from './SourceSelector';
import StatusBar from './StatusBar';

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

  useEffect(() => {
    fetchSources();
    pollIntervalRef.current = setInterval(fetchSources, 10000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

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
        
        <SourceSelector
          sources={sources}
          selectedSource={selectedSource}
          onSourceSelect={setSelectedSource}
          onConnect={connectToLogs}
        />

        <StatusBar
          error={error}
          isConnected={isConnected}
          selectedSource={selectedSource}
          autoScroll={autoScroll}
        />

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
      </div>
    </>
  );
};

export default LogViewer;
