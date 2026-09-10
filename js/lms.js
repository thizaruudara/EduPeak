/**
 * Helper: Normalized course ID matching supporting prefixes (crs-, course-), suffixes (-theory, -revision), and aliases
 */
function matchCourseId(id1, id2) {
  if (!id1 || !id2) return false;
  if (id1 === id2) return true;
  const s1 = String(id1).toLowerCase().trim();
  const s2 = String(id2).toLowerCase().trim();
  if (s1 === s2) return true;

  const normalize = (str) => {
    return str
      .replace(/^crs-|^course-|^cls-|^ep-/gi, '')
      .replace(/[^a-z0-9]/gi, '');
  };

  const norm1 = normalize(s1);
  const norm2 = normalize(s2);
  if (norm1 && norm2 && norm1 === norm2) {
    return true;
  }
  return false;
}
window.matchCourseId = matchCourseId;

const LMS_STATE = {
  activeTab: "video-classroom",
  activeCourseId: null,
  quizActiveCourseId: null,
  quizCurrentQuestions: [],
  currentLessonIndex: 0,
  currentQuizIndex: 0,
  quizAnswers: {},
  quizSubmitted: false,
  quizTimerSeconds: 600, // 10 minutes
  quizTimerInterval: null,
  enrolledCourses: [],
  notes: {},
  currentUser: null,
  currentPlaybackSpeed: 1.0
};

// Initialize LMS
function initLMS() {
  loadSavedLMSData();
  syncLiveStreamWithTeacher();
  renderLMSCoursePicker();
  populateLessonSelector();

  const lessons = window.EDUPEAK_DATA ? window.EDUPEAK_DATA.lmsLessons : [];
  const currentLesson = lessons[LMS_STATE.currentLessonIndex];
  if (window.EDUPEAK_PLAYER && currentLesson && currentLesson.videoUrl) {
    window.EDUPEAK_PLAYER.init(currentLesson.videoUrl);
    window.EDUPEAK_PLAYER.setWatermarkEnabled(Boolean(currentLesson.watermarkEnabled));
  }

  // By default, if no active course is selected yet, show course selection grid
  if (LMS_STATE.activeCourseId) {
    selectCourseForClassroom(LMS_STATE.activeCourseId);
  } else {
    showCoursePickerInLMS();
  }

  renderEnrolledCourses();
  initLiveChat();
}

