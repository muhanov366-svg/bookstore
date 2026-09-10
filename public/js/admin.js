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
    document.getElementById('ordersSection').style.display = 'none';

    document.getElementById(sectionId).style.display = 'block';

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.style.backgroundColor = 'transparent';
        link.style.color = 'white';
    });

    const tabMap = {
        booksSection: 'booksTab',
        usersSection: 'usersTab',
        ordersSection: 'ordersTab'
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
            </div>
            <div class="actions">
                <button class="btn btn-primary" onclick="openEditModal(${book.id})">✏️ Редактировать</button>
                <button class="btn btn-danger" onclick="deleteBook(${book.id})">🗑️ Удалить</button>
            </div>
        `;

        list.appendChild(item);
    });
}

// Загрузка пользователей и их арендованных книг
async function loadUsersAndRentals() {
    try {
        const usersResponse = await fetch('/api/users');
        allUsers = await usersResponse.json();

        const rentalsResponse = await fetch('/api/rentals');
        allRentals = await rentalsResponse.json();

        const booksResponse = await fetch('/api/books');
        const books = await booksResponse.json();
        const booksMap = {};
        books.forEach(book => {
            booksMap[book.id] = book;
        });

        displayUsersWithRentals(allUsers, allRentals, booksMap);
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        document.getElementById('usersList').innerHTML = '<p>Ошибка загрузки данных пользователей</p>';
    }
}

// Отображение пользователей с их арендованными книгами
function displayUsersWithRentals(users, rentals, booksMap) {
    const list = document.getElementById('usersList');
    list.innerHTML = '';

    if (users.length === 0) {
        list.innerHTML = '<p>Пользователи не найдены</p>';
        return;
    }

    users.forEach(user => {
        const userRentals = rentals.filter(r => r.user_id === user.id);

        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            border-left: 4px solid ${user.role === 'admin' ? '#e74c3c' : '#3498db'};
        `;

        let rentalsHtml = '';
        if (userRentals.length === 0) {
            rentalsHtml = '<p style="color: #95a5a6; margin: 10px 0;">Нет арендованных книг</p>';
        } else {
            rentalsHtml = '<div style="margin: 10px 0;">';
            userRentals.forEach(rental => {
                const book = booksMap[rental.book_id];
                const returnDate = new Date(rental.return_date);
                const now = new Date();
                const diffMs = returnDate - now;
                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                const isOverdue = diffDays < 0;
                const isSoon = !isOverdue && diffDays <= 3;
                const statusColor = isOverdue ? '#e74c3c' : (isSoon ? '#f39c12' : '#27ae60');
                const statusText = isOverdue
                    ? `ПРОСРОЧЕНА на ${Math.abs(diffDays)} дн.`
                    : (isSoon ? `Истекает через ${diffDays} дн.` : 'Активна');

                rentalsHtml += `
                    <div style="
                        padding: 10px;
                        margin: 5px 0;
                        background: ${isOverdue ? '#fdf2f2' : (isSoon ? '#fff8e1' : '#f0faf3')};
                        border-radius: 4px;
                        border-left: 3px solid ${statusColor};
                    ">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                            <div>
                                <strong>📖 ${book ? book.title : 'Книга удалена'}</strong><br>
                                ${book ? `Автор: ${book.author}<br>` : ''}
                                🗓️ До: ${returnDate.toLocaleDateString()}<br>
                                <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
                                ${isOverdue ? ' ⚠️' : (isSoon ? ' 🔔' : '')}
                            </div>
                            ${(isOverdue || isSoon) ? `
                                <button class="btn btn-secondary"
                                        style="font-size:12px; padding:6px 12px;"
                                        onclick="sendReminder(${rental.user_id}, '${(book ? book.title : 'Книга').replace(/'/g, "\\'")}', ${diffDays})">
                                    📨 Напомнить
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
            rentalsHtml += '</div>';
        }

        userCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                <div>
                    <h3 style="margin: 0;">
                        ${user.role === 'admin' ? '👑' : '👤'} 
                        ${user.email}
                        <span style="
                            font-size: 12px;
                            background: ${user.role === 'admin' ? '#e74c3c' : '#3498db'};
                            color: white;
                            padding: 2px 10px;
                            border-radius: 12px;
                            margin-left: 10px;
                        ">
                            ${user.role === 'admin' ? 'Админ' : 'Пользователь'}
                        </span>
                    </h3>
                    <div style="color: #7f8c8d; font-size: 14px; margin-top: 5px;">
                        ID: ${user.id} | 
                        Аренд: ${userRentals.length} 
                        ${userRentals.filter(r => new Date() > new Date(r.return_date)).length > 0 ? 
                            `| ⚠️ ${userRentals.filter(r => new Date() > new Date(r.return_date)).length} просрочено` : 
                            ''}
                    </div>
                </div>
                <div>
                    <button class="btn btn-secondary" onclick="viewUserDetails(${user.id})" style="font-size: 12px;">
                        📋 Подробнее
                    </button>
                </div>
            </div>
            ${rentalsHtml}
        `;

        list.appendChild(userCard);
    });
}

// Просмотр детальной информации о пользователе
async function viewUserDetails(userId) {
    try {
        const response = await fetch(`/api/users/${userId}/details`);
        if (!response.ok) throw new Error('Ошибка загрузки данных');

        const data = await response.json();

        let message = `👤 Пользователь: ${data.user.email}\n`;
        message += `Роль: ${data.user.role === 'admin' ? 'Администратор' : 'Пользователь'}\n`;
        message += `Избранное: ${data.user.favorites ? data.user.favorites.length : 0} книг\n\n`;

        if (data.rentals && data.rentals.length > 0) {
            message += '📚 История аренд:\n';
            data.rentals.forEach((rental, index) => {
                message += `${index + 1}. ${rental.book_title || 'Книга'}\n`;
                message += `   Арендована: ${new Date(rental.rented_at).toLocaleDateString()}\n`;
                message += `   Возврат до: ${new Date(rental.return_date).toLocaleDateString()}\n`;
                const isOverdue = new Date() > new Date(rental.return_date);
                message += `   Статус: ${isOverdue ? 'ПРОСРОЧЕНА ⚠️' : 'Активна ✅'}\n\n`;
            });
        } else {
            message += 'Нет истории аренд.\n';
        }

        // ✅ Показываем заказы пользователя
        if (data.orders && data.orders.length > 0) {
            message += '\n🛒 Заказы:\n';
            data.orders.forEach((order, index) => {
                message += `${index + 1}. ${order.book_title} — ${order.price} руб.\n`;
                message += `   Оформлен: ${new Date(order.ordered_at).toLocaleString()}\n`;
                message += `   Получатель: ${order.full_name}\n`;
                message += `   Адрес: ${order.address}\n`;
                message += `   Оплата: ${order.payment_method}\n\n`;
            });
        } else {
            message += '\nЗаказов нет.\n';
        }

        alert(message);
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось загрузить данные пользователя');
    }
}

// ============ ЗАКАЗЫ ============

// ✅ Загрузка всех заказов
async function loadOrders() {
    try {
        const response = await fetch('/api/orders');
        allOrders = await response.json();
        displayOrders(allOrders);
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        document.getElementById('ordersList').innerHTML = '<p>Ошибка загрузки заказов</p>';
    }
}

// ✅ Отображение заказов
function displayOrders(orders) {
    const list = document.getElementById('ordersList');
    const stats = document.getElementById('ordersStats');
    list.innerHTML = '';

    if (!orders || orders.length === 0) {
        stats.textContent = '';
        list.innerHTML = '<p>Заказов пока нет</p>';
        return;
    }

    const totalSum = orders.reduce((sum, o) => sum + Number(o.price || 0), 0);
    stats.textContent = `Всего заказов: ${orders.length} | Общая сумма: ${totalSum.toFixed(2)} руб.`;

    orders.forEach(order => {
        const date = new Date(order.ordered_at);
        const paymentLabels = {
            card: '💳 Банковская карта',
            cash: '💵 Наличные',
            online: '🌐 Онлайн-платёж'
        };
        const paymentText = paymentLabels[order.payment_method] || order.payment_method;

        const item = document.createElement('div');
        item.className = 'admin-book-item';
        item.innerHTML = `
            <div class="book-info">
                <div class="book-title">
                    <strong>#${order.id} — ${order.book_title}</strong>
                </div>
                <div class="book-details">
                    👤 ${order.user_email || ('ID ' + order.user_id)}
                    | 💰 ${order.price} руб.
                    | ${paymentText}
                </div>
                <div class="book-details">
                    📦 ${order.full_name}, ${order.address}
                </div>
                <div class="book-details">
                    🗓️ ${date.toLocaleString()}
                </div>
            </div>
            <div class="actions">
                <button class="btn btn-secondary"
                        onclick="viewOrderDetails(${order.id})">📋 Подробнее</button>
            </div>
        `;

        list.appendChild(item);
    });
}

// ✅ Детали заказа
function viewOrderDetails(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    const date = new Date(order.ordered_at);
    const message =
        `🛒 Заказ #${order.id}\n\n` +
        `📖 Книга: ${order.book_title}\n` +
        `👤 Пользователь: ${order.user_email || ('ID ' + order.user_id)}\n` +
        `💰 Цена: ${order.price} руб.\n` +
        `📅 Оформлен: ${date.toLocaleString()}\n\n` +
        `📦 Получатель: ${order.full_name}\n` +
        `🏠 Адрес: ${order.address}\n` +
        `💳 Оплата: ${order.payment_method}`;

    alert(message);
}

// Добавление книги
async function addBook(e) {
    e.preventDefault();

    const title = document.getElementById('title').value;
    const author = document.getElementById('author').value;
    const category = document.getElementById('category').value;
    const year = document.getElementById('year').value;
    const total = document.getElementById('total').value;
    const price = document.getElementById('price').value;
    const url = document.getElementById('url').value;

    try {
        const response = await fetch('/api/books', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, author, category, year, total, price, url })
        });

        const data = await response.json();

        if (data.success) {
            alert('Книга успешно добавлена!');
            document.getElementById('addBookForm').reset();
            loadBooks();
        } else {
            alert(data.message || 'Ошибка при добавлении книги');
        }
    } catch (error) {
        alert('Ошибка подключения к серверу');
    }
}

