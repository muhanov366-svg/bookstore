-- Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    favorites INTEGER[] DEFAULT '{}'
);

-- Создание таблицы книг
CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    year INTEGER,
    total INTEGER DEFAULT 0,
    rented INTEGER DEFAULT 0,
    price NUMERIC(10,2),
    url TEXT,
    rented_until TIMESTAMP
);

-- Создание таблицы аренды
CREATE TABLE IF NOT EXISTS rentals (
    id SERIAL PRIMARY KEY,
    book_id INTEGER REFERENCES books(id),
    user_id INTEGER REFERENCES users(id),
    rented_at TIMESTAMP DEFAULT NOW(),
    return_date TIMESTAMP,
    period VARCHAR(50)
);

-- Создание таблицы заказов
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    book_id INTEGER REFERENCES books(id),
    book_title VARCHAR(255),
    full_name VARCHAR(255),
    address TEXT,
    payment_method VARCHAR(100),
    price NUMERIC(10,2),
    ordered_at TIMESTAMP DEFAULT NOW()
);

-- Вставка начальных данных
INSERT INTO users (email, password, role) VALUES 
('admin@mail.com', 'password-123456', 'admin'),
('user@mail.com', 'password-123456', 'user')
ON CONFLICT (email) DO NOTHING;

INSERT INTO books (title, author, category, year, total, rented, price, url) VALUES 
('Война и мир', 'Лев Толстой', 'Роман', 1869, 5, 0, 500, 'https://example.com/book1'),
('Преступление и наказание', 'Фёдор Достоевский', 'Роман', 1866, 6, 1, 450, 'https://example.com/book2'),
('Мастер и Маргарита', 'Михаил Булгаков', 'Роман', 1967, 4, 0, 550, 'https://example.com/book3'),
('1984', 'Джордж Оруэлл', 'Фантастика', 1949, 6, 0, 400, 'https://example.com/book4'),
('Маленький принц', 'Антуан де Сент-Экзюпери', 'Сказка', 1943, 8, 0, 350, 'https://example.com/book5')
ON CONFLICT DO NOTHING;