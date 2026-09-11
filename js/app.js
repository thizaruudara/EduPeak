/**
 * EduPeak Educational Portal - Master Application Logic
 * Light Blue & White Theme, Streamlined Teacher Cards, Authentication & Dynamic LMS
 */

window.currentLang = "en";
let activeTeacherFilter = "all";
let activeCourseFilter = "all";

document.addEventListener("DOMContentLoaded", () => {
  initGoatsPreloader();
  initLanguage();
  renderTeachers();
  renderCourses();
  renderInstitutes();
  renderFAQs();
  initEventListeners();
  initInteractiveBackground();
  initCounterAnimations();
  initHeroScrollDescentAnimation();
  initScrollTextLines();
  initScrollRevealAndProgressBar();
  if (window.AUTH_SYSTEM) window.AUTH_SYSTEM.init();
  if (window.initLMS) window.initLMS();

  // Auto-launch LMS portal if navigated with openLms query param or #lms hash
  const urlParams = new URLSearchParams(window.location.search);
  const openTab = urlParams.get("openLms") || urlParams.get("lms");
  const targetCourse = urlParams.get("course");
  const wasAdminOpen = sessionStorage.getItem("edupeak_admin_open") === "true";
  const currentUser = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getCurrentUser() : null;

  if (openTab || window.location.hash === "#lms") {
    if (!currentUser) {
      const courseParam = targetCourse ? `&course=${encodeURIComponent(targetCourse)}` : '';
      const redirectTarget = `index.html?openLms=${encodeURIComponent(openTab || "video-classroom")}${courseParam}`;
      window.location.replace(`login.html?redirect=${encodeURIComponent(redirectTarget)}`);
      return;
    } else {
      setTimeout(() => {
        if (window.openLMSPortal) window.openLMSPortal(openTab || "video-classroom", targetCourse);
      }, 400);
    }
  } else if (window.location.hash.startsWith("#admin") || urlParams.get("admin") !== null || wasAdminOpen) {
    if (!currentUser || currentUser.role !== "admin") {
      history.replaceState(null, document.title, window.location.pathname);
      sessionStorage.removeItem("edupeak_admin_open");
    } else {
      setTimeout(() => {
        if (window.ADMIN_CONTROLLER && window.ADMIN_CONTROLLER.checkAutoOpen) {
          window.ADMIN_CONTROLLER.checkAutoOpen();
        }
      }, 50);
    }
  }
});

// --------------------------------------------------------------------------
// 1. BILINGUAL LANGUAGE CONTROLLER
// --------------------------------------------------------------------------
function initLanguage() {
  const savedLang = localStorage.getItem("edupeak_lang") || "en";
  setLanguage(savedLang);
}

function setLanguage(lang) {
  window.currentLang = lang;
  localStorage.setItem("edupeak_lang", lang);

  const t = window.EDUPEAK_TRANSLATIONS[lang];
  if (!t) return;

  // Update elements with data-i18n attribute
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = t[key];
      } else {
        el.innerHTML = t[key];
      }
    }
  });

  // Update language toggle button label
  const langBtn = document.getElementById("langSwitchBtn");
  if (langBtn) {
    langBtn.innerHTML = `<i class="fa-solid fa-globe"></i> ${lang === 'en' ? 'සිංහල' : 'English'}`;
  }

  // Re-render components
  renderTeachers();
  renderCourses();
  renderInstitutes();
  renderFAQs();
  if (window.renderLMSLesson) window.renderLMSLesson(LMS_STATE.currentLessonIndex);
  if (window.renderQuizCoursePicker) window.renderQuizCoursePicker();
  if (window.renderQuizQuestion && window.LMS_STATE && window.LMS_STATE.quizActiveCourseId) window.renderQuizQuestion(LMS_STATE.currentQuizIndex);
  if (window.renderEnrolledCourses) window.renderEnrolledCourses();
  if (window.AUTH_SYSTEM && window.AUTH_SYSTEM.updateUIForAuthState) window.AUTH_SYSTEM.updateUIForAuthState();
}

function handleSmartLMSButtonClick(e) {
  if (e && typeof e.preventDefault === "function") e.preventDefault();
  const user = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getCurrentUser() : null;
  if (user) {
    if (user.role === "teacher") {
      window.location.href = "teacher-portal.html";
    } else if (user.role === "admin") {
      if (window.openAdminPanel) window.openAdminPanel();
    } else {
      if (window.openLMSPortal) {
        window.openLMSPortal("video-classroom");
      } else {
        window.location.href = "student-dashboard.html";
      }
    }
  } else {
    window.location.href = "login.html?redirect=student-dashboard.html";
  }
}
window.handleSmartLMSButtonClick = handleSmartLMSButtonClick;

function toggleLanguage() {
  setLanguage(window.currentLang === "en" ? "si" : "en");
}

// --------------------------------------------------------------------------
// 2. TEACHERS DIRECTORY RENDERING
// User Requirement: ONLY Teacher Pic, Name, Subject, and Degree. Nothing else.
// --------------------------------------------------------------------------
function renderTeachers() {
  const container = document.getElementById("teachersGrid");
  if (!container) return;

  const stored = localStorage.getItem("edupeak_teachers_db");
  const teachers = stored ? JSON.parse(stored) : window.EDUPEAK_DATA.teachers;
  const lang = window.currentLang;

  const filtered = activeTeacherFilter === "all" 
    ? teachers 
    : teachers.filter(tch => tch.id.toLowerCase().includes(activeTeacherFilter.toLowerCase()) || tch.subject.toLowerCase().includes(activeTeacherFilter.toLowerCase()) || (tch.stream && tch.stream.toLowerCase().includes(activeTeacherFilter.toLowerCase())));

  container.innerHTML = filtered.map(teacher => {
    const name = lang === "si" ? (teacher.name_si || teacher.name) : teacher.name;
    const subject = lang === "si" ? (teacher.subject_si || teacher.subject) : teacher.subject;
    const degree = lang === "si" ? (teacher.degree_si || teacher.degree) : teacher.degree;

    return `
      <article class="teacher-pure-card" id="teacherCard_${teacher.id}">
        <!-- 1. Teacher Profile Picture -->
        <img src="${teacher.image}" alt="${name}" class="teacher-pure-avatar" loading="lazy">
        
        <!-- 2. Teacher Name -->
        <h3 class="teacher-pure-name">${name}</h3>
        
        <!-- 3. Subject -->
        <span class="teacher-pure-subject">${subject}</span>
        
        <!-- 4. Degree & Academic Qualification -->
        <div class="teacher-pure-degree">${degree}</div>
      </article>
    `;
  }).join('');
}

