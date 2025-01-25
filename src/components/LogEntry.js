// src/components/LogEntry.jsx
import React from 'react';
import { parseAnsiString } from '../utils/ansiParser';
import { THEME } from '../constants/theme';

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

export default LogEntry;
