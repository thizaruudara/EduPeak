/**
 * EduPeak LMS - Teacher & Faculty Studio Controller
 * Handles Course Creation, Lesson Video Uploads, Timed MCQ Quiz Builder, and Live Streams
 */

const TEACHER_CONTROLLER = {
  currentTab: "courses",
  teacher: null,
  activeCourseId: null,

  storageKeys: {
    customCourses: "edupeak_custom_courses",
    customLessons: "edupeak_custom_lessons",
    customQuizzes: "edupeak_custom_quizzes",
    quizzesDb: "edupeak_quizzes_db",
    schedulesDb: "edupeak_schedules_db",
    papers: "edupeak_papers_db",
    liveStream: "edupeak_live_stream_config",
    submissions: "edupeak_quiz_submissions"
  },

  init() {
    this.checkAuth();
    this.loadCustomData();
    this.renderMetrics();
    this.switchTab("courses");
    this.populateCourseDropdowns();
    this.initYouTubeDurationProbe();
  },

  checkAuth() {
    const user = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getCurrentUser() : null;
    const gate = document.getElementById("teacherLoginGate");
    if (user && (user.role === "teacher" || user.role === "admin")) {
      this.teacher = user;
      if (gate) gate.style.display = "none";
    } else {
      const h = window.location.hostname.toLowerCase();
      if (h === 'edupeak.lk' || h === 'www.edupeak.lk') {
        window.location.replace("index.html");
        return;
      }
      if (gate) gate.style.display = "flex";
      return;
    }

    // Update UI profile elements
    const nameEl = document.getElementById("teacherProfileName");
    const subEl = document.getElementById("teacherProfileSubject");
    const avatarEl = document.getElementById("teacherProfileAvatar");

    if (nameEl) nameEl.textContent = this.teacher.name;
    if (subEl) subEl.textContent = this.teacher.subject || "Faculty Lecturer";
    if (avatarEl) avatarEl.textContent = this.teacher.avatarLetter || this.teacher.name.charAt(0);
  },

  loadCustomData() {
    try {
      let loadedCourses = null;
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getSharedData === "function") {
        const shared = window.SUPABASE_HELPER.getSharedData("edupeak_courses_db");
        if (shared !== null && Array.isArray(shared)) {
          loadedCourses = shared;
        }
      }
      if (loadedCourses === null) {
        const storedCoursesDb = localStorage.getItem("edupeak_courses_db");
        if (storedCoursesDb !== null) {
          try {
            const parsed = JSON.parse(storedCoursesDb);
            if (Array.isArray(parsed)) loadedCourses = parsed;
          } catch (e) {}
        }
      }
      if (loadedCourses !== null) {
        if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.courses = loadedCourses;
      } else {
        const deletedIds = (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getDeletedCourses === "function")
          ? window.SUPABASE_HELPER.getDeletedCourses()
          : JSON.parse(localStorage.getItem("edupeak_deleted_courses_db") || "[]");

        if (window.EDUPEAK_DATA && Array.isArray(window.EDUPEAK_DATA.courses)) {
          window.EDUPEAK_DATA.courses = window.EDUPEAK_DATA.courses.filter(c => !deletedIds.includes(c.id));
        }

        const customCourses = JSON.parse(localStorage.getItem(this.storageKeys.customCourses || "edupeak_custom_courses") || "[]");
        if (customCourses.length && window.EDUPEAK_DATA && window.EDUPEAK_DATA.courses) {
          customCourses.forEach(c => {
            if (!deletedIds.includes(c.id) && !window.EDUPEAK_DATA.courses.find(item => item.id === c.id)) {
              window.EDUPEAK_DATA.courses.unshift(c);
            }
          });
        }
      }

      const customLessons = JSON.parse(localStorage.getItem(this.storageKeys.customLessons) || "[]");
      if (customLessons.length && window.EDUPEAK_DATA) {
        customLessons.forEach(l => {
          if (!window.EDUPEAK_DATA.lmsLessons.find(item => item.id === l.id)) {
            window.EDUPEAK_DATA.lmsLessons.push(l);
          }
        });
      }

      // Clean orphaned lessons & quizzes whose courses no longer exist
      const validCourses = this.getTeacherCourses();
      const validIds = new Set(validCourses.map(c => c.id));
      if (window.EDUPEAK_DATA && Array.isArray(window.EDUPEAK_DATA.lmsLessons)) {
        window.EDUPEAK_DATA.lmsLessons = window.EDUPEAK_DATA.lmsLessons.filter(l => l.courseId && validIds.has(l.courseId));
      }
      if (window.EDUPEAK_DATA && Array.isArray(window.EDUPEAK_DATA.quizQuestions)) {
        window.EDUPEAK_DATA.quizQuestions = window.EDUPEAK_DATA.quizQuestions.filter(q => q.courseId && validIds.has(q.courseId));
      }

      // Synchronize quizzes and schedules databases
      this.getAllLessons();
      this.getAllQuizzes();
      this.getAllScheduledBroadcasts();
    } catch (e) {
      console.warn("Error loading custom teacher data:", e);
    }
  },

  switchTab(tabId) {
    this.currentTab = tabId;

    // Highlight Tab Buttons & Auto-Center Active Tab on mobile/overflow
    document.querySelectorAll(".teacher-tab-btn").forEach(btn => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle("active", isActive);
      if (isActive && typeof btn.scrollIntoView === "function") {
        btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    });

    // Show Selected Pane
    document.querySelectorAll(".teacher-tab-pane").forEach(pane => {
      pane.classList.toggle("active", pane.id === `teacherTab_${tabId}`);
    });

    if (tabId === "courses") this.renderCourses();
    if (tabId === "lessons") this.renderLessons();
    if (tabId === "quizzes") this.renderQuizzes();
    if (tabId === "papers") this.renderPapers();
    if (tabId === "live") this.renderLiveStudio();
    if (tabId === "students") this.renderStudents();
    if (tabId === "gradebook") this.renderGradebook();
  },

  renderMetrics() {
    const courses = this.getTeacherCourses();
    const lessons = this.getAllLessons();
    const quizzes = this.getAllQuizzes();
    const students = this.getRegisteredStudents ? this.getRegisteredStudents() : [];

    let paperCount = 0;
    try {
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getSharedData === "function") {
        const sharedPapers = window.SUPABASE_HELPER.getSharedData("edupeak_papers_db");
        if (sharedPapers !== null && Array.isArray(sharedPapers)) {
          paperCount = sharedPapers.length;
        }
      }
      if (paperCount === 0) {
        const localPapers = JSON.parse(localStorage.getItem("edupeak_papers_db") || "null");
        if (localPapers !== null && Array.isArray(localPapers)) {
          paperCount = localPapers.length;
        }
      }
    } catch (e) {}

    const mCourses = document.getElementById("metricTotalCourses");
    const mLessons = document.getElementById("metricTotalLessons");
    const mQuizzes = document.getElementById("metricTotalQuizzes");
    const mPapers = document.getElementById("metricTotalPapers");
    const mStudents = document.getElementById("metricTotalStudents");

    if (mCourses) mCourses.textContent = courses.length;
    if (mLessons) mLessons.textContent = lessons.length;
    if (mQuizzes) mQuizzes.textContent = quizzes.length;
    if (mPapers) mPapers.textContent = paperCount;
    if (mStudents) mStudents.textContent = students.length > 0 ? `${students.length} Active` : "4,250+";
  },

  getTeacherCourses() {
    try {
      const deletedIds = (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getDeletedCourses === "function")
        ? window.SUPABASE_HELPER.getDeletedCourses()
        : JSON.parse(localStorage.getItem("edupeak_deleted_courses") || "[]");
      const filterDeleted = (list) => Array.isArray(list) ? list.filter(c => c && !deletedIds.includes(c.id)) : [];

      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getSharedData === "function") {
        const shared = window.SUPABASE_HELPER.getSharedData("edupeak_courses_db");
        if (shared !== null && Array.isArray(shared)) {
          const filtered = filterDeleted(shared);
          if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.courses = filtered;
          return filtered;
        }
      }
      const stored = localStorage.getItem("edupeak_courses_db");
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const filtered = filterDeleted(parsed);
          if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.courses = filtered;
          return filtered;
        }
      }
      const fallback = (window.EDUPEAK_DATA && window.EDUPEAK_DATA.courses) ? filterDeleted(window.EDUPEAK_DATA.courses) : [];
      if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.courses = fallback;
      return fallback;
    } catch (e) {
      return (window.EDUPEAK_DATA && window.EDUPEAK_DATA.courses) ? window.EDUPEAK_DATA.courses : [];
    }
  },

  getAllCourses() {
    return this.getTeacherCourses();
  },

  saveCoursesDatabase(coursesList) {
    if (!Array.isArray(coursesList)) return;
    try {
      localStorage.setItem("edupeak_courses_db", JSON.stringify(coursesList));
    } catch (e) {}
    try {
      localStorage.setItem(this.storageKeys.customCourses || "edupeak_custom_courses", JSON.stringify(coursesList));
    } catch (e) {}
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.courses = coursesList;
    }
    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.setSharedData === "function") {
      window.SUPABASE_HELPER.setSharedData("edupeak_courses_db", coursesList);
    }
  },

  // --------------------------------------------------------------------------
  // 1. COURSES MANAGEMENT (CREATE, EDIT, DELETE)
  // --------------------------------------------------------------------------
  renderCourses() {
    const grid = document.getElementById("teacherCoursesGrid");
    if (!grid) return;

    const courses = this.getTeacherCourses();

    if (!courses.length) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: #ffffff; border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
          <i class="fa-solid fa-book-open" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 1rem;"></i>
          <h3>No Courses Published Yet</h3>
          <p style="color: #64748b;">Click the "Create New Course" button above to publish your first syllabus.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = courses.map(c => `
      <div class="teacher-card" style="margin-bottom: 0; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: #eff6ff; color: #227aff; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
              <i class="fa-solid ${c.thumbnailIcon || 'fa-atom'}"></i>
            </div>
            <span class="status-tag active" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; font-weight: 700;">
              <i class="fa-solid fa-calendar-check"></i> ${c.examYear || c.level || '2026 A/L'}
            </span>
          </div>
          <h3 style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 0.5rem; line-height: 1.4;">${c.title}</h3>
          <p style="font-size: 0.825rem; color: #64748b; margin-bottom: 1rem;">${c.title_si || ''}</p>
          <div style="font-size: 0.8rem; color: #475569; display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1.25rem;">
            <div><i class="fa-solid fa-graduation-cap" style="color: #227aff; width: 18px;"></i> <strong>Target Batch:</strong> <span style="font-weight: 700; color: #0369a1;">${c.examYear || c.level || '2026 A/L'}</span></div>
            <div><i class="fa-solid fa-money-bill-wave" style="color: #10b981; width: 18px;"></i> <strong>Monthly Fee:</strong> ${c.fee || 'LKR 3,500 / Month'}</div>
            <div><i class="fa-solid fa-clock" style="color: #227aff; width: 18px;"></i> <strong>Schedule:</strong> ${c.liveTime || 'Every Sat 7:30 AM'}</div>
            <div><i class="fa-solid fa-users" style="color: #8b5cf6; width: 18px;"></i> <strong>Enrolled:</strong> ${c.students || '1,200'} Students</div>
          </div>
        </div>
        <div>
          <div style="display: flex; gap: 0.4rem; margin-bottom: 0.5rem;">
            <button class="btn btn-outline btn-sm" style="flex: 1;" onclick="TEACHER_CONTROLLER.openEditCourseModal('${c.id}')">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
            <button class="btn btn-ghost btn-sm" style="color: #ef4444; border: 1px solid #fecaca;" onclick="TEACHER_CONTROLLER.handleDeleteCourse('${c.id}')" title="Delete Course">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <div style="display: flex; gap: 0.4rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
            <button class="btn btn-ghost btn-sm" style="flex: 1; font-size: 0.75rem;" onclick="TEACHER_CONTROLLER.quickAddLessonForCourse('${c.id}')">
              <i class="fa-solid fa-plus"></i> Lesson
            </button>
            <button class="btn btn-primary btn-sm" style="flex: 1; font-size: 0.75rem;" onclick="TEACHER_CONTROLLER.quickAddQuizForCourse('${c.id}')">
              <i class="fa-solid fa-file-circle-question"></i> Quiz
            </button>
          </div>
        </div>
      </div>
    `).join("");
  },

  formatTime12h(time24) {
    if (!time24) return "7:30 AM";
    const parts = time24.split(":");
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1] || "00";
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  },

  parseTimeTo24h(timeStr) {
    if (!timeStr) return "07:30";
    const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return "07:30";
    let h = parseInt(match[1], 10);
    const m = match[2];
    const ampm = match[3] ? match[3].toUpperCase() : null;
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  },

  parseScheduleString(scheduleStr) {
    if (!scheduleStr) {
      return { day: "Every Saturday", startTime: "07:30", endTime: "13:30" };
    }
    const days = [
      "Every Saturday", "Every Sunday", "Every Monday", "Every Tuesday", 
      "Every Wednesday", "Every Thursday", "Every Friday", 
      "Weekends (Sat & Sun)", "Weekdays (Mon - Fri)", "Flexible / Online",
      "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
      "Special Live Broadcast"
    ];
    let matchedDay = "Every Saturday";
    for (const d of days) {
      if (scheduleStr.toLowerCase().includes(d.toLowerCase())) {
        matchedDay = d.startsWith("Every") || d.includes("(") ? d : `Every ${d}`;
        break;
      }
    }

    const timeMatches = Array.from(scheduleStr.matchAll(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi));
    let startTime = "07:30";
    let endTime = "13:30";
    if (timeMatches.length >= 2) {
      startTime = this.parseTimeTo24h(timeMatches[0][0]);
      endTime = this.parseTimeTo24h(timeMatches[1][0]);
    } else if (timeMatches.length === 1) {
      startTime = this.parseTimeTo24h(timeMatches[0][0]);
    }

    return { day: matchedDay, startTime, endTime };
  },

  buildScheduleString(day, startTime24, endTime24) {
    if (!day) day = "Every Saturday";
    if (!startTime24) startTime24 = "07:30";
    if (!endTime24) endTime24 = "13:30";
    const start12 = this.formatTime12h(startTime24);
    const end12 = this.formatTime12h(endTime24);
    return `${day} ${start12} - ${end12}`;
  },

  openNewCourseModal() {
    document.getElementById("newCourseModal").classList.add("active");
  },

  openEditCourseModal(courseId) {
    const courses = this.getTeacherCourses();
    const c = courses.find(item => item.id === courseId);
    if (!c) return;

    document.getElementById("editCourseIdInput").value = c.id;
    document.getElementById("editCourseTitleInput").value = c.title;
    if (document.getElementById("editCourseTitleSiInput")) {
      document.getElementById("editCourseTitleSiInput").value = c.title_si || "";
    }
    if (document.getElementById("editCourseExamYearSelect")) {
      document.getElementById("editCourseExamYearSelect").value = c.examYear || c.level || "2026 A/L";
    }
    document.getElementById("editCourseCategorySelect").value = c.category || "theory";
    document.getElementById("editCourseFeeInput").value = c.fee || "LKR 3,500 / Month";
    
    // Populate Day and Time slot pickers
    const parsedSchedule = this.parseScheduleString(c.liveTime || "Every Saturday 7:30 AM - 1:30 PM");
    if (document.getElementById("editCourseScheduleDaySelect")) {
      document.getElementById("editCourseScheduleDaySelect").value = parsedSchedule.day;
    }
    if (document.getElementById("editCourseScheduleStartTime")) {
      document.getElementById("editCourseScheduleStartTime").value = parsedSchedule.startTime;
    }
    if (document.getElementById("editCourseScheduleEndTime")) {
      document.getElementById("editCourseScheduleEndTime").value = parsedSchedule.endTime;
    }
    document.getElementById("editCourseMediumInput").value = c.medium || "Sinhala & English Medium";

    document.getElementById("editCourseModal").classList.add("active");
  },

  handleEditCourseSubmit(e) {
    e.preventDefault();
    const courseId = document.getElementById("editCourseIdInput").value;
    const courses = this.getTeacherCourses();
    const index = courses.findIndex(item => item.id === courseId);
    if (index === -1) return;

    const examYear = document.getElementById("editCourseExamYearSelect") ? document.getElementById("editCourseExamYearSelect").value : (courses[index].examYear || "2026 A/L");
    const title = document.getElementById("editCourseTitleInput").value.trim();

    const day = document.getElementById("editCourseScheduleDaySelect")?.value || "Every Saturday";
    const start = document.getElementById("editCourseScheduleStartTime")?.value || "07:30";
    const end = document.getElementById("editCourseScheduleEndTime")?.value || "13:30";
    const liveTime = this.buildScheduleString(day, start, end);

    courses[index].title = title;
    courses[index].title_si = title;
    courses[index].examYear = examYear;
    courses[index].level = examYear;
    courses[index].category = document.getElementById("editCourseCategorySelect").value;
    courses[index].fee = document.getElementById("editCourseFeeInput").value.trim() || courses[index].fee;
    courses[index].liveTime = liveTime;
    courses[index].medium = document.getElementById("editCourseMediumInput").value.trim() || courses[index].medium;

    this.saveCoursesDatabase(courses);

    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.saveCourse === "function") {
      window.SUPABASE_HELPER.saveCourse(courses[index]);
    }

    if (window.showToast) {
      window.showToast(`✅ Course "${courses[index].title}" updated successfully!`, "success");
    }

    this.closeModal("editCourseModal");
    this.renderCourses();
    this.populateCourseDropdowns();
  },

  handleDeleteCourse(courseId) {
    const courses = this.getTeacherCourses();
    const c = courses.find(item => item.id === courseId);
    if (!c) return;

    if (confirm(`Are you sure you want to permanently delete course "${c.title}"?`)) {
      const updated = courses.filter(item => item.id !== courseId);
      this.saveCoursesDatabase(updated);

      // Cascade delete lessons belonging to this course
      try {
        const storedLessons = localStorage.getItem("edupeak_lessons_db");
        let lessons = storedLessons ? JSON.parse(storedLessons) : ((window.EDUPEAK_DATA && window.EDUPEAK_DATA.lmsLessons) ? window.EDUPEAK_DATA.lmsLessons : []);
        lessons = lessons.filter(l => l.courseId && l.courseId !== courseId && updated.some(uc => uc.id === l.courseId));
        this.saveLessonsDatabase(lessons);

        let customLessons = JSON.parse(localStorage.getItem(this.storageKeys.customLessons || "edupeak_custom_lessons") || "[]");
        customLessons = customLessons.filter(l => l.courseId && l.courseId !== courseId && updated.some(uc => uc.id === l.courseId));
        localStorage.setItem(this.storageKeys.customLessons || "edupeak_custom_lessons", JSON.stringify(customLessons));
      } catch (e) {}

      // Cascade delete quizzes belonging to this course
      try {
        const storedQuizzes = localStorage.getItem(this.storageKeys.quizzesDb || "edupeak_quizzes_db");
        let quizzes = storedQuizzes ? JSON.parse(storedQuizzes) : ((window.EDUPEAK_DATA && window.EDUPEAK_DATA.quizQuestions) ? window.EDUPEAK_DATA.quizQuestions : []);
        quizzes = quizzes.filter(q => q.courseId && q.courseId !== courseId && updated.some(uc => uc.id === q.courseId));
        this.saveQuizzesDatabase(quizzes);

        let customQuizzes = JSON.parse(localStorage.getItem(this.storageKeys.customQuizzes || "edupeak_custom_quizzes") || "[]");
        customQuizzes = customQuizzes.filter(q => q.courseId && q.courseId !== courseId && updated.some(uc => uc.id === q.courseId));
        localStorage.setItem(this.storageKeys.customQuizzes || "edupeak_custom_quizzes", JSON.stringify(customQuizzes));
      } catch (e) {}

      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.deleteCourse === "function") {
        window.SUPABASE_HELPER.deleteCourse(courseId);
      } else {
        try {
          const dels = JSON.parse(localStorage.getItem("edupeak_deleted_courses") || "[]");
          if (!dels.includes(courseId)) {
            dels.push(courseId);
            localStorage.setItem("edupeak_deleted_courses", JSON.stringify(dels));
          }
        } catch (e) {}
      }

      if (window.showToast) {
        window.showToast(`🗑️ Course "${c.title}" deleted along with associated lessons & quizzes.`, "info");
      }

      this.renderCourses();
      this.renderLessons();
      this.renderQuizzes();
      this.renderMetrics();
      this.populateCourseDropdowns();
    }
  },

  closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove("active");
  },

  handleCreateCourseSubmit(e) {
    e.preventDefault();
    const title = document.getElementById("courseTitleInput").value.trim();
    const examYear = document.getElementById("courseExamYearSelect") ? document.getElementById("courseExamYearSelect").value : "2026 A/L";
    const stream = document.getElementById("courseStreamSelect").value;
    const fee = document.getElementById("courseFeeInput").value.trim();
    
    const day = document.getElementById("courseScheduleDaySelect")?.value || "Every Saturday";
    const start = document.getElementById("courseScheduleStartTime")?.value || "07:30";
    const end = document.getElementById("courseScheduleEndTime")?.value || "13:30";
    const schedule = this.buildScheduleString(day, start, end);

    const icon = document.getElementById("courseIconSelect").value;

    const newCourse = {
      id: "crs-phy-" + Date.now().toString(36),
      title: title,
      title_si: title,
      teacherId: "tch-physics",
      teacherName: "Amalsha Wanniarachchi",
      examYear: examYear,
      stream: "Physical Science",
      stream_si: "භෞතික විද්‍යා අංශය",
      category: stream.includes("paper") ? "papers" : (stream.includes("rev") ? "revision" : "theory"),
      fee: fee ? (fee.startsWith("LKR") ? fee : `LKR ${fee} / Month`) : "LKR 3,500 / Month",
      liveTime: schedule,
      thumbnailIcon: icon || "fa-atom",
      medium: "Sinhala & English Medium",
      medium_si: "සිංහල හා ඉංග්‍රීසි මාධ්‍ය",
      level: examYear,
      level_si: "අ.පො.ස. උ/පෙළ",
      students: 1,
      rating: 5.0,
      modulesCount: 1,
      badge: `${examYear} Batch`,
      badge_si: `${examYear} කණ්ඩායම`
    };

    const courses = this.getTeacherCourses();
    courses.unshift(newCourse);
    this.saveCoursesDatabase(courses);

    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.saveCourse === "function") {
      window.SUPABASE_HELPER.saveCourse(newCourse);
    }

    if (window.showToast) {
      window.showToast(`🎉 New Course "${title}" created and published to LMS!`, "success");
    }

    this.closeModal("newCourseModal");
    this.renderCourses();
    this.renderMetrics();
    this.populateCourseDropdowns();
  },

  // --------------------------------------------------------------------------
  // 2. LESSONS & VIDEO MANAGEMENT
  // --------------------------------------------------------------------------
  getAllLessons() {
    const courses = this.getTeacherCourses();
    const validCourseIds = new Set(courses.map(c => c.id));
    if (courses.length === 0) {
      try {
        localStorage.setItem("edupeak_lessons_db", JSON.stringify([]));
        localStorage.setItem(this.storageKeys.customLessons || "edupeak_custom_lessons", JSON.stringify([]));
        if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.setSharedData === "function") {
          window.SUPABASE_HELPER.setSharedData("edupeak_lessons_db", []);
        }
      } catch (e) {}
      if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.lmsLessons = [];
      return [];
    }

    let lessons = null;
    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getSharedData === "function") {
      const shared = window.SUPABASE_HELPER.getSharedData("edupeak_lessons_db");
      if (shared !== null && Array.isArray(shared)) {
        lessons = shared;
      }
    }
    if (lessons === null) {
      const stored = localStorage.getItem("edupeak_lessons_db");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) lessons = parsed;
        } catch (e) {}
      }
    }
    if (lessons === null) {
      lessons = (window.EDUPEAK_DATA && window.EDUPEAK_DATA.lmsLessons) ? window.EDUPEAK_DATA.lmsLessons : [];
    }

    // Filter out any orphaned lessons whose courseId is not in validCourseIds
    lessons = lessons.filter(l => l.courseId && validCourseIds.has(l.courseId));
    try {
      localStorage.setItem("edupeak_lessons_db", JSON.stringify(lessons));
    } catch (e) {}
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.lmsLessons = lessons;
    }
    return lessons;
  },

  saveLessonsDatabase(lessonsList) {
    try {
      localStorage.setItem("edupeak_lessons_db", JSON.stringify(lessonsList));
    } catch (e) {}
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.lmsLessons = lessonsList;
    }
    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.setSharedData === "function") {
      window.SUPABASE_HELPER.setSharedData("edupeak_lessons_db", lessonsList);
    }
  },

  populateCourseDropdowns() {
    const courses = this.getTeacherCourses();
    const selects = [
      "lessonCourseSelect", 
      "quizCourseSelect", 
      "modalLessonCourseSelect", 
      "modalQuizCourseSelect", 
      "editModalLessonCourseSelect",
      "liveStudioCourseSelect",
      "editModalQuizCourseSelect"
    ];

    selects.forEach(sId => {
      const el = document.getElementById(sId);
      if (el) {
        const prevVal = el.value;
        const optionsHtml = courses.map(c => `<option value="${c.id}">${c.title}</option>`).join("");
        if (sId === "quizCourseSelect") {
          el.innerHTML = `<option value="all">🌟 All Courses & Batches (View All Questions)</option>` + optionsHtml;
        } else {
          el.innerHTML = optionsHtml;
        }
        if (prevVal && (prevVal === "all" || courses.find(c => c.id === prevVal))) {
          el.value = prevVal;
        }
      }
    });
  },

  renderLessons() {
    const tbody = document.getElementById("teacherLessonsTbody");
    if (!tbody) return;

    const courses = this.getTeacherCourses();
    if (!courses.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3rem; color: #64748b;">
            <i class="fa-solid fa-book-open" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">No Courses Published Yet</div>
            <p style="font-size: 0.825rem; margin-bottom: 1rem;">Please create and publish a course first to add lesson recordings.</p>
            <button class="btn btn-primary btn-sm" onclick="TEACHER_CONTROLLER.switchTab('courses'); TEACHER_CONTROLLER.openNewCourseModal();">
              <i class="fa-solid fa-plus"></i> Create Course First
            </button>
          </td>
        </tr>
      `;
      return;
    }

    const selectedCourseId = document.getElementById("lessonCourseSelect")?.value;
    const allLessons = this.getAllLessons();
    
    // Filter lessons by selected course
    const filteredLessons = selectedCourseId
      ? allLessons.filter(l => l.courseId === selectedCourseId)
      : allLessons;

    if (!filteredLessons.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3rem; color: #64748b;">
            <i class="fa-solid fa-film" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">No Lessons Uploaded for this Course Yet</div>
            <p style="font-size: 0.825rem; margin-bottom: 1rem;">Click "Add Lesson" to upload video lecture recordings, handouts, and chapter timestamps.</p>
            <button class="btn btn-primary btn-sm" onclick="TEACHER_CONTROLLER.openNewLessonModal()">
              <i class="fa-solid fa-plus"></i> Add Lesson to this Course
            </button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredLessons.map((l, idx) => `
      <tr>
        <td><strong>#${idx + 1}</strong></td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${l.title}</div>
          <div style="font-size: 0.75rem; color: #64748b;">${l.title_si || ''}</div>
        </td>
        <td>
          <button type="button" class="btn btn-sm" style="border-radius: 9999px; font-size: 0.775rem; background: #eff6ff; color: #227aff; border: 1px solid #bfdbfe; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; padding: 0.25rem 0.65rem;" onclick="TEACHER_CONTROLLER.openEditLessonModal('${l.id}')" title="Click to view & edit Chapter Timeline">
            <i class="fa-solid fa-list-ol"></i> ${(l.chapters && l.chapters.length) || 0} Chapters <i class="fa-solid fa-pen" style="font-size: 0.6rem; opacity: 0.7;"></i>
          </button>
        </td>
        <td><span class="status-tag active">${l.duration || '45 mins'}</span></td>
        <td>
          ${l.hasPdf ? (
            l.pdfUrl ?
              `<a href="${l.pdfUrl}" target="_blank" rel="noopener noreferrer" style="color: #059669; font-weight: 600; font-size: 0.8rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem;" title="Open in Google Drive / PDF Viewer">
                <i class="fa-brands fa-google-drive" style="color: #0f9d58;"></i>
                <span>${l.pdfName || 'Notes.pdf'}</span>
                <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.65rem; color: #64748b;"></i>
              </a>` :
              `<span style="color: #10b981; font-weight: 600; font-size: 0.8rem;"><i class="fa-solid fa-file-pdf"></i> ${l.pdfName || 'Notes.pdf'}</span>`
          ) : '<span style="color: #94a3b8; font-size: 0.8rem;">No Handout</span>'}
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="TEACHER_CONTROLLER.openEditLessonModal('${l.id}')" title="Edit Lesson & Chapters">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
            <button class="btn btn-ghost btn-sm" style="color: #ef4444; border: 1px solid #fecaca; font-size: 0.75rem; padding: 0.3rem 0.5rem;" onclick="TEACHER_CONTROLLER.handleDeleteLesson('${l.id}')" title="Delete Lesson">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join("");
  },

  // --------------------------------------------------------------------------
  // YOUTUBE VIDEO DURATION AUTO-DETECTION ENGINE
  // --------------------------------------------------------------------------
  extractYouTubeVideoId(url) {
    if (!url) return null;
    const trimmed = String(url).trim();
    if (trimmed.length === 11 && !trimmed.includes("/") && !trimmed.includes(".")) {
      return trimmed;
    }
    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    return match ? match[1] : null;
  },

  formatDurationFromSeconds(seconds) {
    if (!seconds || isNaN(seconds) || seconds <= 0) return "50 mins";
    const totalSecs = Math.round(seconds);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.round((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (hrs > 0) {
      if (mins === 0) return `${hrs}h`;
      return `${hrs}h ${mins < 10 ? '0' : ''}${mins}m`;
    } else if (mins > 0) {
      return `${mins} mins`;
    } else {
      return `${secs} secs`;
    }
  },

  initYouTubeDurationProbe() {
    if (this._ytProbeInitialized) return;
    this._ytProbeInitialized = true;

    if (!document.getElementById("ytDurationProbeMount")) {
      const probeDiv = document.createElement("div");
      probeDiv.id = "ytDurationProbeMount";
      probeDiv.style.cssText = "position: fixed; left: -9999px; top: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none; z-index: -1;";
      document.body.appendChild(probeDiv);
    }

    const onApiReady = () => {
      try {
        if (!this._probePlayer && window.YT && window.YT.Player) {
          this._probePlayer = new window.YT.Player("ytDurationProbeMount", {
            height: "1",
            width: "1",
            videoId: "dQw4w9WgXcQ",
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              mute: 1,
              rel: 0,
              playsinline: 1
            },
            events: {
              onReady: () => {
                this._probePlayerReady = true;
                if (this._pendingProbeVideoId) {
                  const pending = this._pendingProbeVideoId;
                  this._pendingProbeVideoId = null;
                  this.probeVideoDuration(pending.videoId, pending.callback);
                }
              }
            }
          });
        }
      } catch (e) {
        console.warn("YouTube probe player initialization notice:", e);
      }
    };

    if (!window.YT) {
      const tag = document.createElement("script");
      tag.id = "yt-duration-probe-script";
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }

      const prevHandler = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prevHandler === "function") prevHandler();
        onApiReady();
      };
    } else if (window.YT && window.YT.Player) {
      onApiReady();
    }
  },

  probeVideoDuration(videoId, callback) {
    if (!videoId) return;
    this.initYouTubeDurationProbe();

    if (!this._probePlayerReady || !this._probePlayer) {
      this._pendingProbeVideoId = { videoId, callback };
      return;
    }

    try {
      this._probePlayer.mute();
      this._probePlayer.cueVideoById(videoId);
      
      let checkCount = 0;
      const interval = setInterval(() => {
        checkCount++;
        try {
          const duration = this._probePlayer.getDuration();
          if (duration && duration > 0) {
            clearInterval(interval);
            callback(duration);
            return;
          }
        } catch (e) {}

        if (checkCount > 40) {
          clearInterval(interval);
        }
      }, 100);
    } catch (err) {
      console.warn("Probing YouTube duration error:", err);
    }
  },

  autoDetectDuration(urlInputId, durationInputId, badgeId) {
    const urlInput = document.getElementById(urlInputId);
    const durInput = document.getElementById(durationInputId);
    const badge = document.getElementById(badgeId);
    if (!urlInput || !durInput) return;

    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
      if (badge) badge.innerHTML = "";
      return;
    }

    const videoId = this.extractYouTubeVideoId(rawUrl);
    if (videoId) {
      if (badge) {
        badge.innerHTML = `<span style="color: #227aff; display: inline-flex; align-items: center; gap: 0.25rem;"><i class="fa-solid fa-spinner fa-spin"></i> Detecting...</span>`;
      }
      this.probeVideoDuration(videoId, (durationSecs) => {
        if (durationSecs && durationSecs > 0) {
          const formatted = this.formatDurationFromSeconds(durationSecs);
          durInput.value = formatted;
          if (badge) {
            badge.innerHTML = `<span style="color: #10b981; display: inline-flex; align-items: center; gap: 0.25rem;"><i class="fa-solid fa-wand-magic-sparkles"></i> Auto-calculated (${formatted})</span>`;
          }
        }
      });
    } else if (rawUrl.match(/\.(mp4|webm|ogg|m3u8)(\?.*)?$/i)) {
      if (badge) {
        badge.innerHTML = `<span style="color: #227aff; display: inline-flex; align-items: center; gap: 0.25rem;"><i class="fa-solid fa-spinner fa-spin"></i> Detecting...</span>`;
      }
      const v = document.createElement("video");
      v.preload = "metadata";
      v.src = rawUrl;
      v.onloadedmetadata = () => {
        if (v.duration && v.duration > 0) {
          const formatted = this.formatDurationFromSeconds(v.duration);
          durInput.value = formatted;
          if (badge) {
            badge.innerHTML = `<span style="color: #10b981; display: inline-flex; align-items: center; gap: 0.25rem;"><i class="fa-solid fa-wand-magic-sparkles"></i> Auto-calculated (${formatted})</span>`;
          }
        }
      };
      v.onerror = () => {
        if (badge) badge.innerHTML = "";
      };
    } else {
      if (badge) badge.innerHTML = "";
    }
  },

  openNewLessonModal() {
    const selectedCourseId = document.getElementById("lessonCourseSelect")?.value;
    const modalSelect = document.getElementById("modalLessonCourseSelect");
    if (modalSelect && selectedCourseId) {
      modalSelect.value = selectedCourseId;
    }
    if (document.getElementById("lessonWatermarkCheckbox")) {
      document.getElementById("lessonWatermarkCheckbox").checked = false; // Disabled by default
    }
    if (document.getElementById("lessonHasPdfCheckbox")) {
      document.getElementById("lessonHasPdfCheckbox").checked = true;
    }
    if (document.getElementById("lessonPdfFieldsRow")) {
      document.getElementById("lessonPdfFieldsRow").style.display = "grid";
    }
    if (document.getElementById("lessonPdfNameInput")) {
      document.getElementById("lessonPdfNameInput").value = "Lesson_Summary_Notes.pdf";
    }
    if (document.getElementById("lessonPdfUrlInput")) {
      document.getElementById("lessonPdfUrlInput").value = "";
    }
    const container = document.getElementById("newLessonChaptersContainer");
    if (container) {
      container.innerHTML = "";
    }
    if (document.getElementById("newLessonDurationAutoBadge")) {
      document.getElementById("newLessonDurationAutoBadge").innerHTML = "";
    }

    document.getElementById("newLessonModal").classList.add("active");

    // Auto-detect duration from current initial video URL
    setTimeout(() => {
      this.autoDetectDuration("lessonVideoUrlInput", "lessonDurationInput", "newLessonDurationAutoBadge");
    }, 150);
  },

  addChapterRowToNewModal(timeVal = "00:00", titleVal = "") {
    const container = document.getElementById("newLessonChaptersContainer");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "chapter-edit-row";
    row.style.cssText = "display: flex; gap: 0.5rem; align-items: center;";
    row.innerHTML = `
      <input type="text" class="form-control chapter-time-input" placeholder="00:00" value="${timeVal}" style="width: 85px; font-family: monospace; font-weight: 700; text-align: center; padding: 0.35rem 0.5rem; font-size: 0.85rem;" required>
      <input type="text" class="form-control chapter-title-input" placeholder="Chapter Topic Title" value="${titleVal}" style="flex: 1; padding: 0.35rem 0.6rem; font-size: 0.85rem;" required>
      <button type="button" class="btn btn-ghost btn-sm" style="color: #ef4444; padding: 0.35rem 0.5rem;" onclick="this.closest('.chapter-edit-row').remove()" title="Delete Marker">
        <i class="fa-solid fa-times"></i>
      </button>
    `;
    container.appendChild(row);
  },

  openEditLessonModal(lessonId) {
    const lessons = this.getAllLessons();
    const l = lessons.find(item => item.id === lessonId);
    if (!l) return;

    this.currentEditingLessonId = lessonId;
    const idInput = document.getElementById("editLessonIdInput");
    if (idInput) idInput.value = l.id;

    // Populate course selector
    const courses = this.getTeacherCourses();
    const sel = document.getElementById("editModalLessonCourseSelect");
    if (sel) {
      sel.innerHTML = courses.map(c => `<option value="${c.id}" ${c.id === l.courseId ? 'selected' : ''}>${c.title}</option>`).join("");
    }

    const titleInput = document.getElementById("editLessonTitleInput");
    const durInput = document.getElementById("editLessonDurationInput");
    const videoInput = document.getElementById("editLessonVideoUrlInput");
    const pdfInput = document.getElementById("editLessonPdfNameInput");
    const pdfUrlInput = document.getElementById("editLessonPdfUrlInput");
    const hasPdfCheckbox = document.getElementById("editLessonHasPdfCheckbox");
    const pdfFieldsRow = document.getElementById("editLessonPdfFieldsRow");

    if (titleInput) titleInput.value = l.title || l.title_si || "";
    if (durInput) durInput.value = l.duration || "50 mins";
    if (videoInput) videoInput.value = l.videoUrl || "";
    
    const isPdfActive = Boolean(l.hasPdf || l.pdfName || l.pdfUrl);
    if (hasPdfCheckbox) hasPdfCheckbox.checked = isPdfActive;
    if (pdfFieldsRow) pdfFieldsRow.style.display = isPdfActive ? "grid" : "none";
    if (pdfInput) pdfInput.value = l.pdfName || "";
    if (pdfUrlInput) pdfUrlInput.value = l.pdfUrl || "";

    if (document.getElementById("editLessonWatermarkCheckbox")) {
      document.getElementById("editLessonWatermarkCheckbox").checked = Boolean(l.watermarkEnabled);
    }
    if (document.getElementById("editLessonDurationAutoBadge")) {
      document.getElementById("editLessonDurationAutoBadge").innerHTML = "";
    }

    // Populate Chapter timeline rows
    const container = document.getElementById("editLessonChaptersContainer");
    if (container) {
      container.innerHTML = "";
      const chapters = l.chapters || [];
      chapters.forEach(ch => {
        this.addChapterRowToEditModal(ch.time, ch.title);
      });
    }

    const modal = document.getElementById("editLessonModal");
    if (modal) modal.classList.add("active");
  },

  addChapterRowToEditModal(timeVal = "00:00", titleVal = "") {
    const container = document.getElementById("editLessonChaptersContainer");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "chapter-edit-row";
    row.style.cssText = "display: flex; gap: 0.5rem; align-items: center;";
    row.innerHTML = `
      <input type="text" class="form-control chapter-time-input" placeholder="00:00" value="${timeVal}" style="width: 85px; font-family: monospace; font-weight: 700; text-align: center; padding: 0.35rem 0.5rem; font-size: 0.85rem;" required>
      <input type="text" class="form-control chapter-title-input" placeholder="Chapter Topic Title" value="${titleVal}" style="flex: 1; padding: 0.35rem 0.6rem; font-size: 0.85rem;" required>
      <button type="button" class="btn btn-ghost btn-sm" style="color: #ef4444; padding: 0.35rem 0.5rem;" onclick="this.closest('.chapter-edit-row').remove()" title="Delete Marker">
        <i class="fa-solid fa-times"></i>
      </button>
    `;
    container.appendChild(row);
  },

  handleEditLessonSubmit(e) {
    e.preventDefault();
    const lessonId = document.getElementById("editLessonIdInput").value;
    const lessons = this.getAllLessons();
    const lIdx = lessons.findIndex(item => item.id === lessonId);
    if (lIdx === -1) return;

    const courseId = document.getElementById("editModalLessonCourseSelect").value;
    const title = document.getElementById("editLessonTitleInput").value.trim();
    const duration = document.getElementById("editLessonDurationInput").value.trim();
    const rawVideoUrl = document.getElementById("editLessonVideoUrlInput").value.trim();
    const hasPdfChecked = document.getElementById("editLessonHasPdfCheckbox") ? document.getElementById("editLessonHasPdfCheckbox").checked : true;
    const pdfName = document.getElementById("editLessonPdfNameInput")?.value.trim() || "";
    const pdfUrl = document.getElementById("editLessonPdfUrlInput")?.value.trim() || "";
    const hasPdf = hasPdfChecked && Boolean(pdfName || pdfUrl);
    const watermarkEnabled = Boolean(document.getElementById("editLessonWatermarkCheckbox")?.checked);
    const videoUrl = this.formatEmbedUrl(rawVideoUrl, "youtube");

    // Collect chapters
    const chapters = [];
    const chapterRows = document.querySelectorAll("#editLessonChaptersContainer .chapter-edit-row");
    chapterRows.forEach(row => {
      const time = row.querySelector(".chapter-time-input")?.value.trim() || "00:00";
      const chTitle = row.querySelector(".chapter-title-input")?.value.trim() || "";
      if (chTitle) {
        chapters.push({ time, title: chTitle });
      }
    });

    lessons[lIdx] = {
      ...lessons[lIdx],
      courseId,
      title,
      title_si: title,
      duration: duration || "50 mins",
      videoUrl,
      hasPdf: hasPdf,
      pdfName: hasPdf ? (pdfName || (pdfUrl ? "Handout_Notes.pdf" : "Notes.pdf")) : "",
      pdfUrl: hasPdf ? pdfUrl : "",
      watermarkEnabled,
      chapters
    };

    this.saveLessonsDatabase(lessons);

    if (window.showToast) {
      window.showToast(`✅ Lesson "${title}" and chapter timeline updated!`, "success");
    }

    this.closeModal("editLessonModal");
    this.renderLessons();
    this.renderMetrics();
  },

  handleDeleteLesson(lessonId) {
    const lessons = this.getAllLessons();
    const l = lessons.find(item => item.id === lessonId);
    if (!l) return;

    if (confirm(`Are you sure you want to permanently delete lesson "${l.title}"?`)) {
      const updated = lessons.filter(item => item.id !== lessonId);
      this.saveLessonsDatabase(updated);

      if (window.showToast) {
        window.showToast(`🗑️ Lesson "${l.title}" deleted from syllabus.`, "info");
      }

      this.renderLessons();
      this.renderMetrics();
    }
  },

  handleDeleteCurrentEditingLesson() {
    if (this.currentEditingLessonId) {
      this.closeModal("editLessonModal");
      this.handleDeleteLesson(this.currentEditingLessonId);
    }
  },

  quickAddLessonForCourse(courseId) {
    this.switchTab("lessons");
    const select = document.getElementById("lessonCourseSelect");
    if (select) select.value = courseId;
    this.renderLessons();
    this.openNewLessonModal();
  },

  handleCreateLessonSubmit(e) {
    e.preventDefault();
    const courseId = document.getElementById("modalLessonCourseSelect").value;
    const title = document.getElementById("lessonTitleInput").value.trim();
    const rawVideoUrl = document.getElementById("lessonVideoUrlInput").value.trim();
    const duration = document.getElementById("lessonDurationInput").value.trim();
    const hasPdf = document.getElementById("lessonHasPdfCheckbox")?.checked;
    const pdfName = document.getElementById("lessonPdfNameInput")?.value.trim() || "";
    const pdfUrl = document.getElementById("lessonPdfUrlInput")?.value.trim() || "";
    const shouldHavePdf = hasPdf && Boolean(pdfName || pdfUrl);
    const watermarkEnabled = Boolean(document.getElementById("lessonWatermarkCheckbox")?.checked);

    const videoUrl = this.formatEmbedUrl(rawVideoUrl, "youtube");

    // Collect chapters from newLessonChaptersContainer
    const chapters = [];
    const chapterRows = document.querySelectorAll("#newLessonChaptersContainer .chapter-edit-row");
    chapterRows.forEach(row => {
      const time = row.querySelector(".chapter-time-input")?.value.trim() || "00:00";
      const chTitle = row.querySelector(".chapter-title-input")?.value.trim() || "";
      if (chTitle) {
        chapters.push({ time, title: chTitle });
      }
    });

    const newLesson = {
      id: "lsn-" + Date.now().toString(36),
      courseId: courseId,
      title: title,
      title_si: title,
      duration: duration || "50 mins",
      videoUrl: videoUrl,
      hasPdf: shouldHavePdf,
      pdfName: shouldHavePdf ? (pdfName || (pdfUrl ? `${title} Handout.pdf` : `${title} Summary Sheet.pdf`)) : "",
      pdfUrl: shouldHavePdf ? pdfUrl : "",
      watermarkEnabled: watermarkEnabled,
      chapters: chapters
    };

    // Save to Database
    const lessons = this.getAllLessons();
    lessons.push(newLesson);
    this.saveLessonsDatabase(lessons);

    if (window.showToast) {
      window.showToast(`✓ Lesson "${title}" published successfully!`, "success");
    }

    this.closeModal("newLessonModal");

    // Switch view to the course where lesson was added
    const select = document.getElementById("lessonCourseSelect");
    if (select) select.value = courseId;

    this.renderLessons();
    this.renderMetrics();
  },

  // --------------------------------------------------------------------------
  // 3. QUIZ & MCQ PAPER BUILDER (CREATE, EDIT, DELETE)
  // --------------------------------------------------------------------------
  getAllQuizzes() {
    const courses = this.getTeacherCourses();
    const validCourseIds = new Set(courses.map(c => c.id));
    if (courses.length === 0) {
      try {
        localStorage.setItem(this.storageKeys.quizzesDb, JSON.stringify([]));
        localStorage.setItem(this.storageKeys.customQuizzes, JSON.stringify([]));
        if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.setSharedData === "function") {
          window.SUPABASE_HELPER.setSharedData(this.storageKeys.quizzesDb || "edupeak_quizzes_db", []);
        }
      } catch (e) {}
      if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.quizQuestions = [];
      return [];
    }

    let quizzes = null;
    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getSharedData === "function") {
      const shared = window.SUPABASE_HELPER.getSharedData(this.storageKeys.quizzesDb || "edupeak_quizzes_db");
      if (shared !== null && Array.isArray(shared)) {
        quizzes = shared;
      }
    }
    if (quizzes === null) {
      const stored = localStorage.getItem(this.storageKeys.quizzesDb);
      if (stored !== null) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            quizzes = parsed;
          }
        } catch (e) {
          console.warn("Failed parsing edupeak_quizzes_db", e);
        }
      }
    }
    if (quizzes === null) {
      quizzes = (window.EDUPEAK_DATA && window.EDUPEAK_DATA.quizQuestions) 
        ? JSON.parse(JSON.stringify(window.EDUPEAK_DATA.quizQuestions)) 
        : [];

      try {
        const custom = JSON.parse(localStorage.getItem(this.storageKeys.customQuizzes) || "[]");
        custom.forEach(cq => {
          if (!quizzes.find(item => item.id == cq.id)) {
            quizzes.push(cq);
          }
        });
      } catch (e) {}
    }

    // Ensure all items have an id and normalized courseId
    quizzes.forEach((q, idx) => {
      if (!q.id) q.id = idx + 1;
      if (q.courseId === "crs-phy-2025") q.courseId = "crs-phy-2027-theory";
      if (q.courseId === "crs-phy-2026") q.courseId = "crs-phy-2028-theory";
    });

    quizzes = quizzes.filter(q => q.courseId && validCourseIds.has(q.courseId));

    try {
      localStorage.setItem(this.storageKeys.quizzesDb, JSON.stringify(quizzes));
    } catch (e) {}
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.quizQuestions = quizzes;
    }
    return quizzes;
  },

  saveQuizzesDatabase(quizzesList) {
    try {
      localStorage.setItem(this.storageKeys.quizzesDb, JSON.stringify(quizzesList));
      localStorage.setItem(this.storageKeys.customQuizzes, JSON.stringify(quizzesList));
    } catch (e) {}
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.quizQuestions = quizzesList;
    }
    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.setSharedData === "function") {
      window.SUPABASE_HELPER.setSharedData(this.storageKeys.quizzesDb || "edupeak_quizzes_db", quizzesList);
    }
  },

  renderQuizzes() {
    const list = document.getElementById("teacherQuizList");
    if (!list) return;

    const courses = this.getTeacherCourses();
    if (!courses.length) {
      list.innerHTML = `
        <div style="text-align: center; padding: 3rem; background: #f8fafc; border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
          <i class="fa-solid fa-book-open" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">No Courses Published Yet</div>
          <p style="font-size: 0.825rem; color: #64748b; margin-bottom: 1rem;">Please create and publish a course first to add MCQ quiz questions.</p>
          <button class="btn btn-primary btn-sm" onclick="TEACHER_CONTROLLER.switchTab('courses'); TEACHER_CONTROLLER.openNewCourseModal();">
            <i class="fa-solid fa-plus"></i> Create Course First
          </button>
        </div>
      `;
      return;
    }

    const selectedCourseId = document.getElementById("quizCourseSelect")?.value;
    const questions = this.getAllQuizzes();

    // Filter questions by selected course
    const filteredQuestions = (selectedCourseId && selectedCourseId !== "all")
      ? questions.filter(q => {
          if (!q.courseId) return false;
          if (q.courseId === selectedCourseId) return true;
          if (q.courseId.startsWith(selectedCourseId) || selectedCourseId.startsWith(q.courseId)) return true;
          const cleanQ = (q.courseId || "").replace("-theory", "").replace("-revision", "").replace("-papers", "");
          const cleanSel = (selectedCourseId || "").replace("-theory", "").replace("-revision", "").replace("-papers", "");
          return cleanQ === cleanSel;
        })
      : questions;

    if (!filteredQuestions.length) {
      list.innerHTML = `
        <div style="text-align: center; padding: 3rem; background: #f8fafc; border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
          <i class="fa-solid fa-clipboard-question" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">No MCQ Questions Added for this Course Yet</div>
          <p style="font-size: 0.825rem; color: #64748b; margin-bottom: 1rem;">Create online timed MCQs with 4 options and automatic grading solutions.</p>
          <button class="btn btn-primary btn-sm" onclick="TEACHER_CONTROLLER.openNewQuizModal()">
            <i class="fa-solid fa-plus"></i> Add First MCQ Question
          </button>
        </div>
      `;
      return;
    }

    list.innerHTML = filteredQuestions.map((q, idx) => `
      <div class="quiz-question-builder-card" id="quizCard_${q.id}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span style="font-size: 0.75rem; font-weight: 700; color: #227aff; background: #eff6ff; padding: 0.2rem 0.5rem; border-radius: 6px;">
              Question #${idx + 1} (${q.subject || 'Speed Exam'})
            </span>
            <span style="font-size: 0.75rem; color: #10b981; font-weight: 700; background: #ecfdf5; padding: 0.2rem 0.5rem; border-radius: 6px;">
              <i class="fa-solid fa-check"></i> Option ${q.correctAnswer + 1} (${String.fromCharCode(65 + q.correctAnswer)})
            </span>
          </div>
          <div style="display: flex; gap: 0.35rem; align-items: center;">
            <button type="button" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 0.3rem 0.65rem;" onclick="TEACHER_CONTROLLER.openEditQuizModal('${q.id}')" title="Edit Question">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
            <button type="button" class="btn btn-ghost btn-sm" style="color: #ef4444; border: 1px solid #fecaca; font-size: 0.75rem; padding: 0.3rem 0.55rem;" onclick="TEACHER_CONTROLLER.handleDeleteQuiz('${q.id}')" title="Delete Question">
              <i class="fa-solid fa-trash"></i> Delete
            </button>
          </div>
        </div>
        <h4 style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">${q.question}</h4>
        ${q.question_si ? `<p style="font-size: 0.825rem; color: #64748b; margin-bottom: 0.75rem;">${q.question_si}</p>` : ''}
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.8rem; margin-bottom: 0.75rem;">
          ${(q.options || []).map((opt, optIdx) => `
            <div style="padding: 0.4rem 0.65rem; border-radius: 6px; background: ${optIdx === q.correctAnswer ? '#dcfce7; border: 1px solid #86efac; font-weight: 700; color: #166534;' : '#ffffff; border: 1px solid #e2e8f0; color: #334155;'}">
              (${String.fromCharCode(65 + optIdx)}) ${opt}
            </div>
          `).join("")}
        </div>

        <div style="font-size: 0.775rem; color: #475569; background: #ffffff; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #e2e8f0;">
          <strong>💡 Explanation:</strong> ${q.explanation || q.explanation_si || 'Step-by-step evaluation.'}
        </div>
      </div>
    `).join("");
  },

  openNewQuizModal() {
    const selectedCourseId = document.getElementById("quizCourseSelect")?.value;
    const modalSelect = document.getElementById("modalQuizCourseSelect");
    if (modalSelect) {
      if (selectedCourseId && selectedCourseId !== "all" && Array.from(modalSelect.options).some(o => o.value === selectedCourseId)) {
        modalSelect.value = selectedCourseId;
      } else if (modalSelect.options.length > 0) {
        modalSelect.selectedIndex = 0;
      }
    }
    document.getElementById("newQuizModal").classList.add("active");
  },

  quickAddQuizForCourse(courseId) {
    this.switchTab("quizzes");
    const select = document.getElementById("quizCourseSelect");
    if (select) select.value = courseId;
    this.renderQuizzes();
    this.openNewQuizModal();
  },

  openEditQuizModal(quizId) {
    const questions = this.getAllQuizzes();
    const q = questions.find(item => item.id == quizId);
    if (!q) {
      if (window.showToast) window.showToast("Question not found.", "error");
      return;
    }

    this.currentEditingQuizId = q.id;
    document.getElementById("editQuizIdInput").value = q.id;
    
    const courseSelect = document.getElementById("editModalQuizCourseSelect");
    if (courseSelect) {
      const match = Array.from(courseSelect.options).find(opt => 
        opt.value === q.courseId || 
        opt.value.startsWith(q.courseId) || 
        (q.courseId && q.courseId.startsWith(opt.value))
      );
      if (match) {
        courseSelect.value = match.value;
      } else if (courseSelect.options.length > 0) {
        courseSelect.selectedIndex = 0;
      }
    }

    document.getElementById("editQuizSubjectInput").value = q.subject || "Physics - Mechanics";
    document.getElementById("editQuizQTextInput").value = q.question || "";
    document.getElementById("editQuizQTextSiInput").value = q.question_si || "";
    
    const opts = q.options || ["", "", "", ""];
    document.getElementById("editQuizOptAInput").value = opts[0] || "";
    document.getElementById("editQuizOptBInput").value = opts[1] || "";
    document.getElementById("editQuizOptCInput").value = opts[2] || "";
    document.getElementById("editQuizOptDInput").value = opts[3] || "";

    document.getElementById("editQuizCorrectSelect").value = (q.correctAnswer !== undefined) ? q.correctAnswer : 0;
    document.getElementById("editQuizExplanationInput").value = q.explanation || q.explanation_si || "";

    document.getElementById("editQuizModal").classList.add("active");
  },

  handleEditQuizSubmit(e) {
    e.preventDefault();
    const quizId = document.getElementById("editQuizIdInput").value;
    const questions = this.getAllQuizzes();
    const idx = questions.findIndex(item => item.id == quizId);
    if (idx === -1) return;

    const courseId = document.getElementById("editModalQuizCourseSelect").value;
    const subject = document.getElementById("editQuizSubjectInput").value.trim();
    const qText = document.getElementById("editQuizQTextInput").value.trim();
    const qTextSi = document.getElementById("editQuizQTextSiInput").value.trim();
    const optA = document.getElementById("editQuizOptAInput").value.trim();
    const optB = document.getElementById("editQuizOptBInput").value.trim();
    const optC = document.getElementById("editQuizOptCInput").value.trim();
    const optD = document.getElementById("editQuizOptDInput").value.trim();
    const correctIdx = parseInt(document.getElementById("editQuizCorrectSelect").value, 10);
    const explanation = document.getElementById("editQuizExplanationInput").value.trim();

    questions[idx] = {
      ...questions[idx],
      courseId: courseId,
      subject: subject || "Physics",
      question: qText,
      question_si: qTextSi || qText,
      options: [optA, optB, optC, optD],
      options_si: [optA, optB, optC, optD],
      correctAnswer: correctIdx,
      explanation: explanation || "Step-by-step evaluation.",
      explanation_si: explanation || "පියවරෙන් පියවර විවරණය."
    };

    this.saveQuizzesDatabase(questions);

    if (window.showToast) {
      window.showToast("✓ MCQ Question updated successfully!", "success");
    }

    this.closeModal("editQuizModal");
    this.renderQuizzes();
    this.renderMetrics();
  },

  handleDeleteQuiz(quizId) {
    const questions = this.getAllQuizzes();
    const q = questions.find(item => item.id == quizId);
    if (!q) return;

    const previewSnippet = q.question.length > 40 ? q.question.substring(0, 40) + "..." : q.question;
    if (confirm(`Are you sure you want to permanently delete this question?\n"${previewSnippet}"`)) {
      const updated = questions.filter(item => item.id != quizId);
      this.saveQuizzesDatabase(updated);

      if (window.showToast) {
        window.showToast("🗑️ MCQ Question deleted successfully.", "info");
      }

      this.renderQuizzes();
      this.renderMetrics();
    }
  },

  handleDeleteCurrentEditingQuiz() {
    const id = document.getElementById("editQuizIdInput")?.value;
    if (id) {
      this.closeModal("editQuizModal");
      this.handleDeleteQuiz(id);
    }
  },

  handleCreateQuizSubmit(e) {
    e.preventDefault();
    const courseId = document.getElementById("modalQuizCourseSelect").value;
    const subject = document.getElementById("quizSubjectInput").value.trim();
    const qText = document.getElementById("quizQTextInput").value.trim();
    const qTextSi = document.getElementById("quizQTextSiInput").value.trim();
    const optA = document.getElementById("quizOptAInput").value.trim();
    const optB = document.getElementById("quizOptBInput").value.trim();
    const optC = document.getElementById("quizOptCInput").value.trim();
    const optD = document.getElementById("quizOptDInput").value.trim();
    const correctIdx = parseInt(document.getElementById("quizCorrectSelect").value, 10);
    const explanation = document.getElementById("quizExplanationInput").value.trim();

    const newQuestion = {
      id: Date.now(),
      courseId: courseId,
      subject: subject || "Physics",
      subject_si: "භෞතික විද්‍යාව",
      question: qText,
      question_si: qTextSi || qText,
      options: [optA, optB, optC, optD],
      options_si: [optA, optB, optC, optD],
      correctAnswer: correctIdx,
      explanation: explanation || "Step-by-step evaluation.",
      explanation_si: explanation || "පියවරෙන් පියවර විවරණය."
    };

    const questions = this.getAllQuizzes();
    questions.push(newQuestion);
    this.saveQuizzesDatabase(questions);

    if (window.showToast) {
      window.showToast("✓ MCQ Question added and synchronized with Speed Exam Engine!", "success");
    }

    this.closeModal("newQuizModal");

    // Select the course in dropdown and re-render
    const select = document.getElementById("quizCourseSelect");
    if (select) select.value = courseId;

    this.renderQuizzes();
    this.renderMetrics();
  },

  // --------------------------------------------------------------------------
  // 3.5. PAST PAPERS & PDF VAULT MANAGEMENT (Connected with Supabase & Students)
  // --------------------------------------------------------------------------
  async getPapers() {
    const deletedIds = (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getDeletedPapers === "function")
      ? window.SUPABASE_HELPER.getDeletedPapers()
      : JSON.parse(localStorage.getItem("edupeak_deleted_papers") || "[]");
    const filterDeleted = (list) => Array.isArray(list) ? list.filter(p => p && !deletedIds.includes(p.id) && !deletedIds.includes(String(p.id))) : [];

    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getPapers === "function") {
      const papers = await window.SUPABASE_HELPER.getPapers();
      return filterDeleted(papers);
    }
    const saved = localStorage.getItem(this.storageKeys.papers || "edupeak_papers_db");
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return filterDeleted(parsed);
      } catch (e) {}
    }
    return [];
  },

  parsePdfCloudUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") {
      return {
        type: "local",
        label: "Local PDF Asset",
        icon: "fa-solid fa-file-pdf",
        badgeClass: "local",
        previewUrl: rawUrl || "assets/docs/physics_sample.pdf",
        downloadUrl: rawUrl || "assets/docs/physics_sample.pdf",
        viewUrl: rawUrl || "assets/docs/physics_sample.pdf",
        rawUrl: rawUrl || ""
      };
    }

    const url = rawUrl.trim();

    // 1. Google Drive Links: /file/d/{id}, id={id}, /d/{id}
    const gDriveFileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i) || 
                            url.match(/[?&]id=([a-zA-Z0-9_-]+)/i) ||
                            url.match(/\/d\/([a-zA-Z0-9_-]+)/i);

    if (url.includes("drive.google.com") || url.includes("docs.google.com") || (url.startsWith("http") && gDriveFileMatch)) {
      const fileId = gDriveFileMatch ? gDriveFileMatch[1] : null;
      if (fileId) {
        return {
          type: "gdrive",
          label: "Google Drive Cloud",
          icon: "fa-brands fa-google-drive",
          badgeClass: "gdrive",
          fileId: fileId,
          previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
          downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
          viewUrl: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`,
          rawUrl: url
        };
      }
    }

    // 2. Google Cloud Storage (GCS) Links
    if (url.startsWith("gs://") || url.includes("storage.googleapis.com") || url.includes("storage.cloud.google.com")) {
      let httpUrl = url;
      if (url.startsWith("gs://")) {
        const gcsPath = url.replace("gs://", "");
        httpUrl = `https://storage.googleapis.com/${gcsPath}`;
      } else if (url.includes("storage.cloud.google.com")) {
        httpUrl = url.replace("storage.cloud.google.com", "storage.googleapis.com");
      }

      return {
        type: "gcs",
        label: "Google Cloud Storage",
        icon: "fa-brands fa-google",
        badgeClass: "gcs",
        previewUrl: `https://docs.google.com/viewer?url=${encodeURIComponent(httpUrl)}&embedded=true`,
        directEmbedUrl: httpUrl,
        downloadUrl: httpUrl,
        viewUrl: httpUrl,
        rawUrl: httpUrl
      };
    }

    // 3. Supabase / Firebase / Cloud Storage URLs
    if (url.startsWith("http://") || url.startsWith("https://")) {
      let isSupabase = url.includes("supabase.co/storage");
      let isFirebase = url.includes("firebasestorage.googleapis.com");
      let label = isSupabase ? "Supabase Storage" : (isFirebase ? "Firebase Cloud" : "Cloud PDF URL");
      let icon = isSupabase ? "fa-solid fa-database" : (isFirebase ? "fa-solid fa-fire" : "fa-solid fa-cloud");

      return {
        type: "cloud",
        label: label,
        icon: icon,
        badgeClass: "cloud",
        previewUrl: `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`,
        directEmbedUrl: url,
        downloadUrl: url,
        viewUrl: url,
        rawUrl: url
      };
    }

    // 4. Local Relative Path or Blob
    return {
      type: "local",
      label: "Local Asset PDF",
      icon: "fa-solid fa-file-pdf",
      badgeClass: "local",
      previewUrl: url,
      downloadUrl: url,
      viewUrl: url,
      rawUrl: url
    };
  },

  onPaperUrlInput(input) {
    const badge = document.getElementById("teacherPaperCloudDetectBadge");
    if (!badge) return;
    const val = (input.value || "").trim();
    if (!val) {
      badge.style.display = "none";
      return;
    }

    const cloudInfo = this.parsePdfCloudUrl(val);
    badge.style.display = "inline-flex";
    badge.className = `pdf-cloud-badge ${cloudInfo.badgeClass}`;
    badge.innerHTML = `<i class="${cloudInfo.icon}"></i> ${cloudInfo.label} Detected`;
  },

  fillSampleGoogleDriveLink() {
    const urlInput = document.getElementById("teacherPaperFormUrl");
    if (!urlInput) return;
    urlInput.value = "https://drive.google.com/file/d/1w3A6i3bWkY4d_sample_edupeak_al_physics_2025/view?usp=sharing";
    this.onPaperUrlInput(urlInput);
    const sizeInput = document.getElementById("teacherPaperFormSize");
    if (sizeInput && !sizeInput.value) sizeInput.value = "4.2 MB";
    if (window.showToast) {
      window.showToast("✓ Sample Google Drive PDF link inserted!", "info");
    }
  },

  async renderPapers() {
    const tbody = document.getElementById("teacherPapersTableBody");
    if (!tbody) return;

    let papers = await this.getPapers();

    const searchTerm = (document.getElementById("teacherPaperSearchInput") ? document.getElementById("teacherPaperSearchInput").value : "").toLowerCase().trim();
    const catFilter = document.getElementById("teacherPaperCategoryFilter") ? document.getElementById("teacherPaperCategoryFilter").value : "all";
    const unitFilter = document.getElementById("teacherPaperUnitFilter") ? document.getElementById("teacherPaperUnitFilter").value : "all";

    if (searchTerm) {
      papers = papers.filter(p => 
        (p.title && p.title.toLowerCase().includes(searchTerm)) ||
        (p.title_si && p.title_si.toLowerCase().includes(searchTerm)) ||
        (p.unitName && p.unitName.toLowerCase().includes(searchTerm)) ||
        String(p.year).includes(searchTerm)
      );
    }

    if (catFilter !== "all") {
      papers = papers.filter(p => p.type === catFilter);
    }

    if (unitFilter !== "all") {
      papers = papers.filter(p => p.unit === "all" || p.unit === unitFilter);
    }

    this.renderMetrics();

    if (papers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2.5rem; color: #64748b;">
            <i class="fa-solid fa-folder-open" style="font-size: 2rem; color: #cbd5e1; display: block; margin-bottom: 0.5rem;"></i>
            No PDF papers found matching your search or filter.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = papers.map(p => {
      let badgeHtml = '<span class="status-tag active" style="background:#eff6ff; color:#1d4ed8; border: 1px solid #bfdbfe;"><i class="fa-solid fa-graduation-cap"></i> Past Paper</span>';
      if (p.type === "school") {
        badgeHtml = '<span class="status-tag active" style="background:#ecfdf5; color:#065f46; border: 1px solid #bbf7d0;"><i class="fa-solid fa-school"></i> Top School</span>';
      } else if (p.type === "model") {
        badgeHtml = '<span class="status-tag active" style="background:#fef3c7; color:#92400e; border: 1px solid #fde68a;"><i class="fa-solid fa-award"></i> Victory Model</span>';
      }

      const cloudInfo = this.parsePdfCloudUrl(p.url || p.pdfUrl);

      return `
        <tr>
          <td>
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              <div>${badgeHtml}</div>
              <strong style="font-size: 0.85rem; color: #0f172a; margin-top: 0.2rem;">${p.year} Exam</strong>
            </div>
          </td>
          <td>
            <strong style="font-size: 0.95rem; color: #0f172a; display: block;">${p.title}</strong>
            ${p.title_si ? `<span style="font-size: 0.775rem; color: #64748b; font-family: 'Noto Sans Sinhala', sans-serif;">${p.title_si}</span>` : ''}
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.35rem; flex-wrap: wrap;">
              <span class="pdf-cloud-badge ${cloudInfo.badgeClass}">
                <i class="${cloudInfo.icon}"></i> ${cloudInfo.label}
              </span>
              ${p.url || p.pdfUrl ? `<span style="font-size: 0.72rem; color: #64748b; font-family: monospace;" title="${p.url || p.pdfUrl}"><i class="fa-solid fa-link"></i> ${(p.url || p.pdfUrl).substring(0, 38)}${(p.url || p.pdfUrl).length > 38 ? '...' : ''}</span>` : ''}
            </div>
          </td>
          <td>
            <span style="font-size: 0.8rem; font-weight: 700; color: #475569; background: #f8fafc; padding: 0.25rem 0.65rem; border-radius: 6px; border: 1px solid #e2e8f0; display: inline-block;">
              <i class="fa-solid fa-tag" style="color: #227aff;"></i> ${p.unitName || p.unit}
            </span>
          </td>
          <td>
            <span style="font-size: 0.825rem; font-weight: 800; color: #ef4444; background: #fee2e2; padding: 0.25rem 0.6rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.3rem;">
              <i class="fa-solid fa-file-pdf"></i> ${p.size || p.fileSize || '3.5 MB'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
              <button class="btn btn-ghost btn-sm" title="Preview PDF" onclick="TEACHER_CONTROLLER.previewPaper('${p.id}')" style="background:#eff6ff; color:#227aff; border:1px solid #bfdbfe; font-size: 0.75rem; padding: 0.35rem 0.65rem;">
                <i class="fa-solid fa-eye"></i> View
              </button>
              <button class="btn btn-outline btn-sm" title="Edit Paper Details" onclick="TEACHER_CONTROLLER.openEditPaperModal('${p.id}')" style="font-size: 0.75rem; padding: 0.35rem 0.65rem;">
                <i class="fa-solid fa-pen-to-square"></i> Edit
              </button>
              <button class="btn btn-ghost btn-sm" title="Delete Paper" onclick="TEACHER_CONTROLLER.deletePaper('${p.id}')" style="color:#dc2626; border:1px solid #fecaca; font-size: 0.75rem; padding: 0.35rem 0.65rem;">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddPaperModal() {
    const modal = document.getElementById("teacherPaperDrawerModal");
    if (!modal) return;
    document.getElementById("teacherPaperModalTitle").innerHTML = '<i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i> Add New Cloud PDF Paper';
    document.getElementById("teacherPaperFormId").value = "";
    document.getElementById("teacherPaperFormTitle").value = "";
    document.getElementById("teacherPaperFormTitleSi").value = "";
    document.getElementById("teacherPaperFormType").value = "national";
    document.getElementById("teacherPaperFormYear").value = new Date().getFullYear();
    document.getElementById("teacherPaperFormUnit").value = "all";
    document.getElementById("teacherPaperFormUnitName").value = "Complete Past Paper Examination";
    document.getElementById("teacherPaperFormSize").value = "";
    const urlInput = document.getElementById("teacherPaperFormUrl");
    if (urlInput) {
      urlInput.value = "";
      this.onPaperUrlInput(urlInput);
    }

    modal.classList.add("active");
  },

  async openEditPaperModal(paperId) {
    const modal = document.getElementById("teacherPaperDrawerModal");
    if (!modal) return;
    const papers = await this.getPapers();
    const p = papers.find(item => item.id === paperId);
    if (!p) return;

    document.getElementById("teacherPaperModalTitle").innerHTML = '<i class="fa-solid fa-file-pen" style="color: #227aff;"></i> Edit & Rename PDF Paper';
    document.getElementById("teacherPaperFormId").value = p.id;
    document.getElementById("teacherPaperFormTitle").value = p.title || "";
    document.getElementById("teacherPaperFormTitleSi").value = p.title_si || "";
    document.getElementById("teacherPaperFormType").value = p.type || "national";
    document.getElementById("teacherPaperFormYear").value = p.year || 2024;
    document.getElementById("teacherPaperFormUnit").value = p.unit || "all";
    document.getElementById("teacherPaperFormUnitName").value = p.unitName || "";
    document.getElementById("teacherPaperFormSize").value = p.size || p.fileSize || "";
    const urlInput = document.getElementById("teacherPaperFormUrl");
    if (urlInput) {
      urlInput.value = p.url || p.pdfUrl || "";
      this.onPaperUrlInput(urlInput);
    }

    modal.classList.add("active");
  },

  async handleSavePaperSubmit(event) {
    event.preventDefault();
    const id = document.getElementById("teacherPaperFormId").value.trim() || `pap-${Date.now()}`;
    const title = document.getElementById("teacherPaperFormTitle").value.trim();
    const title_si = document.getElementById("teacherPaperFormTitleSi").value.trim();
    const type = document.getElementById("teacherPaperFormType").value;
    const year = parseInt(document.getElementById("teacherPaperFormYear").value) || 2024;
    const unit = document.getElementById("teacherPaperFormUnit").value;
    const unitName = document.getElementById("teacherPaperFormUnitName").value.trim() || "Physics Unit";
    const size = document.getElementById("teacherPaperFormSize").value.trim() || "Cloud PDF";
    const url = document.getElementById("teacherPaperFormUrl").value.trim() || `assets/docs/paper_${year}.pdf`;

    const paperObj = {
      id,
      title,
      title_si,
      type,
      year,
      unit,
      unitName,
      size,
      fileSize: size,
      url,
      pdfUrl: url,
      updated_at: new Date().toISOString()
    };

    if (window.SUPABASE_HELPER) {
      await window.SUPABASE_HELPER.savePaper(paperObj);
    } else {
      let papers = await this.getPapers();
      const existingIndex = papers.findIndex(item => item.id === id);
      if (existingIndex >= 0) {
        papers[existingIndex] = { ...papers[existingIndex], ...paperObj };
      } else {
        papers.unshift(paperObj);
      }
      localStorage.setItem("edupeak_papers_db", JSON.stringify(papers));
    }

    this.closeModal("teacherPaperDrawerModal");

    if (window.showToast) {
      window.showToast(`✓ PDF Paper "${title}" saved and synced across LMS!`, "success");
    }

    await this.renderPapers();
  },

  async deletePaper(paperId) {
    const papers = await this.getPapers();
    const p = papers.find(item => item.id === paperId);
    const title = p ? p.title : "this paper";

    if (!confirm(`Are you sure you want to delete "${title}"? This will remove it from the Student Paper Vault and Faculty Studio.`)) {
      return;
    }

    if (window.SUPABASE_HELPER) {
      await window.SUPABASE_HELPER.deletePaper(paperId);
    } else {
      try {
        const dels = JSON.parse(localStorage.getItem("edupeak_deleted_papers") || "[]");
        if (!dels.includes(paperId)) {
          dels.push(paperId);
          localStorage.setItem("edupeak_deleted_papers", JSON.stringify(dels));
        }
      } catch (e) {}
      const updated = papers.filter(item => item.id !== paperId);
      localStorage.setItem("edupeak_papers_db", JSON.stringify(updated));
    }

    if (window.showToast) {
      window.showToast("✓ Paper successfully removed from Paper Vault.", "info");
    }

    await this.renderPapers();
  },

  async previewPaper(paperId) {
    const papers = await this.getPapers();
    const p = papers.find(item => item.id === paperId);
    if (!p) return;

    const cloudInfo = this.parsePdfCloudUrl(p.url || p.pdfUrl);
    const viewerModal = document.getElementById("teacherPdfViewerModal");
    
    if (viewerModal) {
      const titleEl = document.getElementById("teacherPdfPreviewTitle");
      const metaEl = document.getElementById("teacherPdfPreviewMeta");
      const badgeEl = document.getElementById("teacherPdfCloudBadge");
      const openDirectBtn = document.getElementById("teacherPdfOpenDirectBtn");
      const downloadBtn = document.getElementById("teacherPdfDownloadBtn");
      const iframe = document.getElementById("teacherPdfPreviewIframe");

      if (titleEl) titleEl.textContent = p.title;
      if (metaEl) metaEl.textContent = `${p.year} Exam • ${p.unitName} • ${p.size || p.fileSize || 'PDF Document'}`;
      if (badgeEl) {
        badgeEl.className = `pdf-cloud-badge ${cloudInfo.badgeClass}`;
        badgeEl.innerHTML = `<i class="${cloudInfo.icon}"></i> ${cloudInfo.label}`;
      }
      if (openDirectBtn) {
        openDirectBtn.href = cloudInfo.viewUrl || cloudInfo.rawUrl || "#";
      }
      if (downloadBtn) {
        downloadBtn.href = cloudInfo.downloadUrl || cloudInfo.rawUrl || "#";
      }
      if (iframe) {
        iframe.src = cloudInfo.previewUrl || cloudInfo.rawUrl;
      }

      viewerModal.classList.add("active");
    } else if (p.url && (p.url.startsWith("http") || p.url.startsWith("blob:") || p.url.startsWith("data:"))) {
      window.open(cloudInfo.viewUrl || p.url, "_blank");
    } else {
      alert(`📄 PDF Document Preview:\n\nTitle: ${p.title}\nCategory: ${p.type.toUpperCase()}\nExam Year: ${p.year}\nUnit: ${p.unitName}\nFile: ${p.url || 'assets/docs/paper.pdf'}\nSize: ${p.size}\n\n✓ File is active and accessible in the Paper Vault!`);
    }
  },

  // --------------------------------------------------------------------------
  // 4. LIVE STUDIO BROADCAST & SCHEDULE CONTROLS (SCHEDULE, EDIT, DELETE)
  // --------------------------------------------------------------------------
  formatEmbedUrl(url, provider) {
    const origin = (typeof window !== "undefined" && window.location && window.location.origin) ? encodeURIComponent(window.location.origin) : "";
    const originSuffix = origin ? `?enablejsapi=1&origin=${origin}` : "";

    if (!url) return `https://www.youtube.com/embed/dQw4w9WgXcQ${originSuffix}`;
    
    // YouTube Watch link conversion: youtube.com/watch?v=XYZ -> youtube.com/embed/XYZ
    if (url.includes("youtube.com/watch?v=")) {
      const videoId = url.split("v=")[1]?.split("&")[0];
      if (videoId) return `https://www.youtube.com/embed/${videoId}${originSuffix}`;
    }
    // YouTube Short link conversion: youtu.be/XYZ -> youtube.com/embed/XYZ
    if (url.includes("youtu.be/")) {
      const videoId = url.split("youtu.be/")[1]?.split("?")[0];
      if (videoId) return `https://www.youtube.com/embed/${videoId}${originSuffix}`;
    }
    // YouTube Embed link conversion without origin
    if (url.includes("youtube.com/embed/") && !url.includes("origin=")) {
      const sep = url.includes("?") ? "&" : "?";
      return origin ? `${url}${sep}enablejsapi=1&origin=${origin}` : url;
    }
    // Vimeo conversion: vimeo.com/XYZ -> player.vimeo.com/video/XYZ
    if (url.includes("vimeo.com/") && !url.includes("player.vimeo.com")) {
      const vimeoId = url.split("vimeo.com/")[1]?.split("?")[0];
      if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
    }
    return url;
  },

  handleProviderChange() {
    const provider = document.getElementById("liveStudioProvider")?.value;
    const urlInput = document.getElementById("liveStudioUrl");
    if (urlInput) {
      if (provider === "youtube") {
        urlInput.placeholder = "https://www.youtube.com/watch?v=... or embed URL";
      } else if (provider === "zoom") {
        urlInput.placeholder = "https://zoom.us/j/... meeting URL";
      } else if (provider === "vimeo") {
        urlInput.placeholder = "https://vimeo.com/... video URL";
      }
    }
  },

  getAllScheduledBroadcasts() {
    const deletedIds = (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getDeletedSchedules === "function")
      ? window.SUPABASE_HELPER.getDeletedSchedules()
      : JSON.parse(localStorage.getItem("edupeak_deleted_schedules_db") || "[]");

    let schedules = null;
    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getSharedData === "function") {
      const shared = window.SUPABASE_HELPER.getSharedData(this.storageKeys.schedulesDb || "edupeak_schedules_db");
      if (shared !== null && Array.isArray(shared)) {
        schedules = shared;
      }
    }
    if (schedules === null) {
      const stored = localStorage.getItem(this.storageKeys.schedulesDb);
      if (stored !== null) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) schedules = parsed;
        } catch (e) {
          console.warn("Failed parsing edupeak_schedules_db", e);
        }
      }
    }
    if (schedules !== null && Array.isArray(schedules)) {
      return schedules.filter(s => s && s.id && !deletedIds.includes(s.id) && !s.id.startsWith("sched-continuous-") && !s.id.startsWith("sched-early-test-"));
    }
    return [];
  },

  saveScheduledBroadcasts(list) {
    try {
      localStorage.setItem(this.storageKeys.schedulesDb, JSON.stringify(list));
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.setSharedData === "function") {
        window.SUPABASE_HELPER.setSharedData(this.storageKeys.schedulesDb || "edupeak_schedules_db", list);
      }
      try {
        window.dispatchEvent(new CustomEvent("edupeak-live-sessions-updated", { detail: { all: list } }));
      } catch(e) {}
      if (typeof BroadcastChannel !== "undefined") {
        try {
          const ch = new BroadcastChannel("edupeak_live_sessions_channel");
          ch.postMessage({ type: "LIVE_SESSION_UPDATED", all: list });
          ch.close();
        } catch(e) {}
      }
      try {
        localStorage.setItem("edupeak_live_session_event", JSON.stringify({ type: "LIVE_SESSION_UPDATED", timestamp: Date.now() }));
      } catch(e) {}
    } catch (e) {}
  },

  renderSchedulesTable() {
    const tbody = document.getElementById("teacherSchedulesTbody");
    if (!tbody) return;

    const schedules = this.getAllScheduledBroadcasts();
    if (!schedules.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2.5rem; color: #64748b;">
            <i class="fa-solid fa-calendar-xmark" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">No Broadcast Schedules Configured</div>
            <p style="font-size: 0.825rem; margin-bottom: 1rem;">Use the Live Broadcast Console above to create and schedule upcoming live classes.</p>
            <button class="btn btn-primary btn-sm" onclick="TEACHER_CONTROLLER.resetScheduleForm()">
              <i class="fa-solid fa-plus"></i> Schedule New Live Class
            </button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = schedules.map(s => {
      const isLive = s.status === "live";
      const isEnded = s.status === "ended";
      const statusBadge = isLive 
        ? `<span class="status-tag active" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca;"><i class="fa-solid fa-circle" style="font-size: 0.55rem; animation: pulse 1.5s infinite;"></i> LIVE NOW</span>`
        : (isEnded 
          ? `<span class="status-tag" style="background: #f1f5f9; color: #64748b;"><i class="fa-solid fa-check"></i> Concluded</span>`
          : `<span class="status-tag active" style="background: #fefce8; color: #854d0e; border: 1px solid #fef08a;"><i class="fa-solid fa-clock"></i> Scheduled</span>`);

      return `
        <tr>
          <td>${statusBadge}</td>
          <td>
            <div style="font-weight: 700; color: #0f172a;">${s.topic}</div>
            <a href="${s.rawUrl || s.embedUrl}" target="_blank" style="font-size: 0.75rem; color: #227aff; text-decoration: none;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Stream
            </a>
          </td>
          <td>
            <span style="font-size: 0.8rem; font-weight: 600; color: #334155; background: #f8fafc; padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid #e2e8f0;">
              ${s.courseTitle || s.courseId || 'General Batch'}
            </span>
          </td>
          <td>
            <div style="font-weight: 600; color: #0f172a; font-size: 0.85rem;"><i class="fa-solid fa-calendar-day" style="color: #227aff;"></i> ${s.scheduleTime || 'Scheduled Class'}</div>
          </td>
          <td>
            <span style="text-transform: capitalize; font-weight: 600; font-size: 0.8rem;">
              <i class="fa-brands fa-${s.provider === 'youtube' ? 'youtube' : (s.provider === 'vimeo' ? 'vimeo' : 'video')}" style="color: ${s.provider === 'youtube' ? '#ef4444' : '#227aff'};"></i> ${s.provider || 'YouTube'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 0.4rem; align-items: center; justify-content: flex-end; flex-wrap: wrap;">
              <a href="live-class.html?stream=${s.id}" target="_blank" class="btn btn-sm" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; font-weight: 700; font-size: 0.75rem; padding: 0.35rem 0.75rem; border-radius: 6px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem; box-shadow: 0 2px 6px rgba(239,68,68,0.25);" title="Open Interactive Live Studio">
                <i class="fa-solid fa-tower-broadcast"></i> Enter Studio ↗
              </a>
              ${isLive ? `
                <button class="btn btn-sm" style="background: #475569; color: #ffffff; font-weight: 700; font-size: 0.75rem; padding: 0.35rem 0.65rem; border-radius: 6px;" onclick="TEACHER_CONTROLLER.endLiveBroadcast('${s.id}')" title="End Live Broadcast">
                  <i class="fa-solid fa-stop"></i> End Live
                </button>
              ` : `
                <button class="btn btn-sm" style="background: #dc2626; color: #ffffff; font-weight: 800; font-size: 0.75rem; padding: 0.35rem 0.65rem; border-radius: 6px; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.25);" onclick="TEACHER_CONTROLLER.startLiveBroadcast('${s.id}')" title="Start Live Broadcast Now">
                  <i class="fa-solid fa-tower-broadcast"></i> Start Live
                </button>
              `}
              <button class="btn btn-ghost btn-sm" style="color: #ef4444; border: 1px solid #fecaca; font-size: 0.75rem; padding: 0.35rem 0.55rem; border-radius: 6px;" onclick="TEACHER_CONTROLLER.handleDeleteSchedule('${s.id}')" title="Delete / Cancel Schedule">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  openEditSchedule(scheduleId) {
    window.open(`live-class.html?stream=${scheduleId}`, "_blank");
  },

  startLiveBroadcast(scheduleId) {
    const schedules = this.getAllScheduledBroadcasts();
    const s = schedules.find(item => item.id === scheduleId);
    if (!s) return;

    const nowIso = new Date().toISOString();
    s.status = "live";
    s.startedAt = s.startedAt || nowIso;
    s.updatedAt = nowIso;

    schedules.forEach(item => {
      if (item.id !== scheduleId && item.status === "live") {
        item.status = "scheduled";
      }
    });

    this.saveScheduledBroadcasts(schedules);
    try {
      localStorage.setItem(this.storageKeys.liveStream, JSON.stringify(s));
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.setSharedData === "function") {
        window.SUPABASE_HELPER.setSharedData(this.storageKeys.liveStream || "edupeak_live_stream_config", s);
      }
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.updateLiveSessionStatus === "function") {
        window.SUPABASE_HELPER.updateLiveSessionStatus(scheduleId, "live", { startedAt: s.startedAt });
      }
    } catch (e) {}

    if (window.showToast) {
      window.showToast(`🔴 Live broadcast for "${s.topic}" is NOW ACTIVE on student LMS!`, "success");
    }

    this.renderSchedulesTable();
  },

  endLiveBroadcast(scheduleId) {
    const schedules = this.getAllScheduledBroadcasts();
    let s = schedules.find(item => item.id === scheduleId);
    if (!s) {
      try {
        const stored = JSON.parse(localStorage.getItem(this.storageKeys.schedulesDb) || "[]");
        s = stored.find(item => item.id === scheduleId);
        if (s) schedules.push(s);
      } catch (e) {}
    }
    if (!s) {
      try {
        const liveCfg = JSON.parse(localStorage.getItem(this.storageKeys.liveStream) || "null");
        if (liveCfg && (liveCfg.id === scheduleId || liveCfg.scheduleId === scheduleId)) {
          s = liveCfg;
          schedules.push(s);
        }
      } catch(e) {}
    }
    if (!s) return;

    const nowIso = new Date().toISOString();
    s.status = "ended";
    s.endedAt = nowIso;
    s.updatedAt = nowIso;

    this.saveScheduledBroadcasts(schedules);
    try {
      localStorage.setItem(this.storageKeys.liveStream, JSON.stringify(s));
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.setSharedData === "function") {
        window.SUPABASE_HELPER.setSharedData(this.storageKeys.liveStream || "edupeak_live_stream_config", s);
      }
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.updateLiveSessionStatus === "function") {
        window.SUPABASE_HELPER.updateLiveSessionStatus(scheduleId, "ended", { endedAt: nowIso });
      }
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("edupeak_live_sessions_channel");
        ch.postMessage({ type: "LIVE_SESSION_UPDATED", sessionId: scheduleId, status: "ended", session: s, all: schedules });
        ch.close();
      }
      localStorage.setItem("edupeak_live_session_event", JSON.stringify({
        type: "LIVE_SESSION_UPDATED", sessionId: scheduleId, status: "ended", timestamp: Date.now()
      }));
    } catch (e) {}

    if (window.showToast) {
      window.showToast(`⏹️ Live broadcast for "${s.topic}" has been ended.`, "info");
    }

    this.renderSchedulesTable();
  },

  handleLiveStudioStart(e) {
    if (e && e.preventDefault) e.preventDefault();
    const statusSelect = document.getElementById("liveStudioStatus");
    if (statusSelect) statusSelect.value = "live";
    this.handleQuickStatusChange("live");
  },

  handleLiveStudioEnd(e) {
    if (e && e.preventDefault) e.preventDefault();
    const statusSelect = document.getElementById("liveStudioStatus");
    if (statusSelect) statusSelect.value = "ended";
    this.handleQuickStatusChange("ended");
  },

  handleQuickStatusChange(status) {
    const statusSelect = document.getElementById("liveStudioStatus");
    if (statusSelect) statusSelect.value = status;

    const topic = document.getElementById("liveStudioTopic")?.value.trim() || existing?.topic || "Live Interactive Masterclass";
    const urlFieldVal = document.getElementById("liveStudioUrl")?.value.trim();
    // Preserve the saved URL — never overwrite with empty or Rick Astley placeholder
    const rawUrl = urlFieldVal || existing?.rawUrl || existing?.rawurl || existing?.embedUrl || "";
    const provider = document.getElementById("liveStudioProvider")?.value || existing?.provider || "youtube";
    const embedUrl = rawUrl ? this.formatEmbedUrl(rawUrl, provider) : (existing?.embedUrl || "");
    const scheduleId = document.getElementById("liveStudioScheduleId")?.value || ("sched-" + Date.now().toString(36));

    const day = document.getElementById("liveStudioScheduleDay")?.value || existing?.scheduleDay || "Every Saturday";
    const start = document.getElementById("liveStudioScheduleStartTime")?.value || existing?.scheduleStartTime || "07:30";
    const end = document.getElementById("liveStudioScheduleEndTime")?.value || existing?.scheduleEndTime || "13:30";
    const scheduleTime = this.buildScheduleString(day, start, end);

    const nowIso = new Date().toISOString();
    const schedules = this.getAllScheduledBroadcasts();
    const existingIdx = schedules.findIndex(item => item.id === scheduleId);

    let startedAt = existing?.startedAt || null;
    if (status === "live" && !startedAt) {
      startedAt = nowIso;
    }
    let endedAt = existing?.endedAt || null;
    if (status === "ended") {
      endedAt = nowIso;
    }

    const streamConfig = {
      scheduleId,
      id: scheduleId,
      topic,
      courseId: document.getElementById("liveStudioCourseSelect")?.value || existing?.courseId || "",
      courseTitle: document.getElementById("liveStudioCourseSelect")?.selectedOptions[0]?.text || existing?.courseTitle || "",
      scheduleDay: day,
      scheduleStartTime: start,
      scheduleEndTime: end,
      scheduleTime,
      provider,
      rawUrl,
      embedUrl,
      status,
      startedAt,
      endedAt,
      updatedAt: nowIso
    };

    try {
      localStorage.setItem(this.storageKeys.liveStream, JSON.stringify(streamConfig));
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.setSharedData === "function") {
        window.SUPABASE_HELPER.setSharedData(this.storageKeys.liveStream || "edupeak_live_stream_config", streamConfig);
      }
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.updateLiveSessionStatus === "function") {
        window.SUPABASE_HELPER.updateLiveSessionStatus(scheduleId, status, { startedAt, endedAt });
      }
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("edupeak_live_sessions_channel");
        ch.postMessage({ type: "LIVE_SESSION_UPDATED", sessionId: scheduleId, status: status, session: streamConfig, all: schedules });
        ch.close();
      }
      localStorage.setItem("edupeak_live_session_event", JSON.stringify({
        type: "LIVE_SESSION_UPDATED", sessionId: scheduleId, status: status, timestamp: Date.now()
      }));
    } catch (e) {}

    if (existingIdx >= 0) {
      schedules[existingIdx] = { ...schedules[existingIdx], ...streamConfig };
    } else {
      schedules.unshift(streamConfig);
    }
    this.saveScheduledBroadcasts(schedules);

    const previewIframe = document.getElementById("teacherLivePreviewIframe");
    const badgeEl = document.getElementById("livePreviewStatusBadge");
    if (previewIframe) previewIframe.src = embedUrl;
    if (badgeEl) {
      const isLive = status === "live";
      const isEnded = status === "ended";
      badgeEl.textContent = isLive ? "🔴 LIVE NOW" : (isEnded ? "⏹️ Concluded" : "⏳ Scheduled");
      badgeEl.style.background = isLive ? "#fee2e2" : (isEnded ? "#f1f5f9" : "#fefce8");
      badgeEl.style.color = isLive ? "#dc2626" : (isEnded ? "#64748b" : "#854d0e");
    }

    if (window.showToast) {
      if (status === "live") {
        window.showToast(`🔴 Live Stream is NOW ACTIVE & BROADCASTING to students!`, "success");
      } else if (status === "ended") {
        window.showToast(`⏹️ Live broadcast session ended.`, "info");
      } else {
        window.showToast(`✓ Broadcast saved and scheduled for ${scheduleTime}.`, "success");
      }
    }

    this.renderSchedulesTable();
  },

  resetScheduleForm() {
    document.getElementById("liveStudioScheduleId").value = "";
    document.getElementById("liveStudioTopic").value = "";
    if (document.getElementById("liveStudioScheduleDay")) document.getElementById("liveStudioScheduleDay").value = "Every Saturday";
    if (document.getElementById("liveStudioScheduleStartTime")) document.getElementById("liveStudioScheduleStartTime").value = "07:30";
    if (document.getElementById("liveStudioScheduleEndTime")) document.getElementById("liveStudioScheduleEndTime").value = "13:30";
    if (document.getElementById("liveStudioScheduleTime")) document.getElementById("liveStudioScheduleTime").value = "";
    document.getElementById("liveStudioUrl").value = "";
    document.getElementById("liveStudioStatus").value = "scheduled";

    const btnText = document.getElementById("btnSaveScheduleText");
    if (btnText) btnText.textContent = "Save & Push Broadcast Schedule";

    const formEl = document.getElementById("liveStudioForm");
    if (formEl) formEl.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("liveStudioTopic").focus();
  },

  async handleDeleteSchedule(scheduleId) {
    const schedules = this.getAllScheduledBroadcasts();
    const s = schedules.find(item => item.id === scheduleId);
    if (!s) return;

    if (confirm(`Are you sure you want to delete broadcast schedule "${s.topic}"?`)) {
      // 1. Permanently register deletion tombstone & delete on Supabase Cloud
      if (window.SUPABASE_HELPER) {
        if (typeof window.SUPABASE_HELPER.addDeletedSchedule === "function") {
          window.SUPABASE_HELPER.addDeletedSchedule(scheduleId);
        }
        if (typeof window.SUPABASE_HELPER.deleteLiveSession === "function") {
          await window.SUPABASE_HELPER.deleteLiveSession(scheduleId);
        }
      } else {
        try {
          const dels = JSON.parse(localStorage.getItem("edupeak_deleted_schedules_db") || "[]");
          if (!dels.includes(scheduleId)) {
            dels.push(scheduleId);
            localStorage.setItem("edupeak_deleted_schedules_db", JSON.stringify(dels));
          }
        } catch(e) {}
      }

      // 2. Filter local schedules and persist
      const updated = schedules.filter(item => item.id !== scheduleId);
      this.saveScheduledBroadcasts(updated);

      // 3. Clear active preview if this stream was active
      const activeLive = localStorage.getItem(this.storageKeys.liveStream);
      if (activeLive) {
        try {
          const cfg = JSON.parse(activeLive);
          if (cfg.scheduleId === scheduleId || cfg.id === scheduleId) {
            const clearedConfig = {
              topic: "No Live Broadcast Scheduled",
              provider: "youtube",
              rawUrl: "",
              embedUrl: "about:blank",
              status: "ended",
              scheduleTime: "",
              updatedAt: new Date().toISOString()
            };
            localStorage.setItem(this.storageKeys.liveStream, JSON.stringify(clearedConfig));
            if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.setSharedData === "function") {
              window.SUPABASE_HELPER.setSharedData(this.storageKeys.liveStream || "edupeak_live_stream_config", clearedConfig);
            }
            const previewIframe = document.getElementById("teacherLivePreviewIframe");
            const badgeEl = document.getElementById("livePreviewStatusBadge");
            if (previewIframe) previewIframe.src = "about:blank";
            if (badgeEl) {
              badgeEl.textContent = "⏹️ No Broadcast Scheduled";
              badgeEl.style.background = "#f1f5f9";
              badgeEl.style.color = "#64748b";
            }
          }
        } catch (e) {}
      }

      if (document.getElementById("liveStudioScheduleId")?.value === scheduleId) {
        this.resetScheduleForm();
      }

      if (window.showToast) {
        window.showToast(`🗑️ Schedule "${s.topic}" deleted and permanently removed from LMS.`, "info");
      }

      this.renderSchedulesTable();
      this.renderLiveStudio();
    }
  },

  async handleDeleteCurrentSchedule() {
    const currentId = document.getElementById("liveStudioScheduleId")?.value;
    if (currentId) {
      await this.handleDeleteSchedule(currentId);
      return;
    }

    if (confirm(`Are you sure you want to clear and cancel the current live broadcast session?`)) {
      const clearedConfig = {
        topic: "No Live Broadcast Scheduled",
        provider: "youtube",
        rawUrl: "",
        embedUrl: "about:blank",
        status: "ended",
        scheduleTime: "",
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(this.storageKeys.liveStream, JSON.stringify(clearedConfig));
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.setSharedData === "function") {
        window.SUPABASE_HELPER.setSharedData(this.storageKeys.liveStream || "edupeak_live_stream_config", clearedConfig);
      }

      this.resetScheduleForm();

      const previewIframe = document.getElementById("teacherLivePreviewIframe");
      const badgeEl = document.getElementById("livePreviewStatusBadge");
      if (previewIframe) previewIframe.src = "about:blank";
      if (badgeEl) {
        badgeEl.textContent = "⏹️ No Broadcast Scheduled";
        badgeEl.style.background = "#f1f5f9";
        badgeEl.style.color = "#64748b";
      }

      if (window.showToast) {
        window.showToast("🗑️ Current live broadcast session cancelled & cleared.", "info");
      }

      this.renderSchedulesTable();
    }
  },

  handleLiveStudioSave(e) {
    if (e && e.preventDefault) e.preventDefault();
    const statusSelect = document.getElementById("liveStudioStatus");
    const status = statusSelect ? statusSelect.value : "scheduled";
    this.handleQuickStatusChange(status);
  },

  renderLiveStudio() {
    let saved = null;
    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getSharedData === "function") {
      const shared = window.SUPABASE_HELPER.getSharedData(this.storageKeys.liveStream || "edupeak_live_stream_config");
      if (shared && typeof shared === "object") saved = shared;
    }
    if (!saved) {
      const raw = localStorage.getItem(this.storageKeys.liveStream);
      if (raw) {
        try { saved = JSON.parse(raw); } catch (e) {}
      }
    }

    // If no URL in saved config, fall back to edupeak_schedules_db (sessions created via edit form)
    if (!saved || (!saved.rawUrl && !saved.embedUrl)) {
      try {
        let sessions = [];
        if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getSharedData === "function") {
          const s = window.SUPABASE_HELPER.getSharedData("edupeak_schedules_db");
          if (Array.isArray(s) && s.length) sessions = s;
        }
        if (!sessions.length) sessions = JSON.parse(localStorage.getItem("edupeak_schedules_db") || "[]");
        // Pick the live session first, then most-recently-updated non-ended session
        const candidate = sessions.find(s => s.status === "live")
          || sessions.filter(s => s.status !== "ended").sort((a,b) => new Date(b.updatedAt||0) - new Date(a.updatedAt||0))[0]
          || null;
        if (candidate && (candidate.rawUrl || candidate.rawurl || candidate.embedUrl)) {
          saved = { ...candidate, rawUrl: candidate.rawUrl || candidate.rawurl || candidate.embedUrl };
        }
      } catch(e) {}
    }
    const titleEl = document.getElementById("liveStudioTopic");
    const urlEl = document.getElementById("liveStudioUrl");
    const statusEl = document.getElementById("liveStudioStatus");
    const providerEl = document.getElementById("liveStudioProvider");
    const timeEl = document.getElementById("liveStudioScheduleTime");
    const courseEl = document.getElementById("liveStudioCourseSelect");
    const previewIframe = document.getElementById("teacherLivePreviewIframe");
    const badgeEl = document.getElementById("livePreviewStatusBadge");

    if (saved) {
      try {
        const cfg = saved;
        if (titleEl && cfg.topic) titleEl.value = cfg.topic;
        if (urlEl && (cfg.rawUrl || cfg.embedUrl)) urlEl.value = cfg.rawUrl || cfg.embedUrl;
        if (statusEl && cfg.status) statusEl.value = cfg.status;
        if (providerEl && cfg.provider) providerEl.value = cfg.provider;
        if (timeEl && cfg.scheduleTime) timeEl.value = cfg.scheduleTime;
        if (courseEl && cfg.courseId) courseEl.value = cfg.courseId;
        if (previewIframe && cfg.embedUrl) previewIframe.src = cfg.embedUrl;

        // Restore the schedule ID so subsequent saves update the same record
        const scheduleIdEl = document.getElementById("liveStudioScheduleId");
        if (scheduleIdEl && (cfg.scheduleId || cfg.id)) {
          scheduleIdEl.value = cfg.scheduleId || cfg.id;
        }

        // Restore day / start / end time inputs.
        // Prefer the explicit raw fields (saved since the latest fix).
        // Fall back to parsing the scheduleTime string for older records.
        const dayEl   = document.getElementById("liveStudioScheduleDay");
        const startEl = document.getElementById("liveStudioScheduleStartTime");
        const endEl   = document.getElementById("liveStudioScheduleEndTime");

        if (cfg.scheduleStartTime && cfg.scheduleEndTime) {
          // Direct fields available — use them, no parsing needed
          if (dayEl   && cfg.scheduleDay)       dayEl.value   = cfg.scheduleDay;
          if (startEl && cfg.scheduleStartTime) startEl.value = cfg.scheduleStartTime;
          if (endEl   && cfg.scheduleEndTime)   endEl.value   = cfg.scheduleEndTime;
        } else if (cfg.scheduleTime) {
          // Legacy records — parse from string
          const parsed = this.parseScheduleString(cfg.scheduleTime);
          if (dayEl   && parsed.day)       dayEl.value   = parsed.day;
          if (startEl && parsed.startTime) startEl.value = parsed.startTime;
          if (endEl   && parsed.endTime)   endEl.value   = parsed.endTime;
        }

        if (badgeEl) {
          const isLive = cfg.status === "live";
          const isEnded = cfg.status === "ended";
          badgeEl.textContent = isLive ? "🔴 LIVE NOW" : (isEnded ? "⏹️ Concluded" : "⏳ Scheduled");
          badgeEl.style.background = isLive ? "#fee2e2" : (isEnded ? "#f1f5f9" : "#fefce8");
          badgeEl.style.color = isLive ? "#dc2626" : (isEnded ? "#64748b" : "#854d0e");
        }
      } catch (e) {}
    }

    this.renderSchedulesTable();
  },

  // --------------------------------------------------------------------------
  // 5. GRADEBOOK & STUDENT SUBMISSIONS
  // --------------------------------------------------------------------------
  renderGradebook() {
    const tbody = document.getElementById("teacherGradebookTbody");
    if (!tbody) return;

    const sampleSubmissions = [
      { id: "SUB-801", name: "Kasun Jayasundara", indexNo: "EP-2027-001", exam: "2027 A/L Physics Complete Theory", score: "92 / 100", grade: "A (Distinction)", date: "Today 08:30 AM" }
    ];

    tbody.innerHTML = sampleSubmissions.map(s => `
      <tr>
        <td><strong>${s.indexNo}</strong></td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${s.name}</div>
          <div style="font-size: 0.75rem; color: #64748b;">${s.id}</div>
        </td>
        <td>${s.exam}</td>
        <td><strong style="color: #227aff;">${s.score}</strong></td>
        <td><span class="status-tag active">${s.grade}</span></td>
        <td style="font-size: 0.8rem; color: #64748b;">${s.date}</td>
      </tr>
    `).join("");
  },

  // --------------------------------------------------------------------------
  // 5. REGISTERED STUDENTS DIRECTORY (READ-ONLY FOR TEACHERS)
  // --------------------------------------------------------------------------
  getRegisteredStudents() {
    let allUsers = [];
    if (window.AUTH_SYSTEM && typeof window.AUTH_SYSTEM.getUsers === "function") {
      allUsers = window.AUTH_SYSTEM.getUsers() || [];
    } else {
      try {
        allUsers = JSON.parse(localStorage.getItem("edupeak_users_db") || "[]");
      } catch (e) {
        allUsers = [];
      }
    }

    // Filter students
    let students = allUsers.filter(u => u.role === "student");

    // Standard registered roster for G.C.E. A/L Physics faculty
    const defaultRoster = [
      {
        id: "EP-2027-001",
        name: "Kasun Jayasundara",
        name_si: "කසුන් ජයසුන්දර",
        email: "student@edupeak.lk",
        phone: "0771234567",
        nic: "200512345678",
        stream: "Physical Science (Combined Maths)",
        examYear: "2027 A/L",
        institute: "Victory Embilipitiya",
        branch: "Victory Embilipitiya",
        enrolledModule: "2027 A/L Complete Theory & Mechanics Masterclass",
        joinedDate: "2025-01-10",
        status: "Active & Enrolled"
      }
    ];

    defaultRoster.forEach(def => {
      const exists = students.some(s => s.id === def.id || (s.email && def.email && s.email.toLowerCase() === def.email.toLowerCase()));
      if (!exists) {
        students.push(def);
      }
    });

    return students;
  },

  renderPendingOrders() {
    const tbody = document.getElementById("teacherPendingOrdersTbody");
    const countBadge = document.getElementById("teacherPendingOrdersCountBadge");
    const metricCountEl = document.getElementById("metricPendingOrdersCount");
    if (!tbody) return;

    let orders = [];
    try {
      orders = JSON.parse(localStorage.getItem("edupeak_pending_orders") || "[]");
    } catch (e) {
      orders = [];
    }

    const pendingOnly = orders.filter(o => o.status === "Pending Approval");

    if (metricCountEl) {
      metricCountEl.textContent = `${pendingOnly.length} Pending`;
    }

    if (countBadge) {
      countBadge.textContent = `${pendingOnly.length} Pending Order${pendingOnly.length === 1 ? '' : 's'}`;
      if (pendingOnly.length > 0) {
        countBadge.style.background = "#fef3c7";
        countBadge.style.color = "#92400e";
        countBadge.style.borderColor = "#fde68a";
      } else {
        countBadge.style.background = "#ecfdf5";
        countBadge.style.color = "#059669";
        countBadge.style.borderColor = "#a7f3d0";
      }
    }

    if (pendingOnly.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: #64748b; padding: 2rem;">
            <i class="fa-solid fa-circle-check" style="font-size: 1.75rem; color: #10b981; margin-bottom: 0.35rem; display: block;"></i>
            No pending enrollment orders awaiting approval. All student requests are up to date!
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pendingOnly.map(order => {
      const d = order.timestamp ? new Date(order.timestamp) : new Date();
      const dateFormatted = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const phoneClean = (order.studentPhone || "").replace(/[^0-9]/g, '');
      const waLink = phoneClean ? `https://wa.me/${phoneClean.startsWith('0') ? '94' + phoneClean.slice(1) : phoneClean}` : '';

      return `
        <tr>
          <td>
            <strong style="font-family: monospace; color: #92400e; background: #fef3c7; padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid #fde68a; font-size: 0.85rem;">
              ${order.orderId}
            </strong>
          </td>
          <td>
            <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${order.studentName}</div>
            <div style="font-size: 0.75rem; color: #64748b;">ID: <strong style="color: #227aff;">${order.studentId}</strong></div>
            <div style="font-size: 0.75rem; color: #475569;">
              <i class="fa-solid fa-phone" style="font-size: 0.7rem;"></i> ${order.studentPhone}
              ${waLink ? `<a href="${waLink}" target="_blank" rel="noopener noreferrer" style="color: #16a34a; font-weight: 700; margin-left: 0.35rem; text-decoration: none;"><i class="fa-brands fa-whatsapp"></i> Chat</a>` : ''}
            </div>
            <div style="font-size: 0.72rem; color: #64748b; max-width: 220px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${order.district || ''} - ${order.address || ''}">
              <i class="fa-solid fa-location-dot" style="font-size: 0.7rem; color: #227aff;"></i> ${order.district || ''} - ${order.address || ''}
            </div>
          </td>
          <td>
            <div style="font-weight: 700; color: #0f172a; font-size: 0.88rem;">${order.courseTitle}</div>
            <span style="font-size: 0.72rem; color: #227aff; background: #eff6ff; padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid #bfdbfe;">
              ID: ${order.courseId}
            </span>
          </td>
          <td>
            <strong style="color: #0f172a; font-size: 0.88rem;">${order.fee || 'LKR 3,500'}</strong>
          </td>
          <td>
            <div style="font-size: 0.78rem; color: #64748b;">${dateFormatted}</div>
          </td>
          <td>
            <span class="status-tag" style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; font-size: 0.72rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.3rem;">
              <i class="fa-solid fa-clock"></i> Pending
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
              <button class="btn btn-sm" 
                      onclick="TEACHER_CONTROLLER.approvePendingOrder('${order.orderId}')"
                      style="background: #16a34a; color: #ffffff; border: 1px solid #16a34a; font-size: 0.75rem; padding: 0.35rem 0.65rem; font-weight: 700; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.3rem; cursor: pointer;"
                      title="Verify payment and grant course access to student">
                <i class="fa-solid fa-check"></i> Approve
              </button>
              <button class="btn btn-sm btn-ghost" 
                      onclick="TEACHER_CONTROLLER.cancelPendingOrder('${order.orderId}')"
                      style="color: #ef4444; border: 1px solid #fecaca; font-size: 0.75rem; padding: 0.35rem 0.65rem; font-weight: 700; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.3rem; cursor: pointer;"
                      title="Cancel/reject order and release duplicate lock">
                <i class="fa-solid fa-xmark"></i> Cancel
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  approvePendingOrder(orderId) {
    if (!orderId) return;
    let orders = [];
    try {
      orders = JSON.parse(localStorage.getItem("edupeak_pending_orders") || "[]");
    } catch (e) {
      orders = [];
    }

    const orderIndex = orders.findIndex(o => o.orderId === orderId);
    if (orderIndex === -1) {
      if (window.showToast) window.showToast("Order not found.", "error");
      return;
    }

    const order = orders[orderIndex];

    // Grant course access to the student
    let studentCourses = [];
    if (window.AUTH_SYSTEM && typeof window.AUTH_SYSTEM.getStudentEnrolledCourses === "function") {
      studentCourses = window.AUTH_SYSTEM.getStudentEnrolledCourses(order.studentId) || [];
    }

    if (!studentCourses.includes(order.courseId)) {
      studentCourses.push(order.courseId);
    }

    if (window.AUTH_SYSTEM && typeof window.AUTH_SYSTEM.setStudentEnrolledCourses === "function") {
      window.AUTH_SYSTEM.setStudentEnrolledCourses(order.studentId, studentCourses);
    } else {
      localStorage.setItem(`edupeak_student_courses_${order.studentId}`, JSON.stringify(studentCourses));
    }

    // Also update general edupeak_enrolled and active student session
    try {
      let generalEnrolled = JSON.parse(localStorage.getItem("edupeak_enrolled") || "[]");
      if (!generalEnrolled.includes(order.courseId)) {
        generalEnrolled.push(order.courseId);
        localStorage.setItem("edupeak_enrolled", JSON.stringify(generalEnrolled));
      }

      const current = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getCurrentUser() : null;
      if (current && (
        current.id === order.studentId || 
        (current.phone && order.studentPhone && current.phone.replace(/\D/g, '') === String(order.studentPhone).replace(/\D/g, '')) ||
        (current.name && order.studentName && current.name.toLowerCase().trim() === String(order.studentName).toLowerCase().trim()) ||
        (current.email && order.studentEmail && current.email.toLowerCase() === String(order.studentEmail).toLowerCase())
      )) {
        if (!Array.isArray(current.enrolledCourses)) current.enrolledCourses = [];
        if (!current.enrolledCourses.includes(order.courseId)) {
          current.enrolledCourses.push(order.courseId);
          localStorage.setItem("edupeak_active_session", JSON.stringify(current));
        }
      }
    } catch (e) {}

    // Update order status
    orders[orderIndex].status = "Approved";
    orders[orderIndex].approvedAt = new Date().toISOString();
    localStorage.setItem("edupeak_pending_orders", JSON.stringify(orders));

    if (window.showToast) {
      window.showToast(`🎉 Order ${order.orderId} approved! Access to "${order.courseTitle}" granted for ${order.studentName}.`, "success");
    }

    this.renderPendingOrders();
    this.renderStudents();
  },

  cancelPendingOrder(orderId) {
    if (!orderId) return;
    if (!confirm(`Are you sure you want to cancel order ${orderId}? This will remove the pending status and allow the student to place a new order.`)) {
      return;
    }

    let orders = [];
    try {
      orders = JSON.parse(localStorage.getItem("edupeak_pending_orders") || "[]");
    } catch (e) {
      orders = [];
    }

    const orderIndex = orders.findIndex(o => o.orderId === orderId);
    if (orderIndex === -1) return;

    orders[orderIndex].status = "Cancelled";
    orders[orderIndex].cancelledAt = new Date().toISOString();
    localStorage.setItem("edupeak_pending_orders", JSON.stringify(orders));

    if (window.showToast) {
      window.showToast(`❌ Order ${orderId} has been cancelled. The course restriction has been released for the student.`, "info");
    }

    this.renderPendingOrders();
    this.renderStudents();
  },

  renderStudents() {
    this.renderPendingOrders();
    const tbody = document.getElementById("teacherStudentsTbody");
    if (!tbody) return;

    let students = this.getRegisteredStudents();
    const searchInput = document.getElementById("teacherStudentSearch");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const filterSelect = document.getElementById("teacherStudentBatchFilter");
    const filter = filterSelect ? filterSelect.value : "all";

    if (query) {
      students = students.filter(s => 
        (s.name && s.name.toLowerCase().includes(query)) ||
        (s.name_si && s.name_si.toLowerCase().includes(query)) ||
        (s.id && s.id.toLowerCase().includes(query)) ||
        (s.nic && s.nic.toLowerCase().includes(query)) ||
        (s.email && s.email.toLowerCase().includes(query)) ||
        (s.phone && s.phone.includes(query)) ||
        (s.enrolledModule && s.enrolledModule.toLowerCase().includes(query))
      );
    }

    if (filter !== "all") {
      students = students.filter(s => {
        const text = `${s.examYear || ''} ${s.stream || ''} ${s.institute || ''} ${s.branch || ''} ${s.enrolledModule || ''}`.toLowerCase();
        return text.includes(filter.toLowerCase());
      });
    }

    const badge = document.getElementById("teacherStudentCountBadge");
    if (badge) {
      badge.innerHTML = `<i class="fa-solid fa-users"></i> ${students.length} Registered Student${students.length === 1 ? '' : 's'}`;
    }

    if (students.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: #64748b; padding: 2.5rem;">
            <i class="fa-solid fa-user-xmark" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 0.5rem; display: block;"></i>
            No registered students found matching "<strong>${query || filter}</strong>".
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = students.map(s => {
      const studentName = s.name || "Student";
      const avatarChar = (s.avatarLetter || studentName.charAt(0) || "S").toUpperCase();
      const examBadge = s.examYear 
        ? `<span class="status-tag active" style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; font-weight: 700; font-size: 0.75rem;"><i class="fa-solid fa-graduation-cap"></i> ${s.examYear}</span>`
        : `<span class="status-tag" style="background: #f1f5f9; color: #64748b;">General Batch</span>`;

      const enrolledCourses = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getStudentEnrolledCourses(s.id) : (s.enrolledCourses || []);
      const courseCount = enrolledCourses.length;
      const courseBadge = courseCount > 0
        ? `<span class="status-tag active" style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; font-size: 0.72rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;" onclick="TEACHER_CONTROLLER.openManageCourseAccessModal('${s.id}')" title="${enrolledCourses.join(', ')}">
             <i class="fa-solid fa-graduation-cap"></i> ${courseCount} Course${courseCount === 1 ? '' : 's'}
           </span>`
        : `<span class="status-tag" style="background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; font-size: 0.72rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;" onclick="TEACHER_CONTROLLER.openManageCourseAccessModal('${s.id}')">
             <i class="fa-regular fa-circle"></i> None
           </span>`;

      return `
        <tr>
          <td><strong style="color: #227aff; font-family: monospace; font-size: 0.85rem;">${s.id}</strong></td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: #eff6ff; color: #227aff; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; border: 1.5px solid #bfdbfe; flex-shrink: 0;">
                ${avatarChar}
              </div>
              <div>
                <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${s.name}</div>
                ${s.name_si ? `<div style="font-size: 0.75rem; color: #64748b;">${s.name_si}</div>` : ''}
              </div>
            </div>
          </td>
          <td>
            <span style="font-family: monospace; font-weight: 700; color: #1e40af; background: #eff6ff; padding: 0.25rem 0.55rem; border-radius: 6px; border: 1px solid #bfdbfe; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 0.35rem;">
              <i class="fa-solid fa-id-card" style="color: #227aff;"></i> ${s.nic || '200512345678'}
            </span>
          </td>
          <td>
            <div style="font-size: 0.8rem; color: #334155; font-weight: 600;"><i class="fa-solid fa-envelope" style="color: #64748b; font-size: 0.75rem;"></i> ${s.email || '-'}</div>
            <div style="font-size: 0.75rem; color: #64748b;"><i class="fa-solid fa-phone" style="color: #64748b; font-size: 0.7rem;"></i> ${s.phone || 'Contact via Institute'}</div>
          </td>
          <td>${examBadge}</td>
          <td>
            <div style="font-size: 0.8rem; font-weight: 600; color: #0f172a;">${s.stream || 'Physical Science'}</div>
            <div style="font-size: 0.72rem; color: #64748b;"><i class="fa-solid fa-location-dot" style="color: #227aff; font-size: 0.7rem;"></i> ${s.branch || s.institute || 'Victory Embilipitiya'}</div>
          </td>
          <td>
            ${courseBadge}
          </td>
          <td>
            <button class="btn btn-sm btn-primary" 
                    onclick="TEACHER_CONTROLLER.openManageCourseAccessModal('${s.id}')"
                    style="font-size: 0.75rem; padding: 0.35rem 0.7rem; font-weight: 700; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.35rem;">
              <i class="fa-solid fa-graduation-cap"></i> Grant Access
            </button>
          </td>
        </tr>
      `;
    }).join("");
  },

  openManageCourseAccessModal(studentId) {
    if (!studentId) return;

    const students = this.getRegisteredStudents();
    let s = students.find(u => u.id === studentId || (u.email && u.email.toLowerCase() === studentId.toLowerCase()));
    if (!s && window.AUTH_SYSTEM) {
      const allUsers = window.AUTH_SYSTEM.getUsers() || [];
      s = allUsers.find(u => u.id === studentId);
    }
    if (!s) {
      s = { id: studentId, name: "Student", email: "", examYear: "2027 A/L" };
    }

    const studentNameEl = document.getElementById("teacherCourseAccessStudentName");
    const studentDetailsEl = document.getElementById("teacherCourseAccessStudentDetails");
    const examBadgeEl = document.getElementById("teacherCourseAccessExamBadge");
    const studentIdInput = document.getElementById("teacherCourseAccessStudentId");
    const listContainer = document.getElementById("teacherCourseAccessList");

    if (studentNameEl) studentNameEl.textContent = s.name || "Student";
    if (studentDetailsEl) studentDetailsEl.textContent = `ID: ${s.id} • ${s.email || 'No email'}${s.phone ? ` • ${s.phone}` : ''}`;
    if (examBadgeEl) examBadgeEl.textContent = s.examYear || s.stream || "2027 A/L";
    if (studentIdInput) studentIdInput.value = s.id;

    // Get current enrolled courses
    const enrolled = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getStudentEnrolledCourses(s.id) : (s.enrolledCourses || []);

    // Get all teacher courses & system courses
    let allCourses = this.getAllCourses ? this.getAllCourses() : (window.EDUPEAK_DATA ? window.EDUPEAK_DATA.courses : []);

    if (listContainer) {
      if (allCourses.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 1.5rem;">No courses available in catalog.</div>`;
      } else {
        listContainer.innerHTML = allCourses.map(course => {
          const isEnrolled = enrolled.some(eid => {
            const cleanEid = String(eid).toLowerCase().replace(/-theory|-revision|-paper/g, '');
            const cleanCid = String(course.id).toLowerCase().replace(/-theory|-revision|-paper/g, '');
            return eid === course.id || cleanEid === cleanCid;
          });

          return `
            <label style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: ${isEnrolled ? '#f0fdf4' : '#ffffff'}; border: 1.5px solid ${isEnrolled ? '#86efac' : '#e2e8f0'}; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <input type="checkbox" class="teacher-course-checkbox" value="${course.id}" ${isEnrolled ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #227aff; cursor: pointer;" onchange="TEACHER_CONTROLLER.onCourseCheckboxToggle(this)">
                <div>
                  <div style="font-weight: 700; color: #0f172a; font-size: 0.88rem;">${course.title}</div>
                  <div style="font-size: 0.74rem; color: #64748b;">
                    <span style="font-weight: 600; color: #227aff;">${course.examYear || course.level || '2027 A/L'}</span> • 
                    ${course.teacherName || course.teacher || 'Amalsha Wanniarachchi'} • 
                    <span style="text-transform: capitalize;">${course.category || 'Theory'}</span>
                  </div>
                </div>
              </div>
              <span class="course-grant-badge status-tag ${isEnrolled ? 'active' : ''}" style="font-size: 0.7rem; font-weight: 700;">
                ${isEnrolled ? '<i class="fa-solid fa-circle-check"></i> Access Granted' : 'Not Enrolled'}
              </span>
            </label>
          `;
        }).join("");
      }
    }

    const modal = document.getElementById("teacherCourseAccessModal");
    if (modal) modal.classList.add("active");
  },

  onCourseCheckboxToggle(checkbox) {
    const parent = checkbox.closest("label");
    const badge = parent ? parent.querySelector(".course-grant-badge") : null;
    if (checkbox.checked) {
      if (parent) {
        parent.style.background = "#f0fdf4";
        parent.style.borderColor = "#86efac";
      }
      if (badge) {
        badge.className = "course-grant-badge status-tag active";
        badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Access Granted';
      }
    } else {
      if (parent) {
        parent.style.background = "#ffffff";
        parent.style.borderColor = "#e2e8f0";
      }
      if (badge) {
        badge.className = "course-grant-badge status-tag";
        badge.textContent = 'Not Enrolled';
      }
    }
  },

  toggleAllCourseAccess(select) {
    const checkboxes = document.querySelectorAll("#teacherCourseAccessList input[type='checkbox']");
    checkboxes.forEach(cb => {
      cb.checked = select;
      this.onCourseCheckboxToggle(cb);
    });
  },

  saveStudentCourseAccess() {
    const studentIdInput = document.getElementById("teacherCourseAccessStudentId");
    const studentId = studentIdInput ? studentIdInput.value : "";
    if (!studentId) return;

    const checkedBoxes = document.querySelectorAll("#teacherCourseAccessList input[type='checkbox']:checked");
    const selectedCourseIds = Array.from(checkedBoxes).map(cb => cb.value);

    if (window.AUTH_SYSTEM && typeof window.AUTH_SYSTEM.setStudentEnrolledCourses === "function") {
      window.AUTH_SYSTEM.setStudentEnrolledCourses(studentId, selectedCourseIds);
    } else {
      localStorage.setItem(`edupeak_student_courses_${studentId}`, JSON.stringify(selectedCourseIds));
    }

    if (window.showToast) {
      window.showToast(`🎉 Access updated for ${studentId} (${selectedCourseIds.length} course${selectedCourseIds.length === 1 ? '' : 's'} granted)!`, "success");
    }

    this.closeModal("teacherCourseAccessModal");
    this.renderStudents();
  },

  logout() {
    if (window.AUTH_SYSTEM && window.AUTH_SYSTEM.logout) {
      window.AUTH_SYSTEM.logout();
    } else {
      localStorage.removeItem("edupeak_active_session");
    }
    localStorage.removeItem("edupeak_active_session");

    if (window.showToast) {
      window.showToast("👋 You have been logged out successfully.", "info");
    }

    if (typeof checkTeacherAuth === "function") {
      checkTeacherAuth();
    } else {
      window.location.reload();
    }
  }
};

