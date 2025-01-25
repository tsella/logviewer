// src/utils/ansiParser.js
import { ANSI_COLORS, ANSI_BG_COLORS } from '../constants/theme';

export function parseAnsiString(text) {
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
        style = {};
      } else if (code === 1) {
        style.fontWeight = 'bold';
      } else if (code === 3) {
        style.fontStyle = 'italic';
      } else if (code === 4) {
        style.textDecoration = 'underline';
      } else if (ANSI_COLORS[code]) {
        style.color = ANSI_COLORS[code];
      } else if (ANSI_BG_COLORS[code]) {
        style.backgroundColor = ANSI_BG_COLORS[code];
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
