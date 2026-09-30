const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key_here';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Setup multer untuk upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Setup SQLite Database
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Database error:', err);
  } else {
    console.log('Database connected');
    initializeDatabase();
  }
});

// Inisialisasi database
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image TEXT,
      category TEXT,
      author_id INTEGER,
      status TEXT DEFAULT 'draft',
      views INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      file_path TEXT NOT NULL,
      category TEXT,
      uploaded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      date DATETIME NOT NULL,
      location TEXT,
      image TEXT,
      category TEXT,
      created_by INTEGER,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT,
      status TEXT DEFAULT 'unread',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default admin user jika tidak ada
  const defaultUser = {
    username: 'admin',
    email: 'admin@internetclub.com',
    password: bcrypt.hashSync('admin123', 10)
  };

  db.run(
    'SELECT * FROM users WHERE username = ?',
    ['admin'],
    (err, row) => {
      if (!row) {
        db.run(
          'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
          [defaultUser.username, defaultUser.email, defaultUser.password, 'admin']
        );
      }
    }
  );
}

// Middleware untuk verifikasi token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Token tidak ditemukan' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token tidak valid' });
  }
};

// ============ AUTH ROUTES ============

// Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username dan password harus diisi' });
  }

  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({ message: 'Username atau password salah' });
      }

      const passwordValid = bcrypt.compareSync(password, user.password);

      if (!passwordValid) {
        return res.status(401).json({ message: 'Username atau password salah' });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    }
  );
});

// Register
app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Semua field harus diisi' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
    [username, email, hashedPassword, 'user'],
    function(err) {
      if (err) {
        return res.status(400).json({ message: 'Username atau email sudah terdaftar' });
      }

      const token = jwt.sign(
        { id: this.lastID, role: 'user' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: this.lastID,
          username,
          email,
          role: 'user'
        }
      });
    }
  );
});

// ============ ARTICLES ROUTES ============

// Get all articles
app.get('/api/articles', (req, res) => {
  const { status } = req.query;
  let query = 'SELECT a.*, u.username as author FROM articles a LEFT JOIN users u ON a.author_id = u.id';
  
  if (status) {
    query += ` WHERE a.status = '${status}'`;
  }
  
  query += ' ORDER BY a.created_at DESC';

  db.all(query, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows || []);
  });
});

// Get single article
app.get('/api/articles/:id', (req, res) => {
  const { id } = req.params;

  db.get(
    'SELECT a.*, u.username as author FROM articles a LEFT JOIN users u ON a.author_id = u.id WHERE a.id = ?',
    [id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      if (!row) {
        return res.status(404).json({ message: 'Artikel tidak ditemukan' });
      }
      res.json(row);
    }
  );
});

// Create article
app.post('/api/articles', verifyToken, upload.single('image'), (req, res) => {
  const { title, content, category, status } = req.body;
  const image = req.file ? req.file.filename : null;

  if (!title || !content) {
    return res.status(400).json({ message: 'Judul dan konten harus diisi' });
  }

  db.run(
    'INSERT INTO articles (title, content, image, category, author_id, status) VALUES (?, ?, ?, ?, ?, ?)',
    [title, content, image, category, req.userId, status || 'draft'],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({
        id: this.lastID,
        title,
        content,
        image,
        category,
        author_id: req.userId,
        status: status || 'draft'
      });
    }
  );
});

// Update article
app.put('/api/articles/:id', verifyToken, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { title, content, category, status } = req.body;

  db.get('SELECT * FROM articles WHERE id = ?', [id], (err, article) => {
    if (!article) {
      return res.status(404).json({ message: 'Artikel tidak ditemukan' });
    }

    const image = req.file ? req.file.filename : article.image;

    db.run(
      'UPDATE articles SET title = ?, content = ?, image = ?, category = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, content, image, category, status, id],
      (err) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        res.json({ message: 'Artikel berhasil diperbarui' });
      }
    );
  });
});

// Delete article
app.delete('/api/articles/:id', verifyToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM articles WHERE id = ?', [id], (err) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json({ message: 'Artikel berhasil dihapus' });
  });
});

// ============ DOCUMENTS ROUTES ============

// Get all documents
app.get('/api/documents', (req, res) => {
  db.all(
    'SELECT d.*, u.username as uploaded_by_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id ORDER BY d.created_at DESC',
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(rows || []);
    }
  );
});

// Upload document
app.post('/api/documents', verifyToken, upload.single('file'), (req, res) => {
  const { title, description, category } = req.body;

  if (!title || !req.file) {
    return res.status(400).json({ message: 'Judul dan file harus diisi' });
  }

  db.run(
    'INSERT INTO documents (title, description, file_path, category, uploaded_by) VALUES (?, ?, ?, ?, ?)',
    [title, description, req.file.filename, category, req.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({
        id: this.lastID,
        title,
        description,
        file_path: req.file.filename,
        category,
        uploaded_by: req.userId
      });
    }
  );
});