function showToast(message, type = "info") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast-message toast-${type}`;
  toast.style.cssText = "display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1.25rem; background: #0f172a; color: #ffffff; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.25); font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem; z-index: 999999;";

  const iconMap = {
    success: '<i class="fa-solid fa-circle-check" style="color: #10b981;"></i>',
    error: '<i class="fa-solid fa-circle-xmark" style="color: #ef4444;"></i>',
    info: '<i class="fa-solid fa-circle-info" style="color: #38bdf8;"></i>'
  };

  toast.innerHTML = `${iconMap[type] || iconMap.info} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

window.showToast = showToast;
window.handleLogout = () => TEACHER_CONTROLLER.logout();
window.handleTeacherLogout = () => TEACHER_CONTROLLER.logout();
window.TEACHER_CONTROLLER = TEACHER_CONTROLLER;

window.addEventListener("edupeak:courses-synced", () => {
  if (window.TEACHER_CONTROLLER) {
    window.TEACHER_CONTROLLER.loadCustomData();
    window.TEACHER_CONTROLLER.renderMetrics();
    window.TEACHER_CONTROLLER.populateCourseDropdowns();
    if (window.TEACHER_CONTROLLER.currentTab === "courses") {
      window.TEACHER_CONTROLLER.renderCourses();
    } else if (window.TEACHER_CONTROLLER.currentTab === "lessons") {
      window.TEACHER_CONTROLLER.renderLessons();
    } else if (window.TEACHER_CONTROLLER.currentTab === "quizzes") {
      window.TEACHER_CONTROLLER.renderQuizzes();
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  TEACHER_CONTROLLER.init();
});