function filterTeachers(filterKey, btnEl) {
  activeTeacherFilter = filterKey;
  document.querySelectorAll(".teachers-filter-bar .filter-btn").forEach(btn => btn.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  renderTeachers();
}

// --------------------------------------------------------------------------
// 3. COURSES DIRECTORY
// --------------------------------------------------------------------------
function isCourseOrderPending(courseId) {
  const currentUser = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getCurrentUser() : null;
  if (!currentUser || !currentUser.id) return false;
  try {
    const orders = JSON.parse(localStorage.getItem("edupeak_pending_orders") || "[]");
    return orders.some(o => 
      o.studentId === currentUser.id && 
      o.status === "Pending Approval" && 
      (o.courseId === courseId || (courseId && o.courseId && o.courseId.includes(courseId)))
    );
  } catch (e) {
    return false;
  }
}
window.isCourseOrderPending = isCourseOrderPending;

function renderCourses() {
  const container = document.getElementById("coursesGrid");
  if (!container) return;

  let courses = [];
  if (typeof window.getLMSCourses === "function") {
    courses = window.getLMSCourses();
  } else if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getSharedData === "function") {
    const shared = window.SUPABASE_HELPER.getSharedData("edupeak_courses_db");
    if (shared !== null && Array.isArray(shared)) {
      courses = shared;
    } else {
      const stored = localStorage.getItem("edupeak_courses_db");
      if (stored !== null) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) courses = parsed;
        } catch (e) {}
      } else {
        courses = (window.EDUPEAK_DATA ? window.EDUPEAK_DATA.courses : []);
      }
    }
  } else {
    const stored = localStorage.getItem("edupeak_courses_db");
    if (stored !== null) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) courses = parsed;
      } catch (e) {}
    } else {
      courses = (window.EDUPEAK_DATA ? window.EDUPEAK_DATA.courses : []);
    }
  }

  const lang = window.currentLang || "en";
  const t = (window.EDUPEAK_TRANSLATIONS && window.EDUPEAK_TRANSLATIONS[lang]) || {};

  const filtered = activeCourseFilter === "all" 
    ? courses 
    : courses.filter(c => {
        if (activeCourseFilter === "al") return (c.level || "").includes("A/L") && !(c.title || "").includes("Paper");
        if (activeCourseFilter === "papers") return (c.title || "").includes("Paper") || (c.title_si || "").includes("ප්‍රශ්න පත්‍ර");
        if (activeCourseFilter === "diploma") return (c.level || "").includes("Diploma") || (c.stream || "").includes("Professional");
        return true;
      });

  if (!filtered || filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card" style="text-align: center; padding: 3.5rem 1.5rem; grid-column: 1 / -1; background: var(--bg-surface, #ffffff); border-radius: 12px; border: 1px dashed var(--border-subtle, #e2e8f0);">
        <div style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 0.75rem;"><i class="fa-solid fa-graduation-cap"></i></div>
        <h3 style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">${lang === 'si' ? 'පාඨමාලා නොමැත' : 'No Courses Available'}</h3>
        <p style="color: #64748b; font-size: 0.85rem; margin: 0;">${lang === 'si' ? 'දැනට සක්‍රීය පාඨමාලා කිසිවක් නොමැත.' : 'There are currently no active courses in the catalog.'}</p>
      </div>
    `;
    return;
  }

  const currentUser = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getCurrentUser() : null;
  const isTeacherOrAdmin = currentUser && (currentUser.role === "teacher" || currentUser.role === "admin");

  container.innerHTML = filtered.map(course => {
    const title = lang === "si" ? course.title_si : course.title;
    const stream = lang === "si" ? course.stream_si : course.stream;
    const medium = lang === "si" ? course.medium_si : course.medium;
    const fee = lang === "si" ? course.fee_si : course.fee;
    const isEnrolled = !isTeacherOrAdmin && (typeof isCourseEnrolled === "function" ? isCourseEnrolled(course.id) : (window.isCourseEnrolled ? window.isCourseEnrolled(course.id) : false));
    const isPending = !isTeacherOrAdmin && isCourseOrderPending(course.id);
    const userExamYear = currentUser ? (currentUser.examYear || "") : "";
    const courseBatch = course.examYear || course.level || "2026 A/L";
    const courseYearNum = (courseBatch.match(/\d{4}/) || [""])[0];
    const userYearNum = (userExamYear.match(/\d{4}/) || [""])[0];
    const isBatchMismatch = !isTeacherOrAdmin && !!(userYearNum && courseYearNum && userYearNum !== courseYearNum && !courseBatch.toLowerCase().includes("all"));

    return `
      <article class="course-card ${isEnrolled ? 'course-card-enrolled' : ''}">
        <div class="course-header-banner">
          <div class="course-icon-round">
            <i class="fa-solid ${course.thumbnailIcon}"></i>
          </div>
          ${isEnrolled ? `
            <span class="course-badge-pill" style="background: #10b981; color: #ffffff; font-weight: 700; box-shadow: 0 2px 8px rgba(16,185,129,0.3);">
              <i class="fa-solid fa-circle-check"></i> ${lang === 'si' ? 'ලියාපදිංචි වී ඇත' : 'Enrolled'}
            </span>
          ` : (isPending ? `
            <span class="course-badge-pill" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-weight: 700; box-shadow: 0 2px 8px rgba(217,119,6,0.2);">
              <i class="fa-solid fa-clock"></i> ${lang === 'si' ? 'ඇණවුම පොරොත්තුවේ' : 'Order Pending'}
            </span>
          ` : (isBatchMismatch ? `
            <span class="course-badge-pill" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;">
              <i class="fa-solid fa-triangle-exclamation"></i> ${courseBatch}
            </span>
          ` : `
            <span class="course-badge-pill">${courseBatch}</span>
          `))}
        </div>

        <div class="course-body">
          <span class="course-stream-tag">${stream}</span>
          <h3 class="course-title">${title}</h3>
          <div class="course-lecturer-row">
            <i class="fa-solid fa-chalkboard-user"></i>
            <span>${course.teacherName}</span>
          </div>

          <div class="course-details-pills">
            <span class="detail-pill" style="${isBatchMismatch ? 'background: #fffbeb; color: #b45309; border: 1px solid #fde68a; font-weight: 700;' : 'background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-weight: 700;'}">
              <i class="fa-solid ${isBatchMismatch ? 'fa-triangle-exclamation' : 'fa-calendar-check'}"></i> 
              ${courseBatch} ${isBatchMismatch ? `(Your Profile: ${userExamYear})` : ''}
            </span>
            <span class="detail-pill"><i class="fa-solid fa-language"></i> ${medium}</span>
            <span class="detail-pill"><i class="fa-regular fa-clock"></i> ${course.liveTime}</span>
            <span class="detail-pill"><i class="fa-solid fa-layer-group"></i> ${course.modulesCount} ${t.course_card_lessons || 'Lessons'}</span>
          </div>

          <div class="course-footer-row">
            <div>
              <span style="font-size: 0.725rem; color: var(--text-dim); display: block;">Course Investment:</span>
              <span class="course-price">${fee}</span>
            </div>
            ${isEnrolled ? `
              <button class="btn btn-sm" style="background: #10b981; color: #ffffff; border: 1px solid #10b981; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;" onclick="openLMSPortal('video-classroom', '${course.id}')">
                <i class="fa-solid fa-circle-play"></i> ${t.course_card_enrolled || 'Enrolled • Go to LMS'}
              </button>
            ` : (isPending ? `
              <a href="student-dashboard.html" class="btn btn-sm" style="background: #fffbeb; color: #b45309; border: 1.5px solid #fde68a; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; text-decoration: none;">
                <i class="fa-solid fa-clock"></i> ${lang === 'si' ? 'ඇණවුම පොරොත්තුවේ' : 'Order Pending • View'}
              </a>
            ` : `
              <button class="btn btn-primary btn-sm" onclick="enrollCourse('${course.id}')">
                <i class="fa-solid fa-cart-plus"></i> ${t.course_card_enroll || 'Enroll'}
              </button>
            `)}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function filterCourses(tabKey, btnEl) {
  activeCourseFilter = tabKey;
  document.querySelectorAll(".courses-tab-bar .filter-btn").forEach(btn => btn.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  renderCourses();
}

// --------------------------------------------------------------------------
// 4. INSTITUTES & BRANCHES DIRECTORY
// --------------------------------------------------------------------------
function renderInstitutes() {
  const container = document.getElementById("institutesGrid");
  if (!container) return;

  const institutes = window.EDUPEAK_INSTITUTES ? window.EDUPEAK_INSTITUTES.getAll() : (window.EDUPEAK_DATA?.institutes || []);
  const lang = window.currentLang || "en";
  const t = (window.EDUPEAK_TRANSLATIONS && window.EDUPEAK_TRANSLATIONS[lang]) || {};

  container.innerHTML = institutes.map(inst => {
    const isComingSoon = inst.status === "coming_soon";
    const name = (lang === "si" && inst.name_si) ? inst.name_si : inst.name;
    const loc = (lang === "si" && inst.location_si) ? inst.location_si : (inst.location || "Sri Lanka");
    const rawFacs = (lang === "si" && inst.facilities_si) ? inst.facilities_si : (inst.facilities || []);
    const facilities = Array.isArray(rawFacs) ? rawFacs : (typeof rawFacs === "string" ? rawFacs.split("\n").filter(Boolean) : []);
    const badge = (lang === "si" && inst.badge_si) ? inst.badge_si : (inst.badge || (isComingSoon ? "Coming Soon" : "Physical Campus Hub"));
    const isPhysical = inst.hasPhysicalLocation !== false && !!inst.mapUrl;

    return `
      <div class="institute-card" style="${isComingSoon ? 'border-color: #fde68a; background: linear-gradient(180deg, #ffffff 0%, #fefce8 100%);' : ''}">
        <div class="inst-header">
          <div>
            ${isComingSoon ? `
              <span class="badge-pill" style="margin-bottom: 0.4rem; font-size: 0.725rem; display: inline-flex; align-items: center; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-weight: 700;">
                <i class="fa-solid fa-clock" style="margin-right: 0.35rem;"></i>
                ${lang === 'si' ? 'ඉදිරියේදී විවෘත වේ (Coming Soon)' : badge}
              </span>
            ` : `
              <span class="badge-pill" style="margin-bottom: 0.4rem; font-size: 0.725rem; display: inline-flex; align-items: center; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-weight: 700;">
                <span class="live-pulse-dot" style="background: #10b981;"></span>
                ${badge}
              </span>
            `}
            <h3 class="inst-name">${name}</h3>
            <div class="inst-location">
              <i class="fa-solid ${isPhysical ? 'fa-map-location-dot' : 'fa-globe'}" style="color: var(--primary); margin-top: 0.2rem;"></i>
              <span>${loc}</span>
            </div>
            ${inst.email ? `
              <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
                <i class="fa-solid fa-envelope" style="color: var(--primary);"></i>
                <a href="mailto:${inst.email}" style="color: inherit; text-decoration: none;">${inst.email}</a>
              </div>
            ` : ''}
          </div>
        </div>

        <ul class="inst-facilities-list">
          ${facilities.map(fac => `
            <li class="inst-facility-item">
              <i class="fa-solid ${isComingSoon ? 'fa-circle-dot' : 'fa-circle-check'}" style="${isComingSoon ? 'color: #d97706;' : 'color: #10b981;'}"></i>
              <span>${fac}</span>
            </li>
          `).join('')}
        </ul>

        <div class="inst-contact-row" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <span class="inst-phone"><i class="fa-solid fa-phone"></i> ${inst.phone || "+94 76 068 7578"}</span>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
            ${isComingSoon ? `
              <span style="font-size: 0.75rem; font-weight: 700; color: #b45309; background: #fffbeb; padding: 4px 8px; border-radius: 6px; border: 1px solid #fde68a;">
                <i class="fa-solid fa-hourglass-start"></i> ${lang === 'si' ? 'ලියාපදිංචිය ඉක්මනින්' : 'Pre-Launch'}
              </span>
            ` : ''}
            ${inst.facebook ? `
              <a href="${inst.facebook}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" title="Facebook Page">
                <i class="fa-brands fa-facebook"></i> Facebook
              </a>
            ` : ''}
            ${isPhysical ? `
              <a href="${inst.mapUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" title="Google Maps Location">
                <i class="fa-solid fa-location-dot" style="color: var(--primary);"></i> ${lang === 'si' ? 'Google Maps පිහිටීම' : 'Map'}
              </a>
            ` : `
              <a href="courses.html" class="btn btn-ghost btn-sm" title="Explore Online Batches">
                <i class="fa-solid fa-graduation-cap" style="color: var(--primary);"></i> ${lang === 'si' ? 'මාර්ගගත පාඨමාලා' : 'Explore Courses'}
              </a>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// --------------------------------------------------------------------------
// 5. FAQ ACCORDION ENGINE
// --------------------------------------------------------------------------
function renderFAQs() {
  const container = document.getElementById("faqAccordionContainer");
  if (!container) return;

  const faqs = window.EDUPEAK_DATA.faqs;
  const lang = window.currentLang;

  container.innerHTML = faqs.map((faq, idx) => {
    const question = lang === "si" ? faq.q_si : faq.q;
    const answer = lang === "si" ? faq.a_si : faq.a;

    return `
      <div class="faq-item ${idx === 0 ? 'open' : ''}" onclick="toggleFaq(this)">
        <div class="faq-question">
          <span>${question}</span>
          <i class="fa-solid fa-chevron-down faq-icon" style="transition: transform 0.3s ease;"></i>
        </div>
        <div class="faq-answer">
          ${answer}
        </div>
      </div>
    `;
  }).join('');
}

function toggleFaq(itemEl) {
  const wasOpen = itemEl.classList.contains("open");
  document.querySelectorAll(".faq-item").forEach(item => item.classList.remove("open"));
  if (!wasOpen) itemEl.classList.add("open");
}

// --------------------------------------------------------------------------
// 6. FULL FUNCTIONAL AUTHENTICATION HANDLERS
// --------------------------------------------------------------------------
let selectedAuthRole = "student";

function switchAuthRole(roleName, btnEl) {
  selectedAuthRole = roleName;
  document.querySelectorAll(".role-switcher-tabs .role-tab-btn").forEach(btn => btn.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  hideAuthError("signInErrorAlert");
}

function hideAuthError(elId) {
  const alert = document.getElementById(elId);
  if (alert) alert.style.display = "none";
}

function showAuthError(elId, msg) {
  const alert = document.getElementById(elId);
  if (alert) {
    alert.textContent = msg;
    alert.style.display = "block";
  }
}

function handleSignIn(e) {
  e.preventDefault();
  const idInput = document.getElementById("signInIdInput");
  const passInput = document.getElementById("signInPasswordInput");
  const identifier = idInput ? idInput.value.trim() : "";
  const password = passInput ? passInput.value : "";

  if (!identifier || !password) {
    showAuthError("signInErrorAlert", "Please enter both your Student ID/Email and Password.");
    return;
  }

  const result = window.AUTH_SYSTEM.login(identifier, password, selectedAuthRole);
  if (!result.success) {
    showAuthError("signInErrorAlert", result.message);
    return;
  }

  hideAuthError("signInErrorAlert");
  closeModal("signInModal");
  showToast(`🎉 Welcome back, ${result.user.name}! Accessing Dashboard...`, "success");
  
  setTimeout(() => {
    if (result.user.role === "student") {
      window.location.href = "student-dashboard.html";
    } else if (result.user.role === "teacher") {
      window.location.href = "teacher-portal.html";
    } else if (result.user.role === "admin") {
      if (window.openAdminPanel) window.openAdminPanel();
    } else {
      window.location.href = "student-dashboard.html";
    }
  }, 500);
}

function handleRegister(e) {
  if (window.handleRegistrationSubmit) {
    return window.handleRegistrationSubmit(e);
  }
}

function handleLogout() {
  window.AUTH_SYSTEM.logout();
}

function handleSupportSubmit(e) {
  e.preventDefault();
  const form = document.getElementById("supportForm");
  if (form) form.reset();
  showToast("✓ Support inquiry submitted! Reference: #TK-9941", "success");
}

// --------------------------------------------------------------------------
// 7. MODALS & EVENTS
// --------------------------------------------------------------------------
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "auto";
  }
}

function initEventListeners() {
  const mobileToggle = document.getElementById("mobileMenuToggle");
  const mainNav = document.getElementById("mainNav");
  if (mobileToggle && mainNav) {
    mobileToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      mainNav.classList.toggle("mobile-active");
    });

    document.querySelectorAll("#mainNav .nav-link").forEach(link => {
      link.addEventListener("click", () => {
        mainNav.classList.remove("mobile-active");
      });
    });

    document.addEventListener("click", (e) => {
      if (mainNav.classList.contains("mobile-active") && !mainNav.contains(e.target) && !mobileToggle.contains(e.target)) {
        mainNav.classList.remove("mobile-active");
      }
    });
  }

  window.addEventListener("scroll", () => {
    const header = document.querySelector(".site-header");
    if (header) {
      header.classList.toggle("scrolled", window.scrollY > 40);
    }
  });

  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("active");
        document.body.style.overflow = "auto";
      }
    });
  });
}

