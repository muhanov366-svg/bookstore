const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// Подключение к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Логирование подключения
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ Установлен' : '✗ НЕ УСТАНОВЛЕН');

// Тест подключения к БД
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as now');
    res.json({ success: true, dbTime: result.rows[0].now });
  } catch (error) {
    console.error('❌ Ошибка подключения к БД:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ АВТОРИЗАЦИЯ ============

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  console.log('=== ПОПЫТКА ВХОДА ===');
  console.log('Email:', email);
  console.log('Password:', password ? '✓' : '✗');
  
  try {
    // Проверяем подключение
    const dbCheck = await pool.query('SELECT 1');
    console.log('✅ Подключение к БД работает');
    
    const result = await pool.query(
      'SELECT id, email, role, favorites FROM users WHERE email = $1 AND password = $2',
      [email, password]
    );
    
    console.log('Результат:', result.rows);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      user.favorites = user.favorites || [];
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: 'Неверный email или пароль' });
    }
  } catch (error) {
    console.error('❌ ОШИБКА:', error);
    console.error('Код:', error.code);
    console.error('Сообщение:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера',
      error: error.message
    });
  }
});

// Получить все книги
app.get('/api/books', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM books');
    const books = result.rows.map(book => ({
      ...book,
      rentedUntil: book.rented_until,
      rented_until: undefined
    }));
    res.json(books);
  } catch (error) {
    console.error('Ошибка получения книг:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// ============ ЗАПУСК СЕРВЕРА ============

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  console.log('Данные для входа:');
  console.log('Админ: admin@mail.com / password-123456');
  console.log('Пользователь: user@mail.com / password-123456');
});
