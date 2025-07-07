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

    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const msg = await res.text();
    alert(msg);
    if (msg.includes('✅')) {
      // ✅ حفظ بيانات المستخدم للجلسة
      localStorage.setItem("asnan360-user", JSON.stringify({ email }));

      // ✅ توجيه ناجح إلى لوحة التحكم
      window.location.href = "dashboard.html";
    }
  });
}
