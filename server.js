const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const WebSocket = require('ws');

const app = express();
const port = 5000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

//-------------------------------------------------------------
// Logger Middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

//-------------------------------------------------------------

// Database setup
const db = new sqlite3.Database('./digital_signage.db', (err) => {
  if (err) console.error('Failed to connect to DB:', err.message);
  else console.log('Connected to SQLite database.');
});

//---------------------------------------------------------
// Create tables if they don't exist
db.run(`CREATE TABLE IF NOT EXISTS screens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  screen_id TEXT NOT NULL UNIQUE
)`);

db.run(`CREATE TABLE IF NOT EXISTS content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  screen_id TEXT NOT NULL,
  data TEXT,
  FOREIGN KEY (screen_id) REFERENCES screens (id)
)`);

//-----------------------------------------------------------------------

// WebSocket server setup
//set up of an HTTP sever to handle express and websocket connections
const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// Create WebSocket server and associate it with the HTTP server
const wss = new WebSocket.Server({ server });

// Store connected clients by screenId (Map allows efficient lookup)
const clients = new Map();

// Handling WebSocket connections
wss.on('connection', (ws) => {
  console.log('New client connected');

  // Handle incoming messages from clients
  ws.on('message', (message) => {
    // If message is a Buffer, convert to string before parsing
    if (Buffer.isBuffer(message)) {
      message = message.toString('utf8');
    }

    console.log('Received:', message);

    try {
      const parsedMessage = JSON.parse(message);

      // If a screenId is provided, store it in the WebSocket object
      if (parsedMessage.screenId) {
        ws.screenId = parsedMessage.screenId;
        clients.set(ws.screenId, ws); // Store WebSocket client by screenId
      }

      // Broadcast the message to all clients (except sender)
      clients.forEach((client, screenId) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } catch (err) {
      console.error('Invalid message format:', message);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket Error:', err);
  });

  // Handle WebSocket disconnection
  ws.on('close', () => {
    if (ws.screenId) {
      clients.delete(ws.screenId); // Remove the client from the map
      console.log('Client disconnected');
    }
  });

  // Send a confirmation message when the client connects
  ws.send(JSON.stringify({ message: 'WebSocket Server Connected' }));
});

// Close DB on exit
process.on('SIGINT', () => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });

  db.close((err) => {
    if (err) console.error('Error closing DB connection:', err.message);
    else console.log('Database connection closed.');
    process.exit(0);
  });
});
//-----------------------------------------------------------

// API Endpoints

// Simple Express route to test the backend
app.get('/', (req, res) => {
  res.send('Digital Signage Content Management System');
});

//register a new screen
app.post('/register-screen', (req, res) => {
  let { screenId } = req.body;
  
  if (!screenId || typeof screenId !== 'string' || screenId.trim() === '') {
    return res.status(400).json({ message: 'Invalid screenId. Expected a non-empty string.' });
  }
  
  screenId = screenId.trim(); // Ensure no leading/trailing spaces

  // Check if the screenId already exists
  db.get('SELECT screen_id FROM screens WHERE screen_id = ?', [screenId], (err, row) => {
    if (err) {
      console.error('Database error while checking screen:', err.message);
      return res.status(500).json({ message: 'Internal server error. Please try again later.' });
    }
    if (row) {
      return res.status(409).json({ message: 'Screen ID already registered.', screenId });
    }
    // Insert the new screen if it doesn't exist
    db.run('INSERT INTO screens (screen_id) VALUES (?)', [screenId], function (err) {
      if (err) {
        console.error('Error registering screen:', err.message);
        return res.status(500).json({ message: 'Failed to register screen due to a database error.' });
      }
      console.log(`Screen registered: ${screenId}`);

      // Broadcast screen registration to all WebSocket clients
      const screenRegisteredMessage = {
        type: 'new-screen',
        screenId,
      };

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(screenRegisteredMessage));
        }
      });

      res.status(201).json({ message: 'Screen registered successfully.', screenId });
    });
  });
});

