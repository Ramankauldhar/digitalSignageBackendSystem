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
const db = new sqlite3.Database('./content.db', (err) => {
  if (err) console.error('Failed to connect to DB:', err.message);
  else console.log('Connected to SQLite database.');
});

// Create table
db.run(`CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY, data TEXT)`);

// Close DB on exit
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error('Error closing DB connection:', err.message);
    else console.log('Database connection closed.');
    process.exit(0);
  });
});

// API endpoints

// Save Content
app.post('/save-content', (req, res) => {
  const { data } = req.body;

  if (!data || typeof data !== 'string') {
    return res.status(400).json({ message: 'Invalid data. Expected a non-empty string.' });
  }

  db.run('INSERT INTO content (data) VALUES (?)', [data], function (err) {
    if (err) {
      console.error('Error saving content:', err.message);
      return res.status(500).json({ message: 'Failed to save content.' });
    }
    res.status(200).json({ id: this.lastID, message: 'Content saved successfully.' });
  });
});

// Fetch Contents
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