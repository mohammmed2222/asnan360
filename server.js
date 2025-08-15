const express = require('express');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = 3000;

// --- Configuration ---
const dataDir = path.join(__dirname, 'data');
const usersPath = path.join(dataDir, 'users.json');
const sessionsPath = path.join(dataDir, 'sessions.json');
const coursesPath = path.join(dataDir, 'courses.json');
const categoriesPath = path.join(dataDir, 'categories.json');
const saltSize = 16;
const keyLength = 64;
const iterations = 100000;
const digest = 'sha512';
const sessionCookieName = 'platform_session_id';

// --- Data Helpers ---
const readJsonFile = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') return (filePath.endsWith('users.json') ? [] : {});
    throw error;
  }
};

const writeJsonFile = async (filePath, data) => {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

// --- Manual Password Hashing ---
const hashPassword = (password) => {
  const salt = crypto.randomBytes(saltSize).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, iterations, keyLength, digest).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, storedPassword) => {
  const [salt, storedHash] = storedPassword.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, iterations, keyLength, digest).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
};

// --- Manual Cookie Parser Middleware ---
// Express.json doesn't parse cookies, so we do it manually.
const cookieParserMiddleware = (req, res, next) => {
    req.cookies = {};
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            req.cookies[parts[0].trim()] = decodeURIComponent(parts[1].trim());
        });
    }
    next();
};

// --- Manual Session Middleware ---
const sessionMiddleware = async (req, res, next) => {
  const sessionId = req.cookies[sessionCookieName];
  req.session = { user: null }; // Default session state

  if (sessionId) {
    const sessions = await readJsonFile(sessionsPath);
    const sessionData = sessions[sessionId];
    if (sessionData && new Date(sessionData.expires) > new Date()) {
      req.session.user = sessionData.user;
    } else if (sessionData) {
      // Clean up expired session
      delete sessions[sessionId];
      await writeJsonFile(sessionsPath, sessions);
    }
  }
  next();
};


// --- Middleware Setup ---
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use(cookieParserMiddleware);
app.use(sessionMiddleware);


// --- API Endpoints ---

// Registration
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).send('Email and password are required.');

  try {
    const users = await readJsonFile(usersPath);
    if (users.find(u => u.email === email)) {
      return res.status(409).send('An account with this email already exists.');
    }
    const hashedPassword = hashPassword(password);
    const newUser = {
      id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
      email,
      password: hashedPassword,
      role: 'student'
    };
    users.push(newUser);
    await writeJsonFile(usersPath, users);
    res.status(201).send('✅ Registration successful! You can now log in.');
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).send('Server error during registration.');
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).send('Email and password are required.');

  try {
    const users = await readJsonFile(usersPath);
    const user = users.find(u => u.email === email);
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).send('Invalid credentials.');
    }

    const sessionId = crypto.randomBytes(32).toString('hex');
    const sessions = await readJsonFile(sessionsPath);
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour session

    sessions[sessionId] = {
      user: { id: user.id, email: user.email, role: user.role },
      expires: expires.toISOString()
    };
    await writeJsonFile(sessionsPath, sessions);

    res.cookie(sessionCookieName, sessionId, { httpOnly: true, expires, sameSite: 'Strict' });
    res.status(200).send({ message: '✅ Login successful!', user: sessions[sessionId].user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Server error during login.');
  }
});

// Logout
app.post('/logout', async (req, res) => {
    const sessionId = req.cookies[sessionCookieName];
    if (sessionId) {
        const sessions = await readJsonFile(sessionsPath);
        delete sessions[sessionId];
        await writeJsonFile(sessionsPath, sessions);
    }
    res.clearCookie(sessionCookieName);
    res.status(200).send('Logged out successfully.');
});

// Check session endpoint
app.get('/api/session', (req, res) => {
    if (req.session.user) {
        res.status(200).json(req.session.user);
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
});


// --- Authorization Middleware ---
const authMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).send('You are not logged in.');
    }
    const userRole = req.session.user.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).send('You do not have permission to perform this action.');
    }
    next();
  };
};


// --- Admin API: User Management ---
app.get('/api/users', authMiddleware(['admin']), async (req, res) => {
    try {
        const users = await readJsonFile(usersPath);
        // Don't send password hashes to client
        res.json(users.map(u => ({ id: u.id, email: u.email, role: u.role })));
    } catch (error) {
        res.status(500).send('Server error.');
    }
});

app.delete('/api/users/:id', authMiddleware(['admin']), async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        let users = await readJsonFile(usersPath);
        const userToDelete = users.find(u => u.id === userId);

        // Prevent admin from deleting themselves
        if (req.session.user.id === userId) {
            return res.status(400).send("You cannot delete your own account.");
        }

        if (!userToDelete) {
            return res.status(404).send('User not found.');
        }

        users = users.filter(u => u.id !== userId);
        await writeJsonFile(usersPath, users);
        res.status(200).send('User deleted successfully.');
    } catch (error) {
        res.status(500).send('Server error.');
    }
});


