const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Проверяем наличие DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ ОШИБКА: Переменная DATABASE_URL не найдена!');
  console.error('Пожалуйста, добавьте DATABASE_URL в настройки приложения на Orenza');
}

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

// ============ ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ============

async function initializeDB() {
  try {
    console.log('📦 Начинаем инициализацию базы данных...');
    
    // Проверяем подключение к БД
    const testResult = await pool.query('SELECT NOW() as now');
    console.log('✅ Подключение к БД успешно:', testResult.rows[0].now);
    
    // Проверяем наличие schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    console.log('📁 Путь к schema.sql:', schemaPath);
    
    if (fs.existsSync(schemaPath)) {
      console.log('✅ Файл schema.sql найден');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schema);
      console.log('✅ База данных инициализирована успешно');
    } else {
      console.log('⚠️ Файл schema.sql не найден, пропускаем инициализацию');
    }
    
    // Проверяем наличие таблиц
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('📋 Таблицы в базе данных:', tablesResult.rows.map(r => r.table_name));
    
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error);
    console.error('Детали ошибки:', error.message);
    console.error('Стек ошибки:', error.stack);
  }
}

// Middleware для логирования запросов
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    database: process.env.DATABASE_URL ? 'configured' : 'missing',
    timestamp: new Date().toISOString()
  });
});

// Тест подключения к БД
app.get('/api/test-db', async (req, res) => {
  try {
    console.log('🔍 Тестируем подключение к БД...');
    const result = await pool.query('SELECT NOW() as now');
    console.log('✅ Подключение к БД работает');
    res.json({ 
      success: true, 
      dbTime: result.rows[0].now,
      databaseUrl: process.env.DATABASE_URL ? 'configured' : 'missing'
    });
  } catch (error) {
    console.error('❌ Ошибка подключения к БД:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      databaseUrl: process.env.DATABASE_URL ? 'configured' : 'missing'
    });
  }
});

// ============ АВТОРИЗАЦИЯ ============

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  console.log('🔐 Попытка входа:', email);
  
  try {
    const result = await pool.query(
      'SELECT id, email, role, favorites FROM users WHERE email = $1 AND password = $2',
      [email, password]
    );
    
    console.log('📊 Результат запроса:', result.rows.length, 'пользователей найдено');
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      user.favorites = user.favorites || [];
      console.log('✅ Успешный вход для:', user.email);
      res.json({ success: true, user });
    } else {
      console.log('❌ Неверный email или пароль');
      res.status(401).json({ success: false, message: 'Неверный email или пароль' });
    }
  } catch (error) {
    console.error('❌ Ошибка авторизации:', error);
    console.error('Детали ошибки:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера при авторизации',
      error: error.message 
    });
  }
});

// ============ МАРШРУТЫ ДЛЯ КНИГ ============

app.get('/api/books', async (req, res) => {
  try {
    console.log('📚 Получаем список книг...');
    const result = await pool.query('SELECT * FROM books');
    const books = result.rows.map(book => ({
      ...book,
      rentedUntil: book.rented_until,
      rented_until: undefined
    }));
    console.log(`✅ Найдено книг: ${books.length}`);
    res.json(books);
  } catch (error) {
    console.error('❌ Ошибка получения книг:', error);
    res.status(500).json({ 
      message: 'Ошибка сервера',
      error: error.message 
    });
  }
});

// ============ МАРШРУТЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ ============

app.get('/api/users', async (req, res) => {
  try {
    console.log('👥 Получаем список пользователей...');
    const result = await pool.query('SELECT id, email, role, favorites FROM users');
    console.log(`✅ Найдено пользователей: ${result.rows.length}`);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Ошибка получения пользователей:', error);
    res.status(500).json({ 
      message: 'Ошибка сервера',
      error: error.message 
    });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, role, favorites FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ message: 'Пользователь не найден' });
    }
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

