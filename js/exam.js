/* =========================================================
   SecureExam – exam.js
   Handles: session guard, full-screen secure mode, anti-cheating
   monitoring, countdown timer, question navigation, and scoring.
   ========================================================= */

const SS_EXAM_USER_E = "examUser";
const LS_QUESTIONS_E = "examQuestions";
const LS_LAST_RESULT = "lastResult";
const LS_RESULTS_HISTORY = "examResults";
const LS_EXAM_TIME_A = "examTime";

const MAX_WARNINGS = 3;
const EXAM_QUESTION_COUNT = 40;

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getExamSeconds() {
  const minutes = parseInt(localStorage.getItem(LS_EXAM_TIME_A) || "15", 10);
  return minutes * 60;
}

const EXAM_SECONDS = getExamSeconds();

/* ---------- Session guard: no valid session -> back to portal ---------- */
const rawUser = sessionStorage.getItem(SS_EXAM_USER_E);
if (!rawUser) {
  window.location.href = "index.html";
}
const currentUser = rawUser ? JSON.parse(rawUser) : { username: "guest", fullName: "Guest" };

/* ---------- Load questions ---------- */
if (typeof syncDefaultQuestions === "function") {
  syncDefaultQuestions();
}
let QUESTION_POOL = JSON.parse(localStorage.getItem(LS_QUESTIONS_E) || "[]");
if (!QUESTION_POOL || QUESTION_POOL.length === 0) {
  QUESTION_POOL = typeof DEFAULT_QUESTIONS !== "undefined" ? DEFAULT_QUESTIONS : [];
}

function buildRandomizedExamSet() {
  const pool = [...QUESTION_POOL];
  const selected = shuffleArray(pool).slice(0, Math.min(EXAM_QUESTION_COUNT, pool.length));

  return selected.map((q) => {
    const baseOptions = [q.optionA, q.optionB, q.optionC, q.optionD];
    const originalOrder = [0, 1, 2, 3];
    const shuffledOrder = shuffleArray(originalOrder);
    const shuffledOptions = shuffledOrder.map((index) => baseOptions[index]);

    return {
      ...q,
      optionA: shuffledOptions[0],
      optionB: shuffledOptions[1],
      optionC: shuffledOptions[2],
      optionD: shuffledOptions[3],
      correct: shuffledOrder.indexOf(q.correct)
    };
  });
}

let QUESTIONS = buildRandomizedExamSet();

/* ---------- State ---------- */
let currentIndex = 0;
let answers = new Array(QUESTIONS.length).fill(null);
let warningCount = 0;
let examStarted = false;
let isSubmitting = false;
let timeRemaining = EXAM_SECONDS;
let timerInterval = null;
let examStartTimestamp = null;
let lastViolationAt = 0;
let fiveMinuteWarningShown = false;
const VIOLATION_DEBOUNCE_MS = 700;

/* ---------- DOM references (populated on load) ---------- */
let els = {};

document.addEventListener("DOMContentLoaded", () => {
  els = {
    securityScreen: document.getElementById("security-screen"),
    examShell: document.getElementById("exam-shell"),
    startBtn: document.getElementById("start-exam-btn"),
    fsError: document.getElementById("fullscreen-error"),
    candidateName: document.getElementById("candidate-name-label"),
    warningStrip: document.getElementById("warning-strip"),
    warnCounter: document.getElementById("warn-counter"),
    timerBox: document.getElementById("timer-box"),
    qMeta: document.getElementById("q-meta"),
    qBody: document.getElementById("q-body"),
    optionsContainer: document.getElementById("options-container"),
    prevBtn: document.getElementById("prev-btn"),
    nextBtn: document.getElementById("next-btn"),
    finishBtn: document.getElementById("finish-btn"),
    qnavGrid: document.getElementById("qnav-grid"),
    submitExamBtn: document.getElementById("submit-exam-btn"),
    submitModal: document.getElementById("submit-modal"),
    cancelSubmitBtn: document.getElementById("cancel-submit-btn"),
    confirmSubmitBtn: document.getElementById("confirm-submit-btn"),
    autoSubmitModal: document.getElementById("auto-submit-modal"),
    ackAutoSubmitBtn: document.getElementById("ack-auto-submit-btn")
  };

  els.candidateName.textContent = currentUser.fullName || currentUser.username;

  els.startBtn.addEventListener("click", handleStartExam);
  els.prevBtn.addEventListener("click", () => navigateTo(currentIndex - 1));
  els.nextBtn.addEventListener("click", () => navigateTo(currentIndex + 1));
  els.finishBtn.addEventListener("click", () => openSubmitModal());
  els.submitExamBtn.addEventListener("click", () => openSubmitModal());
  els.cancelSubmitBtn.addEventListener("click", () => els.submitModal.classList.remove("show"));
  els.confirmSubmitBtn.addEventListener("click", () => {
    els.submitModal.classList.remove("show");
    finalizeExam();
  });
  els.ackAutoSubmitBtn.addEventListener("click", () => {
    els.autoSubmitModal.classList.remove("show");
    finalizeExam();
  });

  buildQuestionNav();
  renderQuestion(0);
});