// Delete document
app.delete('/api/documents/:id', verifyToken, (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM documents WHERE id = ?', [id], (err, doc) => {
    if (!doc) {
      return res.status(404).json({ message: 'Dokumen tidak ditemukan' });
    }

    db.run('DELETE FROM documents WHERE id = ?', [id], (err) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ message: 'Dokumen berhasil dihapus' });
    });
  });
});

// ============ EVENTS ROUTES ============

// Get all events
app.get('/api/events', (req, res) => {
  db.all(
    'SELECT e.*, u.username as created_by_name FROM events e LEFT JOIN users u ON e.created_by = u.id ORDER BY e.date DESC',
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(rows || []);
    }
  );
});

// Get single event
app.get('/api/events/:id', (req, res) => {
  const { id } = req.params;

  db.get(
    'SELECT e.*, u.username as created_by_name FROM events e LEFT JOIN users u ON e.created_by = u.id WHERE e.id = ?',
    [id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      if (!row) {
        return res.status(404).json({ message: 'Event tidak ditemukan' });
      }
      res.json(row);
    }
  );
});

// Create event
app.post('/api/events', verifyToken, upload.single('image'), (req, res) => {
  const { title, description, date, location, category, status } = req.body;
  const image = req.file ? req.file.filename : null;

  if (!title || !description || !date) {
    return res.status(400).json({ message: 'Judul, deskripsi, dan tanggal harus diisi' });
  }

  db.run(
    'INSERT INTO events (title, description, date, location, image, category, created_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [title, description, date, location, image, category, req.userId, status || 'active'],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({
        id: this.lastID,
        title,
        description,
        date,
        location,
        image,
        category,
        created_by: req.userId,
        status: status || 'active'
      });
    }
  );
});

// Update event
app.put('/api/events/:id', verifyToken, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { title, description, date, location, category, status } = req.body;

  db.get('SELECT * FROM events WHERE id = ?', [id], (err, event) => {
    if (!event) {
      return res.status(404).json({ message: 'Event tidak ditemukan' });
    }

    const image = req.file ? req.file.filename : event.image;

    db.run(
      'UPDATE events SET title = ?, description = ?, date = ?, location = ?, image = ?, category = ?, status = ? WHERE id = ?',
      [title, description, date, location, image, category, status, id],
      (err) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        res.json({ message: 'Event berhasil diperbarui' });
      }
    );
  });
});

// Delete event
app.delete('/api/events/:id', verifyToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM events WHERE id = ?', [id], (err) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json({ message: 'Event berhasil dihapus' });
  });
});

// ============ NOTIFICATIONS ROUTES ============

// Get all notifications
app.get('/api/notifications', (req, res) => {
  db.all(
    'SELECT * FROM notifications ORDER BY created_at DESC',
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(rows || []);
    }
  );
});

// Create notification
app.post('/api/notifications', verifyToken, (req, res) => {
  const { title, message, type } = req.body;

  if (!title || !message) {
    return res.status(400).json({ message: 'Judul dan pesan harus diisi' });
  }

  db.run(
    'INSERT INTO notifications (title, message, type) VALUES (?, ?, ?)',
    [title, message, type || 'info'],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({
        id: this.lastID,
        title,
        message,
        type: type || 'info'
      });
    }
  );
});

// Update notification status
app.put('/api/notifications/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db.run(
    'UPDATE notifications SET status = ? WHERE id = ?',
    [status, id],
    (err) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ message: 'Notifikasi berhasil diperbarui' });
    }
  );
});

// ============ CONTACTS ROUTES ============

// Get all contacts
app.get('/api/contacts', verifyToken, (req, res) => {
  db.all(
    'SELECT * FROM contacts ORDER BY created_at DESC',
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(rows || []);
    }
  );
});

// Create contact message
app.post('/api/contacts', (req, res) => {
  const { name, email, phone, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ message: 'Semua field wajib diisi' });
  }

  db.run(
    'INSERT INTO contacts (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
    [name, email, phone, subject, message],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({
        id: this.lastID,
        message: 'Pesan berhasil dikirim'
      });
    }
  );
});

// Update contact status
app.put('/api/contacts/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db.run(
    'UPDATE contacts SET status = ? WHERE id = ?',
    [status, id],
    (err) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ message: 'Status berhasil diperbarui' });
    }
  );
});

// ============ STATS ROUTES ============

// Get dashboard stats
app.get('/api/stats', verifyToken, (req, res) => {
  db.get('SELECT COUNT(*) as total FROM articles', (err, articlesCount) => {
    db.get('SELECT COUNT(*) as total FROM documents', (err, docsCount) => {
      db.get('SELECT COUNT(*) as total FROM events', (err, eventsCount) => {
        db.get('SELECT COUNT(*) as total FROM contacts WHERE status = "new"', (err, newContacts) => {
          res.json({
            articles: articlesCount?.total || 0,
            documents: docsCount?.total || 0,
            events: eventsCount?.total || 0,
            newContacts: newContacts?.total || 0
          });
        });
      });
    });
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
