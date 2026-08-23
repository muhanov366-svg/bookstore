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

// ... остальной код без изменений