/**
 * EduPeak Advanced LMS Engine
 * Handles Video Lectures, Timed Speed MCQ Engine, Live Classroom Simulation & Progress
 */

const LMS_STATE = {
  activeTab: "video-classroom",
  currentLessonIndex: 0,
  currentQuizIndex: 0,
  quizAnswers: {},
  quizSubmitted: false,
  quizTimerSeconds: 600, // 10 minutes
  quizTimerInterval: null,
  enrolledCourses: ["crs-phy-2025-theory", "crs-phy-2026-theory", "crs-phy-2025-revision"],
  notes: {},
  currentUser: null,
  currentPlaybackSpeed: 1.0
};

// Initialize LMS
function initLMS() {
  loadSavedLMSData();
  syncLiveStreamWithTeacher();
  populateLessonSelector();

  const lessons = window.EDUPEAK_DATA ? window.EDUPEAK_DATA.lmsLessons : [];
  const currentLesson = lessons[LMS_STATE.currentLessonIndex];
  if (window.EDUPEAK_PLAYER && currentLesson && currentLesson.videoUrl) {
    window.EDUPEAK_PLAYER.init(currentLesson.videoUrl);
  }

  renderLMSLesson(LMS_STATE.currentLessonIndex);
  startQuizTimer();
  renderQuizQuestion(LMS_STATE.currentQuizIndex);
  renderEnrolledCourses();
  initLiveChatSimulation();
}

// Synchronize Live Stream player with Teacher Studio Broadcast
function syncLiveStreamWithTeacher() {
  try {
    const saved = localStorage.getItem("edupeak_live_stream_config");
    const iframe = document.getElementById("lmsLiveStreamIframe");
    const topicEl = document.getElementById("lmsLiveTopicTitle");
    const statusTextEl = document.getElementById("lmsLiveStatusText");
    const badgeEl = document.getElementById("lmsLiveBadgePill");

    if (saved) {
      const cfg = JSON.parse(saved);
      if (iframe && cfg.embedUrl) {
        iframe.src = cfg.embedUrl;
      }
      if (topicEl && cfg.topic) {
        topicEl.textContent = cfg.topic;
      }
      if (statusTextEl && cfg.status) {
        statusTextEl.textContent = cfg.status === "live" ? "🔴 LIVE NOW" : (cfg.status === "ended" ? "⏹️ CONCLUDED" : "⏳ SCHEDULED");
        statusTextEl.style.color = cfg.status === "live" ? "#ef4444" : (cfg.status === "ended" ? "#64748b" : "#b45309");
      }
      if (badgeEl && cfg.status) {
        if (cfg.status === "live") {
          badgeEl.className = "video-live-pill status-live";
          badgeEl.innerHTML = '<i class="fa-solid fa-circle"></i> <span>BROADCASTING LIVE</span>';
        } else if (cfg.status === "scheduled") {
          badgeEl.className = "video-live-pill status-scheduled";
          badgeEl.innerHTML = '<i class="fa-solid fa-clock"></i> <span>SCHEDULED CLASS</span>';
        } else {
          badgeEl.className = "video-live-pill status-ended";
          badgeEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>CONCLUDED</span>';
        }
      }
    } else {
      if (topicEl) {
        topicEl.textContent = "2025/2026 A/L Physics - Live Interactive Masterclass";
      }
      if (statusTextEl) {
        statusTextEl.textContent = "🔴 LIVE NOW";
        statusTextEl.style.color = "#ef4444";
      }
      if (badgeEl) {
        badgeEl.className = "video-live-pill status-live";
        badgeEl.innerHTML = '<i class="fa-solid fa-circle"></i> <span>BROADCASTING LIVE</span>';
      }
    }
  } catch (e) {
    console.warn("Live stream sync notice:", e);
  }
}