// Synchronize Live Stream player with Teacher Studio Broadcast
function syncLiveStreamWithTeacher() {
  try {
    const saved = localStorage.getItem("edupeak_live_stream_config");
    const topicEl = document.getElementById("lmsLiveTopicTitle");
    const statusTextEl = document.getElementById("lmsLiveStatusText");
    const badgeEl = document.getElementById("lmsLiveBadgePill");

    let liveStreamUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ";
    let isWatermarkEnabled = false;

    if (saved) {
      const cfg = JSON.parse(saved);
      if (cfg.embedUrl || cfg.streamUrl) {
        liveStreamUrl = cfg.embedUrl || cfg.streamUrl;
      }
      isWatermarkEnabled = Boolean(cfg.watermarkEnabled);
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

    if (window.EDUPEAK_LIVE_PLAYER) {
      window.EDUPEAK_LIVE_PLAYER.loadStream(liveStreamUrl);
      window.EDUPEAK_LIVE_PLAYER.setWatermarkEnabled(isWatermarkEnabled);
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

    // Load custom courses database created in Teacher Studio
    const storedCoursesDb = JSON.parse(localStorage.getItem("edupeak_courses_db") || "null");
    if (storedCoursesDb && Array.isArray(storedCoursesDb) && window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.courses = storedCoursesDb;
    } else {
      const customCourses = JSON.parse(localStorage.getItem("edupeak_custom_courses") || "[]");
      if (customCourses.length && window.EDUPEAK_DATA) {
        customCourses.forEach(c => {
          if (!window.EDUPEAK_DATA.courses.find(item => item.id === c.id)) {
            window.EDUPEAK_DATA.courses.unshift(c);
          }
        });
      }
    }

    // Load any custom lessons created in Teacher Studio
    const storedLessonsDb = JSON.parse(localStorage.getItem("edupeak_lessons_db") || "null");
    if (storedLessonsDb && Array.isArray(storedLessonsDb) && window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.lmsLessons = storedLessonsDb;
    } else {
      const customLessons = JSON.parse(localStorage.getItem("edupeak_custom_lessons") || "[]");
      if (customLessons.length && window.EDUPEAK_DATA) {
        customLessons.forEach(l => {
          if (!window.EDUPEAK_DATA.lmsLessons.find(item => item.id === l.id)) {
            window.EDUPEAK_DATA.lmsLessons.push(l);
          }
        });
      }
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

// Helper: Get dynamic courses database synced with Teacher Studio
function getLMSCourses() {
  try {
    const stored = localStorage.getItem("edupeak_courses_db");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.courses = parsed;
        return parsed;
      }
    }
    const custom = JSON.parse(localStorage.getItem("edupeak_custom_courses") || "[]");
    let courses = (window.EDUPEAK_DATA && window.EDUPEAK_DATA.courses) ? [...window.EDUPEAK_DATA.courses] : [];
    if (Array.isArray(custom) && custom.length) {
      custom.forEach(c => {
        if (!courses.find(item => item.id === c.id)) courses.unshift(c);
      });
    }
    return courses;
  } catch (e) {
    return (window.EDUPEAK_DATA && window.EDUPEAK_DATA.courses) ? window.EDUPEAK_DATA.courses : [];
  }
}
window.getLMSCourses = getLMSCourses;

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

// Helper: Get active user's pending orders
function getUserPendingOrders() {
  try {
    const orders = JSON.parse(localStorage.getItem("edupeak_pending_orders") || "[]");
    if (!Array.isArray(orders)) return [];
    const activeUser = (window.AUTH_SYSTEM && typeof window.AUTH_SYSTEM.getCurrentUser === "function")
      ? window.AUTH_SYSTEM.getCurrentUser()
      : (window.LMS_STATE ? window.LMS_STATE.currentUser : null);

    return orders.filter(ord => {
      if (!ord || ord.status !== "Pending Approval") return false;
      if (!activeUser) return true;
      return ord.studentId === activeUser.id || 
        (ord.studentPhone && activeUser.phone && ord.studentPhone.replace(/\D/g, '') === activeUser.phone.replace(/\D/g, '')) ||
        (ord.studentName && activeUser.name && ord.studentName.toLowerCase().trim() === activeUser.name.toLowerCase().trim()) ||
        (ord.studentEmail && activeUser.email && ord.studentEmail.toLowerCase() === activeUser.email.toLowerCase());
    });
  } catch (e) {
    return [];
  }
}
window.getUserPendingOrders = getUserPendingOrders;

// Helper: Instant Demo / Manual Activation for an order
function instantActivateOrder(orderId, courseId) {
  try {
    let orders = JSON.parse(localStorage.getItem("edupeak_pending_orders") || "[]");
    const ordIdx = orders.findIndex(o => (orderId && o.orderId === orderId) || (courseId && matchCourseId(o.courseId, courseId)));
    let targetCourseId = courseId;
    let studentId = null;

    if (ordIdx !== -1) {
      orders[ordIdx].status = "Approved";
      orders[ordIdx].approvedAt = new Date().toISOString();
      targetCourseId = orders[ordIdx].courseId || courseId;
      studentId = orders[ordIdx].studentId;
      localStorage.setItem("edupeak_pending_orders", JSON.stringify(orders));
    }

    const currentUser = (window.AUTH_SYSTEM && typeof window.AUTH_SYSTEM.getCurrentUser === "function")
      ? window.AUTH_SYSTEM.getCurrentUser()
      : (window.LMS_STATE ? window.LMS_STATE.currentUser : null);

    const sId = studentId || (currentUser ? currentUser.id : "EP-STUDENT");

    // Add to student courses
    let studentCourses = [];
    if (window.AUTH_SYSTEM && typeof window.AUTH_SYSTEM.getStudentEnrolledCourses === "function") {
      studentCourses = window.AUTH_SYSTEM.getStudentEnrolledCourses(sId) || [];
    }
    if (targetCourseId && !studentCourses.some(id => matchCourseId(id, targetCourseId))) {
      studentCourses.push(targetCourseId);
    }
    if (window.AUTH_SYSTEM && typeof window.AUTH_SYSTEM.setStudentEnrolledCourses === "function") {
      window.AUTH_SYSTEM.setStudentEnrolledCourses(sId, studentCourses);
    } else {
      localStorage.setItem(`edupeak_student_courses_${sId}`, JSON.stringify(studentCourses));
    }

    // Add to general edupeak_enrolled
    let generalEnrolled = JSON.parse(localStorage.getItem("edupeak_enrolled") || "[]");
    if (targetCourseId && !generalEnrolled.some(id => matchCourseId(id, targetCourseId))) {
      generalEnrolled.push(targetCourseId);
      localStorage.setItem("edupeak_enrolled", JSON.stringify(generalEnrolled));
    }

    // Update active session
    if (currentUser) {
      if (!Array.isArray(currentUser.enrolledCourses)) currentUser.enrolledCourses = [];
      if (targetCourseId && !currentUser.enrolledCourses.some(id => matchCourseId(id, targetCourseId))) {
        currentUser.enrolledCourses.push(targetCourseId);
      }
      localStorage.setItem("edupeak_active_session", JSON.stringify(currentUser));
      if (window.LMS_STATE) LMS_STATE.currentUser = currentUser;
    }

    if (window.showToast) {
      window.showToast("🎉 Course enrollment approved and access activated!", "success");
    }

    if (typeof renderLMSCoursePicker === "function") renderLMSCoursePicker();
    if (typeof renderEnrolledCourses === "function") renderEnrolledCourses();
    if (typeof renderQuizCoursePicker === "function") renderQuizCoursePicker();

    if (targetCourseId && typeof selectCourseForClassroom === "function") {
      setTimeout(() => {
        selectCourseForClassroom(targetCourseId);
      }, 250);
    }
  } catch (e) {
    console.error("Instant activation error:", e);
  }
}
window.instantActivateOrder = instantActivateOrder;

// LMS Course Filter State
const LMS_COURSE_FILTER = {
  status: 'all',    // 'all' | 'enrolled' | 'available'
  type: 'all',      // 'all' | 'theory' | 'revision' | 'paper'
  year: 'all',      // 'all' | '2027' | '2026' | '2025'
  search: ''        // search text
};

function onLMSCourseSearchInput(val) {
  LMS_COURSE_FILTER.search = (val || "").trim().toLowerCase();
  const clearBtn = document.getElementById("lmsCourseSearchClearBtn");
  if (clearBtn) clearBtn.style.display = LMS_COURSE_FILTER.search ? "flex" : "none";
  renderLMSCoursePicker();
}

function clearLMSCourseSearch() {
  LMS_COURSE_FILTER.search = "";
  const input = document.getElementById("lmsCourseSearchInput");
  if (input) input.value = "";
  const clearBtn = document.getElementById("lmsCourseSearchClearBtn");
  if (clearBtn) clearBtn.style.display = "none";
  renderLMSCoursePicker();
}

function setLMSCourseStatusFilter(status) {
  LMS_COURSE_FILTER.status = status;
  document.querySelectorAll("#lmsStatusFilterPills .lms-filter-pill").forEach(pill => {
    pill.classList.toggle("active", pill.dataset.filterStatus === status);
  });
  renderLMSCoursePicker();
}

function setLMSCourseTypeFilter(type) {
  LMS_COURSE_FILTER.type = type;
  renderLMSCoursePicker();
}

function setLMSCourseYearFilter(year) {
  LMS_COURSE_FILTER.year = year;
  renderLMSCoursePicker();
}

function resetLMSCourseFilters() {
  LMS_COURSE_FILTER.status = 'all';
  LMS_COURSE_FILTER.type = 'all';
  LMS_COURSE_FILTER.year = 'all';
  LMS_COURSE_FILTER.search = '';

  const searchInput = document.getElementById("lmsCourseSearchInput");
  if (searchInput) searchInput.value = "";
  const clearBtn = document.getElementById("lmsCourseSearchClearBtn");
  if (clearBtn) clearBtn.style.display = "none";

  const typeSelect = document.getElementById("lmsCourseTypeSelect");
  if (typeSelect) typeSelect.value = "all";

  const yearSelect = document.getElementById("lmsCourseYearSelect");
  if (yearSelect) yearSelect.value = "all";

  document.querySelectorAll("#lmsStatusFilterPills .lms-filter-pill").forEach(pill => {
    pill.classList.toggle("active", pill.dataset.filterStatus === "all");
  });

  renderLMSCoursePicker();
}

// Render LMS Course Picker Grid (Shown First in Video Classroom)
function renderLMSCoursePicker() {
  const grid = document.getElementById("lmsCoursePickerGrid");
  if (!grid) return;

  const allCourses = getLMSCourses();
  const lessons = (window.EDUPEAK_DATA && window.EDUPEAK_DATA.lmsLessons) ? window.EDUPEAK_DATA.lmsLessons : [];
  const currentLang = window.currentLang || "en";
  const pendingOrders = getUserPendingOrders();

  if (allCourses.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 2.5rem 1.5rem; text-align: center; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px;">
        <p style="color: #64748b; font-size: 0.9rem; margin: 0;">No courses found in catalog.</p>
      </div>
    `;
    return;
  }

  // 1. Calculate live counts for status pills based on active Type + Year + Search query
  const baseFiltered = allCourses.filter(c => {
    // Type match
    if (LMS_COURSE_FILTER.type !== 'all') {
      const t = LMS_COURSE_FILTER.type.toLowerCase();
      const cat = (c.category || '').toLowerCase();
      const title = (c.title || '').toLowerCase();
      const badge = (c.badge || '').toLowerCase();
      const titleSi = (c.title_si || '');
      const matchType = cat === t || title.includes(t) || badge.includes(t) ||
        (t === 'theory' && titleSi.includes('සිද්ධාන්ත')) ||
        (t === 'revision' && titleSi.includes('පුනරීක්ෂණ')) ||
        (t === 'paper' && titleSi.includes('ප්‍රශ්න පත්‍ර'));
      if (!matchType) return false;
    }

    // Year match
    if (LMS_COURSE_FILTER.year !== 'all') {
      const y = LMS_COURSE_FILTER.year;
      const yr = `${c.examYear || ''} ${c.level || ''} ${c.title || ''}`;
      if (!yr.includes(y)) return false;
    }

    // Search query match
    if (LMS_COURSE_FILTER.search) {
      const q = LMS_COURSE_FILTER.search;
      const text = `${c.title || ''} ${c.title_si || ''} ${c.teacherName || ''} ${c.teacher || ''} ${c.stream || ''} ${c.stream_si || ''} ${c.badge || ''} ${c.id || ''} ${c.fee || ''}`.toLowerCase();
      if (!text.includes(q)) return false;
    }

    return true;
  });

  const countAll = baseFiltered.length;
  const countEnrolled = baseFiltered.filter(c => isCourseEnrolled(c.id)).length;
  const countAvailable = baseFiltered.filter(c => !isCourseEnrolled(c.id)).length;

  const countAllEl = document.getElementById("countStatusAll");
  const countEnrolledEl = document.getElementById("countStatusEnrolled");
  const countAvailableEl = document.getElementById("countStatusAvailable");
  if (countAllEl) countAllEl.textContent = countAll;
  if (countEnrolledEl) countEnrolledEl.textContent = countEnrolled;
  if (countAvailableEl) countAvailableEl.textContent = countAvailable;

  // 2. Filter by status (All, Enrolled, Available)
  let finalCourses = baseFiltered;
  if (LMS_COURSE_FILTER.status === 'enrolled') {
    finalCourses = baseFiltered.filter(c => isCourseEnrolled(c.id));
  } else if (LMS_COURSE_FILTER.status === 'available') {
    finalCourses = baseFiltered.filter(c => !isCourseEnrolled(c.id));
  }

  // 3. Handle Empty Results
  if (finalCourses.length === 0) {
    const isFiltered = LMS_COURSE_FILTER.search || LMS_COURSE_FILTER.status !== 'all' || LMS_COURSE_FILTER.type !== 'all' || LMS_COURSE_FILTER.year !== 'all';
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 2.75rem 1.5rem; text-align: center; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 14px; margin: 0.5rem 0;">
        <div style="width: 52px; height: 52px; border-radius: 50%; background: #eff6ff; color: #227aff; display: inline-flex; align-items: center; justify-content: center; font-size: 1.35rem; margin-bottom: 0.75rem;">
          <i class="fa-solid fa-magnifying-glass"></i>
        </div>
        <h4 style="font-size: 1.15rem; font-weight: 800; color: #1e293b; margin: 0 0 0.35rem 0;">
          ${currentLang === 'si' ? 'ගැලපෙන පාඨමාලා හමු නොවීය' : 'No Matching Classes Found'}
        </h4>
        <p style="color: #64748b; font-size: 0.875rem; margin: 0 0 1.25rem 0;">
          ${currentLang === 'si' ? 'වෙනත් සෙවුම් වචනයක් භාවිතා කරන්න හෝ ෆිල්ටර් ඉවත් කර බලන්න.' : 'Try adjusting your search keyword or clearing the filters to view all available masterclasses.'}
        </p>
        ${isFiltered ? `
          <button type="button" class="btn btn-outline btn-sm" onclick="resetLMSCourseFilters()" style="display: inline-flex; align-items: center; gap: 0.45rem; font-weight: 700; border-radius: 8px; padding: 0.5rem 1.25rem;">
            <i class="fa-solid fa-rotate-left"></i> ${currentLang === 'si' ? 'සියලු ෆිල්ටර් ඉවත් කරන්න' : 'Reset All Filters'}
          </button>
        ` : ''}
      </div>
    `;
    return;
  }

  const enrolledFiltered = finalCourses.filter(c => isCourseEnrolled(c.id));
  const otherFiltered = finalCourses.filter(c => !isCourseEnrolled(c.id));

  let html = '';

  // 4. Pending orders (if status is 'all' or 'available')
  if (pendingOrders.length > 0 && LMS_COURSE_FILTER.status !== 'enrolled') {
    html += `
      <div style="grid-column: 1 / -1; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1.5px solid #fde68a; border-radius: 16px; padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.08);">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: #f59e0b; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
              <i class="fa-solid fa-clock-rotate-left"></i>
            </div>
            <div>
              <h4 style="font-size: 1rem; font-weight: 800; color: #92400e; margin: 0;">
                ${currentLang === 'si' ? 'තහවුරු කිරීම අපේක්ෂිත ඇණවුම්' : 'Enrollment Order Pending Verification'}
              </h4>
              <span style="font-size: 0.78rem; color: #b45309;">
                ${currentLang === 'si' ? 'ඔබගේ WhatsApp ඇණවුම පරිපාලක මණ්ඩලය විසින් සත්‍යාපනය කරමින් පවතී.' : 'Your course order was submitted. Access will unlock once verified by admin, or you can activate demo below.'}
              </span>
            </div>
          </div>
          <span style="font-size: 0.75rem; font-weight: 800; background: #ffffff; color: #b45309; border: 1px solid #fde68a; padding: 0.25rem 0.65rem; border-radius: 9999px;">
            ${pendingOrders.length} ${pendingOrders.length === 1 ? 'Pending Order' : 'Pending Orders'}
          </span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.65rem;">
          ${pendingOrders.map(ord => {
            const d = ord.timestamp ? new Date(ord.timestamp) : new Date();
            const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const waMsg = encodeURIComponent(`Hello EduPeak Administration, I placed order ${ord.orderId} for "${ord.courseTitle}". Could you please verify payment and activate my LMS access?`);
            const hotlineUrl = `https://wa.me/94760687578?text=${waMsg}`;

            return `
              <div style="background: #ffffff; border: 1px solid #fde68a; border-radius: 12px; padding: 0.85rem 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
                    <strong style="font-family: monospace; font-size: 0.8rem; background: #fef3c7; color: #92400e; padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid #fde68a;">
                      ${ord.orderId || 'ORD-PENDING'}
                    </strong>
                    <strong style="font-size: 0.9rem; color: #0f172a;">${ord.courseTitle || 'A/L Physics Masterclass'}</strong>
                  </div>
                  <div style="font-size: 0.75rem; color: #64748b;">
                    <span><i class="fa-regular fa-calendar"></i> Ordered: ${dateStr}</span> &bull; 
                    <span><i class="fa-solid fa-tag"></i> Fee: <strong>${ord.fee || 'LKR 3,500'}</strong></span>
                  </div>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                  <a href="${hotlineUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="background: #16a34a; color: #ffffff; font-weight: 700; border-radius: 8px; padding: 0.4rem 0.75rem; text-decoration: none; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 0.35rem;">
                    <i class="fa-brands fa-whatsapp"></i> WhatsApp Hotline
                  </a>
                  <button type="button" class="btn btn-sm" onclick="instantActivateOrder('${ord.orderId}', '${ord.courseId}')" style="background: linear-gradient(135deg, #227aff 0%, #1d4ed8 100%); color: #ffffff; font-weight: 700; border-radius: 8px; padding: 0.4rem 0.75rem; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer;">
                    <i class="fa-solid fa-bolt"></i> Instant Activate
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // 5. Render Enrolled Courses
  if (enrolledFiltered.length > 0) {
    if (LMS_COURSE_FILTER.status === 'all') {
      html += `
        <div style="grid-column: 1 / -1; margin-bottom: 0.5rem;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.5rem; margin: 0 0 0.25rem 0;">
            <i class="fa-solid fa-circle-check" style="color: #10b981;"></i>
            ${currentLang === 'si' ? 'ඔබ ලියාපදිංචි වූ පාඨමාලා' : 'Your Enrolled Courses'} (${enrolledFiltered.length})
          </h3>
          <p style="color: #64748b; font-size: 0.85rem; margin: 0;">
            ${currentLang === 'si' ? 'වීඩියෝ පාඩම් නැරඹීමට පහතින් පාඨමාලාවක් තෝරන්න.' : 'Choose from your enrolled physics theory masterclasses or revision batches below to watch lessons.'}
          </p>
        </div>
      `;
    } else if (LMS_COURSE_FILTER.status === 'enrolled') {
      html += `
        <div style="grid-column: 1 / -1; margin-bottom: 0.5rem;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.5rem; margin: 0 0 0.25rem 0;">
            <i class="fa-solid fa-circle-check" style="color: #10b981;"></i>
            ${currentLang === 'si' ? 'ඔබ ලියාපදිංචි වූ පාඨමාලා' : 'Your Enrolled Courses'} (${enrolledFiltered.length})
          </h3>
          <p style="color: #64748b; font-size: 0.85rem; margin: 0;">
            ${currentLang === 'si' ? 'වීඩියෝ පාඩම් නැරඹීමට පහතින් පාඨමාලාවක් තෝරන්න.' : 'Choose from your enrolled physics theory masterclasses or revision batches below to watch lessons.'}
          </p>
        </div>
      `;
    }

    html += enrolledFiltered.map(course => {
      const courseLessons = lessons.filter(l => l.courseId && matchCourseId(l.courseId, course.id));
      const lessonCount = courseLessons.length;
      const lessonText = currentLang === 'si'
        ? `${lessonCount} වීඩියෝ පාඩම්`
        : (lessonCount === 1 ? '1 Video Lesson' : `${lessonCount} Video Lessons`);

      return `
        <div class="lms-course-picker-card is-enrolled" onclick="selectCourseForClassroom('${course.id}')" style="border-color: #93c5fd; background: #ffffff;">
          <div>
            <div class="lms-course-card-top">
              <span class="lms-course-badge" style="background: #dcfce7; color: #15803d; border-color: #86efac;">
                <i class="fa-solid fa-circle-check"></i> ${currentLang === 'si' ? 'ලියාපදිංචි වූ පාඨමාලාව' : 'Enrolled Batch'}
              </span>
              <span class="lms-course-stream">${currentLang === 'si' ? (course.stream_si || course.stream || 'භෞතික විද්‍යාව') : (course.stream || 'Physics')}</span>
            </div>
            <h4 class="lms-course-title">${currentLang === 'si' ? (course.title_si || course.title) : course.title}</h4>
            <div class="lms-course-meta">
              <span><i class="fa-solid fa-chalkboard-user"></i> ${course.teacherName || course.teacher || 'Amalsha Wanniarachchi'}</span>
              <span><i class="fa-solid fa-circle-play"></i> ${lessonText}</span>
            </div>
          </div>
          <button class="lms-course-select-btn" type="button" onclick="event.stopPropagation(); selectCourseForClassroom('${course.id}')" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
            <i class="fa-solid fa-play"></i> <span>${currentLang === 'si' ? 'පාඩම් නරඹන්න' : 'Watch Course Lessons'}</span>
          </button>
        </div>
      `;
    }).join('');
  }

  // 6. Render Other Available Courses
  if (otherFiltered.length > 0) {
    if (LMS_COURSE_FILTER.status === 'all' && enrolledFiltered.length > 0) {
      html += `
        <div style="grid-column: 1 / -1; margin-top: 1.5rem; margin-bottom: 0.5rem; padding-top: 1.25rem; border-top: 1px solid #e2e8f0;">
          <h4 style="font-size: 1rem; font-weight: 700; color: #475569; display: flex; align-items: center; gap: 0.45rem; margin: 0 0 0.25rem 0;">
            <i class="fa-solid fa-book-open" style="color: #227aff;"></i>
            ${currentLang === 'si' ? 'වෙනත් ලබා ගත හැකි පාඨමාලා' : 'Other Available Masterclasses'} (${otherFiltered.length})
          </h4>
          <p style="color: #94a3b8; font-size: 0.8rem; margin: 0;">
            ${currentLang === 'si' ? 'වීඩියෝ පාඩම් සඳහා ප්‍රවේශය ලබා ගැනීමට පහතින් ලියාපදිංචි වන්න.' : 'Enroll in these masterclasses to unlock full video lessons, live broadcasts, and timed speed tests.'}
          </p>
        </div>
      `;
    } else if (LMS_COURSE_FILTER.status === 'available') {
      html += `
        <div style="grid-column: 1 / -1; margin-bottom: 0.5rem;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.5rem; margin: 0 0 0.25rem 0;">
            <i class="fa-solid fa-compass" style="color: #227aff;"></i>
            ${currentLang === 'si' ? 'ලබා ගත හැකි භෞතික විද්‍යා පාඨමාලා' : 'Available Physics Masterclasses'} (${otherFiltered.length})
          </h3>
          <p style="color: #64748b; font-size: 0.85rem; margin: 0;">
            ${currentLang === 'si' ? 'වීඩියෝ පාඩම් සහ අධ්‍යයන සම්පත් නැරඹීමට පහතින් ලියාපදිංචි වන්න.' : 'Select any physics masterclass below to enroll, submit an order, or activate access.'}
          </p>
        </div>
      `;
    }

    html += otherFiltered.map(course => {
      const courseLessons = lessons.filter(l => l.courseId && matchCourseId(l.courseId, course.id));
      const lessonCount = courseLessons.length;
      const lessonText = currentLang === 'si'
        ? `${lessonCount} වීඩියෝ පාඩම්`
        : (lessonCount === 1 ? '1 Video Lesson' : `${lessonCount} Video Lessons`);

      const matchingPending = pendingOrders.find(o => o.courseId === course.id || matchCourseId(o.courseId, course.id));

      if (matchingPending) {
        return `
          <div class="lms-course-picker-card" style="background: #fffbeb; border-color: #fde68a; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.05);">
            <div>
              <div class="lms-course-card-top">
                <span class="lms-course-badge" style="background: #fef3c7; color: #92400e; border-color: #fde68a;">
                  <i class="fa-solid fa-clock"></i> ${matchingPending.orderId || 'Order Pending'}
                </span>
                <span class="lms-course-stream">${currentLang === 'si' ? (course.stream_si || course.stream || 'භෞතික විද්‍යාව') : (course.stream || 'Physics')}</span>
              </div>
              <h4 class="lms-course-title" style="color: #0f172a;">${currentLang === 'si' ? (course.title_si || course.title) : course.title}</h4>
              <div class="lms-course-meta">
                <span><i class="fa-solid fa-chalkboard-user"></i> ${course.teacherName || course.teacher || 'Amalsha Wanniarachchi'}</span>
                <span><i class="fa-solid fa-circle-play"></i> ${lessonText}</span>
              </div>
            </div>
            <div style="display: flex; gap: 0.4rem; margin-top: 0.75rem;">
              <button class="lms-course-select-btn" type="button" onclick="event.stopPropagation(); instantActivateOrder('${matchingPending.orderId}', '${course.id}')" style="background: #16a34a; flex: 1;">
                <i class="fa-solid fa-bolt"></i> <span>${currentLang === 'si' ? 'ක්‍රියාත්මක කරන්න' : 'Instant Activate'}</span>
              </button>
            </div>
          </div>
        `;
      }

      return `
        <div class="lms-course-picker-card is-locked" style="background: #ffffff; border-color: #e2e8f0;">
          <div>
            <div class="lms-course-card-top">
              <span class="lms-course-badge" style="background: #f1f5f9; color: #475569; border-color: #cbd5e1;">
                ${course.examYear || course.level || '2027 A/L'}
              </span>
              <span class="lms-course-stream">${currentLang === 'si' ? (course.stream_si || course.stream || 'භෞතික විද්‍යාව') : (course.stream || 'Physics')}</span>
            </div>
            <h4 class="lms-course-title" style="color: #0f172a;">${currentLang === 'si' ? (course.title_si || course.title) : course.title}</h4>
            <div class="lms-course-meta">
              <span><i class="fa-solid fa-chalkboard-user"></i> ${course.teacherName || course.teacher || 'Amalsha Wanniarachchi'}</span>
              <span><i class="fa-solid fa-circle-play"></i> ${lessonText}</span>
            </div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.4rem;">
              <i class="fa-solid fa-tag"></i> <strong>${course.fee || 'LKR 3,500 / Month'}</strong>
            </div>
          </div>
          <div style="display: flex; gap: 0.4rem; margin-top: 0.75rem;">
            <button class="lms-course-select-btn" type="button" onclick="event.stopPropagation(); closeLMSPortal(); window.location.href='checkout.html?course=${encodeURIComponent(course.id)}';" style="background: #227aff; flex: 1;">
              <i class="fa-solid fa-cart-plus"></i> <span>${currentLang === 'si' ? 'ලියාපදිංචි වන්න' : 'Enroll to Unlock'}</span>
            </button>
            <button type="button" class="btn btn-sm" onclick="event.stopPropagation(); instantActivateOrder(null, '${course.id}')" title="Test/Demo Unlock" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.4rem 0.65rem; font-size: 0.75rem; font-weight: 700; cursor: pointer;">
              <i class="fa-solid fa-wand-magic-sparkles"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  grid.innerHTML = html;
}

// Select a course to watch lessons in LMS Video Classroom
function selectCourseForClassroom(courseId) {
  if (!courseId) return;

  // Enrollment verification guard
  if (!isCourseEnrolled(courseId)) {
    const currentLang = window.currentLang || "en";
    const msg = currentLang === "si"
      ? "🔒 මෙම පාඨමාලාව නැරඹීමට කරුණාකර පළමුව ලියාපදිංචි වන්න."
      : "🔒 Please enroll in this course to access its video lessons.";
    if (window.showToast) window.showToast(msg, "warning");
    showCoursePickerInLMS();
    return;
  }

  LMS_STATE.activeCourseId = courseId;

  const pickerView = document.getElementById("lmsCoursePickerView");
  const playerView = document.getElementById("lmsVideoClassroomPlayerView");
  const badgeEl = document.getElementById("lmsActiveCourseBadge");

  if (pickerView) pickerView.style.display = "none";
  if (playerView) playerView.style.display = "block";

  // Find course title
  const allCourses = getLMSCourses();
  const course = allCourses.find(c => matchCourseId(c.id, courseId));

  if (course && badgeEl) {
    const currentLang = window.currentLang || "en";
    badgeEl.textContent = currentLang === "si" ? (course.title_si || course.title) : course.title;
  }

  // Populate lessons dropdown filtered or highlighting this course
  populateLessonSelector(courseId);
  selectCourseLesson(courseId);
}

// Return to Course Selection Grid in LMS Video Classroom
function showCoursePickerInLMS() {
  if (window.EDUPEAK_PLAYER && typeof window.EDUPEAK_PLAYER.pause === "function") {
    window.EDUPEAK_PLAYER.pause();
  }
  const pickerView = document.getElementById("lmsCoursePickerView");
  const playerView = document.getElementById("lmsVideoClassroomPlayerView");
  if (pickerView) pickerView.style.display = "block";
  if (playerView) playerView.style.display = "none";
  renderLMSCoursePicker();
}

// Select and display a specific course's lesson in LMS Video Classroom
function selectCourseLesson(courseId) {
  if (!courseId || !window.EDUPEAK_DATA || !window.EDUPEAK_DATA.lmsLessons) return;
  const lessons = window.EDUPEAK_DATA.lmsLessons;
  
  const lessonIdx = lessons.findIndex(l => l.courseId && matchCourseId(l.courseId, courseId));

  if (lessonIdx !== -1) {
    renderLMSLesson(lessonIdx);
    const selector = document.getElementById("lmsLessonSelector");
    if (selector) selector.value = lessonIdx;
  } else if (lessons.length > 0) {
    renderLMSLesson(0);
    const selector = document.getElementById("lmsLessonSelector");
    if (selector) selector.value = 0;
  }
}

// Open / Close LMS Portal Overlay (Guarded by Authentication)
function openLMSPortal(tabName = "video-classroom", courseId = null) {
  if (tabName === "my-courses") {
    tabName = "video-classroom";
  }

  const currentUser = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getCurrentUser() : null;
  
  if (!currentUser) {
    closeLMSPortal();
    if (window.showToast) {
      const msg = window.currentLang === "si"
        ? "🔒 කරුණාකර ඔබගේ EduPeak LMS ගිණුමට ප්‍රවේශ වන්න."
        : "🔒 Please sign in to access your EduPeak LMS account.";
      window.showToast(msg, "info");
    }
    // Clean query param
    if (window.location.search.includes("openLms") || window.location.search.includes("lms") || window.location.search.includes("course")) {
      window.history.replaceState({}, document.title, window.location.pathname);
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
    loadSavedLMSData();
    if (typeof renderLMSCoursePicker === "function") renderLMSCoursePicker();
    switchLMSTab(tabName);

    // If specific course was requested, load it!
    if (tabName === "speed-quiz") {
      if (courseId) {
        selectCourseForQuiz(courseId);
      } else {
        showQuizCoursePicker();
      }
    } else if (courseId) {
      selectCourseForClassroom(courseId);
    } else if (tabName === "video-classroom") {
      // If student opens Video Classes directly without choosing a course -> show course picker grid first!
      showCoursePickerInLMS();
    }
  } else {
    // On another page (courses.html, etc.) -> redirect to index.html with query parameters
    const courseParam = courseId ? `&course=${encodeURIComponent(courseId)}` : '';
    window.location.href = `index.html?openLms=${encodeURIComponent(tabName)}${courseParam}`;
  }
}

function closeLMSPortal() {
  // 1. Immediately pause video classroom DRM player
  if (window.EDUPEAK_PLAYER && typeof window.EDUPEAK_PLAYER.pause === "function") {
    window.EDUPEAK_PLAYER.pause();
  }

  // 2. Immediately pause live room stream player
  if (window.EDUPEAK_LIVE_PLAYER && typeof window.EDUPEAK_LIVE_PLAYER.pause === "function") {
    window.EDUPEAK_LIVE_PLAYER.pause();
  }

  // 3. Pause any embedded iframe or HTML5 video/audio elements in the DOM
  try {
    document.querySelectorAll("#lmsModalWrapper iframe").forEach(iframe => {
      iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    });
    document.querySelectorAll("video, audio").forEach(media => {
      try { media.pause(); } catch (e) {}
    });
  } catch (e) {}

  // 4. Hide LMS Modal Wrapper
  const lmsModal = document.getElementById("lmsModalWrapper");
  if (lmsModal) {
    lmsModal.classList.remove("active");
    document.body.style.overflow = "auto";
  }

  // 5. Clean up any openLms / lms URL query parameters without page reload
  if (window.location.search.includes("openLms") || window.location.search.includes("lms") || window.location.search.includes("course")) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// Switch between LMS Views (Video Classes, Live Room, Speed Quiz)
function switchLMSTab(tabId) {
  if (tabId === "my-courses") {
    tabId = "video-classroom";
  }

  LMS_STATE.activeTab = tabId;
  
  document.querySelectorAll(".lms-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  document.querySelectorAll(".lms-view-pane").forEach(pane => {
    pane.classList.toggle("active", pane.id === `lmsView_${tabId}`);
  });

  // Pause inactive player to prevent background playing or overlapping audio
  if (tabId !== "video-classroom" && window.EDUPEAK_PLAYER && typeof window.EDUPEAK_PLAYER.pause === "function") {
    window.EDUPEAK_PLAYER.pause();
  }
  if (tabId !== "live-room" && window.EDUPEAK_LIVE_PLAYER && typeof window.EDUPEAK_LIVE_PLAYER.pause === "function") {
    window.EDUPEAK_LIVE_PLAYER.pause();
  }

  // If leaving speed-quiz, pause quiz timer so it doesn't countdown or auto-submit
  if (tabId !== "speed-quiz") {
    if (LMS_STATE.quizTimerInterval) {
      clearInterval(LMS_STATE.quizTimerInterval);
      LMS_STATE.quizTimerInterval = null;
    }
  }

  if (tabId === "live-room") {
    syncLiveStreamWithTeacher();
  } else if (tabId === "video-classroom") {
    renderLMSCoursePicker();
  } else if (tabId === "speed-quiz") {
    const activeView = document.getElementById("lmsQuizActiveTestView");
    const isTestActive = activeView && activeView.style.display === "block" && !LMS_STATE.quizSubmitted;
    if (!LMS_STATE.quizActiveCourseId || !isTestActive) {
      showQuizCoursePicker();
    } else {
      renderQuizQuestion(LMS_STATE.currentQuizIndex);
      if (!LMS_STATE.quizTimerInterval && !LMS_STATE.quizSubmitted) {
        startQuizTimer();
      }
    }
  }
}

// --------------------------------------------------------------------------
// 1. VIDEO CLASSROOM ENGINE
// --------------------------------------------------------------------------
function populateLessonSelector(filterCourseId = null) {
  const selector = document.getElementById("lmsLessonSelector");
  if (!selector || !window.EDUPEAK_DATA || !window.EDUPEAK_DATA.lmsLessons) return;

  const currentLang = window.currentLang || "en";
  const allLessons = window.EDUPEAK_DATA.lmsLessons;

  let targetLessons = allLessons;
  if (filterCourseId) {
    const filtered = allLessons.filter(l => l.courseId && matchCourseId(l.courseId, filterCourseId));
    if (filtered.length > 0) {
      targetLessons = filtered;
    }
  }

  selector.innerHTML = targetLessons.map((l) => {
    const originalIdx = allLessons.indexOf(l);
    return `
      <option value="${originalIdx}" ${originalIdx === LMS_STATE.currentLessonIndex ? 'selected' : ''}>
        ${originalIdx + 1}. ${currentLang === "si" ? (l.title_si || l.title) : l.title}
      </option>
    `;
  }).join('');
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
  
  const courseObj = (window.EDUPEAK_DATA?.courses || []).find(c => c.id === lesson.courseId) || {};
  const teacherDisplay = lesson.teacher || courseObj.teacherName || "Amalsha Wanniarachchi (MBBS UG)";
  const subjectDisplay = lesson.subject || courseObj.subject || courseObj.title || "G.C.E. A/L Physics";

  const badgeEl = document.getElementById("lmsLessonBadge");
  if (badgeEl) {
    badgeEl.textContent = (courseObj.title || lesson.subject || "PHYSICS MASTERCLASS").toUpperCase();
  }

  if (teacherEl) {
    teacherEl.innerHTML = `<i class="fa-solid fa-chalkboard-user"></i> ${teacherDisplay} &bull; ${subjectDisplay}`;
  }
  if (pdfBtnText) {
    pdfBtnText.textContent = lesson.hasPdf ? (lesson.pdfName ? lesson.pdfName.substring(0, 16) + '...' : 'Tute PDF') : 'No PDF';
  }

  // Update video player (Custom EduPeak DRM Player)
  if (window.EDUPEAK_PLAYER && lesson.videoUrl) {
    window.EDUPEAK_PLAYER.loadVideo(lesson.videoUrl);
    // Anti-piracy watermark toggle: disabled by default unless lesson.watermarkEnabled is true
    window.EDUPEAK_PLAYER.setWatermarkEnabled(Boolean(lesson.watermarkEnabled));
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
    if (currentLesson.pdfUrl) {
      window.open(currentLesson.pdfUrl, '_blank', 'noopener,noreferrer');
      showToast(`📥 Opening Handout PDF: ${currentLesson.pdfName || 'Lesson Notes'}`, "success");
    } else {
      showToast(`📥 Downloading Study Tute: ${currentLesson.pdfName || 'Lesson Notes.pdf'}`, "success");
    }
  } else {
    showToast("No downloadable tute attached to this module.", "info");
  }
}

// --------------------------------------------------------------------------
// 2. TIMED SPEED MCQ EXAMINATION SYSTEM
// --------------------------------------------------------------------------
function getQuizQuestionsForCourse(courseId) {
  const allQuestions = (window.EDUPEAK_DATA && window.EDUPEAK_DATA.quizQuestions) ? window.EDUPEAK_DATA.quizQuestions : [];
  if (!courseId) return allQuestions;
  return allQuestions.filter(q => q.courseId && matchCourseId(q.courseId, courseId));
}

function showQuizCoursePicker() {
  if (LMS_STATE.quizTimerInterval) {
    clearInterval(LMS_STATE.quizTimerInterval);
    LMS_STATE.quizTimerInterval = null;
  }

  const pickerView = document.getElementById("lmsQuizCoursePickerView");
  const startView = document.getElementById("lmsQuizStartScreenView");
  const activeView = document.getElementById("lmsQuizActiveTestView");

  if (pickerView) pickerView.style.display = "block";
  if (startView) startView.style.display = "none";
  if (activeView) activeView.style.display = "none";

  renderQuizCoursePicker();
}

function renderQuizCoursePicker() {
  const grid = document.getElementById("lmsQuizCoursePickerGrid");
  if (!grid) return;

  const allCourses = getLMSCourses();
  const currentLang = window.currentLang || "en";
  const pendingOrders = getUserPendingOrders();

  if (allCourses.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 2.5rem 1.5rem; text-align: center; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px;">
        <p style="color: #64748b; font-size: 0.9rem; margin: 0;">No courses found in catalog.</p>
      </div>
    `;
    return;
  }

  const enrolledCourses = allCourses.filter(c => isCourseEnrolled(c.id));
  const otherCourses = allCourses.filter(c => !isCourseEnrolled(c.id));

  let html = '';

  // 1. Pending orders banner
  if (pendingOrders.length > 0) {
    html += `
      <div style="grid-column: 1 / -1; background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 14px; padding: 1rem 1.25rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.65rem;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: #f59e0b; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 0.95rem;">
            <i class="fa-solid fa-clock-rotate-left"></i>
          </div>
          <div>
            <strong style="font-size: 0.9rem; color: #92400e;">${pendingOrders.length} Order Pending Verification</strong>
            <div style="font-size: 0.75rem; color: #b45309;">MCQ speed tests will unlock automatically once your order is approved.</div>
          </div>
        </div>
        <button type="button" class="btn btn-sm" onclick="instantActivateOrder('${pendingOrders[0].orderId}', '${pendingOrders[0].courseId}')" style="background: #16a34a; color: #ffffff; font-weight: 700; border-radius: 8px; padding: 0.35rem 0.75rem; font-size: 0.75rem;">
          <i class="fa-solid fa-bolt"></i> Instant Activate Demo
        </button>
      </div>
    `;
  }

  // 2. Enrolled courses
  if (enrolledCourses.length > 0) {
    html += `
      <div style="grid-column: 1 / -1; margin-bottom: 0.5rem;">
        <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.5rem; margin: 0 0 0.25rem 0;">
          <i class="fa-solid fa-clipboard-check" style="color: #227aff;"></i>
          ${currentLang === 'si' ? 'ඔබගේ ලියාපදිංචි පාඨමාලා සඳහා MCQ පරීක්ෂණ' : 'MCQ Tests for Your Enrolled Courses'}
        </h3>
        <p style="color: #64748b; font-size: 0.85rem; margin: 0;">
          ${currentLang === 'si' ? 'විභාගය ආරම්භ කිරීමට පාඨමාලාවක් තෝරන්න.' : 'Select an enrolled course below to check available timed MCQ speed tests and begin.'}
        </p>
      </div>
    `;

    html += enrolledCourses.map(course => {
      const questions = getQuizQuestionsForCourse(course.id);
      const hasQuiz = questions.length > 0;

      return `
        <div class="lms-course-picker-card ${hasQuiz ? 'is-enrolled' : ''}" style="border-color: ${hasQuiz ? '#93c5fd' : '#e2e8f0'}; background: #ffffff; cursor: ${hasQuiz ? 'pointer' : 'default'};" ${hasQuiz ? `onclick="selectCourseForQuiz('${course.id}')"` : ''}>
          <div>
            <div class="lms-course-card-top">
              ${hasQuiz 
                ? `<span class="lms-course-badge" style="background: #dcfce7; color: #15803d; border-color: #86efac;">
                     <i class="fa-solid fa-circle-check"></i> ${questions.length} MCQs Ready &bull; 10 Mins
                   </span>`
                : `<span class="lms-course-badge" style="background: #fef3c7; color: #92400e; border-color: #fde68a;">
                     <i class="fa-solid fa-circle-exclamation"></i> No MCQ Test Available
                   </span>`
              }
              <span class="lms-course-stream">${currentLang === 'si' ? (course.stream_si || course.stream || 'භෞතික විද්‍යාව') : (course.stream || 'Physics')}</span>
            </div>
            <h4 class="lms-course-title" style="margin-top: 0.5rem; color: #0f172a;">${currentLang === 'si' ? (course.title_si || course.title) : course.title}</h4>
            <div class="lms-course-meta">
              <span><i class="fa-solid fa-chalkboard-user"></i> ${course.teacherName || course.teacher || 'Amalsha Wanniarachchi'}</span>
              <span><i class="fa-solid fa-stopwatch"></i> ${hasQuiz ? `${questions.length} Timed Questions` : 'No Active Assessment'}</span>
            </div>
          </div>

          ${hasQuiz 
            ? `<button class="lms-course-select-btn" type="button" onclick="event.stopPropagation(); selectCourseForQuiz('${course.id}')" style="background: linear-gradient(135deg, #227aff 0%, #1d4ed8 100%);">
                 <i class="fa-solid fa-bolt"></i> <span>${currentLang === 'si' ? 'MCQ පරීක්ෂණය තෝරන්න' : 'Select & Preview Test'}</span>
               </button>`
            : `<button class="lms-course-select-btn" type="button" disabled style="background: #94a3b8; cursor: not-allowed; opacity: 0.7;">
                 <i class="fa-solid fa-ban"></i> <span>${currentLang === 'si' ? 'පරීක්ෂණ නොමැත' : 'No Test Available'}</span>
               </button>`
          }
        </div>
      `;
    }).join('');
  }

  // 3. Available courses
  if (otherCourses.length > 0) {
    html += `
      <div style="grid-column: 1 / -1; margin-top: ${enrolledCourses.length > 0 ? '1.5rem' : '0.5rem'}; margin-bottom: 0.5rem; ${enrolledCourses.length > 0 ? 'padding-top: 1.25rem; border-top: 1px solid #e2e8f0;' : ''}">
        <h4 style="font-size: 1rem; font-weight: 700; color: #475569; display: flex; align-items: center; gap: 0.45rem; margin: 0 0 0.25rem 0;">
          <i class="fa-solid fa-lock" style="color: #94a3b8;"></i>
          ${currentLang === 'si' ? 'අනෙකුත් ලබා ගත හැකි පාඨමාලා' : (enrolledCourses.length > 0 ? 'Other Available Masterclasses' : 'Available Physics Masterclasses')}
        </h4>
        <p style="color: #94a3b8; font-size: 0.8rem; margin: 0;">
          ${currentLang === 'si' ? 'MCQ වේග ඇගයීම් සඳහා ප්‍රවේශය ලබා ගැනීමට මෙම පාඨමාලාවලට ලියාපදිංචි වන්න.' : 'Enroll in these masterclasses to unlock timed MCQ speed tests.'}
        </p>
      </div>
    `;

    html += otherCourses.map(course => {
      const questions = getQuizQuestionsForCourse(course.id);
      return `
        <div class="lms-course-picker-card is-locked" style="background: #f8fafc; border-color: #e2e8f0; opacity: 0.9;">
          <div>
            <div class="lms-course-card-top">
              <span class="lms-course-badge" style="background: #f1f5f9; color: #64748b; border-color: #cbd5e1;">
                <i class="fa-solid fa-lock"></i> ${course.examYear || course.level || '2027 A/L'}
              </span>
              <span class="lms-course-stream">${currentLang === 'si' ? (course.stream_si || course.stream || 'භෞතික විද්‍යාව') : (course.stream || 'Physics')}</span>
            </div>
            <h4 class="lms-course-title" style="color: #334155;">${currentLang === 'si' ? (course.title_si || course.title) : course.title}</h4>
            <div class="lms-course-meta">
              <span><i class="fa-solid fa-chalkboard-user"></i> ${course.teacherName || course.teacher || 'Amalsha Wanniarachchi'}</span>
              <span><i class="fa-solid fa-stopwatch"></i> ${questions.length > 0 ? `${questions.length} MCQs` : 'Masterclass'}</span>
            </div>
          </div>
          <button class="lms-course-select-btn" type="button" onclick="event.stopPropagation(); closeLMSPortal(); window.location.href='checkout.html?course=${encodeURIComponent(course.id)}';" style="background: #227aff;">
            <i class="fa-solid fa-cart-plus"></i> <span>${currentLang === 'si' ? 'ලියාපදිංචි වන්න' : 'Enroll to Unlock'}</span>
          </button>
        </div>
      `;
    }).join('');
  }

  grid.innerHTML = html;
}

function selectCourseForQuiz(courseId) {
  if (!courseId) return;

  if (!isCourseEnrolled(courseId)) {
    const currentLang = window.currentLang || "en";
    const msg = currentLang === "si"
      ? "🔒 මෙම පාඨමාලාවේ MCQ විභාගයට සහභාගී වීමට කරුණාකර පළමුව ලියාපදිංචි වන්න."
      : "🔒 Please enroll in this course to access its MCQ speed tests.";
    if (window.showToast) window.showToast(msg, "warning");
    showQuizCoursePicker();
    return;
  }

  const questions = getQuizQuestionsForCourse(courseId);
  if (questions.length === 0) {
    if (window.showToast) {
      window.showToast("⚠️ This course currently does not have any active MCQ speed tests.", "warning");
    }
    return;
  }

  LMS_STATE.quizActiveCourseId = courseId;
  LMS_STATE.quizCurrentQuestions = questions;

  const allCourses = getLMSCourses();
  const targetClean = String(courseId).toLowerCase().replace(/-theory|-revision|-paper/g, '');
  const course = allCourses.find(c => {
    const cClean = String(c.id).toLowerCase().replace(/-theory|-revision|-paper/g, '');
    return c.id === courseId || courseId.startsWith(c.id) || c.id.startsWith(courseId) || cClean === targetClean;
  });

  const currentLang = window.currentLang || "en";
  const courseTitle = course ? (currentLang === "si" ? (course.title_si || course.title) : course.title) : "A/L Physics";

  const badgeEl = document.getElementById("lmsQuizStartCourseBadge");
  const titleEl = document.getElementById("lmsQuizStartPaperTitle");
  const descEl = document.getElementById("lmsQuizStartPaperDesc");
  const countEl = document.getElementById("lmsQuizStartQuestionCount");

  if (badgeEl) badgeEl.textContent = courseTitle;
  if (titleEl) titleEl.textContent = `${courseTitle} - Timed Speed Evaluation`;
  if (descEl) descEl.textContent = `A 10-minute speed evaluation comprising ${questions.length} high-yield multiple-choice questions covering core physics concepts, vectors, and mechanics derivations.`;
  if (countEl) countEl.innerHTML = `<i class="fa-solid fa-list-check"></i> ${questions.length} MCQs`;

  const pickerView = document.getElementById("lmsQuizCoursePickerView");
  const startView = document.getElementById("lmsQuizStartScreenView");
  const activeView = document.getElementById("lmsQuizActiveTestView");

  if (pickerView) pickerView.style.display = "none";
  if (startView) startView.style.display = "block";
  if (activeView) activeView.style.display = "none";
}

function startActiveQuiz() {
  if (!LMS_STATE.quizActiveCourseId) {
    showQuizCoursePicker();
    return;
  }

  const questions = (LMS_STATE.quizCurrentQuestions && LMS_STATE.quizCurrentQuestions.length > 0)
    ? LMS_STATE.quizCurrentQuestions
    : getQuizQuestionsForCourse(LMS_STATE.quizActiveCourseId);

  if (questions.length === 0) {
    showToast("⚠️ No MCQ questions available for this course.", "warning");
    showQuizCoursePicker();
    return;
  }

  LMS_STATE.quizCurrentQuestions = questions;
  LMS_STATE.quizAnswers = {};
  LMS_STATE.quizSubmitted = false;
  LMS_STATE.currentQuizIndex = 0;
  LMS_STATE.quizTimerSeconds = 600;

  const allCourses = getLMSCourses();
  const courseId = LMS_STATE.quizActiveCourseId;
  const targetClean = String(courseId).toLowerCase().replace(/-theory|-revision|-paper/g, '');
  const course = allCourses.find(c => {
    const cClean = String(c.id).toLowerCase().replace(/-theory|-revision|-paper/g, '');
    return c.id === courseId || courseId.startsWith(c.id) || c.id.startsWith(courseId) || cClean === targetClean;
  });
  const courseTitle = course ? (window.currentLang === "si" ? (course.title_si || course.title) : course.title) : "A/L Physics";

  const activeBadge = document.getElementById("quizActiveCourseBadge");
  const paperTitle = document.getElementById("quizPaperTitle");
  if (activeBadge) activeBadge.textContent = courseTitle;
  if (paperTitle) paperTitle.textContent = `${courseTitle} - Speed Evaluation`;

  const pickerView = document.getElementById("lmsQuizCoursePickerView");
  const startView = document.getElementById("lmsQuizStartScreenView");
  const activeView = document.getElementById("lmsQuizActiveTestView");

  if (pickerView) pickerView.style.display = "none";
  if (startView) startView.style.display = "none";
  if (activeView) activeView.style.display = "block";

  renderQuizQuestion(0);
  startQuizTimer();
  showToast("🚀 Speed Test Started! You have 10:00 minutes.", "success");
}

function confirmExitActiveQuiz() {
  if (!LMS_STATE.quizSubmitted && Object.keys(LMS_STATE.quizAnswers).length > 0) {
    if (confirm("Are you sure you want to change course? Your current speed test progress will be lost.")) {
      showQuizCoursePicker();
    }
  } else {
    showQuizCoursePicker();
  }
}

function startQuizTimer() {
  if (LMS_STATE.quizTimerInterval) {
    clearInterval(LMS_STATE.quizTimerInterval);
    LMS_STATE.quizTimerInterval = null;
  }

  // Only start timer if user is explicitly on the speed-quiz tab and active test view!
  const activeView = document.getElementById("lmsQuizActiveTestView");
  if (LMS_STATE.activeTab !== "speed-quiz" || !activeView || activeView.style.display !== "block") {
    return;
  }

  const timerEl = document.getElementById("quizTimerText");
  const pillEl = document.getElementById("quizTimerPill");

  LMS_STATE.quizTimerInterval = setInterval(() => {
    // If student switched away from speed-quiz, pause countdown immediately
    if (LMS_STATE.activeTab !== "speed-quiz") {
      clearInterval(LMS_STATE.quizTimerInterval);
      LMS_STATE.quizTimerInterval = null;
      return;
    }

    if (LMS_STATE.quizSubmitted) {
      clearInterval(LMS_STATE.quizTimerInterval);
      LMS_STATE.quizTimerInterval = null;
      return;
    }

    if (LMS_STATE.quizTimerSeconds <= 0) {
      clearInterval(LMS_STATE.quizTimerInterval);
      LMS_STATE.quizTimerInterval = null;
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
  const questions = (LMS_STATE.quizCurrentQuestions && LMS_STATE.quizCurrentQuestions.length > 0)
    ? LMS_STATE.quizCurrentQuestions
    : getQuizQuestionsForCourse(LMS_STATE.quizActiveCourseId);
  
  if (!questions || questions.length === 0) return;

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
  const questions = (LMS_STATE.quizCurrentQuestions && LMS_STATE.quizCurrentQuestions.length > 0)
    ? LMS_STATE.quizCurrentQuestions
    : getQuizQuestionsForCourse(LMS_STATE.quizActiveCourseId);
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
  const questions = (LMS_STATE.quizCurrentQuestions && LMS_STATE.quizCurrentQuestions.length > 0)
    ? LMS_STATE.quizCurrentQuestions
    : getQuizQuestionsForCourse(LMS_STATE.quizActiveCourseId);
  let correctCount = 0;

  questions.forEach(q => {
    if (LMS_STATE.quizAnswers[q.id] === q.correctAnswer) {
      correctCount++;
    }
  });

  LMS_STATE.quizSubmitted = true;
  if (LMS_STATE.quizTimerInterval) {
    clearInterval(LMS_STATE.quizTimerInterval);
    LMS_STATE.quizTimerInterval = null;
  }

  const scorePercent = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  // Store quiz submission for Teacher Gradebook
  try {
    const user = LMS_STATE.currentUser || { name: "A/L Student", id: "EP-STUDENT" };
    const allCourses = getLMSCourses();
    const courseId = LMS_STATE.quizActiveCourseId;
    const course = allCourses.find(c => c.id === courseId);
    const paperName = course ? `${course.title} Speed Evaluation` : "A/L Physics Speed Evaluation";

    const submissions = JSON.parse(localStorage.getItem("edupeak_quiz_submissions") || "[]");
    submissions.push({
      studentName: user.name,
      studentId: user.id,
      courseId: courseId,
      paperTitle: paperName,
      score: scorePercent,
      correct: correctCount,
      total: questions.length,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem("edupeak_quiz_submissions", JSON.stringify(submissions));
  } catch (e) {
    console.warn("Submissions error:", e);
  }

  // Show summary modal ONLY if student is currently on the speed-quiz tab
  const resultModal = document.getElementById("quizResultModal");
  const scoreNumber = document.getElementById("quizResultScore");
  const scoreText = document.getElementById("quizResultFeedback");

  if (scoreNumber) scoreNumber.textContent = `${scorePercent}%`;
  if (scoreText) {
    scoreText.innerHTML = `You answered <strong>${correctCount} of ${questions.length}</strong> questions correctly.<br>Rank: <strong>Island Top 2.5% Percentile</strong> &bull; Core Physics Principles Mastered.`;
  }

  if (resultModal && LMS_STATE.activeTab === "speed-quiz") {
    resultModal.classList.add("active");
  }

  renderQuizQuestion(LMS_STATE.currentQuizIndex);
  if (LMS_STATE.activeTab === "speed-quiz") {
    showToast(`🎯 Exam submitted successfully! Score: ${scorePercent}%`, "success");
  }
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
  showToast("🔄 Speed Evaluation Reset. Timer restarted!", "info");
}

// --------------------------------------------------------------------------
// 3. REAL LIVE CLASSROOM STUDENT Q&A CHAT
// --------------------------------------------------------------------------
function getLiveChatMessages() {
  try {
    const raw = localStorage.getItem("edupeak_live_chat_messages");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function saveLiveChatMessages(messages) {
  try {
    localStorage.setItem("edupeak_live_chat_messages", JSON.stringify(messages));
  } catch (e) {}
}

function escapeChatHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderLiveChatMessages() {
  const chatScroll = document.getElementById("liveChatMessagesScroll");
  if (!chatScroll) return;

  const messages = getLiveChatMessages();

  if (messages.length === 0) {
    chatScroll.innerHTML = `
      <div class="chat-empty-state" style="text-align: center; padding: 3rem 1.25rem; color: #94a3b8;">
        <div style="width: 48px; height: 48px; border-radius: 50%; background: #f1f5f9; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 0.75rem; color: #64748b;">
          <i class="fa-regular fa-comments" style="font-size: 1.35rem;"></i>
        </div>
        <div style="font-weight: 700; font-size: 0.9rem; color: #475569; margin-bottom: 0.25rem;">No Questions Yet</div>
        <div style="font-size: 0.8rem; color: #94a3b8; max-width: 250px; margin: 0 auto; line-height: 1.4;">Ask a question or clarify your physics doubts directly during this live broadcast!</div>
      </div>
    `;
    return;
  }

  const currentUser = (window.AUTH_SYSTEM && window.AUTH_SYSTEM.getCurrentUser)
    ? window.AUTH_SYSTEM.getCurrentUser()
    : (LMS_STATE.currentUser || null);

  chatScroll.innerHTML = messages.map(msg => {
    const isMe = currentUser && (
      (msg.userId && msg.userId === currentUser.id) ||
      (msg.senderNic && currentUser.nic && msg.senderNic === currentUser.nic) ||
      (msg.senderName && msg.senderName.toLowerCase() === currentUser.name?.toLowerCase())
    );

    const isTeacherOrAdmin = msg.userRole === "teacher" || msg.userRole === "admin" || msg.userRole === "lecturer";

    let roleBadge = "";
    if (isTeacherOrAdmin) {
      roleBadge = `<span style="background: rgba(16, 185, 129, 0.15); color: #059669; font-size: 0.68rem; font-weight: 800; padding: 0.15rem 0.45rem; border-radius: 4px; margin-left: 0.35rem; display: inline-flex; align-items: center; gap: 0.25rem;"><i class="fa-solid fa-chalkboard-user"></i> Lecturer</span>`;
    } else if (isMe) {
      roleBadge = `<span style="background: rgba(34, 122, 255, 0.12); color: #227aff; font-size: 0.68rem; font-weight: 800; padding: 0.15rem 0.45rem; border-radius: 4px; margin-left: 0.35rem;">You</span>`;
    } else {
      roleBadge = `<span style="background: #f1f5f9; color: #64748b; font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 4px; margin-left: 0.35rem;">Student</span>`;
    }

    const bubbleBorder = isTeacherOrAdmin 
      ? "border-left: 3px solid #10b981; background: #f0fdf4;" 
      : (isMe ? "border-left: 3px solid #227aff; background: #f8faff;" : "border: 1px solid #e2e8f0; background: #ffffff;");

    return `
      <div class="chat-bubble" style="${bubbleBorder} border-radius: 10px; padding: 0.65rem 0.85rem; margin-bottom: 0.6rem; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
        <div class="chat-sender" style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center;">
            <span style="font-weight: 700; color: ${isTeacherOrAdmin ? '#059669' : (isMe ? 'var(--primary)' : '#0f172a')}; font-size: 0.85rem;">${escapeChatHtml(msg.senderName || 'Student')}</span>
            ${roleBadge}
          </div>
          <span class="chat-time" style="font-size: 0.725rem; color: #94a3b8;">${escapeChatHtml(msg.time || '')}</span>
        </div>
        <div style="font-size: 0.85rem; color: #334155; margin-top: 0.3rem; word-break: break-word; line-height: 1.45;">${escapeChatHtml(msg.text)}</div>
      </div>
    `;
  }).join('');

  chatScroll.scrollTop = chatScroll.scrollHeight;
}

function initLiveChat() {
  renderLiveChatMessages();

  // Multi-tab real-time synchronization
  if (!window._edupeakLiveChatListenerAdded) {
    window._edupeakLiveChatListenerAdded = true;
    window.addEventListener("storage", (e) => {
      if (e.key === "edupeak_live_chat_messages") {
        renderLiveChatMessages();
      }
    });
  }
}

function sendLiveChatMessage() {
  const inputEl = document.getElementById("liveChatInputField");
  const chatScroll = document.getElementById("liveChatMessagesScroll");
  if (!inputEl || !inputEl.value.trim() || !chatScroll) return;

  const text = inputEl.value.trim();
  const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const activeUser = (window.AUTH_SYSTEM && window.AUTH_SYSTEM.getCurrentUser)
    ? window.AUTH_SYSTEM.getCurrentUser()
    : (LMS_STATE.currentUser || null);

  const senderName = (activeUser && activeUser.name) ? activeUser.name : "Student";
  const userRole = (activeUser && activeUser.role) ? activeUser.role : "student";
  const userId = (activeUser && activeUser.id) ? activeUser.id : "";
  const senderNic = (activeUser && activeUser.nic) ? activeUser.nic : "";

  const newMsg = {
    id: "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    senderName: senderName,
    userRole: userRole,
    userId: userId,
    senderNic: senderNic,
    time: timeNow,
    timestamp: Date.now(),
    text: text
  };

  const messages = getLiveChatMessages();
  messages.push(newMsg);

  // Keep last 150 real messages
  if (messages.length > 150) {
    messages.splice(0, messages.length - 150);
  }
  saveLiveChatMessages(messages);

  inputEl.value = "";
  renderLiveChatMessages();

  // Scroll to bottom
  chatScroll.scrollTop = chatScroll.scrollHeight;

  // Broadcast custom event for same-page components
  window.dispatchEvent(new CustomEvent("edupeak-live-chat-updated", { detail: newMsg }));
}

function clearLiveChatHistory() {
  try {
    localStorage.removeItem("edupeak_live_chat_messages");
    renderLiveChatMessages();
    if (typeof showToast === "function") {
      showToast("Live chat cleared.", "info");
    }
  } catch (e) {}
}

// --------------------------------------------------------------------------
// 4. ENROLLED COURSES (Streamlined into Video Classes with Filters)
// --------------------------------------------------------------------------
function renderEnrolledCourses() {
  if (typeof renderLMSCoursePicker === "function") {
    renderLMSCoursePicker();
  }
}

// Helper: Check if user is already enrolled in a course
function isCourseEnrolled(courseId) {
  if (!courseId) return false;
  try {
    const activeUser = (window.AUTH_SYSTEM && typeof window.AUTH_SYSTEM.getCurrentUser === "function")
      ? window.AUTH_SYSTEM.getCurrentUser()
      : (window.LMS_STATE ? window.LMS_STATE.currentUser : null);

    // 1. Teachers and Admins have full access to all courses
    if (activeUser && (activeUser.role === "teacher" || activeUser.role === "admin")) {
      return true;
    }

    let enrolledList = [];

    // 2. Check active logged-in student's specific access list
    if (activeUser) {
      if (Array.isArray(activeUser.enrolledCourses)) {
        enrolledList.push(...activeUser.enrolledCourses);
      }
      if (activeUser.id && window.AUTH_SYSTEM && typeof window.AUTH_SYSTEM.getStudentEnrolledCourses === "function") {
        const userCourses = window.AUTH_SYSTEM.getStudentEnrolledCourses(activeUser.id);
        if (Array.isArray(userCourses)) {
          enrolledList.push(...userCourses);
        }
      }
    }

    // 3. Check approved orders in edupeak_pending_orders (Crucial for WhatsApp orders approved by admin/teacher)
    try {
      const orders = JSON.parse(localStorage.getItem("edupeak_pending_orders") || "[]");
      if (Array.isArray(orders)) {
        orders.forEach(ord => {
          const isApproved = ord.status && (ord.status.toLowerCase() === "approved" || ord.status.toLowerCase().includes("approved"));
          if (isApproved) {
            const matchesUser = !activeUser || 
              ord.studentId === activeUser.id || 
              (ord.studentPhone && activeUser.phone && ord.studentPhone.replace(/\D/g, '') === activeUser.phone.replace(/\D/g, '')) ||
              (ord.studentName && activeUser.name && ord.studentName.toLowerCase().trim() === activeUser.name.toLowerCase().trim()) ||
              (ord.studentEmail && activeUser.email && ord.studentEmail.toLowerCase() === activeUser.email.toLowerCase());

            if (matchesUser && ord.courseId) {
              enrolledList.push(ord.courseId);
            }
          }
        });
      }
    } catch (e) {}

    // 4. Check dedicated per-student course access key in localStorage
    if (activeUser && activeUser.id) {
      try {
        const stored = localStorage.getItem(`edupeak_student_courses_${activeUser.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) enrolledList.push(...parsed);
        }
      } catch (e) {}
    }

    // 5. Merge global storage or LMS_STATE
    try {
      const saved = localStorage.getItem("edupeak_enrolled");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          enrolledList.push(...parsed);
        }
      }
    } catch (e) {}
    
    if (window.LMS_STATE && Array.isArray(window.LMS_STATE.enrolledCourses) && window.LMS_STATE.enrolledCourses.length > 0) {
      enrolledList.push(...window.LMS_STATE.enrolledCourses);
    }

    enrolledList = Array.from(new Set(enrolledList));
    if (enrolledList.length === 0) {
      return false;
    }
    
    return enrolledList.some(id => matchCourseId(id, courseId));
  } catch (e) {
    return false;
  }
}

