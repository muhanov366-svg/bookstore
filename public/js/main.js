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
    
    // Обработчики событий
    document.getElementById('sortCategory').addEventListener('change', function(e) {
        currentSort = e.target.value;
        displayBooks(sortBooks(allBooks, currentSort));
    });
    
    document.getElementById('favoritesLink').addEventListener('click', function(e) {
        e.preventDefault();
        loadFavorites();
    });
    
    document.getElementById('catalogLink').addEventListener('click', function(e) {
        e.preventDefault();
        displayBooks(sortBooks(allBooks, currentSort));
    });
});

// Загрузка книг с сервера
async function loadBooks() {
    try {
        const response = await fetch('/api/books');
        allBooks = await response.json();
        displayBooks(sortBooks(allBooks, currentSort));
    } catch (error) {
        console.error('Ошибка загрузки книг:', error);
    }
}

// Сортировка книг
function sortBooks(books, sortType) {
    const sorted = [...books];
    
    switch(sortType) {
        case 'category':
            sorted.sort((a, b) => a.category.localeCompare(b.category));
            break;
        case 'author':
            sorted.sort((a, b) => a.author.localeCompare(b.author));
            break;
        case 'year-asc':
            sorted.sort((a, b) => a.year - b.year);
            break;
        case 'year-desc':
            sorted.sort((a, b) => b.year - a.year);
            break;
        default:
            // По умолчанию - по ID
            sorted.sort((a, b) => a.id - b.id);
    }
    
    return sorted;
}

// Отображение книг
function displayBooks(books) {
    const catalog = document.getElementById('catalog');
    catalog.innerHTML = '';
    
    if (books.length === 0) {
        catalog.innerHTML = '<p>Книги не найдены</p>';
        return;
    }
    
    books.forEach(book => {
        const available = book.total - book.rented;
        const isAvailable = available > 0;
        const isRented = book.rented > 0;
        
        let statusClass = 'status-available';
        let statusText = 'В наличии';
        
        if (!isAvailable) {
            statusClass = 'status-unavailable';
            statusText = 'Нет в наличии';
        } else if (isRented) {
            statusClass = 'status-rented';
            statusText = 'В аренде';
            if (book.rentedUntil) {
                const date = new Date(book.rentedUntil);
                statusText += ` до ${date.toLocaleDateString()}`;
            }
        }
        
        // Проверяем, в избранном ли книга
        const isFavorite = currentUser.favorites && currentUser.favorites.includes(book.id);
        
        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `
            <h3>${book.title}</h3>
            <div class="author">✍️ ${book.author}</div>
            <div class="category">${book.category}</div>
            <div class="year">📅 ${book.year}</div>
            <div class="price">💰 ${book.price} руб.</div>
            <div class="status ${statusClass}">${statusText}</div>
            <div style="font-size: 14px; color: #666; margin-bottom: 10px;">
                Доступно: ${available} из ${book.total}
            </div>
            <button class="favorite-btn" onclick="toggleFavorite(${book.id})">
                ${isFavorite ? '❤️' : '🤍'}
            </button>
            <div class="actions">
                ${book.url ? `<button class="btn btn-secondary" onclick="window.open('${book.url}', '_blank')">📖 Читать</button>` : ''}
                <button class="btn btn-primary" onclick="openBuyModal(${book.id})">🛒 Купить</button>
                ${isAvailable ? `<button class="btn btn-success" onclick="openRentModal(${book.id})">📚 Арендовать</button>` : ''}
            </div>
        `;
        
        catalog.appendChild(card);
    });
}

// Работа с избранным
async function toggleFavorite(bookId) {
    try {
        const isFavorite = currentUser.favorites && currentUser.favorites.includes(bookId);
        
        let url = '/api/favorites';
        let method = 'POST';
        let body = JSON.stringify({ userId: currentUser.id, bookId });
        
        if (isFavorite) {
            method = 'DELETE';
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: body
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Обновляем данные пользователя
            const userResponse = await fetch(`/api/users/${currentUser.id}`);
            const userData = await userResponse.json();
            currentUser = userData;
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            // Перезагружаем книги
            loadBooks();
        }
    } catch (error) {
        console.error('Ошибка при работе с избранным:', error);
    }
}

// Загрузка избранных книг
async function loadFavorites() {
    try {
        const response = await fetch(`/api/favorites/${currentUser.id}`);
        const favorites = await response.json();
        displayBooks(favorites);
    } catch (error) {
        console.error('Ошибка загрузки избранного:', error);
    }
}

// Модальное окно аренды
let rentBookId = null;

function openRentModal(bookId) {
    rentBookId = bookId;
    const book = allBooks.find(b => b.id === bookId);
    document.getElementById('rentBookTitle').textContent = `Книга: ${book.title}`;
    document.getElementById('rentModal').style.display = 'flex';
}

function closeRentModal() {
    document.getElementById('rentModal').style.display = 'none';
    rentBookId = null;
}

async function confirmRent() {
    if (!rentBookId) return;
    
    const period = document.getElementById('rentPeriod').value;
    
    try {
        const response = await fetch('/api/rent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bookId: rentBookId,
                userId: currentUser.id,
                period: period
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Книга успешно арендована!');
            closeRentModal();
            loadBooks();
        } else {
            alert(data.message || 'Ошибка при аренде');
        }
    } catch (error) {
        alert('Ошибка подключения к серверу');
    }
}

// Модальное окно покупки
let buyBookId = null;

function openBuyModal(bookId) {
    buyBookId = bookId;
    const book = allBooks.find(b => b.id === bookId);
    document.getElementById('buyBookTitle').textContent = `Книга: ${book.title} (${book.price} руб.)`;
    document.getElementById('buyModal').style.display = 'flex';
}

function closeBuyModal() {
    document.getElementById('buyModal').style.display = 'none';
    buyBookId = null;
    document.getElementById('orderForm').reset();
}

// Обработка заказа
document.addEventListener('DOMContentLoaded', function() {
    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
        orderForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!buyBookId) return;
            
            const fullName = document.getElementById('fullName').value;
            const address = document.getElementById('address').value;
            const paymentMethod = document.getElementById('paymentMethod').value;
            
            try {
                const response = await fetch('/api/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: currentUser.id,
                        bookId: buyBookId,
                        fullName,
                        address,
                        paymentMethod
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert('Заказ успешно оформлен! Спасибо за покупку!');
                    closeBuyModal();
                    loadBooks();
                } else {
                    alert(data.message || 'Ошибка при оформлении заказа');
                }
            } catch (error) {
                alert('Ошибка подключения к серверу');
            }
        });
    }
});