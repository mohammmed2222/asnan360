// auth.js
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');

if (registerForm) {
  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = registerForm.email.value.trim();
    const password = registerForm.password.value;

    const res = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const msg = await res.text();
    alert(msg);
    if (msg.includes('✅')) window.location.href = "login.html";
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message);

        // Redirect based on user role
        switch (data.user.role) {
          case 'admin':
            window.location.href = 'admin.html';
            break;
          case 'teacher':
            window.location.href = 'dashboard.html';
            break;
          case 'student':
            window.location.href = 'index.html';
            break;
          default:
            window.location.href = 'index.html';
        }
      } else {
        const errorMsg = await res.text();
        alert(`Login failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Login request failed:', error);
      alert('An error occurred. Please try again.');
    }
  });
}
