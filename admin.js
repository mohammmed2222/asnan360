// --- Global State ---
let allUsers = [];
let allCourses = [];
let allCategories = [];

// --- Utility Functions ---
function showSection(sectionId) {
  document.getElementById('users-section').style.display = 'none';
  document.getElementById('courses-section').style.display = 'none';
  document.getElementById('categories-section').style.display = 'none';
  document.getElementById(sectionId + '-section').style.display = 'block';
}

async function fetchData(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

async function deleteData(url) {
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
    }
}

// --- Render Functions ---
function renderUsers() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  tbody.innerHTML = allUsers.map(user => `
    <tr>
      <td>${user.id}</td>
      <td>${user.email}</td>
      <td>${user.role}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

function renderCourses() {
  const tbody = document.getElementById('courses-table-body');
  if (!tbody) return;
  tbody.innerHTML = allCourses.map(course => `
    <tr>
      <td>${course.id}</td>
      <td>${course.title}</td>
      <td>${course.teacher_id}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteCourse(${course.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

function renderCategories() {
    const tbody = document.getElementById('categories-table-body');
    if (!tbody) return;
    tbody.innerHTML = allCategories.map(cat => `
        <tr>
            <td>${cat.id}</td>
            <td>${cat.name}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteCategory(${cat.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

// --- Event Handlers & API Calls ---
async function deleteUser(id) {
  if (!confirm(`Are you sure you want to delete user ${id}?`)) return;
  try {
    await deleteData(`/api/users/${id}`);
    allUsers = allUsers.filter(u => u.id !== id);
    renderUsers();
  } catch (error) {
    alert('Error deleting user: ' + error.message);
  }
}

async function deleteCourse(id) {
    if (!confirm(`Are you sure you want to delete course ${id}?`)) return;
    try {
        await deleteData(`/api/courses/${id}`);
        allCourses = allCourses.filter(c => c.id !== id);
        renderCourses();
    } catch (error) {
        alert('Error deleting course: ' + error.message);
    }
}

async function deleteCategory(id) {
    if (!confirm(`Are you sure you want to delete category ${id}?`)) return;
    try {
        await deleteData(`/api/categories/${id}`);
        allCategories = allCategories.filter(c => c.id !== id);
        renderCategories();
    } catch (error) {
        alert('Error deleting category: ' + error.message);
    }
}

function setupEventListeners() {
    const categoryForm = document.getElementById('add-category-form');
    if (categoryForm) {
        categoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('category-name');
            const name = nameInput.value.trim();
            if (!name) return;

            try {
                const response = await fetch('/api/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText);
                }
                const newCategory = await response.json();
                allCategories.push(newCategory);
                renderCategories();
                nameInput.value = '';
            } catch (error) {
                alert('Error adding category: ' + error.message);
            }
        });
    }
}

async function logout() {
  await fetch('/logout', { method: 'POST' });
  alert("🚪 تم تسجيل الخروج");
  window.location.href = "login.html";
}

// --- Initial Load ---
window.onload = async () => {
  // Session check
  try {
    const sessionRes = await fetch('/api/session');
    const user = await sessionRes.json();
    if (!sessionRes.ok || user.role !== 'admin') {
      window.location.href = 'login.html';
      return;
    }

    // Fetch all data
    [allUsers, allCourses, allCategories] = await Promise.all([
        fetchData('/api/users'),
        fetchData('/api/courses'),
        fetchData('/api/categories')
    ]);

    // Render data
    renderUsers();
    renderCourses();
    renderCategories();
    setupEventListeners();

  } catch (error) {
    console.error('Initialization failed:', error);
    window.location.href = 'login.html';
  }
};
