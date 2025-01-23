# Digital Signage Content Management System (Backend)

This is the backend for a Digital Signage Content Management System, built using Node.js, Express, SQLite, and WebSockets. It enables real-time content updates, content storage, and management of digital display screens.

Online 
(https://digitalsignagebackendsystem.onrender.com/)


(wss://digitalsignagebackendsystem.onrender.com/)

## Features: 

1. RESTful API for managing screens and content
2. WebSocket support for real-time updates to connected screens
3. SQLite database for persistent data storage
4. Local logging middleware to track API requests
5. CRUD operations for screens and content
6. Offline capability using local storage (to be integrated with frontend)  

## Tech Stack

- Backend: Node.js, Express.js
- Database: SQLite3
- WebSockets: ws for real-time communication
- Middleware: body-parser, cors

## Installation
### Prerequisites
Ensure you have the following installed:
1. Node.js (v16 or later)
2. npm or yarn

## Steps
1. Clone this repository:
`git clone :-  https://github.com/Ramankauldhar/digitalSignageBackendSystem.git'
'cd digitalSignageBackendSystem'

3. Install dependencies:
`npm install`

4. Start the application:
'node server.js`


## Database Structure

screens (Stores registered screens)
CREATE TABLE IF NOT EXISTS screens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  screen_id TEXT NOT NULL UNIQUE
);

content (Stores content per screen)
CREATE TABLE IF NOT EXISTS content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  screen_id TEXT NOT NULL,
  data TEXT,
  FOREIGN KEY (screen_id) REFERENCES screens (id)
);

## API Endpoints

### Screens
#### Method	Endpoint	Description: 
1. POST	/register-screen	:- Registers a new screen
2. GET	/check-screen/:screenId	:- Checks if a screen is registered
   
### Content
#### Method	Endpoint	Description
1. POST	/save-content	:- Saves content for a screen
2. GET	/content/:screenId	:- Fetches all content for a specific screen
3. GET	/contents	:- Fetches all content (for testing)
4. PUT	/update-content/:id	:- Updates content for a specific screen
5. DELETE	/delete-content/:id	:- Deletes content for a specific screen


## WebSocket Implementation

### WebSocket Connection
1. The server listens for WebSocket connections.
2. Each connected screen is identified by a screenId.
   
### Real-time Communication
1. New Content: Broadcasts new content updates to relevant screens.
2. Content Updates: Updates are pushed instantly to connected screens.
3. Screen Registration: New screen connections are announced via WebSocket.

## Future Improvements

1. Offline content caching for uninterrupted playback
2. User authentication and role-based access
3. Cloud database support for scalability
4. Advanced scheduling system for content playback


## Contact
For inquiries or suggestions, please contact:
Name: Ramandeep
Email: Rmnkaul979697@gmail.com