/* ---------- Fullscreen helpers (with basic vendor fallback) ---------- */
function requestFullscreenCompat() {
  const el = document.documentElement;
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  if (el.msRequestFullscreen) return el.msRequestFullscreen();
  return Promise.reject(new Error("Fullscreen API not supported"));
}
function exitFullscreenCompat() {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    if (document.exitFullscreen) return document.exitFullscreen().catch(() => {});
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  }
  return Promise.resolve();
}
function isCurrentlyFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

/* ---------- Start Secure Exam ---------- */
function handleStartExam() {
  els.fsError.classList.remove("show");

  requestFullscreenCompat()
    .then(() => {
      examStarted = true;
      examStartTimestamp = Date.now();
      els.securityScreen.style.display = "none";
      els.examShell.classList.add("active");
      attachSecurityListeners();
      startTimer();
      pushHistoryGuard();
    })
    .catch(() => {
      els.fsError.textContent = "Full-screen permission is required to start the secure exam.";
      els.fsError.classList.add("show");
    });
}

/* ---------- Security / Anti-cheat monitoring ---------- */
function attachSecurityListeners() {
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("blur", onWindowBlur);
  document.addEventListener("contextmenu", blockEvent);
  document.addEventListener("copy", blockEvent);
  document.addEventListener("cut", blockEvent);
  document.addEventListener("paste", blockEvent);
  document.addEventListener("selectstart", blockEvent);
  document.addEventListener("dragstart", blockEvent);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("beforeunload", onBeforeUnload);
}

function detachSecurityListeners() {
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("blur", onWindowBlur);
  document.removeEventListener("contextmenu", blockEvent);
  document.removeEventListener("copy", blockEvent);
  document.removeEventListener("cut", blockEvent);
  document.removeEventListener("paste", blockEvent);
  document.removeEventListener("selectstart", blockEvent);
  document.removeEventListener("dragstart", blockEvent);
  document.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("beforeunload", onBeforeUnload);
}

function blockEvent(e) {
  e.preventDefault();
  return false;
}

function onFullscreenChange() {
  if (!examStarted || isSubmitting) return;
  if (!isCurrentlyFullscreen()) {
    addViolation("Exited full-screen mode");
  }
}

function onVisibilityChange() {
  if (!examStarted || isSubmitting) return;
  if (document.hidden) {
    addViolation("Switched tab or minimized the window");
  }
}

function onWindowBlur() {
  if (!examStarted || isSubmitting) return;
  if (!document.hidden) {
    addViolation("Left the examination window");
  }
}

const BLOCKED_KEYS = ["c", "v", "x", "u", "s", "p", "a", "f", "r", "w", "t", "n"];
function onKeyDown(e) {
  if (!examStarted) return;
  const key = e.key ? e.key.toLowerCase() : "";

  if (e.key === "F12") {
    e.preventDefault();
    addViolation("Attempted to open developer tools (F12)");
    return;
  }
  if ((e.ctrlKey || e.metaKey) && BLOCKED_KEYS.includes(key)) {
    e.preventDefault();
    if (!isSubmitting) addViolation("Restricted keyboard shortcut attempt (Ctrl+" + key.toUpperCase() + ")");
  }
}

