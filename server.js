const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// Создаем пул подключений к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Используем переменную окружения
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Создаем Express приложение
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));


// ============ ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ============

async function initDatabase() {
  try {
    // Создаем таблицу пользователей
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        favorites INTEGER[] DEFAULT '{}'
      );
    `);

    // Создаем таблицу книг
    // Находите этот блок в функции initDatabase():
await pool.query(`
  CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    year INTEGER,
    total INTEGER DEFAULT 0,
    rented INTEGER DEFAULT 0,
    price NUMERIC(10, 2),
    url TEXT,
    rented_until TIMESTAMP
  );
`);

    // Создаем таблицу аренды
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rentals (
        id SERIAL PRIMARY KEY,
        book_id INTEGER REFERENCES books(id),
        user_id INTEGER REFERENCES users(id),
        rented_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        return_date TIMESTAMP NOT NULL,
        period VARCHAR(50)
      );
    `);

    // Создаем таблицу заказов
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        book_id INTEGER REFERENCES books(id),
        book_title VARCHAR(255),
        full_name VARCHAR(255),
        address TEXT,
        payment_method VARCHAR(50),
        price NUMERIC(10, 2),
        ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Проверяем наличие начальных данных
    const usersCount = await pool.query('SELECT COUNT(*) FROM users');
    if (usersCount.rows[0].count === '0') {
      // Добавляем начальных пользователей
      await pool.query(`
        INSERT INTO users (email, password, role) VALUES 
        ('admin@mail.com', 'password-123456', 'admin'),
        ('user@mail.com', 'password-123456', 'user')
      `);
      console.log('Начальные пользователи созданы');
    }

    const booksCount = await pool.query('SELECT COUNT(*) FROM books');
    if (booksCount.rows[0].count === '0') {
      // Добавляем начальные книги
      await pool.query(`
        INSERT INTO books (title, author, category, year, total, price, url) VALUES
        ('Война и мир', 'Лев Толстой', 'Роман', 1869, 5, 500, 'https://example.com/book1'),
        ('Преступление и наказание', 'Фёдор Достоевский', 'Роман', 1866, 3, 450, 'https://example.com/book2'),
        ('Мастер и Маргарита', 'Михаил Булгаков', 'Роман', 1967, 4, 550, 'https://example.com/book3'),
        ('1984', 'Джордж Оруэлл', 'Фантастика', 1949, 6, 400, 'https://example.com/book4'),
        ('Маленький принц', 'Антуан де Сент-Экзюпери', 'Сказка', 1943, 8, 350, 'https://example.com/book5')
      `);
      console.log('Начальные книги созданы');
    }

    console.log('База данных инициализирована успешно');
  } catch (error) {
    console.error('Ошибка инициализации базы данных:', error);
  }
}

// Вызываем инициализацию базы данных при старте
initDatabase();

// ============ МАРШРУТЫ ДЛЯ АВТОРИЗАЦИИ ============

// Вход в систему
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
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