// --------------------------------------------------------------------------
// 7. LIVE INTERACTIVE BACKGROUND CANVAS ANIMATION
// --------------------------------------------------------------------------
function initInteractiveBackground() {
  const canvas = document.getElementById("heroInteractiveCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let width, height;
  let particles = [];
  let mouse = { x: -1000, y: -1000, active: false, radius: 180 };
  let animationFrameId;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = canvas.width = rect.width;
    height = canvas.height = rect.height;
    initParticles();
  }

  function initParticles() {
    particles = [];
    const count = Math.floor((width * height) / 14000);
    const particleCount = Math.min(Math.max(count, 35), 85);

    const colors = [
      "rgba(34, 122, 255, ",   // eWings Primary #227AFF
      "rgba(0, 210, 255, ",    // Cyan Light
      "rgba(21, 101, 216, ",   // Royal Deep
      "rgba(96, 165, 250, "    // Soft Sky Blue
    ];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.75,
        vy: (Math.random() - 0.5) * 0.75,
        radius: Math.random() * 2.2 + 1.5,
        baseColor: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.45 + 0.25,
        pulseOffset: Math.random() * Math.PI * 2
      });
    }
  }

  // Mouse / Touch Tracking
  window.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );
  });

  window.addEventListener("mouseleave", () => {
    mouse.active = false;
    mouse.x = -1000;
    mouse.y = -1000;
  });

  // Touch tracking for mobile devices
  window.addEventListener("touchmove", (e) => {
    if (e.touches.length > 0) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.touches[0].clientX - rect.left;
      mouse.y = e.touches[0].clientY - rect.top;
      mouse.active = true;
    }
  }, { passive: true });

  window.addEventListener("touchend", () => {
    mouse.active = false;
  });

  let time = 0;

  function animate() {
    time += 0.02;
    ctx.clearRect(0, 0, width, height);

    // 1. Subtle ambient mouse glow aura
    if (mouse.active) {
      const aura = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, mouse.radius);
      aura.addColorStop(0, "rgba(34, 122, 255, 0.12)");
      aura.addColorStop(0.5, "rgba(0, 210, 255, 0.05)");
      aura.addColorStop(1, "rgba(34, 122, 255, 0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, mouse.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Update and Draw Particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      p.x += p.vx;
      p.y += p.vy;

      // Bounce smoothly at borders
      if (p.x < 0) { p.x = 0; p.vx *= -1; }
      if (p.x > width) { p.x = width; p.vx *= -1; }
      if (p.y < 0) { p.y = 0; p.vy *= -1; }
      if (p.y > height) { p.y = height; p.vy *= -1; }

      // Mouse interactive physics (elastic magnetic interaction)
      if (mouse.active) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);

        if (dist < mouse.radius) {
          // Connecting beam to cursor
          const connectionAlpha = (1 - dist / mouse.radius) * 0.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(34, 122, 255, ${connectionAlpha})`;
          ctx.lineWidth = 1.1;
          ctx.stroke();

          // Subtle interactive drift away from cursor
          const force = (mouse.radius - dist) / mouse.radius;
          const angle = Math.atan2(dy, dx);
          p.x -= Math.cos(angle) * force * 1.5;
          p.y -= Math.sin(angle) * force * 1.5;
        }
      }

      // Draw particle dot with soft glow
      const currentAlpha = p.alpha + Math.sin(time + p.pulseOffset) * 0.15;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.baseColor + Math.max(0.1, currentAlpha) + ")";
      ctx.shadowColor = "rgba(34, 122, 255, 0.4)";
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;

      // 3. Connect nearby particles to each other (Neural Constellation Mesh)
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 115) {
          const lineAlpha = (1 - dist / 115) * 0.22;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(34, 122, 255, ${lineAlpha})`;
          ctx.lineWidth = 0.85;
          ctx.stroke();
        }
      }
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);
  resize();
  animate();
}

