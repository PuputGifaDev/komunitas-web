const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME
});

async function seed() {
  try {
    console.log('Seeding database...');
    
    const adminCheck = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    
    if (adminCheck.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync('admin@123', 10);
      await pool.query(
        'INSERT INTO users (username, email, password, role, full_name, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
        ['admin', 'admin@internetclub.com', hashedPassword, 'admin', 'Administrator', true]
      );
      console.log('✓ Admin user created: admin / admin@123');
    } else {
      console.log('Admin user already exists');
    }
    
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', ['demo']);
    
    if (userCheck.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync('demo@123', 10);
      await pool.query(
        'INSERT INTO users (username, email, password, role, full_name, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
        ['demo', 'demo@internetclub.com', hashedPassword, 'user', 'Demo User', true]
      );
      console.log('✓ Demo user created: demo / demo@123');
    } else {
      console.log('Demo user already exists');
    }
    
    console.log('✓ Database seeding completed');
    process.exit(0);
  } catch (err) {
    console.error('✗ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
