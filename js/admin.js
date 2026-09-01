/* =========================================================
   SecureExam – admin.js
   Handles: admin authentication, question CRUD, student listing.
   ========================================================= */

const LS_STUDENTS_A = "students";
const LS_QUESTIONS_A = "examQuestions";
const LS_RESULTS_A = "examResults";
const LS_EXAM_TIME_A = "examTime";
const SS_ADMIN = "adminSession";

const ADMIN_ID = "1234";
const ADMIN_PASSWORD = "admin123";

/* Ensure defaults exist even if admin.html is opened first */
function ensureDefaults() {
  if (!localStorage.getItem(LS_STUDENTS_A)) {
    localStorage.setItem(LS_STUDENTS_A, JSON.stringify([]));
  }
  if (typeof syncDefaultQuestions === "function") {
    syncDefaultQuestions();
  }
  if (!localStorage.getItem(LS_EXAM_TIME_A)) {
    localStorage.setItem(LS_EXAM_TIME_A, JSON.stringify(15));
  }
}
ensureDefaults();

function getExamTimeMinutes() {
  return parseInt(localStorage.getItem(LS_EXAM_TIME_A) || "15", 10);
}

function setExamTimeMinutes(minutes) {
  localStorage.setItem(LS_EXAM_TIME_A, JSON.stringify(minutes));
}

