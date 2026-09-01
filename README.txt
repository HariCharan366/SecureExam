====================================================================
 SecureExam – Secure Online Examination System
 College Project (HTML / CSS / JavaScript only — NO DATABASE)
====================================================================

PROJECT OVERVIEW
--------------------------------------------------------------------
SecureExam is a fully client-side (browser-only) secure examination
system. It intentionally uses browser localStorage/sessionStorage
instead of a database. It is suitable for a college demonstration.
A normal web browser cannot provide complete operating-system
lockdown — this project uses browser-level security features
(Fullscreen API, visibility/blur events, keydown interception, and
clipboard/context-menu blocking) to detect and discourage cheating
as strongly as is technically possible from inside a webpage.

There is NO backend, NO server-side code, and NO database of any
kind (no MySQL, MongoDB, Firebase, Supabase, PHP, or Node.js). All
data is stored locally in the student's browser using:

    localStorage   -> students, examQuestions, lastResult, examResults
    sessionStorage -> examUser (logged-in student), adminSession

"examResults" holds the FULL history of every exam attempt (score,
time taken, security warnings, and every question with the
student's selected answer vs. the correct answer). "lastResult"
is just a copy of the most recent attempt, used by result.html
right after a student submits.

--------------------------------------------------------------------
PROJECT STRUCTURE
--------------------------------------------------------------------
SecureExam/
│
├── index.html      -> Student portal (login / create account)
├── admin.html       -> Admin portal (login + dashboard)
├── exam.html         -> Secure exam mode + exam interface
├── result.html       -> Result / score summary page
├── README.txt        -> This file
│
├── css/
│   └── style.css     -> All styling (single stylesheet)
│
└── js/
    ├── auth.js       -> Student login/registration logic
    ├── admin.js      -> Admin login + question/student management
    └── exam.js       -> Fullscreen, monitoring, timer, scoring

--------------------------------------------------------------------
HOW TO RUN (VS CODE + LIVE SERVER)
--------------------------------------------------------------------
1. Install Visual Studio Code (if not already installed).
2. Open the "SecureExam" project folder in VS Code (File > Open Folder).
3. Install the "Live Server" extension by Ritwick Dey from the
   VS Code Extensions marketplace (if not already installed).
4. In the VS Code file explorer, right-click on "index.html".
5. Select "Open with Live Server."
6. Your default browser will open the Student Portal automatically
   (e.g. http://127.0.0.1:5500/index.html).
7. Create a student account using the "Create Account" tab.
8. Switch to the "Student Login" tab and log in with the same
   username and password.
9. On the Secure Exam Mode screen, click "START SECURE EXAM."
10. Your browser will enter full-screen mode and the timer will
    begin (15:00).
11. Answer the questions, navigate using Previous/Next or the
    question navigator panel, and click "Submit Exam" (or "Finish
    & Submit Exam" on the last question) when done.
12. You will be redirected to the Result page showing your score,
    correct/wrong answer counts, security warning count, and total
    time taken. Click "View Detailed Answer Review" to see every
    question with your selected answer and the correct answer
    marked clearly.

--------------------------------------------------------------------
HOW TO ACCESS THE ADMIN PORTAL
--------------------------------------------------------------------
From the main Student Portal page, click "Admin Portal" in the
top-right corner of the navigation bar. This opens admin.html.

Admin Login Credentials:
    Admin ID:  1234
    Password:  admin123

After logging in, the Admin can:
  - View dashboard statistics (Total Students, Total Questions,
    Total Attempts, Exam Duration).
  - Add new exam questions (question text, four options, and the
    correct answer) using the "Add Exam Question" form.
  - View all saved questions with the correct answer highlighted,
    and delete individual questions.
  - Reset the question bank back to the 5 built-in default
    questions using "Reset Default Questions."
  - View the list of registered students (name and username only —
    passwords are never displayed).
  - View "STUDENT EXAM RESULTS" — every exam attempt ever taken,
    most recent first, showing: student name & username, score
    and percentage, time taken (mm:ss), security warning count,
    and submission date/time. Click "View Answers" on any attempt
    to expand a full question-by-question breakdown showing
    exactly which option the student selected vs. the correct
    answer for every question.
  - Clear the entire results history with "Clear All Results"
    (confirmation required).

Any question the Admin saves is immediately available to students
taking the exam, since both pages read from the same
"examQuestions" entry in localStorage.

--------------------------------------------------------------------
SECURITY / ANTI-CHEATING FEATURES (BROWSER-LEVEL ONLY)
--------------------------------------------------------------------
While the secure exam is active, the following are monitored or
blocked:

  - Full-screen exit detection (fullscreenchange event)
  - Tab switching / window minimizing (visibilitychange event)
  - Window focus loss (blur event)
  - Right-click / context menu (disabled)
  - Copy, cut, and paste (disabled)
  - Text selection and drag operations (disabled)
  - Restricted keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+U,
    Ctrl+S, Ctrl+P, Ctrl+A, Ctrl+F, Ctrl+R, Ctrl+W, Ctrl+T, Ctrl+N,
    and F12) — blocked via preventDefault() where the browser
    allows it
  - Back-button / browser navigation attempts (via history guard)

Each detected violation increases a visible "Warnings: n/3" counter
and shows a "SECURITY WARNING n/3" banner. On the 3rd violation,
the exam is automatically submitted with the message: "Three
security violations detected. Your examination will now be
submitted."

IMPORTANT HONESTY NOTE: A normal website running in a browser tab
cannot fully control the operating system. It cannot prevent a
second physical device from being used, cannot block OS-level
screenshot tools in every case, and cannot guarantee against all
possible workarounds. These features provide a strong, realistic
layer of browser-based exam integrity suitable for a classroom or
college demonstration — they are not a substitute for a dedicated,
OS-level lockdown browser used in commercial proctoring products.

--------------------------------------------------------------------
DEFAULT DATA
--------------------------------------------------------------------
On first run, the app automatically seeds 5 default "Programming
Fundamentals" questions into localStorage so the exam works
immediately without any admin setup. The Admin can add more
questions or delete/reset these at any time from admin.html.

--------------------------------------------------------------------
NOTES
--------------------------------------------------------------------
- Clearing your browser's site data (or using a different browser/
  incognito window) will reset all stored accounts, questions, and
  results, since everything lives in that browser's localStorage.
- Because Live Server serves the project over http://127.0.0.1,
  the Fullscreen API and other browser APIs used here work
  correctly (some browsers restrict these APIs on file:// URLs).
====================================================================