// --------------------------------------------------------------------------
// 8. ANIMATED STATS NUMBER COUNTERS (0 -> Target Eased Increment)
// --------------------------------------------------------------------------
function initCounterAnimations() {
  const statElements = document.querySelectorAll(".stat-number[data-target]");
  if (!statElements.length) return;

  let animated = false;

  function runCounters() {
    if (animated) return;
    animated = true;

    statElements.forEach(el => {
      const target = parseFloat(el.getAttribute("data-target")) || 0;
      const suffix = el.getAttribute("data-suffix") || "";
      const prefix = el.getAttribute("data-prefix") || "";
      const useComma = el.getAttribute("data-format") === "comma";
      const decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
      
      const duration = 2000; // 2.0s smooth ease
      const startTime = performance.now();

      function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease Out Cubic: 1 - (1 - progress)^3
        const ease = 1 - Math.pow(1 - progress, 3);
        const currentVal = target * ease;

        let displayVal;
        if (decimals > 0) {
          displayVal = currentVal.toFixed(decimals);
        } else {
          const rounded = Math.round(currentVal);
          displayVal = useComma ? rounded.toLocaleString("en-US") : rounded.toString();
        }

        el.textContent = `${prefix}${displayVal}${suffix}`;

        if (progress < 1) {
          requestAnimationFrame(updateCounter);
        } else {
          const finalVal = decimals > 0 
            ? target.toFixed(decimals) 
            : (useComma ? Math.round(target).toLocaleString("en-US") : Math.round(target).toString());
          el.textContent = `${prefix}${finalVal}${suffix}`;
        }
      }

      requestAnimationFrame(updateCounter);
    });
  }

  // Trigger on viewport intersection or immediately
  const statsRow = document.getElementById("heroStatsRow") || document.querySelector(".hero-stats-row");
  if (statsRow && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0] && entries[0].isIntersecting) {
        runCounters();
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    observer.observe(statsRow);
  } else {
    runCounters();
  }
}

