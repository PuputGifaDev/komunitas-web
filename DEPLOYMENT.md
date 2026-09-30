# Deployment Guide - Internet Club Semarang

## Development Setup

### Dengan Docker Compose (Recommended)

```bash
# Clone repository
git clone https://github.com/yourusername/komunitas-web.git
cd komunitas-web

# Copy environment file
cp .env.example .env

# Start services
docker-compose up -d

# Run migrations
docker-compose exec api npm run migrate

# Seed database
docker-compose exec api npm run seed
```

Akses:
- API: http://localhost:5000
- Frontend: http://localhost:5173
- Database: localhost:5432

### Lokal (tanpa Docker)

#### Backend
```bash
# Install dependencies
npm install

# Setup .env
cp .env.example .env
# Edit .env dengan database config lokal Anda

# Install PostgreSQL
# macOS: brew install postgresql@16
# Ubuntu: sudo apt-get install postgresql
# Windows: Download dari postgresql.org

# Create database
creatdb internet_club

# Run migrations
npm run migrate

# Seed database
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

## Production Deployment

### Option 1: DigitalOcean (Recommended)

#### Prerequisites
- DigitalOcean Account
- Droplet (Ubuntu 22.04, 2GB RAM minimum)
- Domain name

#### Steps

1. **Create Droplet**
   - Choose Ubuntu 22.04 LTS
   - Select 2GB RAM / 1 vCPU minimum
   - Enable backups

2. **SSH ke Droplet**
   ```bash
   ssh root@your_droplet_ip
   ```

3. **Install Dependencies**
   ```bash
   apt-get update
   apt-get upgrade -y
   apt-get install -y docker.io docker-compose curl git
   
   # Add user to docker group
   usermod -aG docker $USER
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   apt-get install -y nodejs
   ```

4. **Clone Repository**
   ```bash
   git clone https://github.com/yourusername/komunitas-web.git
   cd komunitas-web
   ```

5. **Setup Environment**
   ```bash
   cp .env.example .env
   
   # Edit .env dengan production settings
   nano .env
   ```

   Penting untuk production:
   ```env
   NODE_ENV=production
   JWT_SECRET=use-a-very-strong-random-secret-here
   DB_HOST=postgres
   DB_USER=postgres
   DB_PASSWORD=use-a-strong-password
   FRONTEND_URL=https://yourdomain.com
   ```

6. **Build & Start Services**
   ```bash
   docker-compose -f docker-compose.prod.yml build
   docker-compose -f docker-compose.prod.yml up -d
   ```

7. **Run Migrations**
   ```bash
   docker-compose -f docker-compose.prod.yml exec api npm run migrate
   docker-compose -f docker-compose.prod.yml exec api npm run seed
   ```

8. **Setup Nginx Reverse Proxy**
   ```bash
   apt-get install -y nginx certbot python3-certbot-nginx
   ```

   Create `/etc/nginx/sites-available/internetclub`:
   ```nginx
   upstream api {
       server localhost:5000;
   }

   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;
       
       location /api {
           proxy_pass http://api;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
       
       location /uploads {
           alias /root/komunitas-web/uploads;
       }
   }
   ```

   Enable site:
   ```bash
   ln -s /etc/nginx/sites-available/internetclub /etc/nginx/sites-enabled/
   nginx -t
   systemctl restart nginx
   ```

9. **Setup SSL Certificate**
   ```bash
   certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

### Option 2: Heroku

```bash
# Install Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login

# Create app
heroku create your-app-name

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:hobby-dev

# Set environment variables
heroku config:set JWT_SECRET=your-secret-key
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# Run migrations
heroku run npm run migrate
heroku run npm run seed
```

### Option 3: Railway.app

1. Push repository ke GitHub
2. Visit railway.app
3. Create new project
4. Connect GitHub repository
5. Add PostgreSQL plugin
6. Configure environment variables
7. Deploy

### Option 4: AWS EC2

```bash
# Launch EC2 instance (Ubuntu 22.04)
# Security Group: Allow 22, 80, 443, 5000

ssh -i your-key.pem ubuntu@your-ec2-ip

# Follow similar steps as DigitalOcean
```

## Frontend Deployment

### Vercel (Recommended for React)

```bash
cd frontend

# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

Configure environment variable di Vercel dashboard:
```
VITE_API_URL=https://your-api-domain.com/api
```

### Netlify

```bash
cd frontend

# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

### AWS S3 + CloudFront

```bash
# Build
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name/

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths '/*'
```

## Database Backup & Restore

### Backup
```bash
# Using Docker
docker-compose exec postgres pg_dump -U postgres internet_club > backup.sql

# Without Docker
pg_dump -h localhost -U postgres -d internet_club > backup.sql
```

### Restore
```bash
# Using Docker
cat backup.sql | docker-compose exec -T postgres psql -U postgres -d internet_club

# Without Docker
psql -h localhost -U postgres -d internet_club < backup.sql
```

## Monitoring & Logging

### Docker Logs
```bash
# View API logs
docker-compose logs -f api

# View Database logs
docker-compose logs -f postgres
```

### Setup PM2 (Alternative to Docker)
```bash
npm install -g pm2

# Start
pm2 start server.js --name "internet-club-api"

# Monitor
pm2 monit

# Logs
pm2 logs

# Auto restart on reboot
pm2 startup
pm2 save
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Set strong JWT_SECRET (min 32 chars, random)
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall
- [ ] Setup regular backups
- [ ] Enable database encryption
- [ ] Update dependencies regularly
- [ ] Setup monitoring & alerts
- [ ] Configure rate limiting
- [ ] Setup log rotation

## Performance Optimization

```bash
# Add to .env
NODE_ENV=production

# Enable gzip compression in Nginx
# Already included in nginx.conf

# Setup CDN for uploads
# Consider AWS CloudFront, Cloudflare, or Bunny CDN
```

## Auto-Scaling (Optional)

Jika traffic tinggi, gunakan:
- Load Balancer (Nginx, HAProxy)
- Multiple API instances
- Database read replicas
- Redis caching

## Troubleshooting

### Database connection failed
```bash
# Check database status
docker-compose ps

# Restart database
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

### Port already in use
```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>
```

### File upload not working
```bash
# Check uploads folder exists
mkdir -p uploads
chmod 755 uploads

# Check permissions
ls -la uploads/
```

## Support

Untuk bantuan deployment, hubungi: admin@internetclub.com
