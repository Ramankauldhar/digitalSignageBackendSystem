const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 5000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Logger Middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// Database setup
const db = new sqlite3.Database('./digital_signage.db', (err) => {
  if (err) console.error('Failed to connect to DB:', err.message);
  else console.log('Connected to SQLite database.');
});

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

// API Endpoints

// Register Screen
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

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));