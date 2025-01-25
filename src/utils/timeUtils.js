// src/utils/timeUtils.js
export function formatTimestamp(timestamp) {
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
}