// Load data from LocalStorage
function loadSavedLMSData() {
  try {
    const savedNotes = localStorage.getItem("edupeak_notes");
    if (savedNotes) {
      LMS_STATE.notes = JSON.parse(savedNotes);
    }
    const savedEnrolled = localStorage.getItem("edupeak_enrolled");
    if (savedEnrolled) {
      LMS_STATE.enrolledCourses = JSON.parse(savedEnrolled);
    }

    // Load any custom lessons created in Teacher Studio
    const customLessons = JSON.parse(localStorage.getItem("edupeak_custom_lessons") || "[]");
    if (customLessons.length && window.EDUPEAK_DATA) {
      customLessons.forEach(l => {
        if (!window.EDUPEAK_DATA.lmsLessons.find(item => item.id === l.id)) {
          window.EDUPEAK_DATA.lmsLessons.push(l);
        }
      });
    }

    // Load any custom quiz questions created in Teacher Studio
    const customQuizzes = JSON.parse(localStorage.getItem("edupeak_custom_quizzes") || "[]");
    if (customQuizzes.length && window.EDUPEAK_DATA) {
      customQuizzes.forEach(q => {
        if (!window.EDUPEAK_DATA.quizQuestions.find(item => item.id === q.id)) {
          window.EDUPEAK_DATA.quizQuestions.push(q);
        }
      });
    }
  } catch (e) {
    console.error("Storage load error:", e);
  }
}

// Synchronize LMS top bar with active user
function syncLMSUserInfo(user) {
  if (!user) return;
  const avatarLetterEl = document.getElementById("lmsAvatarLetter");
  const nameEl = document.getElementById("lmsStudentName");
  const idEl = document.getElementById("lmsStudentId");

  if (avatarLetterEl) avatarLetterEl.textContent = user.avatarLetter || user.name.charAt(0).toUpperCase();
  if (nameEl) nameEl.textContent = (window.currentLang === "si" && user.name_si) ? user.name_si : user.name;
  if (idEl) idEl.textContent = user.id || "EP-STUDENT";
}

// Select and display a specific course's lesson in LMS Video Classroom
function selectCourseLesson(courseId) {
  if (!courseId || !window.EDUPEAK_DATA || !window.EDUPEAK_DATA.lmsLessons) return;
  const lessons = window.EDUPEAK_DATA.lmsLessons;
  const targetClean = String(courseId).toLowerCase().replace(/-theory|-revision|-paper/g, '');
  
  const lessonIdx = lessons.findIndex(l => {
    if (!l.courseId) return false;
    const lClean = String(l.courseId).toLowerCase().replace(/-theory|-revision|-paper/g, '');
    return l.courseId === courseId || 
           courseId.startsWith(l.courseId) || 
           l.courseId.startsWith(courseId) || 
           lClean === targetClean;
  });

  if (lessonIdx !== -1) {
    renderLMSLesson(lessonIdx);
    const selector = document.getElementById("lmsLessonSelector");
    if (selector) selector.value = lessonIdx;
  }
}

// Open / Close LMS Portal Overlay (Guarded by Authentication)
function openLMSPortal(tabName = "video-classroom", courseId = null) {
  const currentUser = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getCurrentUser() : null;
  
  if (!currentUser) {
    if (window.showToast) {
      const msg = window.currentLang === "si"
        ? "🔒 කරුණාකර ඔබගේ EduPeak LMS ගිණුමට ප්‍රවේශ වන්න."
        : "🔒 Please sign in to access your EduPeak LMS account.";
      window.showToast(msg, "info");
    }
    setTimeout(() => {
      window.location.href = "login.html";
    }, 400);
    return;
  }

  // Set active user into LMS
  LMS_STATE.currentUser = currentUser;
  if (typeof syncLMSUserInfo === "function") syncLMSUserInfo(currentUser);

  const lmsModal = document.getElementById("lmsModalWrapper");
  if (lmsModal) {
    lmsModal.classList.add("active");
    document.body.style.overflow = "hidden";
    if (typeof populateLessonSelector === "function") populateLessonSelector();
    if (typeof renderEnrolledCourses === "function") renderEnrolledCourses();
    switchLMSTab(tabName);

    const lessons = window.EDUPEAK_DATA ? window.EDUPEAK_DATA.lmsLessons : [];
    const currentLesson = lessons[LMS_STATE.currentLessonIndex];
    if (window.EDUPEAK_PLAYER && currentLesson) {
      window.EDUPEAK_PLAYER.init(currentLesson.videoUrl);
    }

    // If specific course was requested, immediately load its module/lesson!
    if (courseId) {
      selectCourseLesson(courseId);
    }
  } else {
    // On another page (courses.html, etc.) -> redirect to index.html with query parameters
    const courseParam = courseId ? `&course=${encodeURIComponent(courseId)}` : '';
    window.location.href = `index.html?openLms=${encodeURIComponent(tabName)}${courseParam}`;
  }
}

