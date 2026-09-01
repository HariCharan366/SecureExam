/* =========================================================
   SecureExam – auth.js
   Handles: tab switching, student registration, student login,
   and first-run initialization of localStorage defaults.
   ========================================================= */

/* ---------- Storage keys ---------- */
const LS_STUDENTS = "students";
const LS_QUESTIONS = "examQuestions";
const SS_EXAM_USER = "examUser";

/* ---------- First-run initialization ---------- */
function initDefaultData() {
  if (!localStorage.getItem(LS_STUDENTS)) {
    localStorage.setItem(LS_STUDENTS, JSON.stringify([]));
  }
  if (typeof syncDefaultQuestions === "function") {
    syncDefaultQuestions();
  }
}
initDefaultData();

/* ---------- Helpers ---------- */
function getStudents() {
  return JSON.parse(localStorage.getItem(LS_STUDENTS) || "[]");
}
function saveStudents(students) {
  localStorage.setItem(LS_STUDENTS, JSON.stringify(students));
}
function showAlert(el, message, type) {
  el.textContent = message;
  el.className = "alert alert-" + type + " show";
}
function hideAlert(el) {
  el.classList.remove("show");
}

/* ---------- Tab switching ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  /* ---------- LOGIN ---------- */
  const loginForm = document.getElementById("login-form");
  const loginAlert = document.getElementById("login-alert");

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    hideAlert(loginAlert);

    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;

    const students = getStudents();
    const student = students.find((s) => s.username === username);

    if (!student) {
      showAlert(loginAlert, "Username not found.", "error");
      return;
    }
    if (student.password !== password) {
      showAlert(loginAlert, "Incorrect password.", "error");
      return;
    }

    // Success – store session and redirect
    sessionStorage.setItem(
      SS_EXAM_USER,
      JSON.stringify({ username: student.username, fullName: student.fullName })
    );
    window.location.href = "exam.html";
  });

  /* ---------- REGISTER ---------- */
  const registerForm = document.getElementById("register-form");
  const registerAlert = document.getElementById("register-alert");

  registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    hideAlert(registerAlert);

    const fullName = document.getElementById("reg-fullname").value.trim();
    const username = document.getElementById("reg-username").value.trim();
    const password = document.getElementById("reg-password").value;
    const confirm = document.getElementById("reg-confirm").value;

    if (!fullName || !username || !password || !confirm) {
      showAlert(registerAlert, "Please fill in all fields.", "error");
      return;
    }
    if (password !== confirm) {
      showAlert(registerAlert, "Passwords do not match.", "error");
      return;
    }

    const students = getStudents();
    const exists = students.some((s) => s.username === username);

    if (exists) {
      showAlert(registerAlert, "Username already exists. Please choose another username.", "error");
      return;
    }

    students.push({ fullName, username, password });
    saveStudents(students);

    showAlert(registerAlert, "Account created successfully! You can now login.", "success");
    registerForm.reset();

    // Switch to login tab automatically after a short delay
    setTimeout(() => {
      document.querySelector('.tab-btn[data-tab="login-tab"]').click();
      document.getElementById("login-username").value = username;
    }, 900);
  });
});
