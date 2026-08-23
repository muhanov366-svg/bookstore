// ============ МАРШРУТЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ ============

app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, role, favorites FROM users');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
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
    // Проверяем доступность книги
    const bookResult = await pool.query('SELECT * FROM books WHERE id = $1', [bookId]);
    const book = bookResult.rows[0];
    
    if (!book) {
      return res.status(404).json({ success: false, message: 'Книга не найдена' });
    }
    
    const available = book.total - book.rented;
    if (available <= 0) {
      return res.status(400).json({ success: false, message: 'Книга недоступна для аренды' });
    }
    
    // Вычисляем дату возврата
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
        returnDate.setDate(returnDate.getDate() + 14); // 2 недели
    }
    
    // Создаем запись об аренде
    await pool.query(
      `INSERT INTO rentals (book_id, user_id, rented_at, return_date, period) 
       VALUES ($1, $2, $3, $4, $5)`,
      [bookId, userId, now, returnDate, period]
    );
    
    // Обновляем количество арендованных книг
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
