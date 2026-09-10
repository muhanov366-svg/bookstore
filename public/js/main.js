// main.js - Основная логика для пользователя

let currentUser = null;
let allBooks = [];
let currentSort = 'default';

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем авторизацию
    currentUser = checkAuth();
    if (!currentUser) return;
    
    // Если админ, перенаправляем
    if (currentUser.role === 'admin') {
        window.location.href = 'admin.html';
        return;
    }
    
    // Отображаем информацию о пользователе
    document.getElementById('userInfo').textContent = `👤 ${currentUser.email}`;
    
    // Показываем основное приложение
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    // Загружаем книги
    loadBooks();
    
    // Загружаем напоминания об аренде
    loadReminders();
    
    // Обработчики событий
    document.getElementById('sortCategory').addEventListener('change