function getQuestions() {
  return JSON.parse(localStorage.getItem(LS_QUESTIONS_A) || "[]");
}
function saveQuestions(qs) {
  localStorage.setItem(LS_QUESTIONS_A, JSON.stringify(qs));
}
function getStudentsA() {
  return JSON.parse(localStorage.getItem(LS_STUDENTS_A) || "[]");
}
function getResultsA() {
  return JSON.parse(localStorage.getItem(LS_RESULTS_A) || "[]");
}
function saveResultsA(results) {
  localStorage.setItem(LS_RESULTS_A, JSON.stringify(results));
}
function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function formatDuration(totalSeconds) {
  const s = totalSeconds || 0;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m + ":" + String(sec).padStart(2, "0");
}
function formatDateTimeA(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

const OPTION_LABELS = ["A", "B", "C", "D"];
let pendingDeleteIndex = null;

document.addEventListener("DOMContentLoaded", () => {
  const loginView = document.getElementById("admin-login-view");
  const dashboardView = document.getElementById("admin-dashboard-view");
  const logoutBtn = document.getElementById("admin-logout-btn");

  async function loadResultsFromBackend() {
    try {
      const res = await fetch("/api/results");
      if (res.ok) {
        const serverResults = await res.json();
        if (Array.isArray(serverResults)) {
          localStorage.setItem(LS_RESULTS_A, JSON.stringify(serverResults));
        }
      }
    } catch (err) {
      console.warn("Backend server not reachable; using LocalStorage results fallback.", err);
    }
  }

  async function showDashboard() {
    loginView.classList.add("hidden");
    dashboardView.classList.add("active");
    logoutBtn.classList.remove("hidden");
    await loadResultsFromBackend();
    try { loadExamSettings(); } catch (e) { console.error(e); }
    try { renderStats(); } catch (e) { console.error(e); }
    try { renderQuestions(); } catch (e) { console.error(e); }
    try { renderStudents(); } catch (e) { console.error(e); }
    try { renderResults(); } catch (e) { console.error(e); }
    try { renderLeaderboard(); } catch (e) { console.error(e); }
  }

  function showLogin() {
    loginView.classList.remove("hidden");
    dashboardView.classList.remove("active");
    logoutBtn.classList.add("hidden");
  }

  // Restore session if already logged in (persisted in localStorage or sessionStorage)
  if (localStorage.getItem(SS_ADMIN) === "true" || sessionStorage.getItem(SS_ADMIN) === "true") {
    showDashboard();
  } else {
    showLogin();
  }

  /* ---------- Admin Login ---------- */
  const adminForm = document.getElementById("admin-login-form");
  const adminAlert = document.getElementById("admin-login-alert");

  adminForm.addEventListener("submit", (e) => {
    e.preventDefault();
    adminAlert.classList.remove("show");

    const id = document.getElementById("admin-id").value.trim();
    const pass = document.getElementById("admin-password").value;

    if (id === ADMIN_ID && pass === ADMIN_PASSWORD) {
      localStorage.setItem(SS_ADMIN, "true");
      sessionStorage.setItem(SS_ADMIN, "true");
      adminForm.reset();
      showDashboard();
    } else {
      adminAlert.textContent = "Invalid Admin ID or Password.";
      adminAlert.className = "alert alert-error show";
    }
  });

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem(SS_ADMIN);
    sessionStorage.removeItem(SS_ADMIN);
    showLogin();
  });

  /* ---------- Stats ---------- */
  function renderStats() {
    document.getElementById("stat-total-students").textContent = getStudentsA().length;
    document.getElementById("stat-total-questions").textContent = getQuestions().length;
    document.getElementById("stat-total-attempts").textContent = getResultsA().length;
    const examMinutes = getExamTimeMinutes();
    document.getElementById("stat-exam-duration").textContent = examMinutes + " min";
  }

  /* ---------- Exam Settings ---------- */
  const examSettingsForm = document.getElementById("exam-settings-form");
  const examSettingsAlert = document.getElementById("exam-settings-alert");
  const examTimeInput = document.getElementById("exam-time-input");

  // Load current exam time on dashboard load
  function loadExamSettings() {
    const currentTime = getExamTimeMinutes();
    examTimeInput.value = currentTime;
  }

  examSettingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    examSettingsAlert.classList.remove("show");

    const minutes = parseInt(examTimeInput.value, 10);

    if (!minutes || minutes < 1 || minutes > 180) {
      examSettingsAlert.textContent = "Please enter a valid exam duration (1-180 minutes).";
      examSettingsAlert.className = "alert alert-error show";
      return;
    }

    setExamTimeMinutes(minutes);
    examSettingsAlert.textContent = `Exam duration updated to ${minutes} minute${minutes !== 1 ? 's' : ''}.`;
    examSettingsAlert.className = "alert alert-success show";
    renderStats();
  });

  /* ---------- Add Question ---------- */
  const questionForm = document.getElementById("question-form");
  const questionAlert = document.getElementById("question-alert");

  questionForm.addEventListener("submit", (e) => {
    e.preventDefault();
    questionAlert.classList.remove("show");

    const questionText = document.getElementById("q-text").value.trim();
    const a = document.getElementById("opt-a").value.trim();
    const b = document.getElementById("opt-b").value.trim();
    const c = document.getElementById("opt-c").value.trim();
    const d = document.getElementById("opt-d").value.trim();
    const correct = parseInt(document.getElementById("correct-answer").value, 10);

    if (!questionText || !a || !b || !c || !d) {
      questionAlert.textContent = "Please fill in the question and all four options.";
      questionAlert.className = "alert alert-error show";
      return;
    }

    const questions = getQuestions();
    questions.push({
      question: questionText,
      optionA: a,
      optionB: b,
      optionC: c,
      optionD: d,
      correct: correct
    });
    saveQuestions(questions);

    questionAlert.textContent = "Question saved successfully.";
    questionAlert.className = "alert alert-success show";
    questionForm.reset();

    renderStats();
    renderQuestions();
  });

  /* ---------- Render Saved Questions ---------- */
  function renderQuestions() {
    const questions = getQuestions();
    const list = document.getElementById("questions-list");
    document.getElementById("questions-count-badge").textContent =
      questions.length + (questions.length === 1 ? " question" : " questions");

    if (questions.length === 0) {
      list.innerHTML = '<div class="empty-state">No questions saved yet. Add your first question above.</div>';
      return;
    }

    list.innerHTML = questions
      .map((q, index) => {
        const opts = [q.optionA, q.optionB, q.optionC, q.optionD];
        const optionsHtml = opts
          .map((opt, i) => {
            const isCorrect = i === q.correct;
            return `<li class="${isCorrect ? "correct-option" : ""}">${OPTION_LABELS[i]}. ${escapeHtml(opt)}${isCorrect ? " ✓" : ""}</li>`;
          })
          .join("");

        return `
          <div class="question-card">
            <div class="q-top">
              <div>
                <span class="q-number">Question ${index + 1}</span>
                <div class="q-text">${escapeHtml(q.question)}</div>
              </div>
              <button class="btn btn-danger btn-sm" data-delete-index="${index}">Delete</button>
            </div>
            <ul class="option-list">${optionsHtml}</ul>
            <div style="font-size:0.82rem; color: var(--gray-600);">
              Correct Answer: <strong>Option ${OPTION_LABELS[q.correct]}</strong>
            </div>
          </div>
        `;
      })
      .join("");

    // Attach delete listeners
    list.querySelectorAll("[data-delete-index]").forEach((btn) => {
      btn.addEventListener("click", () => {
        pendingDeleteIndex = parseInt(btn.dataset.deleteIndex, 10);
        document.getElementById("delete-modal").classList.add("show");
      });
    });
  }

  /* ---------- Delete Question Modal ---------- */
  document.getElementById("cancel-delete-btn").addEventListener("click", () => {
    pendingDeleteIndex = null;
    document.getElementById("delete-modal").classList.remove("show");
  });

  document.getElementById("confirm-delete-btn").addEventListener("click", () => {
    if (pendingDeleteIndex !== null) {
      const questions = getQuestions();
      questions.splice(pendingDeleteIndex, 1);
      saveQuestions(questions);
      pendingDeleteIndex = null;
      renderStats();
      renderQuestions();
    }
    document.getElementById("delete-modal").classList.remove("show");
  });

  /* ---------- Reset Default Questions Modal ---------- */
  document.getElementById("reset-questions-btn").addEventListener("click", () => {
    document.getElementById("reset-modal").classList.add("show");
  });
  document.getElementById("cancel-reset-btn").addEventListener("click", () => {
    document.getElementById("reset-modal").classList.remove("show");
  });
  document.getElementById("confirm-reset-btn").addEventListener("click", () => {
    saveQuestions(JSON.parse(JSON.stringify(DEFAULT_QUESTIONS)));
    document.getElementById("reset-modal").classList.remove("show");
    renderStats();
    renderQuestions();
  });

  /* ---------- Render Students ---------- */
  function renderStudents() {
    const students = getStudentsA();
    const list = document.getElementById("students-list");
    document.getElementById("students-count-badge").textContent =
      students.length + (students.length === 1 ? " student" : " students");

    if (students.length === 0) {
      list.innerHTML = '<div class="empty-state">No students have registered yet.</div>';
      return;
    }

    const rows = students
      .map(
        (s) => `
          <tr>
            <td>${escapeHtml(s.fullName)}</td>
            <td>${escapeHtml(s.username)}</td>
          </tr>`
      )
      .join("");

    list.innerHTML = `
      <table class="student-table">
        <thead>
          <tr><th>Student Name</th><th>Username</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  /* ---------- Export Results to Excel Spreadsheet (.xls) ---------- */
  function exportResultsToExcel() {
    const results = getResultsA();
    if (!results.length) {
      alert("No exam data available to export yet.");
      return;
    }

    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Student Exam Results</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Calibri, Arial, sans-serif; }
        h2 { color: #0f172a; margin-bottom: 4px; }
        p { color: #475569; font-size: 11pt; margin-top: 0; }
        table { border-collapse: collapse; width: 100%; }
        th { background-color: #1e293b; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #94a3b8; padding: 8px; font-size: 11pt; }
        td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; font-size: 10pt; }
        .center { text-align: center; }
        .num { text-align: right; }
        .pass { background-color: #dcfce7; color: #166534; font-weight: bold; text-align: center; }
        .fail { background-color: #fee2e2; color: #991b1b; font-weight: bold; text-align: center; }
        .warning-cell { background-color: #fef3c7; color: #92400e; text-align: center; }
      </style>
      </head>
      <body>
        <h2>SECUREEXAM — STUDENT EXAMINATION RESULTS REPORT</h2>
        <p>Report Generated: ${new Date().toLocaleString()} | Total Candidate Attempts: ${results.length}</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Student Name</th>
              <th>Username</th>
              <th>Date & Time</th>
              <th>Total Questions</th>
              <th>Correct Answers</th>
              <th>Wrong Answers</th>
              <th>Percentage Score</th>
              <th>Time Taken (mm:ss)</th>
              <th>Time Taken (sec)</th>
              <th>Security Warnings</th>
              <th>Result Status</th>
            </tr>
          </thead>
          <tbody>
    `;

    results.forEach((r, idx) => {
      const pct = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
      const isPass = pct >= 50;
      const timeFormatted = formatDuration(r.timeTakenSeconds || 0);

      tableHtml += `
        <tr>
          <td class="center">${idx + 1}</td>
          <td><strong>${escapeHtml(r.studentName || "Unknown")}</strong></td>
          <td>${escapeHtml(r.username || "—")}</td>
          <td>${formatDateTimeA(r.dateTime)}</td>
          <td class="center">${r.total || 0}</td>
          <td class="center" style="color:#15803d; font-weight:bold;">${r.correct || 0}</td>
          <td class="center" style="color:#b91c1c; font-weight:bold;">${r.wrong || 0}</td>
          <td class="center"><strong>${pct}%</strong></td>
          <td class="center">${timeFormatted}</td>
          <td class="num">${r.timeTakenSeconds || 0}s</td>
          <td class="warning-cell">${r.warnings || 0} / 3</td>
          <td class="${isPass ? "pass" : "fail"}">${isPass ? "PASS" : "FAIL"}</td>
        </tr>
      `;
    });

    tableHtml += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SecureExam_Student_Results_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ---------- Export Results to CSV ---------- */
  function exportResultsToCsv() {
    const results = getResultsA();
    if (!results.length) {
      alert("No exam data available to export yet.");
      return;
    }

    const headers = [
      "Student Name",
      "Username",
      "Date & Time",
      "Total Questions",
      "Correct Answers",
      "Wrong Answers",
      "Percentage",
      "Time Taken (mm:ss)",
      "Time Taken (sec)",
      "Warnings",
      "Status"
    ];

    const rows = results.map((r) => {
      const pct = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
      return [
        r.studentName || "",
        r.username || "",
        formatDateTimeA(r.dateTime),
        r.total || 0,
        r.correct || 0,
        r.wrong || 0,
        pct + "%",
        formatDuration(r.timeTakenSeconds || 0),
        r.timeTakenSeconds || 0,
        (r.warnings || 0) + "/3",
        pct >= 50 ? "PASS" : "FAIL"
      ];
    });

    const csv = "\uFEFF" + [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SecureExam_Student_Results_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const excelExportBtn = document.getElementById("export-results-excel-btn");
  if (excelExportBtn) excelExportBtn.addEventListener("click", exportResultsToExcel);

  const csvExportBtn = document.getElementById("export-results-csv-btn");
  if (csvExportBtn) csvExportBtn.addEventListener("click", exportResultsToCsv);

  function renderLeaderboard() {
    const list = document.getElementById("leaderboard-list");
    const results = getResultsA().slice().sort((a, b) => {
      if ((b.correct || 0) !== (a.correct || 0)) return (b.correct || 0) - (a.correct || 0);
      return (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0);
    });

    if (!results.length) {
      list.innerHTML = '<div class="empty-state">No exam attempts yet. Results will appear here.</div>';
      return;
    }

    list.innerHTML = results.slice(0, 10).map((r, index) => {
      const pct = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
      const detailId = "leaderboard-detail-" + index;
      return `
        <div class="leaderboard-item">
          <button class="leaderboard-toggle" data-leaderboard-index="${index}" style="width:100%; display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid #dfe3ee; border-radius:12px; padding:12px 14px; cursor:pointer; margin-bottom:8px; text-align:left;">
            <div>
              <strong>#${index + 1} ${escapeHtml(r.studentName || "Unknown")}</strong><br>
              <small style="color:var(--gray-600);">@${escapeHtml(r.username || "—")}</small>
            </div>
            <div style="text-align:right;">
              <div><strong>${r.correct}/${r.total}</strong></div>
              <small>${pct}%</small>
            </div>
          </button>
          <div id="${detailId}" class="leaderboard-detail hidden" style="padding:12px 14px; background:#f7f9fc; border:1px solid #e7ebf3; border-radius:12px; margin-bottom:12px;">
            <div><strong>Correct:</strong> ${r.correct}</div>
            <div><strong>Wrong:</strong> ${r.wrong || 0}</div>
            <div><strong>Time Taken:</strong> ${formatDuration(r.timeTakenSeconds || 0)}</div>
            <div><strong>Warnings:</strong> ${r.warnings || 0}/3</div>
            <div><strong>Date:</strong> ${formatDateTimeA(r.dateTime)}</div>
          </div>
        </div>
      `;
    }).join("");

    list.querySelectorAll(".leaderboard-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = btn.dataset.leaderboardIndex;
        const detail = document.getElementById("leaderboard-detail-" + i);
        if (detail) {
          detail.classList.toggle("hidden");
        }
      });
    });
  }

  /* ---------- Render Student Exam Results (detailed, per-attempt) ---------- */
  const OPTION_LABELS_R = ["A", "B", "C", "D"];

  function renderResults() {
    const results = getResultsA().slice().reverse(); // most recent attempt first
    const list = document.getElementById("results-list");
    const countBadge = document.getElementById("results-count-badge");
    const summaryLine = document.getElementById("results-summary-line");

    if (!list) return;
    if (countBadge) countBadge.textContent = results.length + (results.length === 1 ? " attempt" : " attempts");

    if (results.length === 0) {
      list.innerHTML = '<div class="empty-state">No students have taken the exam yet.</div>';
      if (summaryLine) summaryLine.textContent = "No exam attempts recorded yet.";
      return;
    }

    const avgScorePct =
      results.reduce((sum, r) => sum + (r && r.total > 0 ? ((r.correct || 0) / r.total) * 100 : 0), 0) / results.length;
    if (summaryLine) {
      summaryLine.textContent =
        results.length + " total attempt(s) recorded  •  Average score: " + Math.round(avgScorePct) + "%";
    }

    list.innerHTML = results
      .map((r, idx) => {
        if (!r) return "";
        const pct = r.total > 0 ? Math.round(((r.correct || 0) / r.total) * 100) : 0;
        const scoreClass = pct >= 70 ? "score-good" : pct >= 40 ? "score-mid" : "score-bad";
        const initials = (r.studentName || "?")
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

        const answersHtml = Array.isArray(r.answers)
          ? r.answers
            .map((a, i) => {
              if (!a) return "";
              const statusClass = a.selectedIndex === null || a.selectedIndex === undefined ? "unanswered" : a.isCorrect ? "correct" : "incorrect";
              const statusLabel =
                a.selectedIndex === null || a.selectedIndex === undefined ? "Not Answered" : a.isCorrect ? "✓ Correct" : "✗ Incorrect";

              const optsHtml = Array.isArray(a.options)
                ? a.options
                  .map((opt, oi) => {
                    const isCorrectAns = oi === a.correctIndex;
                    const isSelected = oi === a.selectedIndex;
                    let cls = "";
                    let tag = "";
                    if (isCorrectAns) {
                      cls += " is-correct-answer";
                      tag += " ✓ Correct Answer";
                    }
                    if (isSelected && !isCorrectAns) {
                      cls += " is-wrong-selected";
                      tag += " ✗ Student's Answer";
                    } else if (isSelected && isCorrectAns) {
                      tag += " (Student's Answer)";
                    }
                    return `<li class="${cls.trim()}">${OPTION_LABELS_R[oi] || oi}. ${escapeHtml(opt || "")}${tag ? " —" + tag : ""}</li>`;
                  })
                  .join("")
                : "";

              return `
                  <div class="review-item ${statusClass}">
                    <div class="q-top">
                      <div>
                        <span class="q-number">Question ${i + 1}</span>
                        <div class="q-text">${escapeHtml(a.question || "")}</div>
                      </div>
                      <span class="status-badge ${statusClass}">${statusLabel}</span>
                    </div>
                    <ul class="option-list review-option-list">${optsHtml}</ul>
                  </div>
                `;
            })
            .join("")
          : '<div class="empty-state">No answer detail saved for this attempt.</div>';

        return `
          <div class="result-row">
            <div class="result-row-top">
              <div class="result-row-info">
                <div class="result-avatar">${escapeHtml(initials)}</div>
                <div>
                  <div class="result-row-name">${escapeHtml(r.studentName || "Unknown")}</div>
                  <div class="result-row-sub">@${escapeHtml(r.username || "—")} • ${formatDateTimeA(r.dateTime)}</div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span class="result-chip ${scoreClass}">Score: ${r.correct || 0}/${r.total || 0} (${pct}%)</span>
                <span class="result-chip">⏱ ${formatDuration(r.timeTakenSeconds || 0)}</span>
                <span class="result-chip">⚠ ${r.warnings || 0}/3 warnings</span>
                <button class="btn btn-ghost btn-sm" data-toggle-result="${idx}">View Answers</button>
              </div>
            </div>
            <div class="result-detail" id="result-detail-${idx}">${answersHtml}</div>
          </div>
        `;
      })
      .join("");

    list.querySelectorAll("[data-toggle-result]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = btn.dataset.toggleResult;
        const detail = document.getElementById("result-detail-" + i);
        if (detail) {
          const isOpen = detail.classList.toggle("open");
          btn.textContent = isOpen ? "Hide Answers" : "View Answers";
        }
      });
    });
  }

  /* ---------- Clear All Results ---------- */
  document.getElementById("clear-results-btn").addEventListener("click", () => {
    document.getElementById("clear-results-modal").classList.add("show");
  });
  document.getElementById("cancel-clear-results-btn").addEventListener("click", () => {
    document.getElementById("clear-results-modal").classList.remove("show");
  });
  document.getElementById("confirm-clear-results-btn").addEventListener("click", () => {
    saveResultsA([]);
    fetch("/api/results", { method: "DELETE" }).catch((e) => console.warn("Failed to clear backend JSON file:", e));
    document.getElementById("clear-results-modal").classList.remove("show");
    renderStats();
    renderResults();
    renderLeaderboard();
  });
});

/* ---------- Utility: escape HTML to avoid injection via stored text ---------- */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
