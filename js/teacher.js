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
    liveStream: "edupeak_live_stream_config",
    submissions: "edupeak_quiz_submissions"
  },

  init() {
    this.checkAuth();
    this.loadCustomData();
    this.renderMetrics();
    this.switchTab("courses");
    this.populateCourseDropdowns();
  },

  checkAuth() {
    const user = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getCurrentUser() : null;
    if (user && (user.role === "teacher" || user.role === "admin")) {
      this.teacher = user;
    } else {
      // Default fallback session for instructor view
      this.teacher = {
        id: "TCH-PHYSICS",
        name: "Amalsha Wanniarachchi (MBBS UG)",
        name_si: "අමල්ෂ වන්නිආරච්චි (MBBS UG)",
        email: "amalsha@edupeak.lk",
        role: "teacher",
        subject: "G.C.E. Advanced Level Physics",
        branch: "Victory Embilipitiya & EduPeak",
        avatarLetter: "A"
      };
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
      const customCourses = JSON.parse(localStorage.getItem(this.storageKeys.customCourses) || "[]");
      if (customCourses.length && window.EDUPEAK_DATA) {
        customCourses.forEach(c => {
          if (!window.EDUPEAK_DATA.courses.find(item => item.id === c.id)) {
            window.EDUPEAK_DATA.courses.unshift(c);
          }
        });
      }

      const customLessons = JSON.parse(localStorage.getItem(this.storageKeys.customLessons) || "[]");
      if (customLessons.length && window.EDUPEAK_DATA) {
        customLessons.forEach(l => {
          if (!window.EDUPEAK_DATA.lmsLessons.find(item => item.id === l.id)) {
            window.EDUPEAK_DATA.lmsLessons.push(l);
          }
        });
      }

      // Synchronize quizzes and schedules databases
      this.getAllQuizzes();
      this.getAllScheduledBroadcasts();
    } catch (e) {
      console.warn("Error loading custom teacher data:", e);
    }
  },

  switchTab(tabId) {
    this.currentTab = tabId;

    // Highlight Tab Buttons
    document.querySelectorAll(".teacher-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });

    // Show Selected Pane
    document.querySelectorAll(".teacher-tab-pane").forEach(pane => {
      pane.classList.toggle("active", pane.id === `teacherTab_${tabId}`);
    });

    if (tabId === "courses") this.renderCourses();
    if (tabId === "lessons") this.renderLessons();
    if (tabId === "quizzes") this.renderQuizzes();
    if (tabId === "live") this.renderLiveStudio();
    if (tabId === "students") this.renderStudents();
    if (tabId === "gradebook") this.renderGradebook();
  },

  renderMetrics() {
    const courses = this.getTeacherCourses();
    const lessons = window.EDUPEAK_DATA ? window.EDUPEAK_DATA.lmsLessons || [] : [];
    const quizzes = this.getAllQuizzes ? this.getAllQuizzes() : (window.EDUPEAK_DATA ? window.EDUPEAK_DATA.quizQuestions || [] : []);
    const students = this.getRegisteredStudents ? this.getRegisteredStudents() : [];

    const mCourses = document.getElementById("metricTotalCourses");
    const mLessons = document.getElementById("metricTotalLessons");
    const mQuizzes = document.getElementById("metricTotalQuizzes");
    const mStudents = document.getElementById("metricTotalStudents");

    if (mCourses) mCourses.textContent = courses.length;
    if (mLessons) mLessons.textContent = lessons.length;
    if (mQuizzes) mQuizzes.textContent = quizzes.length;
    if (mStudents) mStudents.textContent = students.length > 0 ? `${students.length} Active` : "4,250+";
  },

  getTeacherCourses() {
    const stored = localStorage.getItem("edupeak_courses_db");
    let allCourses = stored ? JSON.parse(stored) : ((window.EDUPEAK_DATA && window.EDUPEAK_DATA.courses) ? window.EDUPEAK_DATA.courses : []);
    return allCourses;
  },

  saveCoursesDatabase(coursesList) {
    localStorage.setItem("edupeak_courses_db", JSON.stringify(coursesList));
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.courses = coursesList;
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

  openNewCourseModal() {
    document.getElementById("newCourseModal").classList.add("active");
  },

  openEditCourseModal(courseId) {
    const courses = this.getTeacherCourses();
    const c = courses.find(item => item.id === courseId);
    if (!c) return;

    document.getElementById("editCourseIdInput").value = c.id;
    document.getElementById("editCourseTitleInput").value = c.title;
    document.getElementById("editCourseTitleSiInput").value = c.title_si || "";
    if (document.getElementById("editCourseExamYearSelect")) {
      document.getElementById("editCourseExamYearSelect").value = c.examYear || c.level || "2026 A/L";
    }
    document.getElementById("editCourseCategorySelect").value = c.category || "theory";
    document.getElementById("editCourseFeeInput").value = c.fee || "LKR 3,500 / Month";
    document.getElementById("editCourseScheduleInput").value = c.liveTime || "Every Saturday 7:30 AM - 1:30 PM";
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

    courses[index].title = document.getElementById("editCourseTitleInput").value.trim();
    courses[index].title_si = document.getElementById("editCourseTitleSiInput").value.trim();
    courses[index].examYear = examYear;
    courses[index].level = examYear;
    courses[index].category = document.getElementById("editCourseCategorySelect").value;
    courses[index].fee = document.getElementById("editCourseFeeInput").value.trim() || courses[index].fee;
    courses[index].liveTime = document.getElementById("editCourseScheduleInput").value.trim() || courses[index].liveTime;
    courses[index].medium = document.getElementById("editCourseMediumInput").value.trim() || courses[index].medium;

    this.saveCoursesDatabase(courses);

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

      if (window.showToast) {
        window.showToast(`🗑️ Course "${c.title}" deleted.`, "info");
      }

      this.renderCourses();
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
    const titleSi = document.getElementById("courseTitleSiInput").value.trim();
    const examYear = document.getElementById("courseExamYearSelect") ? document.getElementById("courseExamYearSelect").value : "2026 A/L";
    const stream = document.getElementById("courseStreamSelect").value;
    const fee = document.getElementById("courseFeeInput").value.trim();
    const schedule = document.getElementById("courseScheduleInput").value.trim();
    const icon = document.getElementById("courseIconSelect").value;

    const newCourse = {
      id: "crs-phy-" + Date.now().toString(36),
      title: title,
      title_si: titleSi,
      teacherId: "tch-physics",
      teacherName: "Amalsha Wanniarachchi",
      examYear: examYear,
      stream: "Physical Science",
      stream_si: "භෞතික විද්‍යා අංශය",
      category: stream.includes("paper") ? "papers" : (stream.includes("rev") ? "revision" : "theory"),
      fee: fee ? (fee.startsWith("LKR") ? fee : `LKR ${fee} / Month`) : "LKR 3,500 / Month",
      liveTime: schedule || "Every Saturday 7:30 AM - 1:30 PM",
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
    const stored = localStorage.getItem("edupeak_lessons_db");
    if (stored) {
      return JSON.parse(stored);
    }
    const defaultLessons = (window.EDUPEAK_DATA && window.EDUPEAK_DATA.lmsLessons) ? window.EDUPEAK_DATA.lmsLessons : [];
    localStorage.setItem("edupeak_lessons_db", JSON.stringify(defaultLessons));
    return defaultLessons;
  },

  saveLessonsDatabase(lessonsList) {
    localStorage.setItem("edupeak_lessons_db", JSON.stringify(lessonsList));
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.lmsLessons = lessonsList;
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

    const selectedCourseId = document.getElementById("lessonCourseSelect")?.value;
    const allLessons = this.getAllLessons();
    
    // Filter lessons by selected course
    const filteredLessons = selectedCourseId
      ? allLessons.filter(l => l.courseId === selectedCourseId || (!l.courseId && selectedCourseId === "crs-phy-2025-theory"))
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
          ${l.hasPdf ? `<span style="color: #10b981; font-weight: 600; font-size: 0.8rem;"><i class="fa-solid fa-file-pdf"></i> ${l.pdfName || 'Notes.pdf'}</span>` : '<span style="color: #94a3b8; font-size: 0.8rem;">No Handout</span>'}
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

  openNewLessonModal() {
    const selectedCourseId = document.getElementById("lessonCourseSelect")?.value;
    const modalSelect = document.getElementById("modalLessonCourseSelect");
    if (modalSelect && selectedCourseId) {
      modalSelect.value = selectedCourseId;
    }
    const container = document.getElementById("newLessonChaptersContainer");
    if (container) {
      container.innerHTML = "";
      this.addChapterRowToNewModal("00:00", "Introduction & Key Concepts");
      this.addChapterRowToNewModal("25:00", "Worked Examples & Model Problems");
    }
    document.getElementById("newLessonModal").classList.add("active");
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
    const titleSiInput = document.getElementById("editLessonTitleSiInput");
    const durInput = document.getElementById("editLessonDurationInput");
    const videoInput = document.getElementById("editLessonVideoUrlInput");
    const pdfInput = document.getElementById("editLessonPdfNameInput");

    if (titleInput) titleInput.value = l.title || "";
    if (titleSiInput) titleSiInput.value = l.title_si || "";
    if (durInput) durInput.value = l.duration || "50 mins";
    if (videoInput) videoInput.value = l.videoUrl || "";
    if (pdfInput) pdfInput.value = l.pdfName || "";

    // Populate Chapter timeline rows
    const container = document.getElementById("editLessonChaptersContainer");
    if (container) {
      container.innerHTML = "";
      const chapters = l.chapters || [];
      if (chapters.length === 0) {
        this.addChapterRowToEditModal("00:00", "Introduction & Key Concepts");
      } else {
        chapters.forEach(ch => {
          this.addChapterRowToEditModal(ch.time, ch.title);
        });
      }
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
    const titleSi = document.getElementById("editLessonTitleSiInput").value.trim();
    const duration = document.getElementById("editLessonDurationInput").value.trim();
    const rawVideoUrl = document.getElementById("editLessonVideoUrlInput").value.trim();
    const pdfName = document.getElementById("editLessonPdfNameInput").value.trim();
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
      title_si: titleSi,
      duration: duration || "50 mins",
      videoUrl,
      hasPdf: Boolean(pdfName),
      pdfName,
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
    const titleSi = document.getElementById("lessonTitleSiInput").value.trim();
    const rawVideoUrl = document.getElementById("lessonVideoUrlInput").value.trim();
    const duration = document.getElementById("lessonDurationInput").value.trim();
    const hasPdf = document.getElementById("lessonHasPdfCheckbox").checked;
    const pdfName = document.getElementById("lessonPdfNameInput").value.trim();

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
      title_si: titleSi,
      duration: duration || "50 mins",
      videoUrl: videoUrl,
      hasPdf: hasPdf,
      pdfName: hasPdf ? (pdfName || `${title} Summary Sheet.pdf`) : "",
      chapters: chapters.length ? chapters : [
        { time: "00:00", title: "Introduction & Theory Review" },
        { time: "25:00", title: "Detailed Step Derivations & Calculations" }
      ]
    };

    // Save to Database
    const lessons = this.getAllLessons();
    lessons.push(newLesson);
    this.saveLessonsDatabase(lessons);

    if (window.showToast) {
      window.showToast(`✓ Lesson "${title}" published with chapter timeline!`, "success");
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
    const stored = localStorage.getItem(this.storageKeys.quizzesDb);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) {
          if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.quizQuestions = parsed;
          return parsed;
        }
      } catch (e) {
        console.warn("Failed parsing edupeak_quizzes_db", e);
      }
    }

    // Default questions from EDUPEAK_DATA or fallback
    let defaultQuizzes = (window.EDUPEAK_DATA && window.EDUPEAK_DATA.quizQuestions) 
      ? JSON.parse(JSON.stringify(window.EDUPEAK_DATA.quizQuestions)) 
      : [];

    // Also include custom quizzes if any were saved before
    try {
      const custom = JSON.parse(localStorage.getItem(this.storageKeys.customQuizzes) || "[]");
      custom.forEach(cq => {
        if (!defaultQuizzes.find(item => item.id == cq.id)) {
          defaultQuizzes.push(cq);
        }
      });
    } catch (e) {}

    // Ensure all items have an id and normalized courseId
    defaultQuizzes.forEach((q, idx) => {
      if (!q.id) q.id = idx + 1;
      if (q.courseId === "crs-phy-2025") q.courseId = "crs-phy-2025-theory";
      if (q.courseId === "crs-phy-2026") q.courseId = "crs-phy-2026-theory";
    });

    localStorage.setItem(this.storageKeys.quizzesDb, JSON.stringify(defaultQuizzes));
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.quizQuestions = defaultQuizzes;
    }
    return defaultQuizzes;
  },

  saveQuizzesDatabase(quizzesList) {
    localStorage.setItem(this.storageKeys.quizzesDb, JSON.stringify(quizzesList));
    localStorage.setItem(this.storageKeys.customQuizzes, JSON.stringify(quizzesList));
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.quizQuestions = quizzesList;
    }
  },

  renderQuizzes() {
    const list = document.getElementById("teacherQuizList");
    if (!list) return;

    const selectedCourseId = document.getElementById("quizCourseSelect")?.value;
    const questions = this.getAllQuizzes();

    // Filter questions by selected course
    const filteredQuestions = (selectedCourseId && selectedCourseId !== "all")
      ? questions.filter(q => {
          if (!q.courseId) return true;
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
  // 4. LIVE STUDIO BROADCAST & SCHEDULE CONTROLS (SCHEDULE, EDIT, DELETE)
  // --------------------------------------------------------------------------
  formatEmbedUrl(url, provider) {
    if (!url) return "https://www.youtube.com/embed/dQw4w9WgXcQ";
    
    // YouTube Watch link conversion: youtube.com/watch?v=XYZ -> youtube.com/embed/XYZ
    if (url.includes("youtube.com/watch?v=")) {
      const videoId = url.split("v=")[1]?.split("&")[0];
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    // YouTube Short link conversion: youtu.be/XYZ -> youtube.com/embed/XYZ
    if (url.includes("youtu.be/")) {
      const videoId = url.split("youtu.be/")[1]?.split("?")[0];
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
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
    const stored = localStorage.getItem(this.storageKeys.schedulesDb);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch (e) {
        console.warn("Failed parsing edupeak_schedules_db", e);
      }
    }

    const defaultSchedules = [
      {
        id: "sched-phy-01",
        topic: "2027 A/L Physics - Mechanics Special Live Broadcast",
        courseId: "crs-phy-2025-theory",
        courseTitle: "2027 A/L Physics - Complete Theory & Mechanics",
        scheduleTime: "Every Saturday 7:30 AM - 1:30 PM",
        provider: "youtube",
        rawUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        status: "scheduled",
        updatedAt: new Date().toISOString()
      },
      {
        id: "sched-phy-02",
        topic: "2028 A/L Physics - Units & Dimensional Analysis Live Masterclass",
        courseId: "crs-phy-2026-theory",
        courseTitle: "2028 A/L Physics - Complete Theory Batch",
        scheduleTime: "Every Sunday 8:00 AM - 12:30 PM",
        provider: "youtube",
        rawUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        status: "scheduled",
        updatedAt: new Date().toISOString()
      }
    ];

    localStorage.setItem(this.storageKeys.schedulesDb, JSON.stringify(defaultSchedules));
    return defaultSchedules;
  },

  saveScheduledBroadcasts(list) {
    localStorage.setItem(this.storageKeys.schedulesDb, JSON.stringify(list));
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
        ? `<span class="status-tag active" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca;"><i class="fa-solid fa-circle" style="font-size: 0.55rem;"></i> LIVE NOW</span>`
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
            <div style="display: flex; gap: 0.35rem;">
              <button class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="TEACHER_CONTROLLER.openEditSchedule('${s.id}')" title="Edit Schedule">
                <i class="fa-solid fa-pen-to-square"></i> Edit
              </button>
              <button class="btn btn-ghost btn-sm" style="color: #ef4444; border: 1px solid #fecaca; font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="TEACHER_CONTROLLER.handleDeleteSchedule('${s.id}')" title="Delete / Cancel Schedule">
                <i class="fa-solid fa-trash"></i> Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  openEditSchedule(scheduleId) {
    const schedules = this.getAllScheduledBroadcasts();
    const s = schedules.find(item => item.id === scheduleId);
    if (!s) return;

    document.getElementById("liveStudioScheduleId").value = s.id;
    document.getElementById("liveStudioTopic").value = s.topic;
    if (document.getElementById("liveStudioCourseSelect") && s.courseId) {
      document.getElementById("liveStudioCourseSelect").value = s.courseId;
    }
    document.getElementById("liveStudioScheduleTime").value = s.scheduleTime || "";
    document.getElementById("liveStudioProvider").value = s.provider || "youtube";
    document.getElementById("liveStudioStatus").value = s.status || "scheduled";
    document.getElementById("liveStudioUrl").value = s.rawUrl || s.embedUrl || "";

    const btnText = document.getElementById("btnSaveScheduleText");
    if (btnText) btnText.textContent = "Save Changes & Update Schedule";

    const previewIframe = document.getElementById("teacherLivePreviewIframe");
    const badgeEl = document.getElementById("livePreviewStatusBadge");
    if (previewIframe) previewIframe.src = s.embedUrl;
    if (badgeEl) {
      const isLive = s.status === "live";
      badgeEl.textContent = isLive ? "🔴 LIVE NOW" : (s.status === "ended" ? "⏹️ Concluded" : "⏳ Scheduled");
      badgeEl.style.background = isLive ? "#fee2e2" : "#fefce8";
      badgeEl.style.color = isLive ? "#dc2626" : "#854d0e";
    }

    // Smooth scroll up to form
    const formEl = document.getElementById("liveStudioForm");
    if (formEl) {
      formEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (window.showToast) {
      window.showToast(`Editing Schedule: "${s.topic}"`, "info");
    }
  },

  resetScheduleForm() {
    document.getElementById("liveStudioScheduleId").value = "";
    document.getElementById("liveStudioTopic").value = "";
    document.getElementById("liveStudioScheduleTime").value = "";
    document.getElementById("liveStudioUrl").value = "";
    document.getElementById("liveStudioStatus").value = "scheduled";
    const btnText = document.getElementById("btnSaveScheduleText");
    if (btnText) btnText.textContent = "Save & Push Broadcast Schedule";

    const formEl = document.getElementById("liveStudioForm");
    if (formEl) formEl.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("liveStudioTopic").focus();
  },

  handleDeleteSchedule(scheduleId) {
    const schedules = this.getAllScheduledBroadcasts();
    const s = schedules.find(item => item.id === scheduleId);
    if (!s) return;

    if (confirm(`Are you sure you want to permanently delete this broadcast schedule?\n"${s.topic}"`)) {
      const updated = schedules.filter(item => item.id !== scheduleId);
      this.saveScheduledBroadcasts(updated);

      // Check if this was currently saved in edupeak_live_stream_config
      const activeStream = localStorage.getItem(this.storageKeys.liveStream);
      if (activeStream) {
        try {
          const parsed = JSON.parse(activeStream);
          if (parsed.scheduleId === scheduleId || parsed.topic === s.topic) {
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

      // If current form was editing this schedule, clear it
      if (document.getElementById("liveStudioScheduleId")?.value === scheduleId) {
        this.resetScheduleForm();
      }

      if (window.showToast) {
        window.showToast(`🗑️ Schedule "${s.topic}" deleted and removed from LMS.`, "info");
      }

      this.renderSchedulesTable();
      this.renderLiveStudio();
    }
  },

  handleDeleteCurrentSchedule() {
    const currentId = document.getElementById("liveStudioScheduleId")?.value;
    if (currentId) {
      this.handleDeleteSchedule(currentId);
      return;
    }

    const topic = document.getElementById("liveStudioTopic")?.value.trim();
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

      document.getElementById("liveStudioScheduleId").value = "";
      document.getElementById("liveStudioTopic").value = "";
      document.getElementById("liveStudioScheduleTime").value = "";
      document.getElementById("liveStudioUrl").value = "";
      document.getElementById("liveStudioStatus").value = "ended";

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
    e.preventDefault();
    const scheduleId = document.getElementById("liveStudioScheduleId")?.value || ("sched-" + Date.now().toString(36));
    const topic = document.getElementById("liveStudioTopic").value.trim();
    const courseSelect = document.getElementById("liveStudioCourseSelect");
    const courseId = courseSelect ? courseSelect.value : "";
    const courseTitle = courseSelect && courseSelect.selectedOptions[0] ? courseSelect.selectedOptions[0].text : "";
    const scheduleTime = document.getElementById("liveStudioScheduleTime")?.value.trim() || "Every Saturday 7:30 AM";
    const provider = document.getElementById("liveStudioProvider").value;
    const rawUrl = document.getElementById("liveStudioUrl").value.trim();
    const status = document.getElementById("liveStudioStatus").value;

    const embedUrl = this.formatEmbedUrl(rawUrl, provider);

    const streamConfig = { 
      scheduleId,
      id: scheduleId,
      topic,
      courseId,
      courseTitle,
      scheduleTime,
      provider, 
      rawUrl, 
      embedUrl, 
      status, 
      updatedAt: new Date().toISOString() 
    };

    // Save active live stream for student LMS and LMS classroom player
    localStorage.setItem(this.storageKeys.liveStream, JSON.stringify(streamConfig));

    // Also update schedules directory
    const schedules = this.getAllScheduledBroadcasts();
    const existingIdx = schedules.findIndex(item => item.id === scheduleId);
    if (existingIdx >= 0) {
      schedules[existingIdx] = streamConfig;
    } else {
      schedules.unshift(streamConfig);
    }
    this.saveScheduledBroadcasts(schedules);

    // Update Teacher Live Monitor Preview
    const previewIframe = document.getElementById("teacherLivePreviewIframe");
    const badgeEl = document.getElementById("livePreviewStatusBadge");
    if (previewIframe) previewIframe.src = embedUrl;
    if (badgeEl) {
      const isLive = status === "live";
      badgeEl.textContent = isLive ? "🔴 LIVE NOW" : (status === "ended" ? "⏹️ Concluded" : "⏳ Scheduled");
      badgeEl.style.background = isLive ? "#fee2e2" : "#fefce8";
      badgeEl.style.color = isLive ? "#dc2626" : "#854d0e";
    }

    const btnText = document.getElementById("btnSaveScheduleText");
    if (btnText) btnText.textContent = "Save & Push Broadcast Schedule";

    if (window.showToast) {
      window.showToast(`✓ Broadcast schedule "${topic}" saved and published to LMS!`, "success");
    }

    this.renderSchedulesTable();
  },

  renderLiveStudio() {
    const saved = localStorage.getItem(this.storageKeys.liveStream);
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
        const cfg = JSON.parse(saved);
        if (titleEl && cfg.topic) titleEl.value = cfg.topic;
        if (urlEl && (cfg.rawUrl || cfg.embedUrl)) urlEl.value = cfg.rawUrl || cfg.embedUrl;
        if (statusEl && cfg.status) statusEl.value = cfg.status;
        if (providerEl && cfg.provider) providerEl.value = cfg.provider;
        if (timeEl && cfg.scheduleTime) timeEl.value = cfg.scheduleTime;
        if (courseEl && cfg.courseId) courseEl.value = cfg.courseId;
        if (previewIframe && cfg.embedUrl) previewIframe.src = cfg.embedUrl;
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
      { id: "SUB-801", name: "Kasun Jayasundara", indexNo: "EP-2025-001", exam: "2026 A/L Physics Paper 01", score: "92 / 100", grade: "A (Distinction)", date: "Today 08:30 AM" },
      { id: "SUB-802", name: "Malith Sandeepa", indexNo: "EP-2025-084", exam: "2026 A/L Physics Paper 01", score: "88 / 100", grade: "A (Distinction)", date: "Today 08:15 AM" },
      { id: "SUB-803", name: "Dilshan Wickramasinghe", indexNo: "EP-2025-112", exam: "2026 A/L Physics Paper 01", score: "74 / 100", grade: "B (Very Good)", date: "Yesterday" },
      { id: "SUB-804", name: "Sewwandi Jayasinghe", indexNo: "EP-2025-245", exam: "2026 A/L Physics Paper 01", score: "68 / 100", grade: "C (Credit)", date: "Yesterday" }
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
        stream: "Physical Science (Combined Maths)",
        examYear: "2027 A/L",
        institute: "Victory Embilipitiya",
        branch: "Victory Embilipitiya",
        enrolledModule: "2027 A/L Complete Theory & Mechanics Masterclass",
        joinedDate: "2025-01-10",
        status: "Active & Enrolled"
      },
      {
        id: "EP-2026-042",
        name: "Malith Sandeepa",
        name_si: "මලිත් සන්දීප",
        email: "malith.sandeepa@gmail.com",
        phone: "0714589231",
        stream: "Physical Science",
        examYear: "2026 A/L",
        institute: "EduPeak Colombo & Victory",
        branch: "Colombo Central",
        enrolledModule: "2026 A/L Physics Speed Revision & Paper Class",
        joinedDate: "2024-05-18",
        status: "Active & Enrolled"
      },
      {
        id: "EP-2026-088",
        name: "Sewwandi Jayasinghe",
        name_si: "සෙව්වන්දි ජයසිංහ",
        email: "sewwandi.j@outlook.com",
        phone: "0789123450",
        stream: "Biological Science",
        examYear: "2026 A/L",
        institute: "Victory Embilipitiya",
        branch: "Victory Embilipitiya",
        enrolledModule: "2026 A/L Advanced Physics Theory & MCQ Revision",
        joinedDate: "2024-06-22",
        status: "Active & Enrolled"
      },
      {
        id: "EP-2027-112",
        name: "Dilshan Wickramasinghe",
        name_si: "දිල්ෂාන් වික්‍රමසිංහ",
        email: "dilshan.wick@gmail.com",
        phone: "0703456789",
        stream: "Physical Science",
        examYear: "2027 A/L",
        institute: "Victory Embilipitiya",
        branch: "Victory Embilipitiya",
        enrolledModule: "2027 A/L Complete Theory & Mechanics Masterclass",
        joinedDate: "2025-02-01",
        status: "Active & Enrolled"
      },
      {
        id: "EP-2026-173",
        name: "Tharindu Prabhashwara",
        name_si: "තරිඳු ප්‍රභාෂ්වර",
        email: "tharindu.p@yahoo.com",
        phone: "0765543210",
        stream: "Physical Science",
        examYear: "2026 A/L",
        institute: "EduPeak Online LMS",
        branch: "Island-wide Virtual",
        enrolledModule: "2026 A/L Physics Speed Revision & Paper Class",
        joinedDate: "2024-08-14",
        status: "Active & Enrolled"
      },
      {
        id: "EP-2027-204",
        name: "Nethmi Kavindya",
        name_si: "නෙත්මි කවින්ද්‍යා",
        email: "nethmi.kavi@gmail.com",
        phone: "0723344556",
        stream: "Biological Science",
        examYear: "2027 A/L",
        institute: "Victory Embilipitiya",
        branch: "Victory Embilipitiya",
        enrolledModule: "2027 A/L Complete Theory & Mechanics Masterclass",
        joinedDate: "2025-02-15",
        status: "Active & Enrolled"
      },
      {
        id: "EP-2028-019",
        name: "Chathura Senarathne",
        name_si: "චතුර සෙනරත්න",
        email: "chathura.s@gmail.com",
        phone: "0758899001",
        stream: "Physical Science",
        examYear: "2028 A/L",
        institute: "Victory Embilipitiya",
        branch: "Victory Embilipitiya",
        enrolledModule: "2028 A/L Physics Fundamentals Masterclass",
        joinedDate: "2025-03-01",
        status: "Active & Enrolled"
      },
      {
        id: "EP-2027-055",
        name: "Dinuka Fernando",
        name_si: "දිනුක ප්‍රනාන්දු",
        email: "dinuka.f@gmail.com",
        phone: "0718877665",
        stream: "Physical Science",
        examYear: "2027 A/L",
        institute: "Victory Embilipitiya",
        branch: "Victory Embilipitiya",
        enrolledModule: "2027 A/L Complete Theory & Mechanics Masterclass",
        joinedDate: "2025-01-28",
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

  renderStudents() {
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
      const avatarChar = (s.avatarLetter || s.name.charAt(0)).toUpperCase();
      const examBadge = s.examYear 
        ? `<span class="status-tag active" style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; font-weight: 700; font-size: 0.75rem;"><i class="fa-solid fa-graduation-cap"></i> ${s.examYear}</span>`
        : `<span class="status-tag" style="background: #f1f5f9; color: #64748b;">General Batch</span>`;

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
            <div style="font-size: 0.8rem; color: #334155; font-weight: 600;"><i class="fa-solid fa-envelope" style="color: #64748b; font-size: 0.75rem;"></i> ${s.email || '-'}</div>
            <div style="font-size: 0.75rem; color: #64748b;"><i class="fa-solid fa-phone" style="color: #64748b; font-size: 0.7rem;"></i> ${s.phone || 'Contact via Institute'}</div>
          </td>
          <td>${examBadge}</td>
          <td>
            <div style="font-size: 0.8rem; font-weight: 600; color: #0f172a;">${s.stream || 'Physical Science'}</div>
            <div style="font-size: 0.72rem; color: #64748b;"><i class="fa-solid fa-location-dot" style="color: #227aff; font-size: 0.7rem;"></i> ${s.branch || s.institute || 'Victory Embilipitiya'}</div>
          </td>
          <td>
            <span style="font-size: 0.78rem; font-weight: 600; color: #1e293b; background: #f8fafc; padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid #e2e8f0; display: inline-block; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${s.enrolledModule || s.batch || '2027 A/L Physics'}">
              ${s.enrolledModule || s.batch || '2027 A/L Physics'}
            </span>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span class="status-tag active" style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; font-size: 0.72rem;">
                <i class="fa-solid fa-circle-check"></i> Enrolled
              </span>
              <span style="font-size: 0.7rem; font-weight: 600; color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.15rem 0.45rem; border-radius: 4px;" title="Read-Only View">
                <i class="fa-solid fa-eye"></i> Read-Only
              </span>
            </div>
          </td>
        </tr>
      `;
    }).join("");
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

    setTimeout(() => {
      window.location.href = "index.html";
    }, 350);
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

document.addEventListener("DOMContentLoaded", () => {
  TEACHER_CONTROLLER.init();
});
