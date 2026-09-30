# Internet Club Semarang - Full Stack Web Application

Website komunitas digital untuk berbagi kabar, info, dan dokumentasi di Semarang.

## ✨ Fitur

- 🔐 Autentikasi & Autorisasi (Admin/User Role)
- 📰 Manajemen Artikel (CRUD dengan validasi)
- 📅 Manajemen Event & Registrasi
- 📄 Upload Dokumen ke Storage Permanen
- 💬 Form Kontak dengan Status Tracking
- 📊 Dashboard Admin Lengkap
- 🎨 UI/UX Modern dengan React + Vite
- 🗄️ PostgreSQL Database Production-Ready
- 🚀 Docker & Docker Compose Setup
- 📱 Responsive Design
- ⚡ Performance Optimized

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js 4.x
- **Database**: PostgreSQL 16
- **Authentication**: JWT (jsonwebtoken)
- **File Upload**: Multer
- **Validation**: Validator.js
- **Security**: bcryptjs, Helmet, CORS
- **Containerization**: Docker & Docker Compose

### Frontend
- **Library**: React 18+
- **Build Tool**: Vite
- **Styling**: Modern CSS3
- **Responsive**: Mobile-first Design

## 📋 Prerequisites

- Node.js 20+ & npm
- PostgreSQL 16+ (atau Docker)
- Docker & Docker Compose (optional)
- Git

## 🚀 Quick Start dengan Docker

### Fastest Way

```bash
# Clone repository
git clone https://github.com/PuputGifaDev/komunitas-web.git
cd komunitas-web

# Copy environment
cp .env.example .env

# Start dengan Docker
docker-compose up -d

# Run migrations & seed
docker-compose exec api npm run migrate
docker-compose exec api npm run seed
```

✅ Done! Akses:
- API: http://localhost:5000/api/health
- Frontend: http://localhost:5173

### Manual Setup (Tanpa Docker)

#### Backend

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Edit .env dengan PostgreSQL credentials Anda
nano .env

# Setup database PostgreSQL lokal
# macOS: brew install postgresql@16 && brew services start postgresql@16
# Ubuntu: sudo apt install postgresql && sudo service postgresql start
# Windows: Download dari postgresql.org

# Create database
creatdb internet_club

# Run migrations
npm run migrate

# Seed database with default users
npm run seed

# Start development server
npm run dev
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 🔑 Default Credentials

```
Admin Account:
  Username: admin
  Password: admin@123

Demo Account:
  Username: demo
  Password: demo@123
```

⚠️ **Jangan lupa ganti password default untuk production!**

## 📚 API Documentation

### Authentication
```bash
POST /api/auth/login
Body: { username, password }

POST /api/auth/register
Body: { username, email, password, full_name }
```

### Articles (Admin Only)
```bash
GET /api/articles              # List articles
GET /api/articles/:id          # Get detail
POST /api/articles             # Create
PUT /api/articles/:id          # Update
DELETE /api/articles/:id       # Delete
```

### Events
```bash
GET /api/events                # List events
GET /api/events/:id            # Get detail
POST /api/events               # Create (admin)
POST /api/events/:id/register  # Register (user)
```

### Documents
```bash
GET /api/documents             # List documents
POST /api/documents            # Upload (user)
DELETE /api/documents/:id      # Delete
```

### Contacts (Admin Only)
```bash
GET /api/contacts              # List contacts
PUT /api/contacts/:id          # Update status
```

### Admin Stats (Admin Only)
```bash
GET /api/stats                 # Dashboard stats
GET /api/users                 # List users
PUT /api/users/:id             # Update user role
```

## 📁 Project Structure

```
komunitas-web/
├── server.js                   # API entry point
├── package.json                # Dependencies
├── .env.example               # Environment template
├── Dockerfile                 # Backend container
├── docker-compose.yml         # Development setup
├── docker-compose.prod.yml    # Production setup
│
├── middleware/
│   ├── auth.js               # JWT verification
│   └── validation.js         # Input validation
│
├── utils/
│   ├── fileUpload.js         # Multer configuration
│   └── slugify.js            # Slug generator
│
├── scripts/
│   ├── migrate.js            # Database migrations
│   └── seed.js               # Seed data
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx          # App entry
│   │   └── styles.css        # Styling
│   ├── vite.config.js        # Vite config
│   ├── Dockerfile            # Frontend container
│   └── nginx.conf            # Nginx config
│
└── README.md                 # This file
```