// Check if a Screen is Registered
app.get('/check-screen/:screenId', (req, res) => {
  const { screenId } = req.params;

  if (!screenId) {
    return res.status(400).json({ message: 'ScreenId is required.' });
  }

  db.get('SELECT * FROM screens WHERE screen_id = ?', [screenId], (err, row) => {
    if (err) {
      console.error('Error checking screen registration:', err.message);
      return res.status(500).json({ message: 'Server error. Please try again later.' });
    }

    if (!row) {
      // Instead of 404, return a 200 with registered: false
      return res.status(200).json({ registered: false });
    }

    res.status(200).json({ registered: true, message: 'Screen is registered.', screen: row });
  });
});

// Save Content for a Screen
app.post('/save-content', (req, res) => {
  const { screenId, data } = req.body;

  if (!screenId || !data || typeof data !== 'string') {
    return res.status(400).json({ message: 'Invalid data. Expected screenId and non-empty string data.' });
  }

  db.run('INSERT INTO content (screen_id, data) VALUES (?, ?)', [screenId, data], function (err) {
    if (err) {
      console.error('Error saving content:', err.message);
      return res.status(500).json({ message: 'Failed to save content.' });
    }
    // Broadcast the new content to all WebSocket clients
    const contentUpdate = {
      type: 'new-content',
      screenId: screenId,
      data: data,
    };
    // Send the content update only to the client(s) with the matching screenId
    clients.forEach((client, clientScreenId) => {
      if (client.readyState === WebSocket.OPEN && clientScreenId === screenId) {
        client.send(JSON.stringify(contentUpdate));
      }
    });
    res.status(200).json({ id: this.lastID, message: 'Content saved successfully.' });
  });
});

// Fetch Content for a Specific Screen
app.get('/content/:screenId', (req, res) => {
  const { screenId } = req.params;

  db.all('SELECT * FROM content WHERE screen_id = ?', [screenId], (err, rows) => {
    if (err) {
      console.error('Error fetching content:', err.message);
      return res.status(500).json({ message: 'Failed to fetch content. Please try again later.' });
    }
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No content found for this screen.' });
    }
    res.status(200).json(rows);
  });
});

// Fetch All Contents (optional, for testing)
app.get('/contents', (req, res) => {
  db.all('SELECT * FROM content', [], (err, rows) => {
    if (err) {
      console.error('Error fetching contents:', err.message);
      return res.status(500).json({ message: 'Failed to fetch contents. Please try again later.' });
    }
    res.status(200).json(rows);
  });
});

// Update Content for a Specific Screen
app.put('/update-content/:id', (req, res) => {
  const { id } = req.params;
  const { data } = req.body;

  if (!data || typeof data !== 'string') {
    return res.status(400).json({ message: 'Invalid data. Expected a non-empty string.' });
  }

  db.run('UPDATE content SET data = ? WHERE id = ?', [data, id], function (err) {
    if (err) {
      console.error('Error updating content:', err.message);
      return res.status(500).json({ message: 'Failed to update content.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Content not found.' });
    }
    // Broadcast updated content to all WebSocket clients
    const contentUpdate = {
      type: 'update-content',
      id: id,
      data: data,
    };
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(contentUpdate));
      }
    });
    res.status(200).json({ message: 'Content updated successfully.' });
  });
});

// Delete Content for a Specific Screen
app.delete('/delete-content/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM content WHERE id = ?', [id], function (err) {
    if (err) {
      console.error('Error deleting content:', err.message);
      return res.status(500).json({ message: 'Failed to delete content.' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: 'Content not found.' });
    }
    // Broadcast content deletion to all WebSocket clients
    const contentDelete = {
      type: 'delete-content',
      id: id,
    };
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(contentDelete));
      }
    });
    res.status(200).json({ message: 'Content deleted successfully.' });
  });
});
