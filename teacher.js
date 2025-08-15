// --- Global State ---
let myCourses = [];
let currentUser = null;

// --- Utility Functions ---
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
function renderMyCourses() {
  const tbody = document.getElementById('courses-table-body');
  if (!tbody) return;
  tbody.innerHTML = myCourses.map(course => `
    <tr>
      <td>${course.id}</td>
      <td>${course.title}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteCourse(${course.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

// --- Event Handlers & API Calls ---
async function deleteCourse(id) {
    if (!confirm(`Are you sure you want to delete course ${id}?`)) return;
    try {
        await deleteData(`/api/courses/${id}`);
        myCourses = myCourses.filter(c => c.id !== id);
        renderMyCourses();
    } catch (error) {
        alert('Error deleting course: ' + error.message);
    }
}

function setupEventListeners() {
    const addCourseForm = document.getElementById('add-course-form');
    if (addCourseForm) {
        addCourseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const titleInput = document.getElementById('course-title');
            const descriptionInput = document.getElementById('course-description');

            const courseData = {
                title: titleInput.value.trim(),
                description: descriptionInput.value.trim()
            };

            if (!courseData.title) {
                alert('Title is required.');
                return;
            }

            try {
                const response = await fetch('/api/courses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(courseData)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText);
                }
                const newCourse = await response.json();
                myCourses.push(newCourse);
                renderMyCourses();
                titleInput.value = '';
                descriptionInput.value = '';
            } catch (error) {
                alert('Error adding course: ' + error.message);
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
    if (!sessionRes.ok || user.role !== 'teacher') {
      window.location.href = 'login.html';
      return;
    }
    currentUser = user;
    document.getElementById('welcome-message').innerText = `👋 مرحبًا بك في لوحتك الخاصة, ${currentUser.email}`;

    // Fetch all courses and filter for the current teacher
    const allCourses = await fetchData('/api/courses');
    myCourses = allCourses.filter(course => course.teacher_id === currentUser.id);

    // Render data
    renderMyCourses();
    setupEventListeners();

  } catch (error) {
    console.error('Initialization failed:', error);
    window.location.href = 'login.html';
  }
};
