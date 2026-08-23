// auth.js - Управление авторизацией

const API_URL = window.location.origin;

// Проверяем, авторизован ли пользователь
function checkAuth() {
    const user = localStorage.getItem('user');
    if (user) {
        const userData = JSON.parse(user);
        if (userData.role === 'admin') {
            // Если админ - перенаправляем на админ панель
            if (window.location.pathname.includes('admin.html')) {
                return userData;
            }
            window.location.href = 'admin.html';
            return null;
        } else {
            // Обычный пользователь
            if (window.location.pathname.includes('admin.html')) {
                window.location.href = 'index.html';
                return null;
            }
            return userData;
        }
    } else {
        // Если не авторизован и не на странице входа
        if (!window.location.pathname.includes('index.html') && 
            !window.location.pathname.endsWith('/')) {
            window.location.href = 'index.html';
        }
        return null;
    }
}

// Выход из системы
function logout() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Обработка формы входа
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('loginError');
            
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Сохраняем пользователя в localStorage
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    // Перенаправляем в зависимости от роли
                    if (data.user.role === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'index.html';
                    }
                } else {
                    errorDiv.textContent = data.message || 'Ошибка входа';
                }
            } catch (error) {
                errorDiv.textContent = 'Ошибка подключения к серверу';
            }
        });
    }
    
    // Обработка кнопки выхода
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});