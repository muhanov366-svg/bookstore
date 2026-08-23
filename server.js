const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// 1. Сначала создаем pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// 2. Потом создаем Express app
const app = express();
const PORT = process.env.PORT || 3000;

// 3. Потом middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 4. Потом health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 5. Потом все маршруты
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    console.log('Попытка входа:', email);
    
    const result = await pool.query(
      'SELECT id, email, role, favorites FROM users WHERE email = $1 AND password = $2',
      [email, password]
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      user.favorites = user.favorites || [];
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: 'Неверный email или пароль' });
    }
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// ... остальные маршруты ...

// 6. В самом конце - запуск сервера
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});