// --------------------------------------------------------------------------
// 9. HERO-TO-FACULTY SCROLL DESCENT ANIMATION
// ==========================================================================
// 9. CINEMATIC HERO & FACULTY CARD INTERACTIONS
// Clean, solid Apple-grade card depth, interactive 3D tilt & smooth reveals
// ==========================================================================
function initHeroScrollDescentAnimation() {
  const heroCard = document.querySelector(".hero-card-frame");
  const heroSection = document.getElementById("hero");
  const facultySection = document.getElementById("teachers");
  const facultyFrame = document.getElementById("facultySpotlightFrame");
  const facultyCard = document.getElementById("masterFacultyCard");

  // Remove any leftover morph/orb elements from DOM
  const existingMorph = document.getElementById("heroFacultyMorphCard");
  if (existingMorph) existingMorph.remove();
  const existingOrb = document.getElementById("scrollFlightOrb");
  if (existingOrb) existingOrb.remove();

  // 1. Hero Card Interactive 3D Perspective Tilt on Hover
  if (heroCard && heroSection && window.matchMedia("(hover: hover)").matches) {
    heroSection.addEventListener("mousemove", (e) => {
      const rect = heroCard.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -5;
      const rotateY = ((x - centerX) / centerX) * 5;

      heroCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    });

    heroSection.addEventListener("mouseleave", () => {
      heroCard.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)";
    });
  }

  // 2. Master Faculty Spotlight Card Smooth Reveal
  if (facultyCard) {
    facultyCard.classList.add("faculty-revealed");

    // 3. Subtle 3D Perspective Tilt on Faculty Card Hover
    if (window.matchMedia("(hover: hover)").matches) {
      facultyCard.addEventListener("mousemove", (e) => {
        const rect = facultyCard.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const deltaX = (x - centerX) / centerX;
        const deltaY = (y - centerY) / centerY;

        if (facultyFrame) {
          facultyFrame.style.transform = `perspective(1000px) rotateY(${deltaX * 4}deg) rotateX(${-deltaY * 4}deg) translateY(-3px) scale(1.02)`;
        }
      });

      facultyCard.addEventListener("mouseleave", () => {
        if (facultyFrame) {
          facultyFrame.style.transform = "perspective(1000px) rotateY(0deg) rotateX(0deg) translateY(0) scale(1)";
        }
      });
    }
  }
}

