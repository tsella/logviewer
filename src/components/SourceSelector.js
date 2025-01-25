// src/components/SourceSelector.jsx
import React from 'react';
import { THEME } from '../constants/theme';

const SourceSelector = ({ 
  sources, 
  selectedSource, 
  onSourceSelect, 
  onConnect 
}) => {
  return (
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
            onSourceSelect(source);
          } else {
            onSourceSelect(null);
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
        onClick={onConnect}
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
  );
};

export default SourceSelector;