function onBeforeUnload(e) {
  if (examStarted && !isSubmitting) {
    e.preventDefault();
    e.returnValue = "";
    return "";
  }
}

/* Prevent back-navigation from leaving the exam */
function pushHistoryGuard() {
  history.pushState(null, "", window.location.href);
  window.addEventListener("popstate", onPopState);
}
function onPopState() {
  if (examStarted && !isSubmitting) {
    history.pushState(null, "", window.location.href);
    addViolation("Back navigation attempt");
  }
}

/* ---------- Violation handling ---------- */
function addViolation(reason) {
  const now = Date.now();
  if (now - lastViolationAt < VIOLATION_DEBOUNCE_MS) return;
  lastViolationAt = now;

  if (isSubmitting) return;

  warningCount++;
  els.warnCounter.textContent = "Warnings: " + warningCount + "/" + MAX_WARNINGS;

  if (warningCount < MAX_WARNINGS) {
    showWarningStrip("SECURITY WARNING " + warningCount + "/" + MAX_WARNINGS + " — " + reason);
  }

  if (warningCount >= MAX_WARNINGS) {
    triggerAutoSubmit();
  }
}

function showWarningStrip(message) {
  els.warningStrip.textContent = message;
  els.warningStrip.classList.add("show");
  clearTimeout(showWarningStrip._t);
  showWarningStrip._t = setTimeout(() => {
    els.warningStrip.classList.remove("show");
  }, 4000);
}

function triggerAutoSubmit() {
  if (isSubmitting) return;
  isSubmitting = true;
  clearInterval(timerInterval);
  els.autoSubmitModal.classList.add("show");
  // Safety net: auto-close and finalize even if the user never clicks OK
  setTimeout(() => {
    if (els.autoSubmitModal.classList.contains("show")) {
      els.autoSubmitModal.classList.remove("show");
      finalizeExam();
    }
  }, 3500);
}

/* ---------- Timer ---------- */
function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      finalizeExam();
    }
  }, 1000);
}
function updateTimerDisplay() {
  const m = Math.max(0, Math.floor(timeRemaining / 60));
  const s = Math.max(0, timeRemaining % 60);
  els.timerBox.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");

  if (timeRemaining <= 300 && timeRemaining > 0) {
    els.timerBox.classList.add("warning-5min");
    if (!fiveMinuteWarningShown) {
      fiveMinuteWarningShown = true;
      showWarningStrip("⏰ 5 MINUTES REMAINING! Please finish your remaining questions and submit.");
    }
  }

  if (timeRemaining <= 60) {
    els.timerBox.classList.add("low-time");
  }
}

/* ---------- Question rendering ---------- */
function renderQuestion(index) {
  currentIndex = index;
  const q = QUESTIONS[index];
  els.qMeta.textContent = "Question " + (index + 1) + " of " + QUESTIONS.length;
  els.qBody.textContent = q.question;

  const opts = [q.optionA, q.optionB, q.optionC, q.optionD];
  const labels = ["A", "B", "C", "D"];

  els.optionsContainer.innerHTML = opts
    .map((opt, i) => {
      const selected = answers[index] === i ? "selected" : "";
      return `
        <div class="option-choice ${selected}" data-option-index="${i}">
          <div class="radio-dot"></div>
          <span class="option-label">${labels[i]}.</span>
          <span class="option-text">${opt}</span>
        </div>
      `;
    })
    .join("");

  els.optionsContainer.querySelectorAll(".option-choice").forEach((node) => {
    node.addEventListener("click", () => {
      const i = parseInt(node.dataset.optionIndex, 10);
      answers[currentIndex] = i;
      renderQuestion(currentIndex);
      updateQuestionNav();
    });
  });

  els.prevBtn.disabled = index === 0;
  const isLast = index === QUESTIONS.length - 1;
  els.nextBtn.classList.toggle("hidden", isLast);
  els.finishBtn.classList.toggle("hidden", !isLast);

  updateQuestionNav();
}