// --------------------------------------------------------------------------
// 10. GOATS.COM.PL STYLE LIQUID CURTAIN PRELOADER (Live Counter & Curve Wipe)
// --------------------------------------------------------------------------
function initGoatsPreloader() {
  const preloader = document.getElementById("sitePreloader");
  if (!preloader) return;

  // Check if current page is the root home page
  const pathname = window.location.pathname.toLowerCase();
  const isHomePage = pathname === "/" || pathname === "" || pathname.endsWith("/index.html") || pathname.endsWith("/index");

  // Check for deep links, admin portal session, or lms hashes
  const urlParams = new URLSearchParams(window.location.search);
  const isDeepLink = urlParams.has("openLms") || urlParams.has("lms") || urlParams.has("course") || urlParams.has("admin") || urlParams.has("tab");
  const wasAdminOpen = sessionStorage.getItem("edupeak_admin_open") === "true";
  const isHashDeepLink = window.location.hash.startsWith("#admin") || window.location.hash.startsWith("#lms") || wasAdminOpen;

  // If not on Home page or inside Admin/LMS portal, immediately remove the preloader
  if (!isHomePage || isDeepLink || isHashDeepLink) {
    preloader.style.display = "none";
    preloader.remove();
    document.documentElement.classList.remove("is-preloading");
    document.body.classList.remove("is-preloading");
    document.body.style.overflow = "";
    return;
  }

  const brandBox = document.getElementById("preloaderBrandBox");
  const dot = document.getElementById("preloaderDot") || document.getElementById("preloaderSparkDot");
  const subtext = document.getElementById("preloaderSubtext");
  const counterNum = document.getElementById("preloaderCounterNum");
  const counterBox = document.getElementById("preloaderCounterBox");
  const curvePath = document.getElementById("preloaderCurvePath");

  if (!counterNum) {
    preloader.remove();
    document.documentElement.classList.remove("is-preloading");
    document.body.classList.remove("is-preloading");
    return;
  }

  // Prevent scroll during preloading
  document.body.style.overflow = "hidden";

  // Step 1: Reveal Brand elements with spring/expo timing
  setTimeout(() => {
    if (brandBox) brandBox.classList.add("reveal");
    if (dot) dot.classList.add("reveal");
    if (subtext) subtext.classList.add("reveal");
  }, 100);

  // Step 2: High-Speed Precision Percentage Counter (0 to 100%)
  let count = 0;
  const duration = 1400; // 1.4s smooth energetic load
  const startTime = performance.now();

  function updateCounter(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease-out expo curve for counter progression
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    count = Math.round(easedProgress * 100);
    counterNum.textContent = count;

    if (progress < 1) {
      requestAnimationFrame(updateCounter);
    } else {
      counterNum.textContent = "100";
      // Step 3: Trigger Liquid SVG Curtain Exit Transition
      setTimeout(exitPreloader, 180);
    }
  }

  requestAnimationFrame(updateCounter);

  // Step 3: Liquid SVG Curve Morph & Curtain Slide-Up
  function exitPreloader() {
    // Fade & slide up brand elements
    if (brandBox) {
      brandBox.style.transform = "translateY(-60px)";
      brandBox.style.opacity = "0";
      brandBox.style.transition = "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease";
    }
    if (dot) {
      dot.style.opacity = "0";
      dot.style.transition = "opacity 0.3s ease";
    }
    if (subtext) {
      subtext.style.opacity = "0";
      subtext.style.transition = "opacity 0.3s ease";
    }
    if (counterBox) {
      counterBox.style.transform = "translateY(-30px)";
      counterBox.style.opacity = "0";
      counterBox.style.transition = "transform 0.35s ease, opacity 0.35s ease";
    }

    // Animate SVG Curve morphing (Iconic Goats.com.pl liquid arch)
    if (curvePath) {
      const morphStart = performance.now();
      const morphDuration = 700;

      function morphCurve(t) {
        const p = Math.min((t - morphStart) / morphDuration, 1);
        // Liquid bulge effect: curve control point arching upward
        const archY = 100 - (Math.sin(p * Math.PI) * 45);
        curvePath.setAttribute("d", `M 0 0 L 100 0 L 100 100 Q 50 ${archY} 0 100 Z`);

        if (p < 1) {
          requestAnimationFrame(morphCurve);
        }
      }
      requestAnimationFrame(morphCurve);
    }

    // Slide up entire preloader overlay
    setTimeout(() => {
      preloader.classList.add("is-loaded");
      document.documentElement.classList.remove("is-preloading");
      document.body.classList.remove("is-preloading");
      document.body.style.overflow = "";

      // Cleanup preloader after transition
      setTimeout(() => {
        preloader.style.display = "none";
      }, 950);
    }, 150);
  }
}

