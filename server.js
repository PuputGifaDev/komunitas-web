const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key_change_in_production';
const NODE_ENV = process.env.NODE_ENV || 'development';

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
  console.log('PostgreSQL connected');
  initializeDatabase();
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        full_name VARCHAR(200),
        avatar_url VARCHAR(255),
        bio TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE,
        content TEXT NOT NULL,
        excerpt TEXT,
        image_url VARCHAR(255),
        category VARCHAR(100),
        author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'draft',
        views INTEGER DEFAULT 0,
        featured BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        file_url VARCHAR(255) NOT NULL,
        file_type VARCHAR(50),
        file_size INTEGER,
        category VARCHAR(100),
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        download_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE,
        description TEXT NOT NULL,
        image_url VARCHAR(255),
        date_start TIMESTAMP NOT NULL,
        date_end TIMESTAMP,
        location VARCHAR(255),
        category VARCHAR(100),
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'active',
        max_participants INTEGER,
        registered_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50),
        recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'new',
        replied_at TIMESTAMP,
        replied_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_registrations (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_id)
      )
    `);

    const adminCheck = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    if (adminCheck.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync('admin@123', 10);
      await pool.query(
        'INSERT INTO users (username, email, password, role, full_name, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
        ['admin', 'admin@internetclub.com', hashedPassword, 'admin', 'Administrator', true]
      );
      console.log('Default admin user created: admin / admin@123');
    }
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token tidak ditemukan' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid atau sudah kadaluarsa' });
  }
};

const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Akses hanya untuk admin' });
    }
    next();
  });
};

function generateSlug(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

function isValidEmail(email) {
  return validator.isEmail(email);
}

function isValidPassword(password) {
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, dan password harus diisi' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Format email tidak valid' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'Password minimal 8 karakter, harus ada huruf besar dan angka' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username minimal 3 karakter' });
    }

    const existingUser = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username atau email sudah terdaftar' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password, full_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role, full_name',
      [username, email, hashedPassword, full_name || '', 'user']
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Registrasi berhasil',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password harus diisi' });
    }

    const result = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(401).json({ error: 'Akun Anda telah dinonaktifkan' });
    }

    const passwordValid = bcrypt.compareSync(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login berhasil',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        avatar_url: user.avatar_url
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.get('/api/articles', async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'published', category } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT a.*, u.full_name, u.username FROM articles a LEFT JOIN users u ON a.author_id = u.id WHERE a.status = $1';
    const params = [status];

    if (category) {
      query += ' AND a.category = $' + (params.length + 1);
      params.push(category);
    }

    query += ' ORDER BY a.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);

    let countQuery = 'SELECT COUNT(*) FROM articles WHERE status = $1';
    const countParams = [status];
    if (category) {
      countQuery += ' AND category = $2';
      countParams.push(category);
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (err) {
    console.error('Get articles error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.get('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT a.*, u.full_name, u.username FROM articles a LEFT JOIN users u ON a.author_id = u.id WHERE a.id = $1 OR a.slug = $1',
      [isNaN(id) ? id : parseInt(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Artikel tidak ditemukan' });
    }

    await pool.query('UPDATE articles SET views = views + 1 WHERE id = $1', [result.rows[0].id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get article error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.post('/api/articles', verifyAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, content, excerpt, category, status, featured } = req.body;

    if (!title || title.length < 5) {
      return res.status(400).json({ error: 'Judul minimal 5 karakter' });
    }
    if (!content || content.length < 20) {
      return res.status(400).json({ error: 'Konten minimal 20 karakter' });
    }

    const slug = generateSlug(title);
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await pool.query(
      'INSERT INTO articles (title, slug, content, excerpt, image_url, category, author_id, status, featured) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [title, slug, content, excerpt || content.slice(0, 150), image_url, category || 'Umum', req.userId, status || 'draft', featured || false]
    );

    res.status(201).json({ message: 'Artikel berhasil dibuat', data: result.rows[0] });
  } catch (err) {
    console.error('Create article error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.put('/api/articles/:id', verifyAdmin, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, excerpt, category, status, featured } = req.body;

    const article = await pool.query('SELECT * FROM articles WHERE id = $1', [id]);
    if (article.rows.length === 0) {
      return res.status(404).json({ error: 'Artikel tidak ditemukan' });
    }

    const image_url = req.file ? `/uploads/${req.file.filename}` : article.rows[0].image_url;
    const slug = title ? generateSlug(title) : article.rows[0].slug;

    const result = await pool.query(
      'UPDATE articles SET title = $1, slug = $2, content = $3, excerpt = $4, image_url = $5, category = $6, status = $7, featured = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $9 RETURNING *',
      [title || article.rows[0].title, slug, content || article.rows[0].content, excerpt || article.rows[0].excerpt, image_url, category || article.rows[0].category, status || article.rows[0].status, featured !== undefined ? featured : article.rows[0].featured, id]
    );

    res.json({ message: 'Artikel berhasil diperbarui', data: result.rows[0] });
  } catch (err) {
    console.error('Update article error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.delete('/api/articles/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const article = await pool.query('SELECT * FROM articles WHERE id = $1', [id]);
    if (article.rows.length === 0) {
      return res.status(404).json({ error: 'Artikel tidak ditemukan' });
    }

    if (article.rows[0].image_url) {
      const filePath = path.join(__dirname, article.rows[0].image_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query('DELETE FROM articles WHERE id = $1', [id]);
    res.json({ message: 'Artikel berhasil dihapus' });
  } catch (err) {
    console.error('Delete article error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.get('/api/documents', async (req, res) => {
  try {
    const { category, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT d.*, u.full_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id';
    const params = [];

    if (category) {
      query += ' WHERE d.category = $1';
      params.push(category);
    }

    query += ' ORDER BY d.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json({ data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    console.error('Get documents error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.post('/api/documents', verifyToken, upload.single('file'), async (req, res) => {
  try {
    const { title, description, category } = req.body;

    if (!title || title.length < 3) {
      return res.status(400).json({ error: 'Judul minimal 3 karakter' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'File harus diunggah' });
    }

    const file_url = `/uploads/${req.file.filename}`;
    const result = await pool.query(
      'INSERT INTO documents (title, description, file_url, file_type, file_size, category, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [title, description || '', file_url, req.file.mimetype, req.file.size, category || 'Dokumentasi', req.userId]
    );

    res.status(201).json({ message: 'Dokumen berhasil diunggah', data: result.rows[0] });
  } catch (err) {
    console.error('Upload document error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.delete('/api/documents/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);

    if (doc.rows.length === 0) {
      return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    }

    if (doc.rows[0].uploaded_by !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Anda tidak memiliki akses menghapus dokumen ini' });
    }

    const filePath = path.join(__dirname, doc.rows[0].file_url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await pool.query('DELETE FROM documents WHERE id = $1', [id]);
    res.json({ message: 'Dokumen berhasil dihapus' });
  } catch (err) {
    console.error('Delete document error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'active' } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      'SELECT e.*, u.full_name FROM events e LEFT JOIN users u ON e.created_by = u.id WHERE e.status = $1 ORDER BY e.date_start ASC LIMIT $2 OFFSET $3',
      [status, limit, offset]
    );

    res.json({ data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT e.*, u.full_name FROM events e LEFT JOIN users u ON e.created_by = u.id WHERE e.id = $1 OR e.slug = $1',
      [isNaN(id) ? id : parseInt(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event tidak ditemukan' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get event error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.post('/api/events', verifyAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, description, date_start, date_end, location, category, status, max_participants } = req.body;

    if (!title || title.length < 5) {
      return res.status(400).json({ error: 'Judul minimal 5 karakter' });
    }
    if (!description || description.length < 20) {
      return res.status(400).json({ error: 'Deskripsi minimal 20 karakter' });
    }
    if (!date_start) {
      return res.status(400).json({ error: 'Tanggal mulai harus diisi' });
    }

    const slug = generateSlug(title);
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await pool.query(
      'INSERT INTO events (title, slug, description, image_url, date_start, date_end, location, category, created_by, status, max_participants) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
      [title, slug, description, image_url, date_start, date_end || date_start, location || '', category || 'Umum', req.userId, status || 'active', max_participants || null]
    );

    res.status(201).json({ message: 'Event berhasil dibuat', data: result.rows[0] });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.put('/api/events/:id', verifyAdmin, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, date_start, date_end, location, category, status, max_participants } = req.body;

    const event = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    if (event.rows.length === 0) {
      return res.status(404).json({ error: 'Event tidak ditemukan' });
    }

    const image_url = req.file ? `/uploads/${req.file.filename}` : event.rows[0].image_url;
    const slug = title ? generateSlug(title) : event.rows[0].slug;

    const result = await pool.query(
      'UPDATE events SET title = $1, slug = $2, description = $3, image_url = $4, date_start = $5, date_end = $6, location = $7, category = $8, status = $9, max_participants = $10, updated_at = CURRENT_TIMESTAMP WHERE id = $11 RETURNING *',
      [title || event.rows[0].title, slug, description || event.rows[0].description, image_url, date_start || event.rows[0].date_start, date_end || event.rows[0].date_end, location || event.rows[0].location, category || event.rows[0].category, status || event.rows[0].status, max_participants || event.rows[0].max_participants, id]
    );

    res.json({ message: 'Event berhasil diperbarui', data: result.rows[0] });
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.delete('/api/events/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const event = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    if (event.rows.length === 0) {
      return res.status(404).json({ error: 'Event tidak ditemukan' });
    }

    if (event.rows[0].image_url) {
      const filePath = path.join(__dirname, event.rows[0].image_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query('DELETE FROM event_registrations WHERE event_id = $1', [id]);
    await pool.query('DELETE FROM events WHERE id = $1', [id]);
    res.json({ message: 'Event berhasil dihapus' });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.post('/api/events/:id/register', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const event = await pool.query('SELECT * FROM events WHERE id = $1', [id]);

    if (event.rows.length === 0) {
      return res.status(404).json({ error: 'Event tidak ditemukan' });
    }

    const existing = await pool.query('SELECT * FROM event_registrations WHERE event_id = $1 AND user_id = $2', [id, req.userId]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Anda sudah mendaftar event ini' });
    }

    await pool.query('INSERT INTO event_registrations (event_id, user_id) VALUES ($1, $2)', [id, req.userId]);
    await pool.query('UPDATE events SET registered_count = registered_count + 1 WHERE id = $1', [id]);

    res.json({ message: 'Anda berhasil mendaftar event' });
  } catch (err) {
    console.error('Register event error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.get('/api/notifications', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notifications WHERE recipient_id = $1 ORDER BY created_at DESC LIMIT 50', [req.userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.put('/api/notifications/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1 AND recipient_id = $2', [id, req.userId]);
    res.json({ message: 'Notifikasi berhasil diperbarui' });
  } catch (err) {
    console.error('Update notification error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.get('/api/contacts', verifyAdmin, async (req, res) => {
  try {
    const { status = 'new', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT c.*, u.full_name as replied_by_name FROM contacts c LEFT JOIN users u ON c.replied_by = u.id';
    const params = [];

    if (status !== 'all') {
      query += ' WHERE c.status = $1';
      params.push(status);
    }

    query += ' ORDER BY c.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json({ data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    console.error('Get contacts error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.post('/api/contacts', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || name.length < 3) {
      return res.status(400).json({ error: 'Nama minimal 3 karakter' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Format email tidak valid' });
    }
    if (!subject || subject.length < 3) {
      return res.status(400).json({ error: 'Subjek minimal 3 karakter' });
    }
    if (!message || message.length < 10) {
      return res.status(400).json({ error: 'Pesan minimal 10 karakter' });
    }

    const result = await pool.query(
      'INSERT INTO contacts (name, email, phone, subject, message) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, email, phone || '', subject, message]
    );

    res.status(201).json({ message: 'Pesan berhasil dikirim', data: result.rows[0] });
  } catch (err) {
    console.error('Create contact error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.put('/api/contacts/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      'UPDATE contacts SET status = $1, replied_at = CURRENT_TIMESTAMP, replied_by = $2 WHERE id = $3 RETURNING *',
      [status, req.userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kontak tidak ditemukan' });
    }

    res.json({ message: 'Status berhasil diperbarui', data: result.rows[0] });
  } catch (err) {
    console.error('Update contact error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.get('/api/users', verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      'SELECT id, username, email, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({ data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.put('/api/users/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, is_active } = req.body;

    const result = await pool.query(
      'UPDATE users SET role = $1, is_active = $2 WHERE id = $3 RETURNING id, username, email, role, is_active',
      [role, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }

    res.json({ message: 'User berhasil diperbarui', data: result.rows[0] });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.get('/api/stats', verifyAdmin, async (req, res) => {
  try {
    const articles = await pool.query('SELECT COUNT(*) as total FROM articles');
    const documents = await pool.query('SELECT COUNT(*) as total FROM documents');
    const events = await pool.query('SELECT COUNT(*) as total FROM events');
    const contacts = await pool.query('SELECT COUNT(*) as total FROM contacts WHERE status = \'new\'');
    const users = await pool.query('SELECT COUNT(*) as total FROM users');

    res.json({
      articles: parseInt(articles.rows[0].total),
      documents: parseInt(documents.rows[0].total),
      events: parseInt(events.rows[0].total),
      newContacts: parseInt(contacts.rows[0].total),
      totalUsers: parseInt(users.rows[0].total)
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', environment: NODE_ENV });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Ukuran file terlalu besar (max 10MB)' });
  }

  if (err.message === 'File type not allowed') {
    return res.status(400).json({ error: 'Tipe file tidak diizinkan' });
  }

  res.status(500).json({ error: err.message || 'Terjadi kesalahan server' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
});

module.exports = app;
