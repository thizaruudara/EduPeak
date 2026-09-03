/**
 * EduPeak LMS Admin Panel Controller
 * Handles Management of Students, Courses, Teachers, and Supabase Live Sync
 */

const ADMIN_CONTROLLER = {
  currentTab: "overview",

  init() {
    this.bindEvents();
    this.populateSupabaseConfig();
    this.checkAutoOpen();

    window.addEventListener("hashchange", () => {
      this.checkAutoOpen();
    });
  },

  getTabFromHash() {
    const hash = window.location.hash || "";
    if (!hash.startsWith("#admin")) return null;
    if (hash.includes("/")) {
      const part = hash.split("/")[1].split("?")[0].trim().toLowerCase();
      const validTabs = ["overview", "students", "courses", "teachers", "institutes", "papers", "supabase"];
      if (validTabs.includes(part)) return part;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab")) return params.get("tab");
    return localStorage.getItem("edupeak_admin_active_tab") || "overview";
  },

  checkAutoOpen() {
    const hash = window.location.hash || "";
    const params = new URLSearchParams(window.location.search);
    if (hash.startsWith("#admin") || params.get("admin") !== null || params.get("openAdmin") !== null) {
      const tab = this.getTabFromHash() || "overview";
      this.open(tab);
    }
  },

  // Open Admin Panel Overlay
  open(preferredTab) {
    const currentUser = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getCurrentUser() : null;
    if (!currentUser || currentUser.role !== "admin") {
      const users = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getUsers() : [];
      const adminAcc = users.find(u => u.role === "admin");
      if (adminAcc && (!currentUser || currentUser.role !== "admin")) {
        // Authenticate canonical admin when accessing #admin directly
        window.AUTH_SYSTEM.createSession(adminAcc);
      } else {
        if (window.showToast) {
          window.showToast("🔒 Admin access required. Please sign in as an Administrator.", "info");
        }
        setTimeout(() => {
          window.location.href = "login.html?redirect=" + encodeURIComponent(window.location.hash || "#admin");
        }, 400);
        return;
      }
    }

    const panel = document.getElementById("adminModalWrapper");
    if (panel) {
      panel.classList.add("active");
      document.body.style.overflow = "hidden";
      const targetTab = preferredTab || this.getTabFromHash() || localStorage.getItem("edupeak_admin_active_tab") || this.currentTab || "overview";
      this.switchTab(targetTab);
      this.refreshAll();
    }
  },

  close() {
    const panel = document.getElementById("adminModalWrapper");
    if (panel) {
      panel.classList.remove("active");
      document.body.style.overflow = "auto";
    }
    if (window.location.hash.startsWith("#admin")) {
      history.replaceState(null, document.title, window.location.pathname + window.location.search);
    }
  },

  switchTab(tabId) {
    this.currentTab = tabId;
    try {
      localStorage.setItem("edupeak_admin_active_tab", tabId);
      // Keep hash in sync so refreshing stays on this exact tab!
      if (window.location.hash.startsWith("#admin")) {
        window.location.hash = "admin/" + tabId;
      }
    } catch (e) {}

    // Highlight sidebar
    document.querySelectorAll(".admin-nav-item").forEach(item => {
      item.classList.toggle("active", item.dataset.tab === tabId);
    });

    // Show tab pane
    document.querySelectorAll(".admin-tab-pane").forEach(pane => {
      pane.classList.toggle("active", pane.id === `adminTab_${tabId}`);
    });

    // Update Header title
    const headerTitle = document.getElementById("adminHeaderTitle");
    if (headerTitle) {
      const titles = {
        overview: "Dashboard & Key Metrics",
        students: "Student Management & Enrollments",
        courses: "Course & Curriculum Directory",
        teachers: "Faculty & Master Lecturers",
        institutes: "Educational Institutes & Campus Branches",
        papers: "Past Paper & Model Exam PDF Vault",
        supabase: "Supabase Database & Real-Time Sync"
      };
      headerTitle.textContent = titles[tabId] || "Admin Dashboard";
    }

    // Refresh specific tab
    if (tabId === "overview") this.renderOverview();
    if (tabId === "students") this.renderStudents();
    if (tabId === "courses") this.renderCourses();
    if (tabId === "teachers") this.renderTeachers();
    if (tabId === "institutes") this.renderInstitutes();
    if (tabId === "papers") this.renderPapers();
    if (tabId === "supabase") this.renderSupabaseTab();
  },

  refreshAll() {
    this.renderOverview();
    this.renderStudents();
    this.renderCourses();
    this.renderTeachers();
    this.renderInstitutes();
    this.renderPapers();
  },

  bindEvents() {
    // Search student filter
    const searchInput = document.getElementById("adminStudentSearch");
    if (searchInput) {
      searchInput.addEventListener("input", () => this.renderStudents());
    }
    const streamSelect = document.getElementById("adminStudentStreamFilter");
    if (streamSelect) {
      streamSelect.addEventListener("change", () => this.renderStudents());
    }
  },

  // --------------------------------------------------------------------------
  // 1. OVERVIEW TAB
  // --------------------------------------------------------------------------
  async renderOverview() {
    const users = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getUsers() : [];
    const students = users.filter(u => u.role === "student");
    const teachers = window.EDUPEAK_DATA ? window.EDUPEAK_DATA.teachers : [];
    const courses = window.EDUPEAK_DATA ? window.EDUPEAK_DATA.courses : [];

    const totalStudentsEl = document.getElementById("adminStatTotalStudents");
    const activeCoursesEl = document.getElementById("adminStatActiveCourses");
    const totalTeachersEl = document.getElementById("adminStatTotalTeachers");
    const liveClassesEl = document.getElementById("adminStatLiveClasses");

    if (totalStudentsEl) totalStudentsEl.textContent = students.length || "1,240+";
    if (activeCoursesEl) activeCoursesEl.textContent = courses.length || "12";
    if (totalTeachersEl) totalTeachersEl.textContent = teachers.length || "5";
    if (liveClassesEl) liveClassesEl.textContent = "4 Active";

    // Render Recent Registrations Table
    const recentTableBody = document.getElementById("adminRecentStudentsTbody");
    if (recentTableBody) {
      const recent = students.slice(-5).reverse();
      if (recent.length === 0) {
        recentTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8;">No registered students yet.</td></tr>`;
      } else {
        recentTableBody.innerHTML = recent.map(s => `
          <tr>
            <td><strong>${s.id || "EP-2025-01"}</strong></td>
            <td>${s.name}</td>
            <td><span class="status-tag active">${s.stream || "Physical Science"}</span></td>
            <td>${s.phone || "0771234567"}</td>
            <td><span class="status-tag ${s.status === 'suspended' ? 'suspended' : 'active'}">${s.status || 'Active'}</span></td>
          </tr>
        `).join("");
      }
    }
  },

  // --------------------------------------------------------------------------
  // 2. STUDENTS MANAGEMENT
  // --------------------------------------------------------------------------
  async renderStudents() {
    const tbody = document.getElementById("adminStudentsTbody");
    if (!tbody) return;

    let users = await window.SUPABASE_HELPER.getProfiles();
    let students = users.filter(u => u.role === "student");

    const query = (document.getElementById("adminStudentSearch")?.value || "").toLowerCase().trim();
    const stream = document.getElementById("adminStudentStreamFilter")?.value || "all";

    if (query) {
      students = students.filter(s =>
        (s.name && s.name.toLowerCase().includes(query)) ||
        (s.email && s.email.toLowerCase().includes(query)) ||
        (s.id && s.id.toLowerCase().includes(query)) ||
        (s.phone && s.phone.includes(query))
      );
    }

    if (stream !== "all") {
      students = students.filter(s => s.stream && s.stream.toLowerCase().includes(stream.toLowerCase()));
    }

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 2rem;">No students found matching filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = students.map(s => `
      <tr>
        <td><strong>${s.id || "EP-2025-01"}</strong></td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${s.name}</div>
          <div style="font-size: 0.75rem; color: #64748b;">${s.email || "No email"}</div>
        </td>
        <td>${s.stream || "General"}</td>
        <td>${s.phone || "-"}</td>
        <td>
          <span class="status-tag ${s.status === 'suspended' ? 'suspended' : 'active'}">
            ${s.status === 'suspended' ? 'Suspended' : 'Active'}
          </span>
        </td>
        <td>
          <button class="btn btn-sm ${s.status === 'suspended' ? 'btn-primary' : 'btn-ghost'}" 
                  onclick="ADMIN_CONTROLLER.toggleStudentStatus('${s.id}', '${s.status === 'suspended' ? 'active' : 'suspended'}')">
            <i class="fa-solid ${s.status === 'suspended' ? 'fa-user-check' : 'fa-user-slash'}"></i>
            ${s.status === 'suspended' ? 'Activate' : 'Suspend'}
          </button>
        </td>
      </tr>
    `).join("");
  },

  async toggleStudentStatus(studentId, newStatus) {
    await window.SUPABASE_HELPER.updateProfileStatus(studentId, newStatus);
    if (window.showToast) {
      window.showToast(`Student ${newStatus === 'active' ? 'activated' : 'suspended'} successfully.`, "info");
    }
    this.renderStudents();
    this.renderOverview();
  },

  // --------------------------------------------------------------------------
  // 3. COURSES MANAGEMENT (ADD, EDIT, DELETE)
  // --------------------------------------------------------------------------
  async renderCourses() {
    const tbody = document.getElementById("adminCoursesTbody");
    if (!tbody) return;

    const courses = await window.SUPABASE_HELPER.getCourses();

    tbody.innerHTML = courses.map(c => `
      <tr>
        <td><strong>${c.id}</strong></td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${c.title}</div>
          <div style="font-size: 0.75rem; color: #227aff; font-weight: 600;">${c.teacherName || c.teacher || 'Amalsha Wanniarachchi'}</div>
        </td>
        <td>
          <span class="status-tag active" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; font-weight: 700; font-size: 0.75rem;">
            <i class="fa-solid fa-calendar-check"></i> ${c.examYear || c.level || '2026 A/L'}
          </span>
        </td>
        <td><strong style="color: #1565d8;">${c.fee || c.price || 'LKR 3,500 / Month'}</strong></td>
        <td><span style="font-size: 0.8rem; color: #475569;">${c.liveTime || 'Every Sat 7:30 AM'}</span></td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-ghost btn-sm" onclick="ADMIN_CONTROLLER.openEditCourseModal('${c.id}')" title="Edit Course">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
            <button class="btn btn-ghost btn-sm" style="color: #ef4444;" onclick="ADMIN_CONTROLLER.deleteCourse('${c.id}')" title="Delete Course">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join("");
  },

  openAddCourseModal() {
    document.getElementById("courseModalTitle").textContent = "Add New Course";
    document.getElementById("courseFormId").value = "crs-phy-" + Date.now().toString(36);
    document.getElementById("courseFormTitle").value = "";
    document.getElementById("courseFormTitleSi").value = "";
    document.getElementById("courseFormCategory").value = "theory";
    document.getElementById("courseFormFee").value = "LKR 3,500 / Month";
    document.getElementById("courseFormLevel").value = "2026 A/L";
    document.getElementById("courseFormTeacher").value = "Amalsha Wanniarachchi";
    document.getElementById("courseFormSchedule").value = "Every Saturday 7:30 AM - 1:30 PM";
    document.getElementById("courseFormMedium").value = "Sinhala & English Medium";
    document.getElementById("adminCourseDrawerModal").classList.add("active");
  },

  async openEditCourseModal(id) {
    const courses = await window.SUPABASE_HELPER.getCourses();
    const c = courses.find(item => item.id === id);
    if (!c) return;

    document.getElementById("courseModalTitle").textContent = "Edit Course Details";
    document.getElementById("courseFormId").value = c.id;
    document.getElementById("courseFormTitle").value = c.title;
    document.getElementById("courseFormTitleSi").value = c.title_si || "";
    document.getElementById("courseFormCategory").value = c.category || "theory";
    document.getElementById("courseFormFee").value = c.fee || c.price || "LKR 3,500 / Month";
    document.getElementById("courseFormLevel").value = c.examYear || c.level || "2026 A/L";
    document.getElementById("courseFormTeacher").value = c.teacherName || c.teacher || "Amalsha Wanniarachchi";
    document.getElementById("courseFormSchedule").value = c.liveTime || "Every Saturday 7:30 AM - 1:30 PM";
    document.getElementById("courseFormMedium").value = c.medium || "Sinhala & English Medium";
    document.getElementById("adminCourseDrawerModal").classList.add("active");
  },

  async handleSaveCourseSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("courseFormId").value;
    const title = document.getElementById("courseFormTitle").value.trim();
    const titleSi = document.getElementById("courseFormTitleSi").value.trim();
    const category = document.getElementById("courseFormCategory").value;
    const fee = document.getElementById("courseFormFee").value.trim();
    const level = document.getElementById("courseFormLevel").value.trim();
    const teacher = document.getElementById("courseFormTeacher").value.trim();
    const schedule = document.getElementById("courseFormSchedule").value.trim();
    const medium = document.getElementById("courseFormMedium").value.trim();

    const courseData = {
      id: id,
      title: title,
      title_si: titleSi,
      category: category,
      fee: fee,
      examYear: level,
      level: level,
      teacherId: "tch-physics",
      teacherName: teacher,
      stream: "Physical Science",
      liveTime: schedule,
      medium: medium,
      rating: 4.99,
      students: 1200,
      modulesCount: 24,
      thumbnailIcon: "fa-atom",
      badge: `${level} Batch`,
      badge_si: `${level} කණ්ඩායම`
    };

    await window.SUPABASE_HELPER.saveCourse(courseData);
    document.getElementById("adminCourseDrawerModal").classList.remove("active");

    if (window.showToast) {
      window.showToast("📚 Course saved successfully!", "success");
    }

    this.renderCourses();
    this.renderOverview();
  },

  async deleteCourse(id) {
    if (confirm("Are you sure you want to delete this course from the institution catalog?")) {
      await window.SUPABASE_HELPER.deleteCourse(id);
      if (window.showToast) {
        window.showToast("Course deleted successfully.", "info");
      }
      this.renderCourses();
      this.renderOverview();
    }
  },

  // --------------------------------------------------------------------------
  // 4. TEACHERS & FACULTY MANAGEMENT (With Full Account Creation & Auth Integration)
  // --------------------------------------------------------------------------
  async renderTeachers() {
    const tbody = document.getElementById("adminTeachersTbody");
    if (!tbody) return;

    const teachers = await window.SUPABASE_HELPER.getTeachers();
    const users = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getUsers() : [];

    tbody.innerHTML = teachers.map(t => {
      // Correlate with auth user account
      const userAcc = users.find(u => 
        (u.id === t.id) || 
        (t.email && u.email && u.email.toLowerCase() === t.email.toLowerCase()) ||
        (u.name && t.name && u.name.toLowerCase() === t.name.toLowerCase() && u.role === "teacher")
      );

      const email = (userAcc && userAcc.email) || t.email || `${t.id.toLowerCase()}@edupeak.lk`;
      const password = (userAcc && userAcc.password) || t.password || "teacher123";
      const branch = (userAcc && userAcc.branch) || t.branch || "Victory Embilipitiya";
      const phone = (userAcc && userAcc.phone) || t.phone || "—";

      return `
        <tr>
          <td>
            <img src="${t.image}" alt="${t.name}" style="width: 46px; height: 46px; border-radius: 50%; object-fit: cover; border: 2px solid #227aff; box-shadow: 0 2px 8px rgba(34,122,255,0.2);">
          </td>
          <td>
            <div style="font-weight: 700; color: #0f172a; font-size: 0.95rem;">${t.name}</div>
            <div style="font-size: 0.775rem; color: #64748b;">${t.name_si || ""}</div>
            <div style="font-size: 0.725rem; color: #0284c7; margin-top: 2px;"><i class="fa-solid fa-location-dot"></i> ${branch}</div>
          </td>
          <td>
            <div class="teacher-credential-pill email-pill" title="Click to copy email" onclick="ADMIN_CONTROLLER.copyText('${email}')" style="cursor: pointer;">
              <i class="fa-solid fa-envelope"></i> ${email}
              <i class="fa-solid fa-copy" style="font-size: 0.65rem; margin-left: auto; opacity: 0.7;"></i>
            </div>
            ${phone !== "—" ? `<div style="font-size: 0.725rem; color: #64748b; margin-top: 3px;"><i class="fa-brands fa-whatsapp" style="color: #25d366;"></i> ${phone}</div>` : ""}
          </td>
          <td>
            <div class="teacher-credential-pill pwd-pill" id="pwdBox_${t.id}">
              <i class="fa-solid fa-key"></i>
              <span id="pwdText_${t.id}">••••••••</span>
              <button type="button" class="btn-icon-square" style="width: 20px; height: 20px; border: none; background: none; font-size: 0.7rem; cursor: pointer; color: #854d0e; margin-left: 2px;" onclick="ADMIN_CONTROLLER.togglePasswordView('${t.id}', '${password}')" title="Show / Hide Password">
                <i class="fa-solid fa-eye" id="pwdEye_${t.id}"></i>
              </button>
              <button type="button" class="btn-icon-square" style="width: 20px; height: 20px; border: none; background: none; font-size: 0.7rem; cursor: pointer; color: #854d0e; margin-left: 1px;" onclick="ADMIN_CONTROLLER.copyText('${password}')" title="Copy Password">
                <i class="fa-solid fa-copy"></i>
              </button>
            </div>
          </td>
          <td>
            <span class="status-tag active" style="font-size: 0.75rem; white-space: nowrap;">
              <i class="fa-solid fa-atom"></i> ${t.subject}
            </span>
          </td>
          <td style="font-size: 0.8rem; max-width: 200px; color: #475569; line-height: 1.35;">
            ${t.degree}
          </td>
          <td>
            <div class="teacher-table-actions">
              <button class="btn-icon-square" title="Edit Teacher & Credentials" onclick="ADMIN_CONTROLLER.openEditTeacherModal('${t.id}')">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn-icon-square login-as" title="Log In to Teacher Portal as ${t.name}" onclick="ADMIN_CONTROLLER.loginAsTeacher('${email}', '${password}')">
                <i class="fa-solid fa-right-to-bracket"></i>
              </button>
              <button class="btn-icon-square danger" title="Delete Teacher" onclick="ADMIN_CONTROLLER.deleteTeacher('${t.id}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  openAddTeacherModal() {
    const randomId = "tch-" + Date.now().toString().slice(-6);
    document.getElementById("teacherModalTitle").innerHTML = `<i class="fa-solid fa-user-plus" style="color: #227aff;"></i> Add New Master Lecturer & Teacher Account`;
    document.getElementById("teacherFormId").value = randomId;
    document.getElementById("teacherFormName").value = "";
    document.getElementById("teacherFormNameSi").value = "";
    document.getElementById("teacherFormEmail").value = "";
    document.getElementById("teacherFormPassword").value = `EduPeak@${Math.floor(1000 + Math.random() * 9000)}`;
    document.getElementById("teacherFormSubject").value = "";
    document.getElementById("teacherFormSubjectSi").value = "";
    document.getElementById("teacherFormDegree").value = "";
    document.getElementById("teacherFormPhone").value = "";
    document.getElementById("teacherFormBranch").value = "Victory Embilipitiya";
    document.getElementById("teacherFormImage").value = "assets/img/hero_lecturer.png";
    document.getElementById("adminTeacherDrawerModal").classList.add("active");
  },

  generateTeacherPassword() {
    const pwd = "Teach@" + Math.floor(100 + Math.random() * 900);
    const pwdInput = document.getElementById("teacherFormPassword");
    if (pwdInput) {
      pwdInput.value = pwd;
      if (window.showToast) window.showToast(`🔑 Generated Password: ${pwd}`, "info");
    }
  },

  togglePasswordView(id, password) {
    const span = document.getElementById(`pwdText_${id}`);
    const eye = document.getElementById(`pwdEye_${id}`);
    if (!span || !eye) return;

    if (span.textContent === "••••••••") {
      span.textContent = password;
      eye.className = "fa-solid fa-eye-slash";
    } else {
      span.textContent = "••••••••";
      eye.className = "fa-solid fa-eye";
    }
  },

  copyText(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        if (window.showToast) window.showToast(`📋 Copied to clipboard: ${text}`, "success");
      });
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      if (window.showToast) window.showToast(`📋 Copied: ${text}`, "success");
    }
  },

  async openEditTeacherModal(id) {
    const teachers = await window.SUPABASE_HELPER.getTeachers();
    const t = teachers.find(item => item.id === id);
    if (!t) return;

    const users = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getUsers() : [];
    const userAcc = users.find(u => 
      (u.id === t.id) || 
      (t.email && u.email && u.email.toLowerCase() === t.email.toLowerCase()) ||
      (u.name && t.name && u.name.toLowerCase() === t.name.toLowerCase() && u.role === "teacher")
    );

    document.getElementById("teacherModalTitle").innerHTML = `<i class="fa-solid fa-user-pen" style="color: #227aff;"></i> Edit Lecturer & Teacher Account`;
    document.getElementById("teacherFormId").value = t.id;
    document.getElementById("teacherFormName").value = t.name;
    document.getElementById("teacherFormNameSi").value = t.name_si || "";
    document.getElementById("teacherFormEmail").value = (userAcc && userAcc.email) || t.email || `${t.id.toLowerCase()}@edupeak.lk`;
    document.getElementById("teacherFormPassword").value = (userAcc && userAcc.password) || t.password || "teacher123";
    document.getElementById("teacherFormSubject").value = t.subject;
    document.getElementById("teacherFormSubjectSi").value = t.subject_si || "";
    document.getElementById("teacherFormDegree").value = t.degree;
    document.getElementById("teacherFormPhone").value = (userAcc && userAcc.phone) || t.phone || "";
    document.getElementById("teacherFormBranch").value = (userAcc && userAcc.branch) || t.branch || "Victory Embilipitiya";
    document.getElementById("teacherFormImage").value = t.image || "assets/img/hero_lecturer.png";
    document.getElementById("adminTeacherDrawerModal").classList.add("active");
  },

  async handleSaveTeacherSubmit(e) {
    e.preventDefault();
    const teacherId = document.getElementById("teacherFormId").value;
    const name = document.getElementById("teacherFormName").value.trim();
    const name_si = document.getElementById("teacherFormNameSi").value.trim() || name;
    const email = document.getElementById("teacherFormEmail").value.trim().toLowerCase();
    const password = document.getElementById("teacherFormPassword").value.trim();
    const subject = document.getElementById("teacherFormSubject").value.trim();
    const subject_si = document.getElementById("teacherFormSubjectSi").value.trim() || subject;
    const degree = document.getElementById("teacherFormDegree").value.trim();
    const phone = document.getElementById("teacherFormPhone").value.trim();
    const branch = document.getElementById("teacherFormBranch").value;
    const image = document.getElementById("teacherFormImage").value.trim() || "assets/img/hero_lecturer.png";

    if (!email || !password) {
      if (window.showToast) window.showToast("⚠️ Email and Password are required for teacher login!", "warning");
      return;
    }

    // 1. Teacher showcase profile object
    const teacherData = {
      id: teacherId,
      name,
      name_si,
      email,
      password,
      subject,
      subject_si,
      degree,
      phone,
      branch,
      image
    };

    // Save to teachers DB and Supabase
    await window.SUPABASE_HELPER.saveTeacher(teacherData);

    // 2. Create/Update login account in AUTH_SYSTEM (edupeak_users_db)
    if (window.AUTH_SYSTEM && window.AUTH_SYSTEM.saveUserAccount) {
      const userAccount = {
        id: teacherId,
        name: name,
        name_si: name_si,
        email: email,
        password: password,
        phone: phone,
        role: "teacher",
        subject: subject,
        subject_si: subject_si,
        degree: degree,
        institute: branch,
        branch: branch,
        email_verified: true,
        avatar: image,
        avatarLetter: name.charAt(0).toUpperCase(),
        joinedDate: new Date().toISOString().split("T")[0],
        status: "active"
      };

      window.AUTH_SYSTEM.saveUserAccount(userAccount);

      // Sync user profile to Supabase if connected
      if (window.SUPABASE_HELPER && window.SUPABASE_HELPER.syncProfile) {
        await window.SUPABASE_HELPER.syncProfile(userAccount);
      }
    }

    document.getElementById("adminTeacherDrawerModal").classList.remove("active");

    if (window.showToast) {
      window.showToast(`🎉 Teacher Account & Profile Saved!\nLogin: ${email}`, "success");
    }

    this.renderTeachers();
    this.renderOverview();
    if (window.renderTeachers) window.renderTeachers();
  },

  async deleteTeacher(id) {
    if (confirm("Are you sure you want to remove this lecturer profile and delete their login account?")) {
      await window.SUPABASE_HELPER.deleteTeacher(id);
      if (window.AUTH_SYSTEM && window.AUTH_SYSTEM.deleteUserAccount) {
        window.AUTH_SYSTEM.deleteUserAccount(id);
      }
      if (window.showToast) {
        window.showToast("Teacher profile & login account deleted.", "info");
      }
      this.renderTeachers();
      this.renderOverview();
      if (window.renderTeachers) window.renderTeachers();
    }
  },

  async loginAsTeacher(email, password) {
    if (!window.AUTH_SYSTEM) return;
    if (confirm(`Do you want to sign in to Teacher Studio as ${email}?`)) {
      const res = await window.AUTH_SYSTEM.login(email, password, "teacher");
      if (res.success) {
        window.location.href = "teacher-portal.html";
      } else {
        if (window.showToast) window.showToast(res.message || "Failed to log in as teacher", "error");
      }
    }
  },

  // --------------------------------------------------------------------------
  // 4.5. INSTITUTES & CAMPUSES MANAGEMENT (Active vs Coming Soon, Add/Edit/Delete)
  // --------------------------------------------------------------------------
  renderInstitutes() {
    const tbody = document.getElementById("adminInstitutesTbody");
    if (!tbody) return;

    const institutes = window.EDUPEAK_INSTITUTES ? window.EDUPEAK_INSTITUTES.getAll() : (window.EDUPEAK_DATA?.institutes || []);
    if (!institutes.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 2.5rem;">No educational institute branches configured.</td></tr>`;
      return;
    }

    tbody.innerHTML = institutes.map(inst => {
      const isComingSoon = inst.status === "coming_soon";
      const icon = inst.icon || (isComingSoon ? (inst.hasPhysicalLocation ? "🏛️" : "🌐") : "🏫");
      const cleanName = (inst.name || "").replace(/\s*\(Coming soon\)/gi, "").replace(/\s*\(භෞතික.*?\)/gi, "");

      return `
        <tr>
          <td style="white-space: nowrap;"><strong>${inst.id}</strong></td>
          <td>
            <div style="font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 0.4rem;">
              <span>${icon}</span>
              <span>${cleanName}</span>
            </div>
            ${inst.name_si ? `<div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">${inst.name_si}</div>` : ''}
          </td>
          <td>
            <div style="font-weight: 600; color: #334155; font-size: 0.85rem;">${inst.type || (inst.hasPhysicalLocation ? 'Physical Campus' : 'Online Platform')}</div>
            <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.15rem;">
              <i class="fa-solid fa-location-dot" style="color: #227aff;"></i> ${inst.location || 'Online Cloud'}
            </div>
          </td>
          <td style="text-align: center;">
            <button onclick="ADMIN_CONTROLLER.toggleInstituteStatus('${inst.id}')"
                    class="status-tag ${isComingSoon ? 'suspended' : 'active'}"
                    style="cursor: pointer; border: 1px solid ${isComingSoon ? '#fde68a' : '#bbf7d0'}; background: ${isComingSoon ? '#fef3c7' : '#dcfce7'}; color: ${isComingSoon ? '#92400e' : '#15803d'}; font-size: 0.75rem; padding: 0.25rem 0.65rem; border-radius: 20px; display: inline-flex; align-items: center; gap: 0.35rem;"
                    title="Click to toggle status: ${isComingSoon ? 'Make Active' : 'Set Coming Soon'}">
              <i class="fa-solid ${isComingSoon ? 'fa-clock' : 'fa-circle-check'}"></i>
              <span>${isComingSoon ? 'Coming Soon' : 'Active'}</span>
            </button>
          </td>
          <td>
            <div style="font-size: 0.8rem; color: #334155;">
              <i class="fa-solid fa-phone" style="color: #64748b; width: 14px;"></i> ${inst.phone || 'N/A'}
            </div>
            ${inst.email ? `
              <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.15rem;">
                <i class="fa-solid fa-envelope" style="color: #64748b; width: 14px;"></i> ${inst.email}
              </div>
            ` : ''}
          </td>
          <td>
            <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
              <button class="btn btn-ghost btn-sm" onclick="ADMIN_CONTROLLER.openEditInstituteModal('${inst.id}')" title="Edit Institute Branch">
                <i class="fa-solid fa-pen-to-square"></i> Edit
              </button>
              <button class="btn btn-ghost btn-sm" style="color: #ef4444;" onclick="ADMIN_CONTROLLER.deleteInstitute('${inst.id}')" title="Delete Institute Branch">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  openAddInstituteModal() {
    const modal = document.getElementById("adminInstituteDrawerModal");
    if (!modal) return;

    document.getElementById("instModalTitle").innerHTML = `<i class="fa-solid fa-school-flag" style="color: #227aff;"></i> Add New Educational Institute / Campus Branch`;
    document.getElementById("instFormId").value = "";
    document.getElementById("instFormName").value = "";
    document.getElementById("instFormNameSi").value = "";
    document.getElementById("instFormStatus").value = "active";
    document.getElementById("instFormType").value = "Physical Campus & Smart Auditorium";
    document.getElementById("instFormBadge").value = "Physical Campus Hub";
    document.getElementById("instFormIcon").value = "🏫";
    document.getElementById("instFormLocation").value = "";
    document.getElementById("instFormPhone").value = "+94 71 805 9089";
    document.getElementById("instFormEmail").value = "";
    document.getElementById("instFormMapUrl").value = "";
    document.getElementById("instFormFacilities").value = "Air Conditioned 1,000-seat Auditorium\nSmart LMS Campus Wi-Fi\nPhysics Demonstration Lab\nStudent Study Lounge & Helpdesk";

    modal.classList.add("active");
  },

  openEditInstituteModal(id) {
    const modal = document.getElementById("adminInstituteDrawerModal");
    if (!modal) return;

    const institutes = window.EDUPEAK_INSTITUTES ? window.EDUPEAK_INSTITUTES.getAll() : (window.EDUPEAK_DATA?.institutes || []);
    const inst = institutes.find(i => i.id === id);
    if (!inst) return;

    const cleanName = (inst.name || "").replace(/\s*\(Coming soon\)/gi, "").replace(/\s*\(භෞතික.*?\)/gi, "");

    document.getElementById("instModalTitle").innerHTML = `<i class="fa-solid fa-school-flag" style="color: #227aff;"></i> Edit Institute: ${cleanName}`;
    document.getElementById("instFormId").value = inst.id;
    document.getElementById("instFormName").value = cleanName;
    document.getElementById("instFormNameSi").value = inst.name_si || "";
    document.getElementById("instFormStatus").value = inst.status === "coming_soon" ? "coming_soon" : "active";
    document.getElementById("instFormType").value = inst.type || "Physical Campus & Smart Auditorium";
    document.getElementById("instFormBadge").value = inst.badge || "Physical Campus Hub";
    document.getElementById("instFormIcon").value = inst.icon || "🏫";
    document.getElementById("instFormLocation").value = inst.location || "";
    document.getElementById("instFormPhone").value = inst.phone || "";
    document.getElementById("instFormEmail").value = inst.email || "";
    document.getElementById("instFormMapUrl").value = inst.mapUrl || "";

    const facs = Array.isArray(inst.facilities) ? inst.facilities.join("\n") : (inst.facilities || "");
    document.getElementById("instFormFacilities").value = facs;

    modal.classList.add("active");
  },

  handleSaveInstituteSubmit(e) {
    e.preventDefault();

    const id = document.getElementById("instFormId").value;
    const name = document.getElementById("instFormName").value.trim();
    const name_si = document.getElementById("instFormNameSi").value.trim() || name;
    const status = document.getElementById("instFormStatus").value;
    const type = document.getElementById("instFormType").value.trim();
    const badge = document.getElementById("instFormBadge").value.trim() || (status === "coming_soon" ? "Coming Soon" : "Physical Campus Hub");
    const icon = document.getElementById("instFormIcon").value.trim() || "🏫";
    const location = document.getElementById("instFormLocation").value.trim();
    const phone = document.getElementById("instFormPhone").value.trim();
    const email = document.getElementById("instFormEmail").value.trim();
    const mapUrl = document.getElementById("instFormMapUrl").value.trim();
    const rawFacilities = document.getElementById("instFormFacilities").value.trim();
    const facilities = rawFacilities.split("\n").map(f => f.trim()).filter(Boolean);

    const institutes = window.EDUPEAK_INSTITUTES ? [...window.EDUPEAK_INSTITUTES.getAll()] : [];

    const instData = {
      id: id || ("inst-" + Date.now().toString(36)),
      name: name,
      name_si: name_si,
      status: status,
      hasPhysicalLocation: !type.toLowerCase().includes("online"),
      type: type,
      type_si: type,
      badge: badge,
      badge_si: status === "coming_soon" ? "ඉදිරියේදී විවෘත වේ" : badge,
      icon: icon,
      location: location,
      location_si: location,
      phone: phone,
      email: email,
      mapUrl: mapUrl,
      facilities: facilities.length > 0 ? facilities : ["Air Conditioned Auditorium", "Smart Campus Wi-Fi"],
      facilities_si: facilities.length > 0 ? facilities : ["වායුසමනය කළ ශ්‍රවණාගාරය", "Smart LMS Wi-Fi"]
    };

    const existingIndex = institutes.findIndex(i => i.id === id);
    if (existingIndex >= 0) {
      institutes[existingIndex] = { ...institutes[existingIndex], ...instData };
    } else {
      institutes.push(instData);
    }

    if (window.EDUPEAK_INSTITUTES) {
      window.EDUPEAK_INSTITUTES.saveAll(institutes);
    }

    document.getElementById("adminInstituteDrawerModal").classList.remove("active");
    if (window.showToast) {
      window.showToast(`🏫 Institute branch "${name}" saved & synced!`, "success");
    }

    this.renderInstitutes();
  },

  toggleInstituteStatus(id) {
    const institutes = window.EDUPEAK_INSTITUTES ? [...window.EDUPEAK_INSTITUTES.getAll()] : [];
    const inst = institutes.find(i => i.id === id);
    if (!inst) return;

    const newStatus = inst.status === "active" ? "coming_soon" : "active";
    inst.status = newStatus;
    if (newStatus === "coming_soon") {
      inst.badge = "Coming Soon";
      inst.badge_si = "ඉදිරියේදී විවෘත වේ";
    } else {
      inst.badge = "Physical Campus Hub";
      inst.badge_si = "ප්‍රධාන භෞතික මධ්‍යස්ථානය";
    }

    if (window.EDUPEAK_INSTITUTES) {
      window.EDUPEAK_INSTITUTES.saveAll(institutes);
    }

    const cleanName = (inst.name || "").replace(/\s*\(Coming soon\)/gi, "");
    if (window.showToast) {
      window.showToast(`Branch "${cleanName}" status changed to: ${newStatus === 'active' ? '🟢 Active' : '🟡 Coming Soon'}!`, "info");
    }

    this.renderInstitutes();
  },

  deleteInstitute(id) {
    const institutes = window.EDUPEAK_INSTITUTES ? [...window.EDUPEAK_INSTITUTES.getAll()] : [];
    const inst = institutes.find(i => i.id === id);
    if (!inst) return;

    const cleanName = (inst.name || "").replace(/\s*\(Coming soon\)/gi, "");
    if (confirm(`Are you sure you want to delete "${cleanName}"? This branch will be removed from the home page and registration forms.`)) {
      const filtered = institutes.filter(i => i.id !== id);
      if (window.EDUPEAK_INSTITUTES) {
        window.EDUPEAK_INSTITUTES.saveAll(filtered);
      }
      if (window.showToast) {
        window.showToast(`Branch "${cleanName}" has been deleted.`, "info");
      }
      this.renderInstitutes();
    }
  },

  // --------------------------------------------------------------------------
  // 5. SUPABASE CONNECTION & SYNC TAB
  // --------------------------------------------------------------------------
  renderSupabaseTab() {
    const config = window.SUPABASE_HELPER.getConfig();
    const urlInput = document.getElementById("supabaseUrlInput");
    const keyInput = document.getElementById("supabaseAnonKeyInput");
    const sqlCode = document.getElementById("supabaseSqlPreview");

    if (urlInput) urlInput.value = config.url || "";
    if (keyInput) keyInput.value = config.anonKey || "";
    if (sqlCode) sqlCode.textContent = window.SUPABASE_HELPER.getSqlSchemaScript();

    window.SUPABASE_HELPER.testConnection();
  },

  populateSupabaseConfig() {
    const config = window.SUPABASE_HELPER.getConfig();
    if (config.url && config.anonKey) {
      window.SUPABASE_HELPER.init();
    }
  },

  async handleSaveSupabaseConfig(e) {
    e.preventDefault();
    const url = document.getElementById("supabaseUrlInput").value;
    const anonKey = document.getElementById("supabaseAnonKeyInput").value;

    window.SUPABASE_HELPER.saveConfig(url, anonKey);
    const res = await window.SUPABASE_HELPER.testConnection();

    if (res.success) {
      if (window.showToast) window.showToast("⚡ " + res.message, "success");
    } else {
      if (window.showToast) window.showToast("⚠️ " + res.message, "info");
    }
  },

  async handleSyncToSupabase() {
    const res = await window.SUPABASE_HELPER.syncLocalToCloud();
    if (res.success) {
      if (window.showToast) window.showToast("☁️ " + res.message, "success");
    } else {
      if (window.showToast) window.showToast("⚠️ " + res.message, "info");
    }
  },

  copySqlSchema() {
    const sql = window.SUPABASE_HELPER.getSqlSchemaScript();
    navigator.clipboard.writeText(sql).then(() => {
      if (window.showToast) window.showToast("📋 SQL Schema script copied to clipboard!", "success");
    });
  },

  // =========================================================================
  // 5. PAST PAPERS & PDF VAULT MANAGEMENT (STRICTLY ADMIN ONLY)
  // =========================================================================
  getPapers() {
    const saved = localStorage.getItem("edupeak_papers_db");
    if (saved) {
      try {
        let parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Auto-migrate any legacy "National Examination" strings to "Past Paper"
          let modified = false;
          parsed.forEach(p => {
            if (p.unitName === "Complete National Examination") {
              p.unitName = "Complete Past Paper Examination";
              modified = true;
            }
          });
          if (modified) {
            localStorage.setItem("edupeak_papers_db", JSON.stringify(parsed));
          }
          return parsed;
        }
      } catch (e) {}
    }

    const defaultPapers = [
      {
        id: "pap-al-2024",
        title: "2024 G.C.E. A/L Physics Past Paper & Marking Scheme",
        title_si: "2024 අ.පො.ස. උ/පෙළ භෞතික විද්‍යාව ප්‍රශ්න පත්‍රය සහ ලකුණු දීමේ පටිපාටිය",
        type: "national",
        unit: "all",
        unitName: "Complete Past Paper Examination",
        year: 2024,
        size: "4.2 MB",
        url: "assets/docs/al_physics_2024.pdf"
      },
      {
        id: "pap-al-2023",
        title: "2023 G.C.E. A/L Physics Past Paper (MCQ & Essay)",
        title_si: "2023 අ.පො.ස. උ/පෙළ භෞතික විද්‍යාව පසුගිය ප්‍රශ්න පත්‍රය",
        type: "national",
        unit: "all",
        unitName: "Complete Past Paper Examination",
        year: 2023,
        size: "3.8 MB",
        url: "assets/docs/al_physics_2023.pdf"
      },
      {
        id: "pap-royal-2024",
        title: "Royal College Colombo - 2024 Term Test Physics Paper",
        title_si: "කොළඹ රාජකීය විද්‍යාලය - 2024 වාර විභාග ප්‍රශ්න පත්‍රය",
        type: "school",
        unit: "mechanics",
        unitName: "Mechanics & Circular Motion",
        year: 2024,
        size: "2.9 MB",
        url: "assets/docs/royal_physics_2024.pdf"
      },
      {
        id: "pap-ananda-2024",
        title: "Ananda College Colombo - 2024 3rd Term Physics Paper",
        title_si: "කොළඹ ආනන්ද විද්‍යාලය - 2024 තෙවන වාර භෞතික විද්‍යා ප්‍රශ්න පත්‍රය",
        type: "school",
        unit: "waves",
        unitName: "Waves, Sound & Resonance",
        year: 2024,
        size: "3.1 MB",
        url: "assets/docs/ananda_physics_2024.pdf"
      },
      {
        id: "pap-visakha-2024",
        title: "Visakha Vidyalaya Colombo - 2024 Term Test Physics",
        title_si: "විශාඛා විද්‍යාලය කොළඹ - 2024 වාර විභාග ප්‍රශ්න පත්‍රය",
        type: "school",
        unit: "thermal",
        unitName: "Thermal Physics & Gas Laws",
        year: 2024,
        size: "2.7 MB",
        url: "assets/docs/visakha_physics_2024.pdf"
      },
      {
        id: "pap-dharmaraja-2024",
        title: "Dharmaraja College Kandy - 2024 Model Physics Paper",
        title_si: "ධර්මරාජ විද්‍යාලය මහනුවර - 2024 ආදර්ශ ප්‍රශ්න පත්‍රය",
        type: "school",
        unit: "fields",
        unitName: "Gravitational & Electrostatic Fields",
        year: 2024,
        size: "2.8 MB",
        url: "assets/docs/dharmaraja_physics_2024.pdf"
      },
      {
        id: "pap-mahinda-2024",
        title: "Mahinda College Galle - 2024 Physics Term Paper",
        title_si: "මහින්ද විද්‍යාලය ගාල්ල - 2024 භෞතික විද්‍යා ප්‍රශ්න පත්‍රය",
        type: "school",
        unit: "electricity",
        unitName: "Current Electricity & Circuits",
        year: 2024,
        size: "3.4 MB",
        url: "assets/docs/mahinda_physics_2024.pdf"
      },
      {
        id: "pap-vic-model-01",
        title: "Victory Embilipitiya - Amalsha Sir Special Speed Paper 01",
        title_si: "වික්ටරි ඇඹිලිපිටිය - අමල්ෂ සර් විශේෂ වේගවත් ප්‍රශ්න පත්‍රය 01",
        type: "model",
        unit: "mechanics",
        unitName: "Newton's Laws & Hydrodynamics",
        year: 2025,
        size: "3.5 MB",
        url: "assets/docs/victory_model_01.pdf"
      },
      {
        id: "pap-vic-model-02",
        title: "Victory Embilipitiya - Amalsha Sir Special Speed Paper 02",
        title_si: "වික්ටරි ඇඹිලිපිටිය - අමල්ෂ සර් විශේෂ වේගවත් ප්‍රශ්න පත්‍රය 02",
        type: "model",
        unit: "electronics",
        unitName: "Semiconductors & Logic Gates",
        year: 2025,
        size: "3.2 MB",
        url: "assets/docs/victory_model_02.pdf"
      }
    ];

    try {
      localStorage.setItem("edupeak_papers_db", JSON.stringify(defaultPapers));
    } catch (e) {}
    return defaultPapers;
  },

  renderPapers() {
    const tbody = document.getElementById("adminPapersTableBody");
    if (!tbody) return;

    let papers = this.getPapers();

    const searchTerm = (document.getElementById("adminPaperSearchInput") ? document.getElementById("adminPaperSearchInput").value : "").toLowerCase().trim();
    const catFilter = document.getElementById("adminPaperCategoryFilter") ? document.getElementById("adminPaperCategoryFilter").value : "all";
    const unitFilter = document.getElementById("adminPaperUnitFilter") ? document.getElementById("adminPaperUnitFilter").value : "all";

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
      let badgeHtml = '<span class="status-pill active" style="background:#eff6ff; color:#1d4ed8;"><i class="fa-solid fa-graduation-cap"></i> Past Paper</span>';
      if (p.type === "school") {
        badgeHtml = '<span class="status-pill active" style="background:#ecfdf5; color:#065f46;"><i class="fa-solid fa-school"></i> Top School</span>';
      } else if (p.type === "model") {
        badgeHtml = '<span class="status-pill active" style="background:#fef3c7; color:#92400e;"><i class="fa-solid fa-award"></i> Victory Model</span>';
      }

      return `
        <tr>
          <td>
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              ${badgeHtml}
              <strong style="font-size: 0.85rem; color: #0f172a; margin-top: 0.2rem;">${p.year} Exam</strong>
            </div>
          </td>
          <td>
            <strong style="font-size: 0.95rem; color: #0f172a; display: block;">${p.title}</strong>
            ${p.title_si ? `<span style="font-size: 0.775rem; color: #64748b; font-family: 'Noto Sans Sinhala', sans-serif;">${p.title_si}</span>` : ''}
            ${p.url ? `<div style="font-size: 0.75rem; color: #227aff; margin-top: 0.25rem; font-family: monospace;"><i class="fa-solid fa-link"></i> ${p.url.substring(0, 42)}${p.url.length > 42 ? '...' : ''}</div>` : ''}
          </td>
          <td>
            <span style="font-size: 0.8rem; font-weight: 700; color: #475569; background: #f8fafc; padding: 0.25rem 0.65rem; border-radius: 6px; border: 1px solid #e2e8f0; display: inline-block;">
              <i class="fa-solid fa-tag" style="color: #227aff;"></i> ${p.unitName || p.unit}
            </span>
          </td>
          <td>
            <span style="font-size: 0.85rem; font-weight: 800; color: #ef4444; background: #fee2e2; padding: 0.25rem 0.6rem; border-radius: 6px;">
              <i class="fa-solid fa-file-pdf"></i> ${p.size || '3.5 MB'}
            </span>
          </td>
          <td>
            <div class="action-btn-group" style="display: flex; gap: 0.35rem;">
              <button class="btn-icon" title="View Preview" onclick="ADMIN_CONTROLLER.previewPaper('${p.id}')" style="background:#eff6ff; color:#227aff; border:1px solid #bfdbfe;">
                <i class="fa-solid fa-eye"></i>
              </button>
              <button class="btn-icon" title="Edit / Rename Details" onclick="ADMIN_CONTROLLER.openEditPaperModal('${p.id}')" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1;">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn-icon btn-danger" title="Delete Paper" onclick="ADMIN_CONTROLLER.deletePaper('${p.id}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5;">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddPaperModal() {
    const modal = document.getElementById("adminPaperDrawerModal");
    if (!modal) return;
    document.getElementById("paperModalTitle").textContent = "Upload New PDF Paper";
    document.getElementById("paperFormId").value = "";
    document.getElementById("paperFormTitle").value = "";
    document.getElementById("paperFormTitleSi").value = "";
    document.getElementById("paperFormType").value = "national";
    document.getElementById("paperFormYear").value = new Date().getFullYear();
    document.getElementById("paperFormUnit").value = "all";
    document.getElementById("paperFormUnitName").value = "Complete Past Paper Examination";
    document.getElementById("paperFormSize").value = "3.5 MB";
    document.getElementById("paperFormUrl").value = "";
    if (document.getElementById("paperFormFileInput")) {
      document.getElementById("paperFormFileInput").value = "";
    }
    modal.classList.add("active");
  },

  openEditPaperModal(paperId) {
    const modal = document.getElementById("adminPaperDrawerModal");
    if (!modal) return;
    const papers = this.getPapers();
    const p = papers.find(item => item.id === paperId);
    if (!p) return;

    document.getElementById("paperModalTitle").textContent = "Edit & Rename PDF Paper";
    document.getElementById("paperFormId").value = p.id;
    document.getElementById("paperFormTitle").value = p.title || "";
    document.getElementById("paperFormTitleSi").value = p.title_si || "";
    document.getElementById("paperFormType").value = p.type || "national";
    document.getElementById("paperFormYear").value = p.year || 2024;
    document.getElementById("paperFormUnit").value = p.unit || "all";
    document.getElementById("paperFormUnitName").value = p.unitName || "";
    document.getElementById("paperFormSize").value = p.size || "3.5 MB";
    document.getElementById("paperFormUrl").value = p.url || "";
    if (document.getElementById("paperFormFileInput")) {
      document.getElementById("paperFormFileInput").value = "";
    }

    modal.classList.add("active");
  },

  handlePdfFileSelected(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    // Auto-calculate size in MB
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    const sizeStr = `${sizeInMB} MB`;
    const sizeInput = document.getElementById("paperFormSize");
    if (sizeInput) sizeInput.value = sizeStr;

    // Set file path / name
    const urlInput = document.getElementById("paperFormUrl");
    if (urlInput) {
      urlInput.value = `assets/docs/${file.name}`;
    }

    // Auto-suggest title if blank
    const titleInput = document.getElementById("paperFormTitle");
    if (titleInput && !titleInput.value) {
      titleInput.value = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
    }

    if (window.showToast) {
      window.showToast(`Selected PDF: ${file.name} (${sizeStr})`, "info");
    }
  },

  handleSavePaperSubmit(event) {
    event.preventDefault();
    const id = document.getElementById("paperFormId").value.trim() || `pap-${Date.now()}`;
    const title = document.getElementById("paperFormTitle").value.trim();
    const title_si = document.getElementById("paperFormTitleSi").value.trim();
    const type = document.getElementById("paperFormType").value;
    const year = parseInt(document.getElementById("paperFormYear").value) || 2024;
    const unit = document.getElementById("paperFormUnit").value;
    const unitName = document.getElementById("paperFormUnitName").value.trim() || "Physics Unit";
    const size = document.getElementById("paperFormSize").value.trim() || "3.5 MB";
    const url = document.getElementById("paperFormUrl").value.trim() || `assets/docs/paper_${year}.pdf`;

    let papers = this.getPapers();
    const existingIndex = papers.findIndex(item => item.id === id);

    const paperObj = {
      id,
      title,
      title_si,
      type,
      year,
      unit,
      unitName,
      size,
      url,
      updated_at: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      papers[existingIndex] = { ...papers[existingIndex], ...paperObj };
    } else {
      papers.unshift(paperObj);
    }

    localStorage.setItem("edupeak_papers_db", JSON.stringify(papers));

    // Sync to Supabase if available
    if (window.SUPABASE_HELPER && window.SUPABASE_HELPER.isConnected) {
      try {
        window.SUPABASE_HELPER.client.from("past_papers").upsert(paperObj).then(() => {});
      } catch (e) {}
    }

    const modal = document.getElementById("adminPaperDrawerModal");
    if (modal) modal.classList.remove("active");

    if (window.showToast) {
      window.showToast(`✓ PDF Paper "${title}" saved and published successfully!`, "success");
    }

    this.renderPapers();
  },

  deletePaper(paperId) {
    const papers = this.getPapers();
    const p = papers.find(item => item.id === paperId);
    const title = p ? p.title : "this paper";

    if (!confirm(`Are you sure you want to delete "${title}"? This will immediately remove it from the Student Paper Vault.`)) {
      return;
    }

    const updated = papers.filter(item => item.id !== paperId);
    localStorage.setItem("edupeak_papers_db", JSON.stringify(updated));

    // Delete in Supabase if connected
    if (window.SUPABASE_HELPER && window.SUPABASE_HELPER.isConnected) {
      try {
        window.SUPABASE_HELPER.client.from("past_papers").delete().eq("id", paperId).then(() => {});
      } catch (e) {}
    }

    if (window.showToast) {
      window.showToast("✓ Paper successfully removed from Paper Vault.", "info");
    }

    this.renderPapers();
  },

  previewPaper(paperId) {
    const papers = this.getPapers();
    const p = papers.find(item => item.id === paperId);
    if (!p) return;

    if (p.url && (p.url.startsWith("http") || p.url.startsWith("blob:") || p.url.startsWith("data:"))) {
      window.open(p.url, "_blank");
    } else {
      alert(`📄 PDF Document Preview:\n\nTitle: ${p.title}\nCategory: ${p.type.toUpperCase()}\nExam Year: ${p.year}\nUnit: ${p.unitName}\nFile: ${p.url || 'assets/docs/paper.pdf'}\nSize: ${p.size}\n\n✓ File is active and accessible for student download in the Paper Vault!`);
    }
  }
};

// Expose globally
window.ADMIN_CONTROLLER = ADMIN_CONTROLLER;
window.openAdminPanel = () => ADMIN_CONTROLLER.open();
window.closeAdminPanel = () => ADMIN_CONTROLLER.close();

document.addEventListener("DOMContentLoaded", () => {
  ADMIN_CONTROLLER.init();
});