// --------------------------------------------------------------------------
// 11. MOTION SCROLL TEXT LINES CONTROLLER (Kinetic Scroll-Driven Marquee)
// --------------------------------------------------------------------------
function initScrollTextLines() {
  const section = document.getElementById("scrollTextLinesSection");
  if (!section) return;

  const lines = section.querySelectorAll(".ticker-line");
  if (!lines.length) return;

  const lineData = Array.from(lines).map((line) => {
    const track = line.querySelector(".ticker-track");
    const speed = parseFloat(line.getAttribute("data-speed")) || 0.6;
    const direction = parseFloat(line.getAttribute("data-direction")) || 1;
    return {
      track,
      speed,
      direction,
      currentOffset: 0,
      targetOffset: 0
    };
  });

  function getGroupWidth(item) {
    const groups = item.track.querySelectorAll(".ticker-group");
    if (groups.length > 0 && groups[0].offsetWidth > 0) {
      return groups[0].offsetWidth;
    }
    return item.track.scrollWidth / (groups.length || 3);
  }

  function getTrackX(offset, groupWidth) {
    if (!groupWidth || groupWidth <= 0) return 0;
    const norm = ((offset % groupWidth) + groupWidth) % groupWidth;
    return norm - groupWidth;
  }

  let isTicking = false;

  function onScroll() {
    const scrollY = window.scrollY || window.pageYOffset;
    const rect = section.getBoundingClientRect();
    const windowH = window.innerHeight;

    // Only compute when section is near or in viewport
    if (rect.bottom > -300 && rect.top < windowH + 300) {
      const scrollProgress = scrollY - (section.offsetTop - windowH);

      lineData.forEach((item) => {
        item.targetOffset = scrollProgress * item.speed * item.direction;
      });

      if (!isTicking) {
        isTicking = true;
        requestAnimationFrame(update);
      }
    }
  }

  function update() {
    let stillMoving = false;

    lineData.forEach((item) => {
      if (!item.track) return;
      const groupWidth = getGroupWidth(item);

      // Smooth kinetic momentum
      const diff = item.targetOffset - item.currentOffset;
      if (Math.abs(diff) > 0.1) {
        item.currentOffset += diff * 0.18;
        stillMoving = true;
      } else {
        item.currentOffset = item.targetOffset;
      }

      const x = getTrackX(item.currentOffset, groupWidth);
      item.track.style.transform = `translate3d(${x}px, 0, 0)`;
    });

    if (stillMoving) {
      requestAnimationFrame(update);
    } else {
      isTicking = false;
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  // Initial calculation so all lines are populated and visible edge-to-edge
  onScroll();
}

// --------------------------------------------------------------------------
// 11. PROFESSIONAL SCROLL REVEAL & PROGRESS BAR CONTROLLER
// --------------------------------------------------------------------------
function initScrollRevealAndProgressBar() {
  // 1. Reading Progress Bar at top of window
  let progressBar = document.getElementById("pageScrollProgressBar");
  if (!progressBar) {
    progressBar = document.createElement("div");
    progressBar.id = "pageScrollProgressBar";
    progressBar.className = "page-scroll-progress";
    document.body.prepend(progressBar);
  }

  function updateProgressBar() {
    const scrollTotal = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollTotal > 0) {
      const scrollPercent = (window.scrollY / scrollTotal) * 100;
      progressBar.style.width = Math.min(100, Math.max(0, scrollPercent)) + "%";
    }
  }

  window.addEventListener("scroll", updateProgressBar, { passive: true });
  updateProgressBar();

  // 2. IntersectionObserver for Smooth Reveal on Scroll
  function setupScrollReveals() {
    const revealTargets = document.querySelectorAll(
      ".section-header, .course-card, .institute-card, .support-card, .master-faculty-card, .hero-sinhala-banner, .hero-stat-card, .scroll-text-lines-section"
    );

    if ("IntersectionObserver" in window) {
      const revealObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            obs.unobserve(entry.target);
          }
        });
      }, {
        root: null,
        threshold: 0.08,
        rootMargin: "0px 0px -30px 0px"
      });

      revealTargets.forEach((el) => {
        el.classList.add("reveal-on-scroll");
        const parent = el.parentElement;
        if (parent && (parent.classList.contains("institutes-grid") || parent.style.display === "grid" || parent.classList.contains("courses-grid") || parent.classList.contains("support-cards-row"))) {
          const siblingIndex = Array.from(parent.children).indexOf(el);
          el.classList.add(`stagger-${(siblingIndex % 5) + 1}`);
        }
        revealObserver.observe(el);
      });
    } else {
      revealTargets.forEach(el => el.classList.add("is-revealed"));
    }
  }

  // Trigger setup after rendering courses and institutes
  setTimeout(setupScrollReveals, 120);
}