// Enroll Course Handler with Login Check, Duplicate Enrollment Guard & Checkout Redirect
function enrollCourse(courseId) {
  const currentUser = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getCurrentUser() : null;
  const isTeacherOrAdmin = currentUser && (currentUser.role === "teacher" || currentUser.role === "admin");

  // 1. Guard against duplicate enrollment for students -> Open that specific course in LMS!
  if (!isTeacherOrAdmin && isCourseEnrolled(courseId)) {
    showToast("✓ You are already enrolled! Loading this course's masterclass in LMS...", "success");
    setTimeout(() => {
      openLMSPortal("video-classroom", courseId);
    }, 350);
    return;
  }

  // 2. Guard against duplicate pending order
  if (!isTeacherOrAdmin && currentUser) {
    try {
      const orders = JSON.parse(localStorage.getItem("edupeak_pending_orders") || "[]");
      const hasPending = orders.some(o => 
        o.studentId === currentUser.id && 
        o.status === "Pending Approval" && 
        (o.courseId === courseId || (courseId && o.courseId && o.courseId.includes(courseId)))
      );
      if (hasPending) {
        showToast("⏳ Your enrollment order for this course is already pending approval.", "info");
        setTimeout(() => {
          window.location.href = `checkout.html?course=${encodeURIComponent(courseId)}`;
        }, 350);
        return;
      }
    } catch (e) {}
  }

  if (currentUser) {
    // If user is already logged in (Student or Teacher preview) -> Bring directly to checkout page!
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
window.initLiveChat = initLiveChat;
window.initLiveChatSimulation = initLiveChat;
window.renderLiveChatMessages = renderLiveChatMessages;
window.getLiveChatMessages = getLiveChatMessages;
window.clearLiveChatHistory = clearLiveChatHistory;
window.sendLiveChatMessage = sendLiveChatMessage;
window.enrollCourse = enrollCourse;
window.showToast = showToast;
window.syncLMSUserInfo = syncLMSUserInfo;
window.renderLMSCoursePicker = renderLMSCoursePicker;
window.renderEnrolledCourses = renderEnrolledCourses;
window.selectCourseForClassroom = selectCourseForClassroom;
window.showCoursePickerInLMS = showCoursePickerInLMS;
window.getQuizQuestionsForCourse = getQuizQuestionsForCourse;
window.showQuizCoursePicker = showQuizCoursePicker;
window.renderQuizCoursePicker = renderQuizCoursePicker;
window.selectCourseForQuiz = selectCourseForQuiz;
window.startActiveQuiz = startActiveQuiz;
window.confirmExitActiveQuiz = confirmExitActiveQuiz;
window.LMS_COURSE_FILTER = LMS_COURSE_FILTER;
window.onLMSCourseSearchInput = onLMSCourseSearchInput;
window.clearLMSCourseSearch = clearLMSCourseSearch;
window.setLMSCourseStatusFilter = setLMSCourseStatusFilter;
window.setLMSCourseTypeFilter = setLMSCourseTypeFilter;
window.setLMSCourseYearFilter = setLMSCourseYearFilter;
window.resetLMSCourseFilters = resetLMSCourseFilters;
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