// Редактирование книги
function openEditModal(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book) return;

    document.getElementById('editBookId').value = book.id;
    document.getElementById('editTitle').value = book.title;
    document.getElementById('editAuthor').value = book.author;
    document.getElementById('editCategory').value = book.category;
    document.getElementById('editYear').value = book.year;
    document.getElementById('editTotal').value = book.total;
    document.getElementById('editPrice').value = book.price;
    document.getElementById('editUrl').value = book.url || '';

    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    document.getElementById('editBookForm').reset();
}

async function updateBook(e) {
    e.preventDefault();

    const id = parseInt(document.getElementById('editBookId').value);
    const title = document.getElementById('editTitle').value;
    const author = document.getElementById('editAuthor').value;
    const category = document.getElementById('editCategory').value;
    const year = document.getElementById('editYear').value;
    const total = document.getElementById('editTotal').value;
    const price = document.getElementById('editPrice').value;
    const url = document.getElementById('editUrl').value;

    try {
        const response = await fetch(`/api/books/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, author, category, year, total, price, url })
        });

        const data = await response.json();

        if (data.success) {
            alert('Книга успешно обновлена!');
            closeEditModal();
            loadBooks();
        } else {
            alert(data.message || 'Ошибка при обновлении книги');
        }
    } catch (error) {
        alert('Ошибка подключения к серверу');
    }
}

// Удаление книги
async function deleteBook(bookId) {
    if (!confirm('Вы уверены, что хотите удалить эту книгу?')) return;

    try {
        const response = await fetch(`/api/books/${bookId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            alert('Книга удалена!');
            loadBooks();
        } else {
            alert(data.message || 'Ошибка при удалении книги');
        }
    } catch (error) {
        alert('Ошибка подключения к серверу');
    }
}

// ============ РУЧНОЕ НАПОМИНАНИЕ ============

async function sendReminder(userId, bookTitle, daysLeft) {
    const isOverdue = daysLeft < 0;
    const text = isOverdue
        ? `Книга "${bookTitle}" просрочена на ${Math.abs(daysLeft)} дн. Пожалуйста, верните её как можно скорее.`
        : `Напоминаем, что срок аренды книги "${bookTitle}" истекает через ${daysLeft} дн.`;

    try {
        const response = await fetch('/api/reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, bookTitle, daysLeft, message: text })
        });

        const data = await response.json();

        if (data.success) {
            alert(`✅ Напоминание отправлено пользователю (ID ${userId}):\n\n${text}`);
        } else {
            alert('⚠️ Напоминание зафиксировано локально:\n\n' + text);
        }
    } catch (error) {
        alert('📨 Напоминание (локально):\n\n' + text);
    }
}