function closeLMSPortal() {
  const lmsModal = document.getElementById("lmsModalWrapper");
  if (lmsModal) {
    lmsModal.classList.remove("active");
    document.body.style.overflow = "auto";
  }
}

// Switch between LMS Views (Video, Live Room, Quiz, My Courses)
function switchLMSTab(tabId) {
  LMS_STATE.activeTab = tabId;
  
  document.querySelectorAll(".lms-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  document.querySelectorAll(".lms-view-pane").forEach(pane => {
    pane.classList.toggle("active", pane.id === `lmsView_${tabId}`);
  });

  if (tabId === "live-room") {
    syncLiveStreamWithTeacher();
  } else if (tabId === "my-courses") {
    renderEnrolledCourses();
  } else if (tabId === "speed-quiz") {
    renderQuizQuestion(LMS_STATE.currentQuizIndex);
    if (!LMS_STATE.quizTimerInterval && !LMS_STATE.quizSubmitted) {
      startQuizTimer();
    }
  }
}

// --------------------------------------------------------------------------
// 1. VIDEO CLASSROOM ENGINE
// --------------------------------------------------------------------------
function populateLessonSelector() {
  const selector = document.getElementById("lmsLessonSelector");
  if (!selector || !window.EDUPEAK_DATA || !window.EDUPEAK_DATA.lmsLessons) return;

  const currentLang = window.currentLang || "en";
  selector.innerHTML = window.EDUPEAK_DATA.lmsLessons.map((l, idx) => `
    <option value="${idx}" ${idx === LMS_STATE.currentLessonIndex ? 'selected' : ''}>
      ${idx + 1}. ${currentLang === "si" ? (l.title_si || l.title) : l.title}
    </option>
  `).join('');
}

function renderLMSLesson(index) {
  LMS_STATE.currentLessonIndex = index;
  const lessons = window.EDUPEAK_DATA ? window.EDUPEAK_DATA.lmsLessons : [];
  const lesson = lessons[index];
  if (!lesson) return;

  const titleEl = document.getElementById("lmsLessonTitle");
  const teacherEl = document.getElementById("lmsLessonTeacher");
  const chaptersListEl = document.getElementById("lmsChaptersList");
  const chaptersCountEl = document.getElementById("lmsChaptersCount");
  const notePadEl = document.getElementById("lmsNotePad");
  const videoIframe = document.getElementById("lmsVideoIframe");
  const pdfBtnText = document.getElementById("lmsPdfBtnText");
  const selector = document.getElementById("lmsLessonSelector");

  if (selector && selector.value != index) {
    selector.value = index;
  }

  const currentLang = window.currentLang || "en";
  if (titleEl) {
    titleEl.textContent = currentLang === "si" ? (lesson.title_si || lesson.title) : lesson.title;
  }
  if (teacherEl) {
    teacherEl.innerHTML = `<i class="fa-solid fa-chalkboard-user"></i> ${lesson.teacher} &bull; ${lesson.subject}`;
  }
  if (pdfBtnText) {
    pdfBtnText.textContent = lesson.hasPdf ? (lesson.pdfName ? lesson.pdfName.substring(0, 16) + '...' : 'Tute PDF') : 'No PDF';
  }

  // Update video player (Custom EduPeak DRM Player)
  if (window.EDUPEAK_PLAYER && lesson.videoUrl) {
    window.EDUPEAK_PLAYER.loadVideo(lesson.videoUrl);
  } else if (videoIframe && lesson.videoUrl) {
    if (!videoIframe.src.includes(lesson.videoUrl)) {
      videoIframe.src = lesson.videoUrl;
    }
  }

  // Set note content
  const lessonNoteKey = `lesson_${lesson.id}`;
  if (notePadEl) {
    notePadEl.value = LMS_STATE.notes[lessonNoteKey] || lesson.notes || "";
  }

  // Render chapters
  const chapters = lesson.chapters || [];
  if (chaptersCountEl) {
    chaptersCountEl.textContent = `${chapters.length} Chapters`;
  }

  if (chaptersListEl) {
    if (chapters.length === 0) {
      chaptersListEl.innerHTML = `
        <div style="padding: 0.75rem; color: #94a3b8; font-size: 0.8rem; text-align: center;">
          Full lecture stream without timeline cuts.
        </div>
      `;
    } else {
      chaptersListEl.innerHTML = chapters.map((ch, chIdx) => `
        <div class="chapter-item ${chIdx === 0 ? 'active' : ''}" onclick="jumpToChapter(${chIdx}, '${ch.time}')">
          <span><i class="fa-solid fa-play" style="font-size: 0.65rem; margin-right: 0.4rem; color: var(--primary);"></i> ${ch.title}</span>
          <span class="chapter-time">${ch.time}</span>
        </div>
      `).join('');
    }
  }
}

