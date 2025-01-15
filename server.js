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

//-----------------------------------------------------------------------

// WebSocket server setup
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Handle messages from the client
  ws.on('message', (message) => {
    console.log(`Received: ${message}`);
    
    // Broadcast the received message to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

//---------------------------------------------------------
// Create tables if they don't exist
db.run(`CREATE TABLE IF NOT EXISTS screens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  screen_id TEXT NOT NULL UNIQUE
)`);

db.run(`CREATE TABLE IF NOT EXISTS content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  screen_id INTEGER NOT NULL,
  data TEXT,
  FOREIGN KEY (screen_id) REFERENCES screens (id)
)`);

// Close DB on exit
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error('Error closing DB connection:', err.message);
    else console.log('Database connection closed.');
    process.exit(0);
  });
});

//-----------------------------------------------------------

// API Endpoints
app.post('/register-screen', (req, res) => {
  const { screenId } = req.body;

  if (!screenId || typeof screenId !== 'string') {
    return res.status(400).json({ message: 'Invalid screenId. Expected a non-empty string.' });
  }

  db.run('INSERT INTO screens (screen_id) VALUES (?)', [screenId], function (err) {
    if (err) {
      console.error('Error registering screen:', err.message);
      return res.status(500).json({ message: 'Failed to register screen.' });
    }
    res.status(200).json({ message: 'Screen registered successfully', screenId: screenId });
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
      return res.status(404).json({ registered: false, message: 'Screen is not registered.' });
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

    res.status(200).json({ message: 'Content deleted successfully.' });
  });
});


app.listen(port, () => console.log(`Server running on http://localhost:${port}`));