// --------------------------------------------------------------------------
// USER PROFILE INTERACTIVE DROPDOWN CONTROLLER
// --------------------------------------------------------------------------
function toggleProfileDropdown(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const wrapper = document.getElementById("userProfileDropdownWrapper");
  if (wrapper) {
    const isOpen = wrapper.classList.toggle("open");
    const triggerChip = document.getElementById("userProfileTriggerChip");
    if (triggerChip) {
      triggerChip.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
  }
}

function closeProfileDropdown() {
  const wrapper = document.getElementById("userProfileDropdownWrapper");
  if (wrapper) {
    wrapper.classList.remove("open");
    const triggerChip = document.getElementById("userProfileTriggerChip");
    if (triggerChip) {
      triggerChip.setAttribute("aria-expanded", "false");
    }
  }
}

// Close dropdown on outside click
document.addEventListener("click", (e) => {
  const wrapper = document.getElementById("userProfileDropdownWrapper");
  if (wrapper && wrapper.classList.contains("open") && !wrapper.contains(e.target)) {
    closeProfileDropdown();
  }
});

// Close dropdown on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeProfileDropdown();
  }
});

// PeakBot Interactive Chat Simulation
function simulatePeakBotMsg(topic) {
  const canvas = document.getElementById("peakbotChatCanvas");
  if (!canvas) return;

  const responses = {
    timetable: {
      user: "📅 මේ සතියේ Physics කාලසටහන මොකක්ද?",
      bot: "⏰ <strong>2025 Theory:</strong> සෙනසුරාදා උදේ 8.00 - 1.30 (Victory Embilipitiya)<br>⏰ <strong>2026 Theory:</strong> ඉරිදා උදේ 8.00 - 1.30<br>⏰ <strong>Speed MCQ:</strong> බදාදා රාත්‍රී 7.30 (Zoom Live)"
    },
    tute: {
      user: "📚 මගේ Tute Pack එක ඩිලිවර් වෙලාද?",
      bot: "📦 <strong>Tute Pack #04 (Mechanics II):</strong> Promex Courier හරහා ඊයේ dispatch කරන ලදී. Tracking No: <code>EP-78942LK</code> (හෙට දහවල් වන විට නිවසටම ලැබේ)."
    },
    exam: {
      user: "⏱️ ඊළඟ Speed MCQ Exam එක තියෙන්නේ කවදාද?",
      bot: "🏆 <strong>Speed MCQ Paper 09 (Fields & Gravitation):</strong> ලබන බදාදා රාත්‍රී 8.00 ට LMS Arena එකේදී පැවැත්වේ. කාලය: මිනිත්තු 45 (ප්‍රශ්න 30)."
    },
    zoom: {
      user: "📹 අද රෑ Zoom Live Link එක ගන්න පුළුවන්ද?",
      bot: "🔗 ඔබේ <strong>Student ID (EP-2025-...)</strong> තහවුරු විය. අද රෑ 7.30 Live Revision Session එක සඳහා Direct Portal Pass එක LMS Dashboard එකට එක් කර ඇත!"
    }
  };

  const data = responses[topic];
  if (!data) return;

  // Append user bubble
  const userBubble = document.createElement("div");
  userBubble.className = "chat-bubble chat-user";
  userBubble.innerHTML = `<span>${data.user}</span>`;
  canvas.appendChild(userBubble);

  // Auto scroll
  canvas.scrollTop = canvas.scrollHeight;

  // Typing indicator delay
  setTimeout(() => {
    const botBubble = document.createElement("div");
    botBubble.className = "chat-bubble chat-bot";
    botBubble.innerHTML = `
      <div class="chat-bot-header">
        <i class="fa-solid fa-robot"></i> PeakBot Assistant
      </div>
      <span>${data.bot}</span>
    `;
    canvas.appendChild(botBubble);
    canvas.scrollTop = canvas.scrollHeight;
  }, 400);
}

// Global exports
window.toggleLanguage = toggleLanguage;
window.setLanguage = setLanguage;
window.filterTeachers = filterTeachers;
window.filterCourses = filterCourses;
window.toggleFaq = toggleFaq;
window.openModal = openModal;
window.closeModal = closeModal;
window.switchAuthRole = switchAuthRole;
window.handleSignIn = handleSignIn;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.handleSupportSubmit = handleSupportSubmit;
window.initInteractiveBackground = initInteractiveBackground;
window.initCounterAnimations = initCounterAnimations;
window.initHeroScrollDescentAnimation = initHeroScrollDescentAnimation;
window.initGoatsPreloader = initGoatsPreloader;
window.initScrollTextLines = initScrollTextLines;
window.initScrollRevealAndProgressBar = initScrollRevealAndProgressBar;
window.toggleProfileDropdown = toggleProfileDropdown;
window.closeProfileDropdown = closeProfileDropdown;
window.simulatePeakBotMsg = simulatePeakBotMsg;
window.renderCourses = renderCourses;
window.renderTeachers = renderTeachers;

window.addEventListener("edupeak:courses-synced", () => {
  renderCourses();
});

window.addEventListener("edupeak:teachers-synced", () => {
  renderTeachers();
});