// --- Course Management API ---
app.get('/api/courses', async (req, res) => {
    try {
        const courses = await readJsonFile(coursesPath);
        res.json(courses);
    } catch (error) {
        res.status(500).send('Server error.');
    }
});

app.post('/api/courses', authMiddleware(['admin', 'teacher']), async (req, res) => {
    const { title, description, category_id } = req.body;
    if (!title) return res.status(400).send('Course title is required.');

    try {
        const courses = await readJsonFile(coursesPath);
        const newCourse = {
            id: courses.length > 0 ? Math.max(...courses.map(c => c.id)) + 1 : 1,
            title,
            description,
            category_id: parseInt(category_id, 10) || null,
            teacher_id: req.session.user.id
        };
        courses.push(newCourse);
        await writeJsonFile(coursesPath, courses);
        res.status(201).json(newCourse);
    } catch (error) {
        res.status(500).send('Server error.');
    }
});

app.put('/api/courses/:id', authMiddleware(['admin', 'teacher']), async (req, res) => {
    const courseId = parseInt(req.params.id, 10);
    const { title, description, category_id } = req.body;

    try {
        let courses = await readJsonFile(coursesPath);
        const courseIndex = courses.findIndex(c => c.id === courseId);
        if (courseIndex === -1) return res.status(404).send('Course not found.');

        const course = courses[courseIndex];
        // Teachers can only edit their own courses
        if (req.session.user.role === 'teacher' && course.teacher_id !== req.session.user.id) {
            return res.status(403).send('You can only edit your own courses.');
        }

        course.title = title || course.title;
        course.description = description || course.description;
        course.category_id = category_id || course.category_id;

        courses[courseIndex] = course;
        await writeJsonFile(coursesPath, courses);
        res.json(course);
    } catch (error) {
        res.status(500).send('Server error.');
    }
});

app.delete('/api/courses/:id', authMiddleware(['admin', 'teacher']), async (req, res) => {
    const courseId = parseInt(req.params.id, 10);
    try {
        let courses = await readJsonFile(coursesPath);
        const course = courses.find(c => c.id === courseId);
        if (!course) return res.status(404).send('Course not found.');

        // Teachers can only delete their own courses
        if (req.session.user.role === 'teacher' && course.teacher_id !== req.session.user.id) {
            return res.status(403).send('You can only delete your own courses.');
        }

        courses = courses.filter(c => c.id !== courseId);
        await writeJsonFile(coursesPath, courses);
        res.status(200).send('Course deleted.');
    } catch (error) {
        res.status(500).send('Server error.');
    }
});


// --- Category Management API (Admin Only) ---
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await readJsonFile(categoriesPath);
        res.json(categories);
    } catch (error) {
        res.status(500).send('Server error.');
    }
});

app.post('/api/categories', authMiddleware(['admin']), async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).send('Category name is required.');

    try {
        const categories = await readJsonFile(categoriesPath);
        const newCategory = {
            id: categories.length > 0 ? Math.max(...categories.map(c => c.id)) + 1 : 1,
            name
        };
        categories.push(newCategory);
        await writeJsonFile(categoriesPath, categories);
        res.status(201).json(newCategory);
    } catch (error) {
        res.status(500).send('Server error.');
    }
});

app.put('/api/categories/:id', authMiddleware(['admin']), async (req, res) => {
    const categoryId = parseInt(req.params.id, 10);
    const { name } = req.body;
    if (!name) return res.status(400).send('Category name is required.');

    try {
        let categories = await readJsonFile(categoriesPath);
        const categoryIndex = categories.findIndex(c => c.id === categoryId);
        if (categoryIndex === -1) return res.status(404).send('Category not found.');

        categories[categoryIndex].name = name;
        await writeJsonFile(categoriesPath, categories);
        res.json(categories[categoryIndex]);
    } catch (error) {
        res.status(500).send('Server error.');
    }
});

app.delete('/api/categories/:id', authMiddleware(['admin']), async (req, res) => {
    const categoryId = parseInt(req.params.id, 10);
    try {
        let categories = await readJsonFile(categoriesPath);
        categories = categories.filter(c => c.id !== categoryId);
        await writeJsonFile(categoriesPath, categories);
        res.status(200).send('Category deleted.');
    } catch (error) {
        res.status(500).send('Server error.');
    }
});


// --- Initial Admin User Setup ---
const setupAdmin = async () => {
    try {
        const users = await readJsonFile(usersPath);
        if (!users.find(u => u.role === 'admin')) {
            console.log('No admin user found. Creating one...');
            const hashedPassword = hashPassword('admin123');
            const adminUser = {
                id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
                email: 'admin@platform.com',
                password: hashedPassword,
                role: 'admin'
            };
            users.push(adminUser);
            await writeJsonFile(usersPath, users);
            console.log('Admin user created: admin@platform.com / admin123');
        }
    } catch (error) {
        console.error('Failed to set up admin user:', error);
    }
};

// --- Server Start ---
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  setupAdmin();
});