function jumpToChapter(chIdx, time) {
  document.querySelectorAll(".chapter-item").forEach((el, i) => {
    el.classList.toggle("active", i === chIdx);
  });

  if (window.EDUPEAK_PLAYER && window.EDUPEAK_PLAYER.parseTimeToSeconds) {
    const seconds = window.EDUPEAK_PLAYER.parseTimeToSeconds(time);
    window.EDUPEAK_PLAYER.seekTo(seconds);
  }

  showToast(`⚡ Jumped to Chapter Marker at ${time}`, "info");
}

function setPlaybackSpeed(speed, btnEl) {
  LMS_STATE.currentPlaybackSpeed = speed;
  document.querySelectorAll(".speed-btn").forEach(btn => {
    btn.classList.remove("active");
    btn.style.background = "transparent";
    btn.style.color = "#64748b";
  });
  if (btnEl) {
    btnEl.classList.add("active");
    btnEl.style.background = "#eff6ff";
    btnEl.style.color = "#227aff";
  }

  if (window.EDUPEAK_PLAYER) {
    window.EDUPEAK_PLAYER.setPlaybackRate(speed);
  } else {
    showToast(`🚀 Playback speed adjusted to ${speed}x`, "info");
  }
}

function saveStudentNote() {
  const notePadEl = document.getElementById("lmsNotePad");
  const lessons = window.EDUPEAK_DATA ? window.EDUPEAK_DATA.lmsLessons : [];
  const currentLesson = lessons[LMS_STATE.currentLessonIndex];
  if (notePadEl && currentLesson) {
    const key = `lesson_${currentLesson.id}`;
    LMS_STATE.notes[key] = notePadEl.value;
    localStorage.setItem("edupeak_notes", JSON.stringify(LMS_STATE.notes));
    showToast("💾 Lecture notes saved successfully to your Cloud Notebook!", "success");
  }
}

function downloadCurrentPdf() {
  const lessons = window.EDUPEAK_DATA ? window.EDUPEAK_DATA.lmsLessons : [];
  const currentLesson = lessons[LMS_STATE.currentLessonIndex];
  if (currentLesson && currentLesson.hasPdf) {
    showToast(`📥 Downloading Study Tute: ${currentLesson.pdfName}`, "success");
  } else {
    showToast("No downloadable tute attached to this module.", "info");
  }
}

// --------------------------------------------------------------------------
// 2. TIMED SPEED MCQ EXAMINATION SYSTEM
// --------------------------------------------------------------------------
function startQuizTimer() {
  if (LMS_STATE.quizTimerInterval) {
    clearInterval(LMS_STATE.quizTimerInterval);
  }

  const timerEl = document.getElementById("quizTimerText");
  const pillEl = document.getElementById("quizTimerPill");

  LMS_STATE.quizTimerInterval = setInterval(() => {
    if (LMS_STATE.quizSubmitted) {
      clearInterval(LMS_STATE.quizTimerInterval);
      return;
    }

    if (LMS_STATE.quizTimerSeconds <= 0) {
      clearInterval(LMS_STATE.quizTimerInterval);
      if (timerEl) timerEl.textContent = "00:00 (Time's Up)";
      showToast("⏰ Time is up! Submitting exam automatically...", "info");
      submitQuiz();
      return;
    }

    LMS_STATE.quizTimerSeconds--;
    const mins = Math.floor(LMS_STATE.quizTimerSeconds / 60);
    const secs = LMS_STATE.quizTimerSeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (timerEl) {
      timerEl.textContent = `${formatted} Left`;
    }

    if (LMS_STATE.quizTimerSeconds <= 60 && pillEl) {
      pillEl.style.background = "#fee2e2";
      pillEl.style.color = "#dc2626";
      pillEl.style.borderColor = "#f87171";
    }
  }, 1000);
}