app.get('/api/users/:id/details', async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, email, role, favorites FROM users WHERE id = $1', [req.params.id]);
    const rentalsResult = await pool.query(
      `SELECT r.*, b.title as book_title 
       FROM rentals r 
       LEFT JOIN books b ON r.book_id = b.id 
       WHERE r.user_id = $1`,
      [req.params.id]
    );
    
    res.json({
      user: userResult.rows[0],
      rentals: rentalsResult.rows
    });
  } catch (error) {
    console.error('Ошибка получения деталей пользователя:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// ============ МАРШРУТЫ ДЛЯ АРЕНДЫ ============

app.get('/api/rentals', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rentals');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения аренд:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

app.post('/api/rent', async (req, res) => {
  const { bookId, userId, period } = req.body;
  
  try {
    const bookResult = await pool.query('SELECT * FROM books WHERE id = $1', [bookId]);
    const book = bookResult.rows[0];
    
    if (!book) {
      return res.status(404).json({ success: false, message: 'Книга не найдена' });
    }
    
    const available = book.total - book.rented;
    if (available <= 0) {
      return res.status(400).json({ success: false, message: 'Книга недоступна для аренды' });
    }
    
    const now = new Date();
    let returnDate = new Date();
    
    switch(period) {
      case '1month':
        returnDate.setMonth(returnDate.getMonth() + 1);
        break;
      case '3months':
        returnDate.setMonth(returnDate.getMonth() + 3);
        break;
      default:
        returnDate.setDate(returnDate.getDate() + 14);
    }
    
    await pool.query(
      `INSERT INTO rentals (book_id, user_id, rented_at, return_date, period) 
       VALUES ($1, $2, $3, $4, $5)`,
      [bookId, userId, now, returnDate, period]
    );
    
    await pool.query(
      'UPDATE books SET rented = rented + 1, rented_until = $2 WHERE id = $1',
      [bookId, returnDate]
    );
    
    res.json({ success: true, message: 'Книга успешно арендована' });
  } catch (error) {
    console.error('Ошибка аренды книги:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// ============ МАРШРУТЫ ДЛЯ ИЗБРАННОГО ============

app.post('/api/favorites', async (req, res) => {
  const { userId, bookId } = req.body;
  
  try {
    const userResult = await pool.query('SELECT favorites FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }
    
    const favorites = user.favorites || [];
    favorites.push(bookId);
    
    await pool.query('UPDATE users SET favorites = $1 WHERE id = $2', [favorites, userId]);
    
    res.json({ success: true, message: 'Книга добавлена в избранное' });
  } catch (error) {
    console.error('Ошибка добавления в избранное:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

app.delete('/api/favorites', async (req, res) => {
  const { userId, bookId } = req.body;
  
  try {
    const userResult = await pool.query('SELECT favorites FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }
    
    const favorites = (user.favorites || []).filter(id => id !== bookId);
    
    await pool.query('UPDATE users SET favorites = $1 WHERE id = $2', [favorites, userId]);
    
    res.json({ success: true, message: 'Книга удалена из избранного' });
  } catch (error) {
    console.error('Ошибка удаления из избранного:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

app.get('/api/favorites/:userId', async (req, res) => {
  try {
    const userResult = await pool.query('SELECT favorites FROM users WHERE id = $1', [req.params.userId]);
    const user = userResult.rows[0];
    
    if (!user || !user.favorites) {
      return res.json([]);
    }
    
    const favorites = user.favorites;
    const booksResult = await pool.query('SELECT * FROM books WHERE id = ANY($1)', [favorites]);
    
    res.json(booksResult.rows);
  } catch (error) {
    console.error('Ошибка получения избранного:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// ============ МАРШРУТЫ ДЛЯ ЗАКАЗОВ ============

app.post('/api/orders', async (req, res) => {
  const { userId, bookId, fullName, address, paymentMethod } = req.body;
  
  try {
    const bookResult = await pool.query('SELECT * FROM books WHERE id = $1', [bookId]);
    const book = bookResult.rows[0];
    
    if (!book) {
      return res.status(404).json({ success: false, message: 'Книга не найдена' });
    }
    
    await pool.query(
      `INSERT INTO orders (user_id, book_id, book_title, full_name, address, payment_method, price, ordered_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, bookId, book.title, fullName, address, paymentMethod, book.price, new Date()]
    );
    
    res.json({ success: true, message: 'Заказ успешно оформлен' });
  } catch (error) {
    console.error('Ошибка оформления заказа:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// ============ CRUD ДЛЯ КНИГ ============

app.post('/api/books', async (req, res) => {
  const { title, author, category, year, total, price, url } = req.body;
  
  try {
    await pool.query(
      `INSERT INTO books (title, author, category, year, total, rented, price, url) 
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7)`,
      [title, author, category, year, total, price, url]
    );
    
    res.json({ success: true, message: 'Книга добавлена' });
  } catch (error) {
    console.error('Ошибка добавления книги:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

app.put('/api/books/:id', async (req, res) => {
  const { id } = req.params;
  const { title, author, category, year, total, price, url } = req.body;
  
  try {
    await pool.query(
      `UPDATE books SET title = $2, author = $3, category = $4, year = $5, total = $6, price = $7, url = $8 
       WHERE id = $1`,
      [id, title, author, category, year, total, price, url]
    );
    
    res.json({ success: true, message: 'Книга обновлена' });
  } catch (error) {
    console.error('Ошибка обновления книги:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

app.delete('/api/books/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('DELETE FROM books WHERE id = $1', [id]);
    
    res.json({ success: true, message: 'Книга удалена' });
  } catch (error) {
    console.error('Ошибка удаления книги:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// ============ ЗАПУСК СЕРВЕРА ============

// Инициализация БД при запуске
initializeDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log('📍 URL приложения: http://localhost:' + PORT);
    console.log('👤 Данные для входа:');
    console.log('   Админ: admin@mail.com / password-123456');
    console.log('   Пользователь: user@mail.com / password-123456');
  });
});
