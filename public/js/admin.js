// admin.js - Логика для администратора

let currentUser = null;
let allBooks = [];
let allUsers = [];
let allRentals = [];
let allOrders = [];

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    currentUser = checkAuth();
    if (!currentUser) return;
    
    if (currentUser.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }
    
    document.getElementById('adminInfo').textContent = `👑 ${currentUser.email}`;
    
    loadBooks();
    
    document.getElementById('addBookForm').addEventListener('submit', addBook);
    document.getElementById('editBookForm').addEventListener('submit', updateBook);
    
    document.getElementById('booksTab').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('booksSection');
        loadBooks();
    });
    
    document.getElementById('usersTab').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('usersSection');
        loadUsersAndRentals();
    });

    // ✅ Новая вкладка "Заказы"
    document.getElementById('ordersTab').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('ordersSection');
        loadOrders();
    });
});

// Переключение вкладок
function showSection(sectionId) {
    document.getElementById('booksSection').style.display = 'none';
    document.getElementById('usersSection').style.display = 'none';
    document.getElementById('ordersSection').style.display = 'none';  // ✅

    document.getElementById(sectionId).style.display = 'block';
    
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.style.backgroundColor = 'transparent';
        link.style.color = 'white';
    });
    
    const tabMap = {
        booksSection: 'booksTab',
        usersSection: 'usersTab',
        ordersSection: 'ordersTab'  // ✅
    };
    const tab = document.getElementById(tabMap[sectionId]);
    if (tab) {
        tab.style.backgroundColor = '#34495e';
        tab.style.color = '#ecf0f1';
        tab.style.borderRadius = '4px';
        tab.style.padding = '8px 15px';
    }
}

// Загрузка книг
async function loadBooks() {
    try {
        const response = await fetch('/api/books');
        allBooks = await response.json();
        displayAdminBooks(allBooks);
    } catch (error) {
        console.error('Ошибка загрузки книг:', error);
        document.getElementById('adminBookList').innerHTML = '<p>Ошибка загрузки книг</p>';
    }
}

// Отображение книг в админке
function displayAdminBooks(books) {
    const list = document.getElementById('adminBookList');
    list.innerHTML = '';
    
    if (books.length === 0) {
        list.innerHTML = '<p>Книги не найдены</p>';
        return;
    }
    
    books.forEach(book => {
        const available = book.total - book.rented;
        const isAvailable = available > 0;
        const isRented = book.rented > 0;
        
        let statusText = 'В наличии ✅';
        if (!isAvailable) {
            statusText = 'Нет в наличии ❌';
        } else if (isRented) {
            statusText = 'В аренде 📚';
            if (book.rented_until) {
                const date = new Date(book.rented_until);
                statusText += ` до ${date.toLocaleDateString()}`;
            }
        }
        
        const item = document.createElement('div');
        item.className = 'admin-book-item';
        item.innerHTML = `
            <div class="book-info">
                <div class="book-title"><strong>${book.title}</strong></div>
                <div class="book-details">
                    ${book.author} | ${book.category} | ${book.year} г.
                </div>
                <div class="book-details">
                    💰 ${book.price} руб. | 📚 ${available} из ${book.total} доступно
                </div>
                <div class="book-details">${statusText}</div>
            </div