function renderQuizQuestion(index) {
  LMS_STATE.currentQuizIndex = index;
  const questions = window.EDUPEAK_DATA ? window.EDUPEAK_DATA.quizQuestions : [];
  const q = questions[index];
  if (!q) return;

  const currentLang = window.currentLang || "en";

  // Update dots
  const dotsContainer = document.getElementById("quizDotsContainer");
  if (dotsContainer) {
    dotsContainer.innerHTML = questions.map((item, idx) => {
      const isAnswered = LMS_STATE.quizAnswers[item.id] !== undefined;
      const isActive = idx === index;
      return `
        <div class="quiz-dot ${isActive ? 'active' : ''} ${isAnswered ? 'answered' : ''}" onclick="renderQuizQuestion(${idx})">
          ${idx + 1}
        </div>
      `;
    }).join('');
  }

  // Render question text
  const subjectTag = document.getElementById("quizSubjectTag");
  const counterEl = document.getElementById("quizQuestionCounter");
  const mainText = document.getElementById("quizQuestionMain");
  const sinhalaText = document.getElementById("quizQuestionSinhala");
  const optionsList = document.getElementById("quizOptionsList");
  const explanationBox = document.getElementById("quizExplanationBox");

  if (subjectTag) subjectTag.textContent = currentLang === "si" ? (q.subject_si || q.subject) : q.subject;
  if (counterEl) counterEl.textContent = `Question ${index + 1} of ${questions.length}`;
  if (mainText) mainText.textContent = q.question;
  if (sinhalaText) sinhalaText.textContent = q.question_si || "";

  // Options
  if (optionsList) {
    const selectedAnswer = LMS_STATE.quizAnswers[q.id];
    optionsList.innerHTML = q.options.map((opt, optIdx) => {
      const isSelected = selectedAnswer === optIdx;
      let stateClass = isSelected ? 'selected' : '';

      if (LMS_STATE.quizSubmitted) {
        if (optIdx === q.correctAnswer) stateClass += ' correct';
        else if (isSelected && optIdx !== q.correctAnswer) stateClass += ' incorrect';
      }

      return `
        <div class="quiz-option-item ${stateClass}" onclick="selectQuizOption(${q.id}, ${optIdx})" style="cursor: ${LMS_STATE.quizSubmitted ? 'default' : 'pointer'};">
          <div class="option-radio-mark">${String.fromCharCode(65 + optIdx)}</div>
          <div style="font-size: 0.925rem; font-weight: 500; line-height: 1.4;">${opt}</div>
        </div>
      `;
    }).join('');
  }

  // Explanation
  if (explanationBox) {
    if (LMS_STATE.quizSubmitted) {
      explanationBox.style.display = "block";
      explanationBox.innerHTML = `
        <div style="font-weight: 800; color: #16a34a; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-circle-check"></i> Step-by-Step Physics Derivation & Analysis:
        </div>
        <p style="font-size: 0.9rem; line-height: 1.5; color: #0f172a; margin-bottom: 0.5rem;">${q.explanation}</p>
        <p style="font-size: 0.85rem; line-height: 1.5; color: #334155; font-family: var(--font-sinhala); margin: 0;">${q.explanation_si || ''}</p>
      `;
    } else {
      explanationBox.style.display = "none";
    }
  }

  // Next / Prev button states
  const prevBtn = document.getElementById("quizPrevBtn");
  const nextBtn = document.getElementById("quizNextBtn");
  const submitBtn = document.getElementById("quizSubmitBtn");

  if (prevBtn) prevBtn.disabled = index === 0;
  if (nextBtn) nextBtn.style.display = index === questions.length - 1 ? 'none' : 'inline-flex';
  if (submitBtn) submitBtn.style.display = index === questions.length - 1 ? 'inline-flex' : 'none';
}

function selectQuizOption(questionId, optionIndex) {
  if (LMS_STATE.quizSubmitted) return;
  LMS_STATE.quizAnswers[questionId] = optionIndex;
  renderQuizQuestion(LMS_STATE.currentQuizIndex);
}

function nextQuizQuestion() {
  const questions = window.EDUPEAK_DATA ? window.EDUPEAK_DATA.quizQuestions : [];
  if (LMS_STATE.currentQuizIndex < questions.length - 1) {
    renderQuizQuestion(LMS_STATE.currentQuizIndex + 1);
  }
}

function prevQuizQuestion() {
  if (LMS_STATE.currentQuizIndex > 0) {
    renderQuizQuestion(LMS_STATE.currentQuizIndex - 1);
  }
}