function navigateTo(index) {
  if (index < 0 || index >= QUESTIONS.length) return;
  renderQuestion(index);
}

/* ---------- Question navigator panel ---------- */
function buildQuestionNav() {
  els.qnavGrid.innerHTML = QUESTIONS.map((_, i) => `<button class="qnav-btn" data-nav-index="${i}">${i + 1}</button>`).join("");
  els.qnavGrid.querySelectorAll(".qnav-btn").forEach((btn) => {
    btn.addEventListener("click", () => navigateTo(parseInt(btn.dataset.navIndex, 10)));
  });
}
function updateQuestionNav() {
  els.qnavGrid.querySelectorAll(".qnav-btn").forEach((btn, i) => {
    btn.classList.toggle("current", i === currentIndex);
    btn.classList.toggle("answered", answers[i] !== null && i !== currentIndex);
  });
}

/* ---------- Submit flow ---------- */
function openSubmitModal() {
  els.submitModal.classList.add("show");
}

function formatDuration(totalSeconds) {
  const s = totalSeconds || 0;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m + ":" + String(sec).padStart(2, "0");
}

let hasFinalized = false;
function finalizeExam() {
  if (hasFinalized) return; // guard against double-run (e.g. timer + violation racing)
  hasFinalized = true;
  isSubmitting = true;
  clearInterval(timerInterval);
  detachSecurityListeners();

  let correct = 0;
  let wrong = 0;
  let unanswered = 0;

  const answerDetails = QUESTIONS.map((q, i) => {
    const selectedIndex = answers[i];
    if (selectedIndex === null || selectedIndex === undefined) {
      unanswered++;
    } else if (selectedIndex === q.correct) {
      correct++;
    } else {
      wrong++;
    }
    const isCorrect = selectedIndex === q.correct;
    return {
      question: q.question,
      options: [q.optionA, q.optionB, q.optionC, q.optionD],
      selectedIndex: selectedIndex, // null if left unanswered
      correctIndex: q.correct,
      isCorrect: isCorrect
    };
  });
  const total = QUESTIONS.length;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  const status = percentage >= 50 ? "Passed" : "Failed";

  // Time taken: elapsed seconds since the exam actually started
  const elapsedFromClock = examStartTimestamp ? Math.round((Date.now() - examStartTimestamp) / 1000) : EXAM_SECONDS - timeRemaining;
  const timeTakenSeconds = Math.min(EXAM_SECONDS, Math.max(0, elapsedFromClock));
  const timeTakenFormatted = formatDuration(timeTakenSeconds);
  const submittedAtFormatted = new Date().toISOString().replace("T", " ").slice(0, 19);

  const result = {
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    studentName: currentUser.fullName || currentUser.username,
    email: currentUser.email || currentUser.username || (currentUser.username + "@gmail.com"),
    username: currentUser.username,
    score: correct,
    total: total,
    percentage: percentage,
    correct: correct,
    wrong: wrong,
    unanswered: unanswered,
    timeTaken: timeTakenFormatted,
    timeTakenSeconds: timeTakenSeconds,
    submittedAt: submittedAtFormatted,
    dateTime: new Date().toISOString(),
    status: status,
    warnings: warningCount,
    answers: answerDetails
  };

  // 1. Save as the "most recent result" (used by result.html right after submit)
  localStorage.setItem(LS_LAST_RESULT, JSON.stringify(result));

  // 2. Append to the full results history in LocalStorage
  const history = JSON.parse(localStorage.getItem(LS_RESULTS_HISTORY) || "[]");
  history.push(result);
  localStorage.setItem(LS_RESULTS_HISTORY, JSON.stringify(history));

  // 3. Append to persistent data/results.json via Node.js Express backend
  const postPromise = fetch("/api/results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result)
  }).catch((err) => {
    console.warn("Backend API not reachable; saved result to LocalStorage fallback.", err);
  });

  // Give fetch time to complete before redirecting to result.html
  const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 800));

  Promise.race([postPromise, timeoutPromise]).finally(() => {
    sessionStorage.removeItem(SS_EXAM_USER_E);
    exitFullscreenCompat().finally(() => {
      window.location.href = "result.html";
    });
  });
}