// Получить пользователя по ID
app.get('/api/users/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  
  try {
    const result = await pool.query(
      'SELECT id, email, role, favorites FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      user.favorites = user.favorites || [];
      res.json(user);
    } else {
      res.status(404).json({ message: 'Пользователь не найден' });
    }
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// ============ МАРШРУТЫ ДЛЯ КНИГ ============

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

// Получить книгу по ID
app.get('/api/books/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  
  try {
    const result = await pool.query('SELECT * FROM books WHERE id = $1', [id]);
    
    if (result.rows.length > 0) {
      const book = result.rows[0];
      book.rentedUntil = book.rented_until;
      delete book.rented_until;
      res.json(book);
    } else {
      res.status(404).json({ message: 'Книга не найдена' });
    }
  } catch (error) {
    console.error('Ошибка получения книги:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Добавить книгу
app.post('/api/books', async (req, res) => {
  const { title, author, category, year, total, price, url } = req.body;
  
  if (!title || !author || !category || !year || !total || !price) {
    return res.status(400).json({ 
      success: false, 
      message: 'Все поля обязательны для заполнения' 
    });
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO books (title, author, category, year, total, rented, price, url)
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7)
       RETURNING *`,
      [title, author, category, year, total, price, url || '']
    );
    
    const newBook = result.rows[0];
    newBook.rentedUntil = newBook.rented_until;
    delete newBook.rented_until;
    
    res.json({ success: true, book: newBook });
  } catch (error) {
    console.error('Ошибка добавления книги:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// Обновить книгу
app.put('/api/books/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, author, category, year, total, price, url } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE books 
       SET title = $1, author = $2, category = $3, year = $4, total = $5, price = $6, url = $7
       WHERE id = $8
       RETURNING *`,
      [title, author, category, year, total, price, url, id]
    );
    
    if (result.rows.length > 0) {
      const updatedBook = result.rows[0];
      updatedBook.rentedUntil = updatedBook.rented_until;
      delete updatedBook.rented_until;
      res.json({ success: true, book: updatedBook });
    } else {
      res.status(404).json({ success: false, message: 'Книга не найдена' });
    }
  } catch (error) {
    console.error('Ошибка обновления книги:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// Удалить книгу
app.delete('/api/books/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  
  try {
    const result = await pool.query('DELETE FROM books WHERE id = $1', [id]);
    
    if (result.rowCount > 0) {
      res.json({ success: true, message: 'Книга удалена' });
    } else {
      res.status(404).json({ success: false, message: 'Книга не найдена' });
    }
  } catch (error) {
    console.error('Ошибка удаления книги:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// ============ МАРШРУТЫ ДЛЯ АРЕНДЫ ============

// Арендовать книгу
app.post('/api/rent', async (req, res) => {
  const { bookId, userId, period } = req.body;
  
  try {
    const bookResult = await pool.query(
      'SELECT * FROM books WHERE id = $1 AND total - rented > 0',
      [bookId]
    );
    
    if (bookResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Нет доступных экземпляров' });
    }
    
    const book = bookResult.rows[0];
    
    const now = new Date();
    let returnDate = new Date(now);
    
    switch(period) {
      case '2weeks':
        returnDate.setDate(now.getDate() + 14);
        break;
      case '1month':
        returnDate.setMonth(now.getMonth() + 1);
        break;
      case '3months':
        returnDate.setMonth(now.getMonth() + 3);
        break;
      default:
        return res.status(400).json({ success: false, message: 'Неверный период аренды' });
    }
    
    await pool.query(
      'UPDATE books SET rented = rented + 1, rented_until = $1 WHERE id = $2',
      [returnDate, bookId]
    );
    
    await pool.query(
      `INSERT INTO rentals (book_id, user_id, return_date, period)
       VALUES ($1, $2, $3, $4)`,
      [bookId, userId, returnDate, period]
    );
    
    res.json({ 
      success: true, 
      message: 'Книга успешно арендована',
      returnDate: returnDate.toISOString()
    });
  } catch (error) {
    console.error('Ошибка аренды книги:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// ============ МАРШРУТЫ ДЛЯ ИЗБРАННОГО ============

// Добавить в избранное
app.post('/api/favorites', async (req, res) => {
  const { userId, bookId } = req.body;
  
  try {
    const userResult = await pool.query(
      'SELECT favorites FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }
    
    const favorites = userResult.rows[0].favorites || [];
    
    if (favorites.includes(bookId)) {
      return res.status(400).json({ success: false, message: 'Книга уже в избранном' });
    }
    
    const newFavorites = [...favorites, bookId];
    await pool.query(
      'UPDATE users SET favorites = $1 WHERE id = $2',
      [newFavorites, userId]
    );
    
    res.json({ success: true, message: 'Книга добавлена в избранное' });
  } catch (error) {
    console.error('Ошибка добавления в избранное:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// Удалить из избранного
app.delete('/api/favorites', async (req, res) => {
  const { userId, bookId } = req.body;
  
  try {
    const userResult = await pool.query(
      'SELECT favorites FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }
    
    const favorites = userResult.rows[0].favorites || [];
    const newFavorites = favorites.filter(id => id !== bookId);
    
    await pool.query(
      'UPDATE users SET favorites = $1 WHERE id = $2',
      [newFavorites, userId]
    );
    
    res.json({ success: true, message: 'Книга удалена из избранного' });
  } catch (error) {
    console.error('Ошибка удаления из избранного:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// Получить избранное пользователя
app.get('/api/favorites/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  
  try {
    const userResult = await pool.query(
      'SELECT favorites FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }
    
    const favorites = userResult.rows[0].favorites || [];
    
    const booksResult = await pool.query(
      'SELECT * FROM books WHERE id = ANY($1)',
      [favorites]
    );
    
    const books = booksResult.rows.map(book => ({
      ...book,
      rentedUntil: book.rented_until,
      rented_until: undefined
    }));
    
    res.json(books);
  } catch (error) {
    console.error('Ошибка получения избранного:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// ============ МАРШРУТЫ ДЛЯ ЗАКАЗОВ ============

// Оформить заказ (покупка)
app.post('/api/orders', async (req, res) => {
  const { userId, bookId, fullName, address, paymentMethod } = req.body;
  
  try {
    const bookResult = await pool.query(
      'SELECT * FROM books WHERE id = $1',
      [bookId]
    );
    
    if (bookResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Книга не найдена' });
    }
    
    const book = bookResult.rows[0];
    const available = book.total - book.rented;
    if (available <= 0) {
      return res.status(400).json({ success: false, message: 'Книга временно недоступна для покупки' });
    }
    
    await pool.query(
      `INSERT INTO orders (user_id, book_id, book_title, full_name, address, payment_method, price)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, bookId, book.title, fullName, address, paymentMethod, book.price]
    );
    
    await pool.query(
      'UPDATE books SET total = total - 1 WHERE id = $1',
      [bookId]
    );
    
    res.json({ 
      success: true, 
      message: 'Заказ успешно оформлен'
    });
  } catch (error) {
    console.error('Ошибка оформления заказа:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// ============ АВТОМАТИЧЕСКАЯ ПРОВЕРКА АРЕНДЫ ============

async function checkOverdueRentals() {
  try {
    const now = new Date();
    
    const result = await pool.query(
      'SELECT * FROM books WHERE rented_until < $1 AND rented > 0',
      [now]
    );
    
    for (const book of result.rows) {
      await pool.query(
        'UPDATE books SET rented = 0, rented_until = NULL WHERE id = $1',
        [book.id]
      );
      console.log(`Книга "${book.title}" возвращена автоматически`);
    }
  } catch (error) {
    console.error('Ошибка проверки аренды:', error);
  }
}

setInterval(checkOverdueRentals, 24 * 60 * 60 * 1000);

// ============ ЗАПУСК СЕРВЕРА ============

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log('Данные для входа:');
  console.log('Админ: admin@mail.com / password-123456');
  console.log('Пользователь: user@mail.com / password-123456');
});
// ============ МАРШРУТЫ ДЛЯ АДМИНИСТРАТОРА (Пользователи) ============

// Получить всех пользователей
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, role, favorites FROM users ORDER BY id'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка получения пользователей:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Получить все аренды
app.get('/api/rentals', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM rentals ORDER BY rented_at DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка получения аренд:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Получить детальную информацию о пользователе (с арендами)
app.get('/api/users/:id/details', async (req, res) => {
    const id = parseInt(req.params.id);
    
    try {
        // Получаем данные пользователя
        const userResult = await pool.query(
            'SELECT id, email, role, favorites FROM users WHERE id = $1',
            [id]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        
        // Получаем аренды пользователя с названиями книг
        const rentalsResult = await pool.query(
            `SELECT r.*, b.title as book_title, b.author as book_author
             FROM rentals r
             LEFT JOIN books b ON r.book_id = b.id
             WHERE r.user_id = $1
             ORDER BY r.rented_at DESC`,
            [id]
        );
        
        res.json({
            user: userResult.rows[0],
            rentals: rentalsResult.rows
        });
    } catch (error) {
        console.error('Ошибка получения данных пользователя:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Принудительный возврат книги администратором
app.post('/api/admin/return-book', async (req, res) => {
    const { rentalId } = req.body;
    
    try {
        // Получаем информацию об аренде
        const rentalResult = await pool.query(
            'SELECT * FROM rentals WHERE id = $1',
            [rentalId]
        );
        
        if (rentalResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Аренда не найдена' });
        }
        
        const rental = rentalResult.rows[0];
        
        // Уменьшаем количество арендованных книг
        await pool.query(
            'UPDATE books SET rented = rented - 1, rented_until = NULL WHERE id = $1',
            [rental.book_id]
        );
        
        // Удаляем запись об аренде
        await pool.query('DELETE FROM rentals WHERE id = $1', [rentalId]);
        
        res.json({ success: true, message: 'Книга успешно возвращена' });
    } catch (error) {
        console.error('Ошибка возврата книги:', error);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});