function submitQuiz() {
  const questions = window.EDUPEAK_DATA ? window.EDUPEAK_DATA.quizQuestions : [];
  let correctCount = 0;

  questions.forEach(q => {
    if (LMS_STATE.quizAnswers[q.id] === q.correctAnswer) {
      correctCount++;
    }
  });

  LMS_STATE.quizSubmitted = true;
  if (LMS_STATE.quizTimerInterval) {
    clearInterval(LMS_STATE.quizTimerInterval);
  }

  const scorePercent = Math.round((correctCount / questions.length) * 100);

  // Store quiz submission for Teacher Gradebook
  try {
    const user = LMS_STATE.currentUser || { name: "A/L Student", id: "EP-STUDENT" };
    const submissions = JSON.parse(localStorage.getItem("edupeak_quiz_submissions") || "[]");
    submissions.push({
      studentName: user.name,
      studentId: user.id,
      paperTitle: "A/L Physics Speed Evaluation 01",
      score: scorePercent,
      correct: correctCount,
      total: questions.length,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem("edupeak_quiz_submissions", JSON.stringify(submissions));
  } catch (e) {
    console.warn("Submissions error:", e);
  }

  // Show summary modal
  const resultModal = document.getElementById("quizResultModal");
  const scoreNumber = document.getElementById("quizResultScore");
  const scoreText = document.getElementById("quizResultFeedback");

  if (scoreNumber) scoreNumber.textContent = `${scorePercent}%`;
  if (scoreText) {
    scoreText.innerHTML = `You answered <strong>${correctCount} of ${questions.length}</strong> questions correctly.<br>Rank: <strong>Island Top 2.5% Percentile</strong> &bull; Mechanics & Vectors Mastered.`;
  }

  if (resultModal) {
    resultModal.classList.add("active");
  }

  renderQuizQuestion(LMS_STATE.currentQuizIndex);
  showToast(`🎯 Exam submitted successfully! Score: ${scorePercent}%`, "success");
}

function resetQuiz() {
  LMS_STATE.quizAnswers = {};
  LMS_STATE.quizSubmitted = false;
  LMS_STATE.currentQuizIndex = 0;
  LMS_STATE.quizTimerSeconds = 600;
  
  const resultModal = document.getElementById("quizResultModal");
  if (resultModal) resultModal.classList.remove("active");

  startQuizTimer();
  renderQuizQuestion(0);
  showToast("🔄 Speed Evaluation Reset. Timer started!", "info");
}

// --------------------------------------------------------------------------
// 3. LIVE CLASSROOM CHAT SIMULATOR
// --------------------------------------------------------------------------
const SIMULATED_MESSAGES = [
  { sender: "Kavindu Jayawardena", time: "18:20", text: "Sir, moment of inertia question 2 explanation was crystal clear!" },
  { sender: "Sanduni Fernando (Embilipitiya)", time: "18:22", text: "Sir recording eka upload wenawada ada raata?" },
  { sender: "Amalsha Wanniarachchi (Lecturer)", time: "18:23", text: "Yes Sanduni, recording will be available in 1080p within 1 hour after stream." },
  { sender: "Nethmi Wickramasinghe", time: "18:24", text: "Sir please solve the 2023 equilibrium tricky essay part!" },
  { sender: "Kasun Theekshana", time: "18:25", text: "EduPeak LMS speed and quality is top tier 🔥" }
];

function initLiveChatSimulation() {
  const chatScroll = document.getElementById("liveChatMessagesScroll");
  if (!chatScroll) return;

  chatScroll.innerHTML = SIMULATED_MESSAGES.map(msg => `
    <div class="chat-bubble">
      <div class="chat-sender">
        <span style="font-weight: 700; color: #0f172a;">${msg.sender}</span>
        <span class="chat-time" style="font-size: 0.725rem; color: #94a3b8;">${msg.time}</span>
      </div>
      <div style="font-size: 0.85rem; color: #334155; margin-top: 0.2rem;">${msg.text}</div>
    </div>
  `).join('');

  chatScroll.scrollTop = chatScroll.scrollHeight;
}

function sendLiveChatMessage() {
  const inputEl = document.getElementById("liveChatInputField");
  const chatScroll = document.getElementById("liveChatMessagesScroll");
  if (!inputEl || !inputEl.value.trim() || !chatScroll) return;

  const text = inputEl.value.trim();
  const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const userName = (LMS_STATE.currentUser && LMS_STATE.currentUser.name) ? LMS_STATE.currentUser.name : "Student";

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.innerHTML = `
    <div class="chat-sender">
      <span style="font-weight: 700; color: var(--primary);">${userName} (You)</span>
      <span class="chat-time" style="font-size: 0.725rem; color: #94a3b8;">${timeNow}</span>
    </div>
    <div style="font-size: 0.85rem; color: #0f172a; margin-top: 0.2rem;">${text}</div>
  `;

  chatScroll.appendChild(bubble);
  inputEl.value = "";
  chatScroll.scrollTop = chatScroll.scrollHeight;

  // Auto simulated instructor bot response after 1.8 seconds
  setTimeout(() => {
    const autoReply = document.createElement("div");
    autoReply.className = "chat-bubble";
    autoReply.innerHTML = `
      <div class="chat-sender">
        <span style="font-weight: 700; color: #10b981;"><i class="fa-solid fa-robot"></i> EduPeak Studio Assistant</span>
        <span class="chat-time" style="font-size: 0.725rem; color: #94a3b8;">${timeNow}</span>
      </div>
      <div style="font-size: 0.85rem; color: #334155; margin-top: 0.2rem;">Your physics question has been prioritized in the lecturer's live stream queue.</div>
    `;
    chatScroll.appendChild(autoReply);
    chatScroll.scrollTop = chatScroll.scrollHeight;
  }, 1800);
}

// --------------------------------------------------------------------------
// 4. ENROLLED COURSES DASHBOARD
// --------------------------------------------------------------------------
function renderEnrolledCourses() {
  const grid = document.getElementById("enrolledCoursesGrid");
  if (!grid) return;

  const allCourses = (window.EDUPEAK_DATA && window.EDUPEAK_DATA.courses) ? window.EDUPEAK_DATA.courses : [];
  const enrolled = allCourses.filter(c => LMS_STATE.enrolledCourses.some(id => c.id === id || c.id.startsWith(id) || id.startsWith(c.id)));
  const currentLang = window.currentLang || "en";

  if (enrolled.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 2.5rem 1.5rem; text-align: center; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: var(--radius-lg); margin-top: 0.5rem;">
        <div style="width: 48px; height: 48px; border-radius: 50%; background: #eff6ff; color: var(--primary); display: inline-flex; align-items: center; justify-content: center; font-size: 1.3rem; margin-bottom: 0.75rem;">
          <i class="fa-solid fa-graduation-cap"></i>
        </div>
        <h4 style="font-size: 1.1rem; font-weight: 700; color: #1e293b; margin: 0 0 0.35rem 0;">No Active Course Enrollments</h4>
        <p style="color: var(--text-muted); font-size: 0.875rem; margin: 0 0 1.25rem 0;">Explore our G.C.E. Advanced Level Physics masterclasses to enroll and access study materials!</p>
        <button class="btn btn-primary btn-sm" onclick="closeLMSPortal(); window.location.href='courses.html';" style="display: inline-flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-compass"></i> Explore Courses
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = enrolled.map((crs, idx) => {
    const progress = Math.min(100, (idx + 1) * 28 + 15);
    return `
      <div class="enrolled-course-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <div>
          <div class="enrolled-course-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span class="enrolled-stream-badge" style="background: #eff6ff; color: #227aff; font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 6px;">${currentLang === "si" ? (crs.stream_si || crs.stream) : crs.stream}</span>
            <span class="enrolled-level-tag" style="background: #f1f5f9; color: #475569; font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 6px;">${crs.level || 'A/L'}</span>
          </div>
          <h4 class="enrolled-course-title" style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-bottom: 0.4rem; line-height: 1.4;">
            ${currentLang === "si" ? (crs.title_si || crs.title) : crs.title}
          </h4>
          <div class="enrolled-teacher-row" style="font-size: 0.825rem; color: #64748b; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.4rem;">
            <i class="fa-solid fa-chalkboard-user" style="color: #227aff;"></i> <span>${crs.teacherName || 'Amalsha Wanniarachchi (MBBS UG)'}</span>
          </div>
          <div class="progress-bar-container" style="height: 6px; background: #f1f5f9; border-radius: 9999px; overflow: hidden; margin-bottom: 0.5rem;">
            <div class="progress-bar-fill" style="width: ${progress}%; height: 100%; background: linear-gradient(90deg, #227aff, #38bdf8); border-radius: 9999px;"></div>
          </div>
          <div class="enrolled-progress-meta" style="display: flex; justify-content: space-between; font-size: 0.775rem; color: #64748b; margin-bottom: 1rem;">
            <span>Completed: <strong style="color: #0f172a;">${progress}%</strong></span>
            <span>${crs.modulesCount || 12} Video Modules</span>
          </div>
        </div>
        <button class="btn btn-primary btn-sm enrolled-cta-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.4rem; font-weight: 700;" onclick="switchLMSTab('video-classroom'); renderLMSLesson(${idx % 4});">
          <i class="fa-solid fa-circle-play"></i> Continue Learning
        </button>
      </div>
    `;
  }).join('');
}

// Helper: Check if user is already enrolled in a course
function isCourseEnrolled(courseId) {
  if (!courseId) return false;
  try {
    let enrolledList = [];
    const saved = localStorage.getItem("edupeak_enrolled");
    if (saved) {
      enrolledList = JSON.parse(saved);
    } else if (window.LMS_STATE && window.LMS_STATE.enrolledCourses) {
      enrolledList = window.LMS_STATE.enrolledCourses;
    }
    
    // Normalize string IDs
    const targetClean = String(courseId).toLowerCase().replace(/-theory|-revision|-paper/g, '');
    return enrolledList.some(id => {
      const cleanId = String(id).toLowerCase().replace(/-theory|-revision|-paper/g, '');
      return id === courseId || courseId.startsWith(id) || id.startsWith(courseId) || cleanId === targetClean;
    });
  } catch (e) {
    return false;
  }
}

// Enroll Course Handler with Login Check, Duplicate Enrollment Guard & Checkout Redirect
function enrollCourse(courseId) {
  // 1. Guard against duplicate enrollment -> Open that specific course in LMS!
  if (isCourseEnrolled(courseId)) {
    showToast("✓ You are already enrolled! Loading this course's masterclass in LMS...", "success");
    setTimeout(() => {
      openLMSPortal("video-classroom", courseId);
    }, 350);
    return;
  }

  const currentUser = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getCurrentUser() : null;

  if (currentUser) {
    // If user is already logged in -> Bring directly to checkout page!
    window.location.href = `checkout.html?course=${encodeURIComponent(courseId)}`;
  } else {
    // If not logged in -> Save redirect and forward to login page
    sessionStorage.setItem("edupeak_redirect_after_login", `checkout.html?course=${encodeURIComponent(courseId)}`);
    showToast("Please sign in to complete your course enrollment.", "info");
    setTimeout(() => {
      window.location.href = `login.html?redirect=checkout.html%3Fcourse%3D${encodeURIComponent(courseId)}`;
    }, 450);
  }
}

// Toast notification helper
function showToast(message, type = "info") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-info'}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Expose globally
window.isCourseEnrolled = isCourseEnrolled;
window.openLMSPortal = openLMSPortal;
window.closeLMSPortal = closeLMSPortal;
window.switchLMSTab = switchLMSTab;
window.renderLMSLesson = renderLMSLesson;
window.selectCourseLesson = selectCourseLesson;
window.populateLessonSelector = populateLessonSelector;
window.saveStudentNote = saveStudentNote;
window.downloadCurrentPdf = downloadCurrentPdf;
window.jumpToChapter = jumpToChapter;
window.setPlaybackSpeed = setPlaybackSpeed;
window.selectQuizOption = selectQuizOption;
window.nextQuizQuestion = nextQuizQuestion;
window.prevQuizQuestion = prevQuizQuestion;
window.submitQuiz = submitQuiz;
window.resetQuiz = resetQuiz;
window.sendLiveChatMessage = sendLiveChatMessage;
window.enrollCourse = enrollCourse;
window.showToast = showToast;
window.syncLMSUserInfo = syncLMSUserInfo;
window.LMS_STATE = LMS_STATE;
window.initLMS = initLMS;

document.addEventListener("DOMContentLoaded", () => {
  const lmsModal = document.getElementById("lmsModalWrapper");
  if (lmsModal) {
    initLMS();

    // Check if query parameter requested an LMS tab and specific course
    const urlParams = new URLSearchParams(window.location.search);
    const openLms = urlParams.get("openLms") || urlParams.get("lms");
    const targetCourse = urlParams.get("course");
    if (openLms) {
      setTimeout(() => {
        openLMSPortal(openLms, targetCourse);
      }, 200);
    }
  }
});
