// server.js
import express from 'express';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HEARTBEAT_INTERVAL = process.env.HEARTBEAT_INTERVAL || 3000;
const MAX_LOG_LINES = process.env.MAX_LOG_LINES || 1000;


// Configuration for systemd daemons
const ALLOWED_DAEMONS = process.env.ALLOWED_DAEMONS
  ? process.env.ALLOWED_DAEMONS.split(',').map(d => d.trim())
  : [];

// Track active processes
const activeProcesses = new Map();

// Validate systemd daemon name
const validateDaemon = (req, res, next) => {
  const { daemon } = req.params;
  
  if (!daemon) {
    return res.status(400).json({ error: 'Daemon name is required' });
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(daemon)) {
    return res.status(400).json({ error: 'Invalid daemon name format' });
  }
  
  if (!ALLOWED_DAEMONS.includes(daemon)) {
    return res.status(403).json({ error: 'Daemon not in allowed list' });
  }
  
  next();
};

// Get list of docker containers
async function getDockerContainers() {
  return new Promise((resolve, reject) => {
    const docker = spawn('docker', ['ps', '--format', '{{.ID}}\t{{.Names}}\t{{.Status}}']);
    let output = '';
    
    docker.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    docker.stderr.on('data', (data) => {
      console.error(`Docker Error: ${data}`);
    });
    
    docker.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('Failed to get container list'));
        return;
      }
      
      const containers = output.trim().split('\n').map(line => {
        const [id, name, status] = line.split('\t');
        return { id, name, status };
      });
      
      resolve(containers);
    });
  });
}

// Serve static files
app.use(express.static(path.join(process.cwd(), 'dist')));

// Get list of available sources (daemons and containers)
app.get('/api/sources', async (req, res) => {
  try {
    const containers = await getDockerContainers();
    res.json({
      daemons: ALLOWED_DAEMONS.map(name => ({
        type: 'systemd',
        id: name,
        name: name
      })),
      containers: containers.map(c => ({
        type: 'docker',
        id: c.id,
        name: c.name,
        status: c.status
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sources' });
  }
});

// Stream logs for a specific source
app.get('/api/logs/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  
  // Validate source type
  if (!['systemd', 'docker'].includes(type)) {
    return res.status(400).json({ error: 'Invalid source type' });
  }
  
  // For systemd, validate daemon name
  if (type === 'systemd') {
    if (!ALLOWED_DAEMONS.includes(id)) {
      return res.status(403).json({ error: 'Daemon not allowed' });
    }
  }
  
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  
  // Handle client disconnect
  const heartbeat = setInterval(() => {
    res.write(':\n\n');
  }, HEARTBEAT_INTERVAL);

  // Start appropriate log process
  let logProcess;
  if (type === 'systemd') {
    logProcess = spawn('journalctl', [
      '-u', id,
      '-f',
      '-n', MAX_LOG_LINES,
      '-o', 'json',
      '--no-pager'
    ]);
  } else {
    logProcess = spawn('docker', ['logs', '-f', '--tail', MAX_LOG_LINES, id]);
  }
  
  // Set process priority
  process.nextTick(() => {
    spawn('renice', ['-n', '-20', logProcess.pid.toString()]);
  });

  // Buffer for incomplete lines
  let buffer = '';
  
  // Handle process errors
  logProcess.on('error', (error) => {
    console.error(`Error spawning ${type} logs for ${id}:`, error);
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Failed to start log streaming' })}\n\n`);
    cleanup();
  });
  
  // Stream stdout
  logProcess.stdout.on('data', (data) => {
    buffer += data.toString();
    
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      
      try {
        if (type === 'systemd') {
          const logEntry = JSON.parse(line);
          const formattedEntry = {
            timestamp: logEntry.__REALTIME_TIMESTAMP,
            message: logEntry.MESSAGE,
            priority: logEntry.PRIORITY,
            syslogIdentifier: logEntry.SYSLOG_IDENTIFIER
          };
          res.write(`data: ${JSON.stringify(formattedEntry)}\n\n`);
        } else {
          const timestamp = Date.now() * 1000; // Use current time in microseconds
          res.write(`data: ${JSON.stringify({
            timestamp: timestamp.toString(),
            message: line,
            priority: 6, // Default to INFO level
            syslogIdentifier: id.slice(0, 12) // Use container ID short form
          })}\n\n`);
        }
      } catch (error) {
        console.error('Error parsing log output:', error);
        res.write(`data: ${JSON.stringify({ 
          timestamp: (Date.now() * 1000).toString(),
          message: line,
          priority: 6
        })}\n\n`);
      }
    }
  });
  
  // Handle stderr
  logProcess.stderr.on('data', (data) => {
    console.error(`${type} stderr for ${id}:`, data.toString());
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Error reading logs' })}\n\n`);
  });
  
  // Cleanup function
  const cleanup = () => {
    clearInterval(heartbeat);
    if (logProcess.pid) {
      process.kill(logProcess.pid, 'SIGTERM');
    }
    activeProcesses.delete(`${type}:${id}`);
  };
  
  // Track active process
  activeProcesses.set(`${type}:${id}`, logProcess);
  
  // Handle client disconnect
  req.on('close', cleanup);
  res.on('error', cleanup);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  for (const [_, process] of activeProcesses) {
    process.kill('SIGTERM');
  }
  server.close(() => process.exit(0));
});