## 🔒 Security Features

✅ Password hashing dengan bcryptjs  
✅ JWT token authentication (expiry 7 hari)  
✅ CORS protection  
✅ Input validation & sanitization  
✅ File type & size validation  
✅ SQL injection prevention (parameterized queries)  
✅ Role-based access control (RBAC)  
✅ Permission checks pada setiap endpoint  

## 💾 Database Features

✅ Automatic migrations  
✅ Indexes pada frequently-queried columns  
✅ Foreign key constraints  
✅ Timestamps (created_at, updated_at)  
✅ Soft delete ready (dapat ditambahkan)  
✅ Transaction support  

## 📤 File Upload

- **Location**: `./uploads/` (permanen di server)
- **Max Size**: 10MB
- **Allowed Types**: JPEG, PNG, GIF, PDF, DOC, DOCX
- **Auto Cleanup**: Saat delete artikel/dokumen

Untuk production, gunakan cloud storage:
- AWS S3
- Google Cloud Storage
- Cloudinary
- MinIO

## 🚀 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) untuk guide lengkap.

### Quick Deployment to DigitalOcean

```bash
# Create droplet, SSH in, then:
git clone repo && cd komunitas-web
cp .env.example .env
# Edit .env
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml exec api npm run migrate
```

### Frontend to Vercel

```bash
cd frontend
npm i -g vercel
vercel --prod
```

## 📊 Database Backup

```bash
# Backup
docker-compose exec postgres pg_dump -U postgres internet_club > backup.sql

# Restore
cat backup.sql | docker-compose exec -T postgres psql -U postgres -d internet_club
```

## 🛠️ Development Commands

```bash
# Backend
npm run dev        # Start with auto-reload
npm run migrate    # Run migrations
npm run seed       # Seed database
npm start          # Production start

# Frontend
cd frontend
npm run dev        # Start dev server
npm run build      # Build for production
npm run preview    # Preview production build

# Docker
docker-compose up -d              # Start services
docker-compose down               # Stop services
docker-compose logs -f api        # View logs
docker-compose exec api bash      # Shell access
```

## ✅ Role-Based Features

### Admin Role
- ✅ Full dashboard access
- ✅ Create/edit/delete articles
- ✅ Create/edit/delete events
- ✅ Manage users (enable/disable, change role)
- ✅ View all contacts & reply
- ✅ View statistics

### User Role
- ✅ Access website publik
- ✅ Upload documents
- ✅ Register untuk events
- ✅ Submit contact form
- ✅ View articles & events

## 🎯 Environment Variables

```env
# API
PORT=5000
NODE_ENV=development|production
JWT_SECRET=very-strong-random-secret-min-32-chars

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=internet_club
DB_USER=postgres
DB_PASSWORD=secure-password

# Frontend
FRONTEND_URL=http://localhost:5173

# Files
MAX_FILE_SIZE=10485760
```

## 📈 Performance Tips

1. **Database**: Gunakan indexes, query optimization
2. **Caching**: Implementasi Redis untuk session/cache
3. **CDN**: Gunakan untuk static files & uploads
4. **Compression**: Gzip enabled di Nginx
5. **Monitoring**: Setup logging & alerting

## 🐛 Troubleshooting

### Database connection failed
```bash
docker-compose restart postgres
# atau
psql -h localhost -U postgres
```

### Port already in use
```bash
lsof -i :5000
kill -9 <PID>
```

### File upload not working
```bash
mkdir -p uploads
chmod 755 uploads
```

### Database migration error
```bash
npm run migrate  # Run manually
# Check migration files di scripts/migrate.js
```

## 📞 Support & Contact

📧 Email: info@internetclub.com  
🌐 Website: Coming soon  
💬 Telegram: @internetclubsemarang  

## 📄 License

MIT License - Silakan gunakan dan modifikasi sesuai kebutuhan.

## 🙏 Contributors

Terima kasih kepada semua yang berkontribusi!

---

**Dibuat untuk Internet Club Semarang** ❤️

Dengan ❤️ oleh PuputGifaDev
