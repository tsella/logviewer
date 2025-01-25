// src/components/StatusBar.jsx
import React from 'react';
import { THEME } from '../constants/theme';

const StatusBar = ({ error, isConnected, selectedSource, autoScroll }) => {
  return (
    <>
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

      <div style={{
        textAlign: 'right',
        marginTop: '5px',
        fontSize: '9pt',
        color: autoScroll ? THEME.success : THEME.muted
      }}>
        {autoScroll ? 'Auto-scrolling' : 'Scroll paused'}
      </div>
    </>
  );
};

export default StatusBar;
