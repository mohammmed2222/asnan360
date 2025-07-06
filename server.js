const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.static(__dirname));
app.use(express.json());

const usersFile = path.join(__dirname, 'users.json');

function readUsers() {
  return fs.existsSync(usersFile)
    ? JSON.parse(fs.readFileSync(usersFile))
    : [];
}

function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

app.post('/register', (req, res) => {
  const { email, password } = req.body;
  const users = readUsers();
  if (users.find(u => u.email === email)) {
    return res.send('❌ البريد الإلكتروني مسجّل مسبقاً');
  }
  users.push({ email, password }); // ⚠️ تخزين بدون تشفير لأغراض التجربة فقط
  writeUsers(users);
  res.send('✅ تم إنشاء الحساب بنجاح');
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.email === email && u.password === password);
  if (user) {
    res.send('✅ تم تسجيل الدخول بنجاح');
  } else {
    res.send('❌ البريد أو كلمة المرور غير صحيحة');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});