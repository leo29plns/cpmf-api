import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const initializeDb = async () => {
  const db = await open({
    filename: './database.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      playerName TEXT,
      playerId TEXT,
      chrono INTEGER,
      trackId TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
};

const db = await initializeDb();

const maintainTableSize = async () => {
  const count = await db.get('SELECT COUNT(*) as count FROM scores');
  if (count.count > 5000) {
    const deleteCount = count.count - 5000;
    await db.run(`
      DELETE FROM scores
      WHERE id IN (
        SELECT id FROM scores
        ORDER BY createdAt ASC
        LIMIT ?
      )
    `, [deleteCount]);
  }
};

app.put('/scores', async (req, res) => {
  const { playerName, playerId, chrono, trackId } = req.body;
  const id = uuidv4();

  try {
    await db.run(
      'INSERT INTO scores (id, playerName, playerId, chrono, trackId) VALUES (?, ?, ?, ?, ?)',
      [id, playerName, playerId, chrono, trackId]
    );

    await maintainTableSize();

    res.status(201).json({ id, playerName, playerId, chrono, trackId, createdAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/scores', async (req, res) => {
  const { trackId, playerId } = req.query;

  try {
    let query = 'SELECT id, playerName, playerId, chrono, trackId, createdAt FROM scores WHERE 1=1';
    const params = [];

    if (trackId) {
      query += ' AND trackId = ?';
      params.push(trackId);
    }

    if (playerId) {
      query += ' AND playerId = ?';
      params.push(playerId);
    }

    query += ' ORDER BY chrono ASC LIMIT 100';

    const rows = await db.all(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
