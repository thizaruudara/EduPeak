/**
 * EduPeak LMS Admin Panel Controller
 * Handles Management of Students, Courses, Teachers, and Supabase Live Sync
 */

const ADMIN_CONTROLLER = {
  currentTab: "overview",
  clockTimer: null,

  init() {
    this.startLiveClock();
    this.bindEvents();
    this.populateSupabaseConfig();
    this.checkAutoOpen();

    window.addEventListener("hashchange", () => {
      this.checkAutoOpen();
    });

    window.addEventListener("edupeak-order-updated", () => {
      if (typeof this.renderPendingOrders === "function") this.renderPendingOrders();
      if (typeof this.renderOverview === "function") this.renderOverview();
      if (typeof this.renderStudents === "function") this.renderStudents();
    });

    window.addEventListener("edupeak-order-approved", () => {
      if (typeof this.renderPendingOrders === "function") this.renderPendingOrders();
      if (typeof this.renderOverview === "function") this.renderOverview();
      if (typeof this.renderStudents === "function") this.renderStudents();
    });
  },

  startLiveClock() {
    const update = () => {
      const clockEl = document.getElementById("adminLiveClockText");
      if (!clockEl) return;
      const now = new Date();
      const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
      clockEl.textContent = now.toLocaleDateString('en-US', options).replace(/,/g, ' •');
    };
    update();
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = setInterval(update, 1000);
  },

  getTabFromHash() {
    const hash = window.location.hash || "";
    if (hash.startsWith("#admin")) {
      if (hash.includes("/")) {
        const part = hash.split("/")[1].split("?")[0].trim().toLowerCase();
        const validTabs = ["overview", "students", "courses", "teachers", "lessons", "quizzes", "institutes", "papers", "supabase"];
        if (validTabs.includes(part)) return part;
      }
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab")) return params.get("tab");
    return localStorage.getItem("edupeak_admin_active_tab") || "overview";
  },

  checkAutoOpen() {
    const hash = window.location.hash || "";
    const params = new URLSearchParams(window.location.search);
    const wasOpen = sessionStorage.getItem("edupeak_admin_open") === "true";
    if (hash.startsWith("#admin") || params.get("admin") !== null || params.get("openAdmin") !== null || wasOpen) {
      const currentUser = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getCurrentUser() : null;
      if (!currentUser || currentUser.role !== "admin") {
        history.replaceState(null, document.title, window.location.pathname);
        sessionStorage.removeItem("edupeak_admin_open");
        return;
      }
      const tab = this.getTabFromHash() || localStorage.getItem("edupeak_admin_active_tab") || "overview";
      this.open(tab);
    }
  },

  // Open Admin Panel Overlay
  open(preferredTab) {
    const currentUser = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getCurrentUser() : null;
    if (!currentUser || currentUser.role !== "admin") {
      history.replaceState(null, document.title, window.location.pathname);
      sessionStorage.removeItem("edupeak_admin_open");
      if (typeof this.close === "function") this.close();
      const h = window.location.hostname.toLowerCase();
      if (h === 'edupeak.lk' || h === 'www.edupeak.lk') {
        if (window.location.pathname.toLowerCase().includes("admin.html")) {
          window.location.replace("index.html");
        }
      } else {
        const gate = document.getElementById("adminLoginGate");
        if (gate) gate.style.display = "flex";
        const wrapper = document.getElementById("adminModalWrapper");
        if (wrapper) wrapper.style.display = "none";
      }
      return;
    }

    const panel = document.getElementById("adminModalWrapper");
    if (panel) {
      panel.classList.add("active");
      document.body.style.overflow = "hidden";
      try {
        sessionStorage.setItem("edupeak_admin_open", "true");
      } catch (e) {}
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
    try {
      sessionStorage.removeItem("edupeak_admin_open");
    } catch (e) {}
    if (window.location.hash.startsWith("#admin")) {
      window.location.hash = "home";
    }
  },

  async switchTab(tabId) {
    this.currentTab = tabId;
    try {
      localStorage.setItem("edupeak_admin_active_tab", tabId);
      sessionStorage.setItem("edupeak_admin_open", "true");
      // Keep hash in sync so refreshing or bookmarking stays on this exact tab!
      window.location.hash = "admin/" + tabId;
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
        lessons: "Course Video Lessons & Curriculum",
        quizzes: "Speed MCQ Quizzes & Examination Papers",
        teachers: "Faculty & Master Lecturers",
        institutes: "Educational Institutes & Campus Branches",
        papers: "Past Paper & Model Exam PDF Vault",
        supabase: "Supabase Database & Real-Time Sync"
      };
      headerTitle.textContent = titles[tabId] || "Admin Dashboard";
    }

    // Refresh specific tab
    if (tabId === "overview") return await this.renderOverview();
    if (tabId === "students") return this.renderStudents();
    if (tabId === "courses") return await this.renderCourses();
    if (tabId === "lessons") return await this.renderLessons();
    if (tabId === "quizzes") return await this.renderQuizzes();
    if (tabId === "teachers") return await this.renderTeachers();
    if (tabId === "institutes") return this.renderInstitutes();
    if (tabId === "papers") return this.renderPapers();
    if (tabId === "supabase") return this.renderSupabaseTab();
  },

  async refreshAll() {
    await this.renderOverview();
    this.renderStudents();
    await this.renderCourses();
    await this.renderLessons();
    await this.renderQuizzes();
    await this.renderTeachers();
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
    const batchSelect = document.getElementById("adminStudentBatchFilter");
    if (batchSelect) {
      batchSelect.addEventListener("change", () => this.renderStudents());
    }
    const courseCat = document.getElementById("adminCourseCategoryFilter");
    if (courseCat) {
      courseCat.addEventListener("change", () => this.renderCourses());
    }
    const courseBatch = document.getElementById("adminCourseBatchFilter");
    if (courseBatch) {
      courseBatch.addEventListener("change", () => this.renderCourses());
    }
  },

  updatePendingBadges(count) {
    const badge = document.getElementById("adminNavPendingBadge");
    if (badge) {
      if (count > 0) {
        badge.style.display = "inline-flex";
        badge.textContent = count;
      } else {
        badge.style.display = "none";
      }
    }
  },

  // --------------------------------------------------------------------------
  // 1. OVERVIEW TAB
  // --------------------------------------------------------------------------
  async renderOverview() {
    try {
      const users = (window.AUTH_SYSTEM && typeof window.AUTH_SYSTEM.getUsers === "function") ? window.AUTH_SYSTEM.getUsers() : [];
      const students = users.filter(u => u.role === "student");

      let teachers = [];
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getTeachers === "function") {
        try { teachers = await window.SUPABASE_HELPER.getTeachers(); } catch (e) {}
      }
      if (!Array.isArray(teachers) || teachers.length === 0) {
        teachers = (window.EDUPEAK_DATA && Array.isArray(window.EDUPEAK_DATA.teachers)) ? window.EDUPEAK_DATA.teachers : [];
      }

      let courses = [];
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getCourses === "function") {
        try { courses = await window.SUPABASE_HELPER.getCourses(); } catch (e) {}
      }
      if (!Array.isArray(courses) || courses.length === 0) {
        courses = (typeof window.getLMSCourses === "function") ? window.getLMSCourses() : ((window.EDUPEAK_DATA && Array.isArray(window.EDUPEAK_DATA.courses)) ? window.EDUPEAK_DATA.courses : []);
      }

      const totalStudentsEl = document.getElementById("adminStatTotalStudents");
      const activeCoursesEl = document.getElementById("adminStatActiveCourses");
      const totalTeachersEl = document.getElementById("adminStatTotalTeachers");
      const liveClassesEl = document.getElementById("adminStatLiveClasses");
      const pendingOrdersEl = document.getElementById("adminStatPendingOrders");

      let orders = [];
      try {
        orders = JSON.parse(localStorage.getItem("edupeak_pending_orders") || "[]");
      } catch (e) {
        orders = [];
      }
      const pendingOnly = orders.filter(o => o.status === "Pending Approval");
      const pendingCount = pendingOnly.length;

      if (totalStudentsEl) totalStudentsEl.textContent = students.length.toLocaleString();
      if (activeCoursesEl) activeCoursesEl.textContent = courses.length.toString();
      if (totalTeachersEl) totalTeachersEl.textContent = teachers.length.toString();
      if (liveClassesEl) liveClassesEl.textContent = "Protected";
      if (pendingOrdersEl) pendingOrdersEl.textContent = `${pendingCount} Pending`;

      this.updatePendingBadges(pendingCount);

    // 1. Render Inline Pending Queue in Overview
    const overviewPendingTbody = document.getElementById("adminOverviewPendingOrdersTbody");
    if (overviewPendingTbody) {
      if (pendingOnly.length === 0) {
        overviewPendingTbody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; color: #059669; padding: 2rem; background: #ecfdf5; border-radius: 8px;">
              <i class="fa-solid fa-circle-check" style="font-size: 1.6rem; color: #10b981; display: block; margin-bottom: 0.35rem;"></i>
              <strong style="font-size: 0.9rem;">All Student Requests Verified!</strong>
              <div style="font-size: 0.76rem; color: #047857; margin-top: 0.2rem;">No outstanding WhatsApp course payment verifications.</div>
            </td>
          </tr>
        `;
      } else {
        overviewPendingTbody.innerHTML = pendingOnly.slice(0, 5).map(order => {
          const phoneClean = (order.studentPhone || "").replace(/[^0-9]/g, '');
          const waLink = phoneClean ? `https://wa.me/${phoneClean.startsWith('0') ? '94' + phoneClean.slice(1) : phoneClean}` : '';
          return `
            <tr>
              <td>
                <div style="font-weight: 700; color: #0f172a; font-size: 0.88rem;">${order.studentName}</div>
                <div style="font-size: 0.74rem; color: #64748b;">
                  ID: <strong style="color: #227aff;">${order.studentId}</strong>
                  ${order.studentPhone ? ` • <i class="fa-solid fa-phone" style="font-size: 0.65rem;"></i> ${order.studentPhone}` : ''}
                </div>
                ${waLink ? `<div style="font-size: 0.72rem; margin-top: 2px;"><a href="${waLink}" target="_blank" rel="noopener noreferrer" style="color: #16a34a; font-weight: 700; text-decoration: none;"><i class="fa-brands fa-whatsapp"></i> Chat on WhatsApp</a></div>` : ''}
              </td>
              <td>
                <div style="font-weight: 600; color: #0f172a; font-size: 0.82rem;">${order.courseTitle}</div>
                <span style="font-size: 0.7rem; color: #227aff; background: #eff6ff; padding: 0.1rem 0.4rem; border-radius: 4px; border: 1px solid #bfdbfe;">ID: ${order.courseId}</span>
              </td>
              <td>
                <strong style="color: #0f172a; font-size: 0.85rem;">${order.fee || 'LKR 3,500'}</strong>
              </td>
              <td>
                <div style="display: flex; gap: 0.35rem;">
                  <button class="btn btn-sm" onclick="ADMIN_CONTROLLER.approvePendingOrder('${order.orderId}')" style="background: #16a34a; color: #ffffff; border: 1px solid #16a34a; font-size: 0.72rem; padding: 0.3rem 0.6rem; border-radius: 6px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 0.25rem;" title="Approve payment & unlock course">
                    <i class="fa-solid fa-check"></i> Approve
                  </button>
                  <button class="btn btn-sm btn-ghost" onclick="ADMIN_CONTROLLER.cancelPendingOrder('${order.orderId}')" style="color: #ef4444; border: 1px solid #fecaca; font-size: 0.72rem; padding: 0.3rem 0.45rem; border-radius: 6px; font-weight: 700; cursor: pointer;" title="Cancel / Reject">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join("");
      }
    }

    // 2. Populate Campus Branch Distribution
    const branchDistContainer = document.getElementById("adminBranchDistributionList");
    if (branchDistContainer) {
      const institutes = window.EDUPEAK_INSTITUTES ? window.EDUPEAK_INSTITUTES.getAll() : (window.EDUPEAK_DATA?.institutes || []);
      if (institutes.length === 0) {
        branchDistContainer.innerHTML = `<div style="text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 1rem;">No campus branches configured.</div>`;
      } else {
        const totalCount = students.length || 1240;
        const defaultShares = [0.42, 0.28, 0.18, 0.12];
        branchDistContainer.innerHTML = institutes.map((inst, idx) => {
          const cleanName = (inst.name || "").replace(/\s*\(Coming soon\)/gi, "").replace(/\s*\(භෞතික.*?\)/gi, "");
          const studentCount = Math.round(totalCount * (defaultShares[idx % defaultShares.length] || 0.15));
          const percent = Math.round((studentCount / totalCount) * 100);
          const isComingSoon = inst.status === "coming_soon";
          return `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 0.9rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <div style="font-weight: 700; font-size: 0.84rem; color: #0f172a; display: flex; align-items: center; gap: 0.35rem;">
                  <span>${inst.icon || '🏫'}</span>
                  <span>${cleanName}</span>
                  ${isComingSoon ? `<span style="font-size: 0.65rem; background: #fef3c7; color: #92400e; padding: 1px 6px; border-radius: 999px; border: 1px solid #fde68a;">Coming Soon</span>` : ''}
                </div>
                <div style="font-size: 0.75rem; font-weight: 700; color: #227aff;">${studentCount} Students (${percent}%)</div>
              </div>
              <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, #227aff, #38bdf8); border-radius: 999px; transition: width 0.4s ease;"></div>
              </div>
            </div>
          `;
        }).join("");
      }
    }

    // 3. Render Recent Registrations Table
    const recentTableBody = document.getElementById("adminRecentStudentsTbody");
    const recent = students.slice(0, 5);
    if (recentTableBody) {
      if (recent.length === 0) {
        recentTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 2rem;">No registered students yet.</td></tr>`;
      } else {
        recentTableBody.innerHTML = recent.map(s => {
          const phoneClean = (s.phone || "").replace(/[^0-9]/g, '');
          const waLink = phoneClean ? `https://wa.me/${phoneClean.startsWith('0') ? '94' + phoneClean.slice(1) : phoneClean}` : '';
          return `
            <tr>
              <td><strong style="color: #227aff; font-family: monospace;">${s.id || "EP-2027-001"}</strong></td>
              <td>
                <div style="font-weight: 700; color: #0f172a;">${s.name || "A/L Student"}</div>
                <div style="font-size: 0.75rem; color: #64748b;">${s.email || "No email"}</div>
              </td>
              <td>
                <div onclick="ADMIN_CONTROLLER.copyText('${s.nic || "200512345678"}')" title="Click to copy NIC" style="display: inline-flex; align-items: center; gap: 0.35rem; font-family: monospace; font-weight: 700; font-size: 0.78rem; background: #eff6ff; color: #1e40af; padding: 0.2rem 0.5rem; border-radius: 6px; border: 1px solid #bfdbfe; cursor: pointer;">
                  <i class="fa-solid fa-id-card" style="color: #227aff;"></i>
                  <span>${s.nic || "200512345678"}</span>
                  <i class="fa-solid fa-copy" style="font-size: 0.65rem; opacity: 0.6;"></i>
                </div>
              </td>
              <td><span class="status-tag active" style="font-size: 0.72rem;">${s.stream || "Physical Science"}</span></td>
              <td>
                <div style="font-size: 0.8rem; color: #334155;">
                  ${s.phone || "0771234567"}
                  ${waLink ? `<a href="${waLink}" target="_blank" rel="noopener noreferrer" style="color: #16a34a; margin-left: 0.35rem; text-decoration: none; font-weight: 700; font-size: 0.75rem;"><i class="fa-brands fa-whatsapp"></i> Chat</a>` : ''}
                </div>
              </td>
              <td><span class="status-tag ${s.status === 'suspended' ? 'suspended' : 'active'}" style="font-size: 0.72rem;">${s.status || 'Active'}</span></td>
            </tr>
          `;
        }).join("");
      }
    }
  } catch (err) {
    console.warn("renderOverview error:", err);
  }
},

  // --------------------------------------------------------------------------
  // 2. STUDENTS MANAGEMENT & PENDING ORDERS
  // --------------------------------------------------------------------------
  async renderPendingOrders() {
    const tbody = document.getElementById("adminPendingOrdersTbody");
    const countBadge = document.getElementById("adminPendingOrdersCountBadge");
    const statPendingEl = document.getElementById("adminStatPendingOrders");
    if (!tbody) return;

    let orders = [];
    try {
      orders = JSON.parse(localStorage.getItem("edupeak_pending_orders") || "[]");
    } catch (e) {
      orders = [];
    }

    const renderTable = (ordersList) => {
      const pendingOnly = (ordersList || []).filter(o => o.status === "Pending Approval" || o.status === "order_pending");

      if (statPendingEl) {
        statPendingEl.textContent = `${pendingOnly.length} Pending`;
      }

      this.updatePendingBadges(pendingOnly.length);

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
            <td colspan="7" style="text-align: center; color: #64748b; padding: 2.5rem;">
              <i class="fa-solid fa-circle-check" style="font-size: 1.85rem; color: #10b981; margin-bottom: 0.35rem; display: block;"></i>
              No pending enrollment orders awaiting approval. All student requests are verified!
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
                        onclick="ADMIN_CONTROLLER.approvePendingOrder('${order.orderId}')"
                        style="background: #16a34a; color: #ffffff; border: 1px solid #16a34a; font-size: 0.75rem; padding: 0.35rem 0.65rem; font-weight: 700; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.3rem; cursor: pointer;"
                        title="Verify payment and grant course access to student">
                  <i class="fa-solid fa-check"></i> Approve
                </button>
                <button class="btn btn-sm btn-ghost" 
                        onclick="ADMIN_CONTROLLER.cancelPendingOrder('${order.orderId}')"
                        style="color: #ef4444; border: 1px solid #fecaca; font-size: 0.75rem; padding: 0.35rem 0.65rem; font-weight: 700; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.3rem; cursor: pointer;"
                        title="Cancel/reject order and release duplicate lock">
                  <i class="fa-solid fa-xmark"></i> Cancel
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join("");
    };

    // Render immediately from local cache
    renderTable(orders);

    // Fetch fresh orders from Supabase Cloud
    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getOrders === "function") {
      try {
        const fresh = await window.SUPABASE_HELPER.getOrders();
        if (Array.isArray(fresh)) {
          renderTable(fresh);
        }
      } catch(e) {}
    }
  },

  async approvePendingOrder(orderId) {
    if (!orderId) return;
    let orders = [];
    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getOrders === "function") {
      try { orders = await window.SUPABASE_HELPER.getOrders(); } catch(e) {}
    }
    if (!orders || !orders.length) {
      try { orders = JSON.parse(localStorage.getItem("edupeak_pending_orders") || "[]"); } catch (e) { orders = []; }
    }

    const orderIndex = orders.findIndex(o => o.orderId === orderId);
    if (orderIndex === -1) {
      if (window.showToast) window.showToast("Order not found.", "error");
      return;
    }

    const order = orders[orderIndex];

    // 1. Update status in Supabase Cloud
    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.updateOrderStatus === "function") {
      try {
        await window.SUPABASE_HELPER.updateOrderStatus(orderId, "Approved");
      } catch (e) {
        console.warn("Supabase updateOrderStatus error:", e);
      }
    }

    // 2. Grant course access to the student
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

    // Update order status locally
    orders[orderIndex].status = "Approved";
    orders[orderIndex].approvedAt = new Date().toISOString();
    localStorage.setItem("edupeak_pending_orders", JSON.stringify(orders));

    if (window.showToast) {
      window.showToast(`🎉 Order ${order.orderId} approved! Access to "${order.courseTitle}" granted for ${order.studentName}.`, "success");
    }

    await this.renderPendingOrders();
    this.renderStudents();
    this.renderOverview();
  },

  async cancelPendingOrder(orderId) {
    if (!orderId) return;
    if (!confirm(`Are you sure you want to cancel order ${orderId}? This will remove the pending status and allow the student to place a new order.`)) {
      return;
    }

    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.updateOrderStatus === "function") {
      try {
        await window.SUPABASE_HELPER.updateOrderStatus(orderId, "Cancelled");
      } catch (e) {
        console.warn("Supabase cancel order error:", e);
      }
    }

    let orders = [];
    try {
      orders = JSON.parse(localStorage.getItem("edupeak_pending_orders") || "[]");
    } catch (e) {
      orders = [];
    }

    const orderIndex = orders.findIndex(o => o.orderId === orderId);
    if (orderIndex !== -1) {
      orders[orderIndex].status = "Cancelled";
      orders[orderIndex].cancelledAt = new Date().toISOString();
      localStorage.setItem("edupeak_pending_orders", JSON.stringify(orders));
    }

    if (window.showToast) {
      window.showToast(`❌ Order ${orderId} has been cancelled. The course restriction has been released for the student.`, "info");
    }

    await this.renderPendingOrders();
    this.renderStudents();
    this.renderOverview();
  },

  renderStudents() {
    this.renderPendingOrders();
    const tbody = document.getElementById("adminStudentsTbody");
    if (!tbody) return;

    const localUsers = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getUsers() : [];
    let students = localUsers.filter(u => u.role === "student");

    const query = (document.getElementById("adminStudentSearch")?.value || "").toLowerCase().trim();
    const stream = document.getElementById("adminStudentStreamFilter")?.value || "all";
    const batch = document.getElementById("adminStudentBatchFilter")?.value || "all";

    if (query) {
      students = students.filter(s =>
        (s.name && s.name.toLowerCase().includes(query)) ||
        (s.email && s.email.toLowerCase().includes(query)) ||
        (s.id && s.id.toLowerCase().includes(query)) ||
        (s.nic && s.nic.toLowerCase().includes(query)) ||
        (s.phone && s.phone.includes(query))
      );
    }

    if (stream !== "all") {
      students = students.filter(s => s.stream && s.stream.toLowerCase().includes(stream.toLowerCase()));
    }

    if (batch !== "all") {
      students = students.filter(s => (s.examYear && s.examYear.includes(batch)) || (s.id && s.id.includes(batch)));
    }

    const countLabel = document.getElementById("adminStudentsCountLabel");
    if (countLabel) {
      countLabel.textContent = `Showing ${students.length} student${students.length === 1 ? '' : 's'}`;
    }

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 2.5rem;">No students found matching current filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = students.map(s => {
      const enrolledCourses = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getStudentEnrolledCourses(s.id) : (s.enrolledCourses || []);
      const courseCount = enrolledCourses.length;
      const courseTag = courseCount > 0
        ? `<span class="status-tag active" style="font-size: 0.72rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;" onclick="ADMIN_CONTROLLER.openManageCourseAccessModal('${s.id}')" title="${enrolledCourses.join(', ')}">
            <i class="fa-solid fa-graduation-cap"></i> ${courseCount} Course${courseCount === 1 ? '' : 's'}
           </span>`
        : `<span class="status-tag" style="background: #f1f5f9; color: #64748b; font-size: 0.72rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;" onclick="ADMIN_CONTROLLER.openManageCourseAccessModal('${s.id}')">
            <i class="fa-regular fa-circle"></i> None
           </span>`;

      const phoneClean = (s.phone || "").replace(/[^0-9]/g, '');
      const waLink = phoneClean ? `https://wa.me/${phoneClean.startsWith('0') ? '94' + phoneClean.slice(1) : phoneClean}` : '';

      return `
        <tr>
          <td><strong style="color: #227aff; font-family: monospace;">${s.id || "EP-2027-001"}</strong></td>
          <td>
            <div style="font-weight: 700; color: #0f172a;">${s.name || "A/L Student"}</div>
            <div style="font-size: 0.75rem; color: #64748b;">${s.email || "No email"}</div>
          </td>
          <td>
            <div onclick="ADMIN_CONTROLLER.copyText('${s.nic || "Not Provided"}')" title="Click to copy NIC" style="display: inline-flex; align-items: center; gap: 0.35rem; font-family: monospace; font-weight: 700; font-size: 0.78rem; background: #eff6ff; color: #1e40af; padding: 0.25rem 0.55rem; border-radius: 6px; border: 1px solid #bfdbfe; cursor: pointer;">
              <i class="fa-solid fa-id-card" style="color: #227aff;"></i>
              <span>${s.nic || 'Not Provided'}</span>
              <i class="fa-solid fa-copy" style="font-size: 0.65rem; opacity: 0.6;"></i>
            </div>
          </td>
          <td><span class="status-tag active" style="font-size: 0.72rem;">${s.stream || "Physical Science"}</span></td>
          <td>
            <div style="font-size: 0.8rem; color: #334155; display: flex; align-items: center; gap: 0.4rem;">
              <span>${s.phone || "-"}</span>
              ${waLink ? `<a href="${waLink}" target="_blank" rel="noopener noreferrer" style="color: #16a34a; font-weight: 700; font-size: 0.75rem; text-decoration: none;" title="Open WhatsApp chat"><i class="fa-brands fa-whatsapp" style="font-size: 0.9rem;"></i></a>` : ''}
            </div>
          </td>
          <td>${courseTag}</td>
          <td>
            <span class="status-tag ${s.status === 'suspended' ? 'suspended' : 'active'}" style="font-size: 0.72rem;">
              ${s.status === 'suspended' ? 'Suspended' : 'Active'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
              <button class="btn btn-sm btn-primary" 
                      onclick="ADMIN_CONTROLLER.openManageCourseAccessModal('${s.id}')" 
                      title="Manage courses access for this student"
                      style="font-size: 0.75rem; padding: 0.35rem 0.65rem;">
                <i class="fa-solid fa-key"></i> Courses
              </button>
              <button class="btn btn-sm ${s.status === 'suspended' ? 'btn-primary' : 'btn-ghost'}" 
                      onclick="ADMIN_CONTROLLER.toggleStudentStatus('${s.id}', '${s.status === 'suspended' ? 'active' : 'suspended'}')"
                      style="font-size: 0.75rem; padding: 0.35rem 0.65rem;">
                <i class="fa-solid ${s.status === 'suspended' ? 'fa-user-check' : 'fa-user-slash'}"></i>
                ${s.status === 'suspended' ? 'Activate' : 'Suspend'}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  exportStudentsCsv() {
    const localUsers = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getUsers() : [];
    let students = localUsers.filter(u => u.role === "student");

    const query = (document.getElementById("adminStudentSearch")?.value || "").toLowerCase().trim();
    const stream = document.getElementById("adminStudentStreamFilter")?.value || "all";
    const batch = document.getElementById("adminStudentBatchFilter")?.value || "all";

    if (query) {
      students = students.filter(s =>
        (s.name && s.name.toLowerCase().includes(query)) ||
        (s.email && s.email.toLowerCase().includes(query)) ||
        (s.id && s.id.toLowerCase().includes(query)) ||
        (s.nic && s.nic.toLowerCase().includes(query)) ||
        (s.phone && s.phone.includes(query))
      );
    }
    if (stream !== "all") {
      students = students.filter(s => s.stream && s.stream.toLowerCase().includes(stream.toLowerCase()));
    }
    if (batch !== "all") {
      students = students.filter(s => (s.examYear && s.examYear.includes(batch)) || (s.id && s.id.includes(batch)));
    }

    if (students.length === 0) {
      if (window.showToast) window.showToast("⚠️ No students found to export.", "warning");
      return;
    }

    const escapeCsv = str => `"${String(str || '').replace(/"/g, '""')}"`;

    const headers = ["Student ID", "Full Name", "NIC Number", "Email", "WhatsApp Mobile", "Stream", "Exam Batch", "Institute Branch", "Enrolled Courses Count", "Status"];
    const rows = students.map(s => {
      const enrolled = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getStudentEnrolledCourses(s.id) : (s.enrolledCourses || []);
      return [
        escapeCsv(s.id || ''),
        escapeCsv(s.name || ''),
        escapeCsv(s.nic || ''),
        escapeCsv(s.email || ''),
        escapeCsv(s.phone || ''),
        escapeCsv(s.stream || 'Physical Science'),
        escapeCsv(s.examYear || '2026 A/L'),
        escapeCsv(s.branch || 'Victory Embilipitiya'),
        escapeCsv(enrolled.length),
        escapeCsv(s.status || 'Active')
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `edupeak_students_roster_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (window.showToast) {
      window.showToast(`📊 Exported ${students.length} students to CSV successfully!`, "success");
    }
  },

  async openManageCourseAccessModal(studentId) {
    if (!studentId) return;

    let users = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getUsers() : [];
    let s = users.find(u => u.id === studentId || (u.email && u.email.toLowerCase() === studentId.toLowerCase()));
    if (!s) {
      try {
        const storedUsers = JSON.parse(localStorage.getItem("edupeak_users_db") || "[]");
        s = storedUsers.find(u => u.id === studentId || (u.email && u.email.toLowerCase() === studentId.toLowerCase()));
      } catch (e) {}
    }
    if (!s) {
      s = { id: studentId, name: "Student", email: "", examYear: "2027 A/L" };
    }

    const studentNameEl = document.getElementById("adminCourseAccessStudentName");
    const studentDetailsEl = document.getElementById("adminCourseAccessStudentDetails");
    const examBadgeEl = document.getElementById("adminCourseAccessExamBadge");
    const studentIdInput = document.getElementById("adminCourseAccessStudentId");
    const listContainer = document.getElementById("adminCourseAccessList");

    if (studentNameEl) studentNameEl.textContent = s.name || "Student";
    if (studentDetailsEl) studentDetailsEl.textContent = `ID: ${s.id} • NIC: ${s.nic || 'Not Provided'} • ${s.email || 'No email'}${s.phone ? ` • ${s.phone}` : ''}`;
    if (examBadgeEl) examBadgeEl.textContent = s.examYear || s.stream || "General";
    if (studentIdInput) studentIdInput.value = s.id;

    // Get current enrolled courses
    const enrolled = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getStudentEnrolledCourses(s.id) : (s.enrolledCourses || []);

    // Get all courses in system instantly from SUPABASE_HELPER, getLMSCourses or local DB
    let allCourses = [];
    if (window.SUPABASE_HELPER) {
      allCourses = await window.SUPABASE_HELPER.getCourses();
    } else if (typeof window.getLMSCourses === "function") {
      allCourses = window.getLMSCourses();
    } else {
      const stored = localStorage.getItem("edupeak_courses_db");
      if (stored !== null) {
        try {
          allCourses = JSON.parse(stored);
        } catch (e) {}
      } else {
        allCourses = (window.EDUPEAK_DATA && window.EDUPEAK_DATA.courses) ? window.EDUPEAK_DATA.courses : [];
      }
    }

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
                <input type="checkbox" class="admin-course-checkbox" value="${course.id}" ${isEnrolled ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #227aff; cursor: pointer;" onchange="ADMIN_CONTROLLER.onCourseCheckboxToggle(this)">
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

    const modal = document.getElementById("adminCourseAccessModal");
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
    const checkboxes = document.querySelectorAll("#adminCourseAccessList input[type='checkbox']");
    checkboxes.forEach(cb => {
      cb.checked = select;
      this.onCourseCheckboxToggle(cb);
    });
  },

  saveStudentCourseAccessSubmit() {
    const studentIdInput = document.getElementById("adminCourseAccessStudentId");
    const studentId = studentIdInput ? studentIdInput.value : "";
    if (!studentId) return;

    const checkedBoxes = document.querySelectorAll("#adminCourseAccessList input[type='checkbox']:checked");
    const selectedCourseIds = Array.from(checkedBoxes).map(cb => cb.value);

    if (window.AUTH_SYSTEM && typeof window.AUTH_SYSTEM.setStudentEnrolledCourses === "function") {
      window.AUTH_SYSTEM.setStudentEnrolledCourses(studentId, selectedCourseIds);
    } else {
      localStorage.setItem(`edupeak_student_courses_${studentId}`, JSON.stringify(selectedCourseIds));
    }

    if (window.showToast) {
      window.showToast(`🎉 Access updated for ${studentId} (${selectedCourseIds.length} course${selectedCourseIds.length === 1 ? '' : 's'} granted)!`, "success");
    }

    const modal = document.getElementById("adminCourseAccessModal");
    if (modal) modal.classList.remove("active");

    this.renderStudents();
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

    let courses = await window.SUPABASE_HELPER.getCourses();

    const catFilter = document.getElementById("adminCourseCategoryFilter")?.value || "all";
    const batchFilter = document.getElementById("adminCourseBatchFilter")?.value || "all";

    if (catFilter !== "all") {
      courses = courses.filter(c => (c.category || "").toLowerCase() === catFilter.toLowerCase());
    }

    if (batchFilter !== "all") {
      courses = courses.filter(c => 
        (c.examYear && c.examYear.includes(batchFilter)) || 
        (c.level && c.level.includes(batchFilter)) || 
        (c.id && c.id.includes(batchFilter)) ||
        (c.badge && c.badge.includes(batchFilter))
      );
    }

    const countLabel = document.getElementById("adminCoursesCountLabel");
    if (countLabel) {
      countLabel.textContent = `Showing ${courses.length} active course${courses.length === 1 ? '' : 's'} (${catFilter === 'all' ? 'All categories' : catFilter})`;
    }

    if (courses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 2.5rem;">No courses found matching current filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = courses.map(c => `
      <tr>
        <td><strong style="font-family: monospace; color: #227aff;">${c.id}</strong></td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${c.title}</div>
          <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">${c.teacherName || c.teacher || 'Amalsha Wanniarachchi'}</div>
        </td>
        <td>
          <span class="status-tag active" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; font-weight: 700; font-size: 0.75rem;">
            <i class="fa-solid fa-calendar-check"></i> ${c.examYear || c.level || '2026 A/L'}
          </span>
        </td>
        <td><strong style="color: #1565d8;">${c.fee || c.price || 'LKR 3,500 / Month'}</strong></td>
        <td><span style="font-size: 0.8rem; color: #475569;">${c.liveTime || 'Every Sat 7:30 AM'}</span></td>
        <td>
          <div style="display: flex; gap: 0.35rem; justify-content: flex-end; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-sm" style="background: #eff6ff; color: #227aff; border: 1px solid #bfdbfe; font-size: 0.75rem; padding: 0.25rem 0.5rem; font-weight: 700;" onclick="ADMIN_CONTROLLER.quickAddLessonForCourse('${c.id}')" title="Add Video Lesson for this course">
              <i class="fa-solid fa-plus"></i> Lesson
            </button>
            <button class="btn btn-sm" style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; font-size: 0.75rem; padding: 0.25rem 0.5rem; font-weight: 700;" onclick="ADMIN_CONTROLLER.quickAddQuizForCourse('${c.id}')" title="Add MCQ Question for this course">
              <i class="fa-solid fa-plus"></i> MCQ
            </button>
            <button class="btn btn-ghost btn-sm" onclick="ADMIN_CONTROLLER.openEditCourseModal('${c.id}')" title="Edit Course">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-ghost btn-sm" style="color: #ef4444;" onclick="ADMIN_CONTROLLER.deleteCourse('${c.id}')" title="Delete Course">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join("");
    
    // Ensure dropdowns in lessons and quizzes stay populated
    await this.populateCourseDropdowns();
  },

  toggleCourseCategoryCustom(val) {
    const el = document.getElementById("courseFormCategoryCustom");
    if (el) el.style.display = (val === "custom") ? "block" : "none";
  },

  toggleCourseFeeCustom(val) {
    const el = document.getElementById("courseFormFeeCustom");
    if (el) el.style.display = (val === "custom") ? "block" : "none";
  },

  toggleCourseScheduleDayCustom(val) {
    const el = document.getElementById("courseFormScheduleDayCustom");
    if (el) el.style.display = (val === "custom") ? "block" : "none";
  },

  toggleCourseMediumCustom(val) {
    const el = document.getElementById("courseFormMediumCustom");
    if (el) el.style.display = (val === "custom") ? "block" : "none";
  },

  openAddCourseModal() {
    document.getElementById("courseModalTitle").textContent = "Add New Course";
    document.getElementById("courseFormId").value = "crs-phy-" + Date.now().toString(36);
    document.getElementById("courseFormTitle").value = "";
    if (document.getElementById("courseFormTitleSi")) {
      document.getElementById("courseFormTitleSi").value = "";
    }
    
    // Category
    const catSelect = document.getElementById("courseFormCategory");
    if (catSelect) catSelect.value = "theory";
    this.toggleCourseCategoryCustom("theory");
    if (document.getElementById("courseFormCategoryCustom")) {
      document.getElementById("courseFormCategoryCustom").value = "";
    }

    // Monthly Fee
    const feeSelect = document.getElementById("courseFormFee");
    if (feeSelect) feeSelect.value = "LKR 3,500 / Month";
    this.toggleCourseFeeCustom("LKR 3,500 / Month");
    if (document.getElementById("courseFormFeeCustom")) {
      document.getElementById("courseFormFeeCustom").value = "";
    }

    document.getElementById("courseFormLevel").value = "2026 A/L";
    document.getElementById("courseFormTeacher").value = "Amalsha Wanniarachchi";
    
    // Schedule Day
    const daySelect = document.getElementById("courseFormScheduleDay");
    if (daySelect) daySelect.value = "Every Saturday";
    this.toggleCourseScheduleDayCustom("Every Saturday");
    if (document.getElementById("courseFormScheduleDayCustom")) {
      document.getElementById("courseFormScheduleDayCustom").value = "";
    }

    if (document.getElementById("courseFormScheduleStartTime")) {
      document.getElementById("courseFormScheduleStartTime").value = "07:30";
    }
    if (document.getElementById("courseFormScheduleEndTime")) {
      document.getElementById("courseFormScheduleEndTime").value = "13:30";
    }

    // Medium
    const medSelect = document.getElementById("courseFormMedium");
    if (medSelect) medSelect.value = "Sinhala & English Medium";
    this.toggleCourseMediumCustom("Sinhala & English Medium");
    if (document.getElementById("courseFormMediumCustom")) {
      document.getElementById("courseFormMediumCustom").value = "";
    }

    document.getElementById("adminCourseDrawerModal").classList.add("active");
  },

  async openEditCourseModal(id) {
    const courses = await window.SUPABASE_HELPER.getCourses();
    const c = courses.find(item => item.id === id);
    if (!c) return;

    document.getElementById("courseModalTitle").textContent = "Edit Course Details";
    document.getElementById("courseFormId").value = c.id;
    document.getElementById("courseFormTitle").value = c.title;
    if (document.getElementById("courseFormTitleSi")) {
      document.getElementById("courseFormTitleSi").value = c.title_si || "";
    }

    // Category
    const catSelect = document.getElementById("courseFormCategory");
    const currentCat = c.category || "theory";
    const catOption = catSelect ? Array.from(catSelect.options).find(opt => opt.value === currentCat) : null;
    if (catOption) {
      catSelect.value = currentCat;
      this.toggleCourseCategoryCustom(currentCat);
      if (document.getElementById("courseFormCategoryCustom")) document.getElementById("courseFormCategoryCustom").value = "";
    } else if (catSelect) {
      catSelect.value = "custom";
      this.toggleCourseCategoryCustom("custom");
      if (document.getElementById("courseFormCategoryCustom")) {
        document.getElementById("courseFormCategoryCustom").value = currentCat;
      }
    }

    // Fee
    const feeSelect = document.getElementById("courseFormFee");
    const currentFee = c.fee || c.price || "LKR 3,500 / Month";
    const feeOption = feeSelect ? Array.from(feeSelect.options).find(opt => opt.value === currentFee) : null;
    if (feeOption) {
      feeSelect.value = currentFee;
      this.toggleCourseFeeCustom(currentFee);
      if (document.getElementById("courseFormFeeCustom")) document.getElementById("courseFormFeeCustom").value = "";
    } else if (feeSelect) {
      feeSelect.value = "custom";
      this.toggleCourseFeeCustom("custom");
      if (document.getElementById("courseFormFeeCustom")) {
        document.getElementById("courseFormFeeCustom").value = currentFee;
      }
    }

    document.getElementById("courseFormLevel").value = c.examYear || c.level || "2026 A/L";
    document.getElementById("courseFormTeacher").value = c.teacherName || c.teacher || "Amalsha Wanniarachchi";
    
    // Parse Day & Time Slot
    const parsedSchedule = this.parseScheduleString(c.liveTime || "Every Saturday 7:30 AM - 1:30 PM");
    const daySelect = document.getElementById("courseFormScheduleDay");
    if (daySelect) {
      const dayOption = Array.from(daySelect.options).find(opt => opt.value === parsedSchedule.day);
      if (dayOption) {
        daySelect.value = parsedSchedule.day;
        this.toggleCourseScheduleDayCustom(parsedSchedule.day);
        if (document.getElementById("courseFormScheduleDayCustom")) document.getElementById("courseFormScheduleDayCustom").value = "";
      } else {
        daySelect.value = "custom";
        this.toggleCourseScheduleDayCustom("custom");
        if (document.getElementById("courseFormScheduleDayCustom")) {
          document.getElementById("courseFormScheduleDayCustom").value = parsedSchedule.day;
        }
      }
    }

    if (document.getElementById("courseFormScheduleStartTime")) {
      document.getElementById("courseFormScheduleStartTime").value = parsedSchedule.startTime;
    }
    if (document.getElementById("courseFormScheduleEndTime")) {
      document.getElementById("courseFormScheduleEndTime").value = parsedSchedule.endTime;
    }

    // Medium
    const medSelect = document.getElementById("courseFormMedium");
    const currentMed = c.medium || "Sinhala & English Medium";
    const medOption = medSelect ? Array.from(medSelect.options).find(opt => opt.value === currentMed) : null;
    if (medOption) {
      medSelect.value = currentMed;
      this.toggleCourseMediumCustom(currentMed);
      if (document.getElementById("courseFormMediumCustom")) document.getElementById("courseFormMediumCustom").value = "";
    } else if (medSelect) {
      medSelect.value = "custom";
      this.toggleCourseMediumCustom("custom");
      if (document.getElementById("courseFormMediumCustom")) {
        document.getElementById("courseFormMediumCustom").value = currentMed;
      }
    }

    document.getElementById("adminCourseDrawerModal").classList.add("active");
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
    const timeMatches = Array.from(scheduleStr.matchAll(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi));
    let startTime = "07:30";
    let endTime = "13:30";
    if (timeMatches.length >= 2) {
      startTime = this.parseTimeTo24h(timeMatches[0][0]);
      endTime = this.parseTimeTo24h(timeMatches[1][0]);
    } else if (timeMatches.length === 1) {
      startTime = this.parseTimeTo24h(timeMatches[0][0]);
    }

    let extractedDay = "";
    if (timeMatches.length > 0 && timeMatches[0].index > 0) {
      extractedDay = scheduleStr.substring(0, timeMatches[0].index).trim();
    } else {
      extractedDay = scheduleStr.trim();
    }

    const standardDays = [
      "Every Saturday", "Every Sunday", "Every Monday", "Every Tuesday", 
      "Every Wednesday", "Every Thursday", "Every Friday", 
      "Weekends (Sat & Sun)", "Weekdays (Mon - Fri)", "Flexible / Online"
    ];

    let matchedDay = extractedDay;
    const foundStandard = standardDays.find(d => 
      d.toLowerCase() === extractedDay.toLowerCase() || 
      d.replace("Every ", "").toLowerCase() === extractedDay.toLowerCase()
    );
    if (foundStandard) {
      matchedDay = foundStandard;
    } else if (!matchedDay) {
      matchedDay = "Every Saturday";
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

  async handleSaveCourseSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("courseFormId").value;
    const title = document.getElementById("courseFormTitle").value.trim();
    const titleSi = document.getElementById("courseFormTitleSi") ? document.getElementById("courseFormTitleSi").value.trim() : title;
    
    let category = document.getElementById("courseFormCategory") ? document.getElementById("courseFormCategory").value : "theory";
    if (category === "custom") {
      category = document.getElementById("courseFormCategoryCustom")?.value.trim() || "theory";
    }

    let fee = document.getElementById("courseFormFee") ? document.getElementById("courseFormFee").value : "LKR 3,500 / Month";
    if (fee === "custom") {
      fee = document.getElementById("courseFormFeeCustom")?.value.trim() || "LKR 3,500 / Month";
    }

    const level = document.getElementById("courseFormLevel").value.trim();
    const teacher = document.getElementById("courseFormTeacher").value.trim();
    
    let day = document.getElementById("courseFormScheduleDay")?.value || "Every Saturday";
    if (day === "custom") {
      day = document.getElementById("courseFormScheduleDayCustom")?.value.trim() || "Every Saturday";
    }
    const start = document.getElementById("courseFormScheduleStartTime")?.value || "07:30";
    const end = document.getElementById("courseFormScheduleEndTime")?.value || "13:30";
    const schedule = this.buildScheduleString(day, start, end);

    let medium = document.getElementById("courseFormMedium") ? document.getElementById("courseFormMedium").value : "Sinhala & English Medium";
    if (medium === "custom") {
      medium = document.getElementById("courseFormMediumCustom")?.value.trim() || "Sinhala & English Medium";
    }

    const courseData = {
      id: id,
      title: title,
      title_si: titleSi || title,
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

    await this.renderCourses();
    await this.renderOverview();
  },

  async deleteCourse(id) {
    if (confirm("Are you sure you want to delete this course from the institution catalog?")) {
      await window.SUPABASE_HELPER.deleteCourse(id);
      if (window.showToast) {
        window.showToast("Course deleted successfully.", "info");
      }
      await this.renderCourses();
      await this.renderOverview();
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
    document.getElementById("instFormPhone").value = "+94 76 068 7578";
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
    document.getElementById("instFormStatus").value = (inst.status === "coming_soon" || inst.status === "pending" || inst.status === "inactive") ? "coming_soon" : "active";
    document.getElementById("instFormType").value = inst.type || "Physical Campus & Smart Auditorium";
    document.getElementById("instFormBadge").value = inst.badge || (inst.status === "coming_soon" ? "Coming Soon" : "Physical Campus Hub");
    document.getElementById("instFormIcon").value = inst.icon || "🏫";
    document.getElementById("instFormLocation").value = inst.location || "";
    document.getElementById("instFormPhone").value = inst.phone || "";
    document.getElementById("instFormEmail").value = inst.email || "";
    document.getElementById("instFormMapUrl").value = inst.mapUrl || inst.mapurl || "";

    const facs = Array.isArray(inst.facilities) ? inst.facilities.join("\n") : (inst.facilities || "");
    document.getElementById("instFormFacilities").value = facs;

    modal.classList.add("active");
  },

  handleStatusDropdownChange(newStatus) {
    const badgeInput = document.getElementById("instFormBadge");
    const typeInput = document.getElementById("instFormType");
    if (!badgeInput) return;
    const isOnline = typeInput && typeInput.value.toLowerCase().includes("online");
    const currentVal = badgeInput.value.trim();
    if (newStatus === "active") {
      if (!currentVal || currentVal === "Coming Soon" || currentVal === "Coming Soon (Online)" || currentVal === "ඉදිරියේදී විවෘත වේ") {
        badgeInput.value = isOnline ? "24/7 Global Cloud LMS" : "Physical Campus Hub";
      }
    } else if (newStatus === "coming_soon") {
      if (!currentVal || currentVal === "Physical Campus Hub" || currentVal === "24/7 Global Cloud LMS" || currentVal === "ප්‍රධාන භෞතික මධ්‍යස්ථානය") {
        badgeInput.value = isOnline ? "Coming Soon (Online)" : "Coming Soon";
      }
    }
  },

  async handleSaveInstituteSubmit(e) {
    e.preventDefault();

    const id = document.getElementById("instFormId").value;
    const name = document.getElementById("instFormName").value.trim();
    const name_si = document.getElementById("instFormNameSi").value.trim() || name;
    const status = document.getElementById("instFormStatus").value;
    const type = document.getElementById("instFormType").value.trim();
    const isOnline = type.toLowerCase().includes("online");
    let badge = document.getElementById("instFormBadge").value.trim();

    // Auto-align default badge text with active vs coming_soon if it was not custom
    if (status === "active" && (badge === "Coming Soon" || badge === "Coming Soon (Online)" || badge === "ඉදිරියේදී විවෘත වේ")) {
      badge = isOnline ? "24/7 Global Cloud LMS" : "Physical Campus Hub";
    } else if (status === "coming_soon" && (badge === "Physical Campus Hub" || badge === "24/7 Global Cloud LMS" || badge === "ප්‍රධාන භෞතික මධ්‍යස්ථානය")) {
      badge = isOnline ? "Coming Soon (Online)" : "Coming Soon";
    }
    if (!badge) {
      badge = status === "coming_soon" ? (isOnline ? "Coming Soon (Online)" : "Coming Soon") : (isOnline ? "24/7 Global Cloud LMS" : "Physical Campus Hub");
    }

    const icon = document.getElementById("instFormIcon").value.trim() || (isOnline ? "🌐" : "🏫");
    const location = document.getElementById("instFormLocation").value.trim();
    const phone = document.getElementById("instFormPhone").value.trim();
    const email = document.getElementById("instFormEmail").value.trim();
    const mapUrl = document.getElementById("instFormMapUrl").value.trim();
    const rawFacilities = document.getElementById("instFormFacilities").value.trim();
    const facilities = rawFacilities.split("\n").map(f => f.trim()).filter(Boolean);

    const existingInstitutes = window.EDUPEAK_INSTITUTES ? window.EDUPEAK_INSTITUTES.getAll() : [];
    const existingInst = existingInstitutes.find(i => i.id === id);

    const instData = {
      ...(existingInst || {}),
      id: id || ("inst-" + Date.now().toString(36)),
      name: name,
      name_si: name_si,
      status: status,
      hasPhysicalLocation: !isOnline,
      hasphysicallocation: !isOnline,
      type: type,
      type_si: type,
      badge: badge,
      badge_si: status === "coming_soon" ? "ඉදිරියේදී විවෘත වේ" : (badge === "Physical Campus Hub" ? "ප්‍රධාන භෞතික මධ්‍යස්ථානය" : badge),
      icon: icon,
      location: location,
      location_si: location,
      phone: phone,
      email: email,
      mapUrl: mapUrl,
      mapurl: mapUrl,
      facilities: facilities.length > 0 ? facilities : ["Air Conditioned Auditorium", "Smart Campus Wi-Fi"],
      facilities_si: facilities.length > 0 ? facilities : ["වායුසමනය කළ ශ්‍රවණාගාරය", "Smart LMS Wi-Fi"]
    };

    // 1. Immediately persist locally
    const institutes = [...existingInstitutes];
    const existingIndex = institutes.findIndex(i => i.id === instData.id);
    if (existingIndex >= 0) {
      institutes[existingIndex] = { ...institutes[existingIndex], ...instData };
    } else {
      institutes.push(instData);
    }
    if (window.EDUPEAK_INSTITUTES) {
      window.EDUPEAK_INSTITUTES.saveAll(institutes);
    }

    // 2. Sync to Supabase Cloud
    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.saveInstitute === "function") {
      await window.SUPABASE_HELPER.saveInstitute(instData);
    }

    document.getElementById("adminInstituteDrawerModal").classList.remove("active");
    if (window.showToast) {
      window.showToast(`🏫 Institute branch "${name}" saved & synced!`, "success");
    }

    this.renderInstitutes();
  },

  async toggleInstituteStatus(id) {
    const institutes = window.EDUPEAK_INSTITUTES ? [...window.EDUPEAK_INSTITUTES.getAll()] : [];
    const inst = institutes.find(i => i.id === id);
    if (!inst) return;

    const newStatus = inst.status === "active" ? "coming_soon" : "active";
    const isOnline = (inst.type && inst.type.toLowerCase().includes("online")) || inst.hasPhysicalLocation === false;
    inst.status = newStatus;
    if (newStatus === "coming_soon") {
      inst.badge = isOnline ? "Coming Soon (Online)" : "Coming Soon";
      inst.badge_si = "ඉදිරියේදී විවෘත වේ";
    } else {
      inst.badge = isOnline ? "24/7 Global Cloud LMS" : "Physical Campus Hub";
      inst.badge_si = isOnline ? "ගෝලීය මාර්ගගත LMS" : "ප්‍රධාන භෞතික මධ්‍යස්ථානය";
    }

    if (window.EDUPEAK_INSTITUTES) {
      window.EDUPEAK_INSTITUTES.saveAll(institutes);
    }

    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.saveInstitute === "function") {
      await window.SUPABASE_HELPER.saveInstitute(inst);
    }

    const cleanName = (inst.name || "").replace(/\s*\(Coming soon\)/gi, "");
    if (window.showToast) {
      window.showToast(`Branch "${cleanName}" status changed to: ${newStatus === 'active' ? '🟢 Active' : '🟡 Coming Soon'}!`, "info");
    }

    this.renderInstitutes();
  },

  async deleteInstitute(id) {
    const institutes = window.EDUPEAK_INSTITUTES ? [...window.EDUPEAK_INSTITUTES.getAll()] : [];
    const inst = institutes.find(i => i.id === id);
    if (!inst) return;

    const cleanName = (inst.name || "").replace(/\s*\(Coming soon\)/gi, "");
    if (confirm(`Are you sure you want to delete "${cleanName}"? This branch will be removed from the home page and registration forms.`)) {
      const filtered = institutes.filter(i => i.id !== id);
      if (window.EDUPEAK_INSTITUTES) {
        window.EDUPEAK_INSTITUTES.saveAll(filtered);
      }
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.deleteInstitute === "function") {
        await window.SUPABASE_HELPER.deleteInstitute(id);
      }
      if (window.showToast) {
        window.showToast(`Branch "${cleanName}" has been deleted.`, "info");
      }
      this.renderInstitutes();
    }
  },

  async restoreDefaultInstitutes() {
    const defaultList = [
      {
        id: "inst-embilipitiya",
        name: "Victory Higher Educational Institute - Embilipitiya",
        name_si: "වික්ටරි උසස් අධ්‍යාපන ආයතනය - ඇඹිලිපිටිය",
        status: "active",
        hasPhysicalLocation: true,
        location: "Victory College Embilipitiya, Embilipitiya Pallegama, Sri Lanka, 70200",
        location_si: "වික්ටරි කොලේජ්, ඇඹිලිපිටිය පල්ලෙගම, ශ්‍රී ලංකාව, 70200",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Victory+College+Embilipitiya+Pallegama",
        phone: "+94 47 226 2808 / +94 76 068 7578 (WhatsApp)",
        email: "victorycollege.emb@gmail.com",
        website: "https://victorycollegeemb.edu.lk",
        facebook: "https://www.facebook.com/Embilipitiya.edu",
        type: "Physical Campus & Smart Auditorium",
        type_si: "ප්‍රධාන භෞතික ශ්‍රවණාගාරය හා පරිශ්‍රය",
        facilities: [
          "Air Conditioned 1,500-seat Ultra-Modern Auditorium",
          "High-Speed Smart LMS Campus Wi-Fi",
          "Digital Physics Demonstration Lab & Visual Projection",
          "Dedicated Tute Counter & Student Helpdesk (047 226 2808)",
          "Official WhatsApp Support: +94 76 068 7578"
        ],
        facilities_si: [
          "වායුසමනය කළ ආසන 1,500ක අතිනවීන ශ්‍රවණාගාරය",
          "අධිවේගී Smart LMS Wi-Fi පද්ධතිය",
          "භෞතික විද්‍යා ආදර්ශන සහ ඩිජිටල් ප්‍රක්ෂේපණ පද්ධතිය",
          "නිබන්ධන කවුළුව සහ ශිෂ්‍ය තාක්ෂණික සහාය (047 226 2808)",
          "නිල WhatsApp සහාය: +94 76 068 7578"
        ],
        badge: "Physical Campus Hub",
        badge_si: "ප්‍රධාන භෞතික මධ්‍යස්ථානය",
        icon: "🏫"
      },
      {
        id: "inst-online",
        name: "EduPeak 24/7 Global Online LMS",
        name_si: "එඩියුපීක් 24/7 ගෝලීය මාර්ගගත LMS",
        status: "coming_soon",
        hasPhysicalLocation: false,
        location: "Online Hybrid Cloud Platform (Island-Wide)",
        location_si: "සමස්ත ලංකා මාර්ගගත ක්ලවුඩ් පද්ධතිය (Online)",
        phone: "+94 76 068 7578 (WhatsApp / Hotline)",
        email: "support@edupeak.lk",
        type: "Online Educational Platform & LMS",
        type_si: "100% ක්ලවුඩ් LMS පද්ධතිය",
        facilities: [
          "Ultra HD 1080p Low-Latency Live Streaming",
          "Instant MCQ Speed Testing & Ranking",
          "Island-wide Tute Home Delivery (Speed Post)",
          "24/7 AI-Powered Doubt Clearing Chat"
        ],
        facilities_si: [
          "අඩු ඩේටා වැයවන Ultra HD සජීවී විකාශය",
          "ක්ෂණික MCQ ලකුණු හා සමස්ත ලංකා ශ්‍රේණිගත කිරීම්",
          "දිවයින පුරා නිවසටම නිබන්ධන කුරියර් සේවාව",
          "24/7 ක්‍රියාත්මක AI සහායක සහ ගැටළු නිරාකරණය"
        ],
        badge: "Coming Soon (Online)",
        badge_si: "ඉදිරියේදී විවෘත වේ",
        icon: "🌐"
      },
      {
        id: "inst-kandy",
        name: "EduPeak Kandy Royal Center",
        name_si: "එඩියුපීක් මහනුවර රෝයල් මධ්‍යස්ථානය",
        status: "coming_soon",
        hasPhysicalLocation: true,
        location: "Royal Center, Peradeniya Road, Kandy, Sri Lanka",
        location_si: "රෝයල් මධ්‍යස්ථානය, පේරාදෙණිය පාර, මහනුවර",
        mapUrl: "https://maps.google.com/?q=Kandy",
        phone: "+94 81 223 4567 / +94 71 805 9089",
        email: "kandy@edupeak.lk",
        type: "Upcoming Central Province Campus Hub",
        type_si: "මධ්‍යම පළාත් නව ශාඛාව",
        facilities: [
          "800-seat Multimedia Lecture Hall",
          "Physics Experiment Demonstration Unit",
          "Kandy District Tute Counter & Express Courier",
          "Student Study Lounge & Free Wi-Fi"
        ],
        facilities_si: [
          "ආසන 800ක බහුමාධ්‍ය ශ්‍රවණාගාරය",
          "භෞතික විද්‍යා ප්‍රායෝගික ආදර්ශන ඒකකය",
          "මහනුවර දිස්ත්‍රික් නිබන්ධන කවුළුව",
          "නොමිලේ Wi-Fi සහ අධ්‍යයන ශාලාව"
        ],
        badge: "Coming Soon",
        badge_si: "ඉදිරියේදී විවෘත වේ",
        icon: "🏛️"
      },
      {
        id: "inst-kurunegala",
        name: "EduPeak Kurunegala Premier Hub",
        name_si: "එඩියුපීක් කුරුණෑගල ප්‍රිමියර් මධ්‍යස්ථානය",
        status: "coming_soon",
        hasPhysicalLocation: true,
        location: "Premier Hub, Colombo Road, Kurunegala, Sri Lanka",
        location_si: "ප්‍රිමියර් මධ්‍යස්ථානය, කොළඹ පාර, කුරුණෑගල",
        mapUrl: "https://maps.google.com/?q=Kurunegala",
        phone: "+94 37 222 3344 / +94 71 805 9089",
        email: "kurunegala@edupeak.lk",
        type: "Upcoming North Western Province Hub",
        type_si: "වයඹ පළාත් නව ශාඛාව",
        facilities: [
          "Modern Digital Classroom with Visual Monitors",
          "Speed Exam Testing Center",
          "Wayamba Student Support Desk",
          "Direct Bus Route Accessibility"
        ],
        facilities_si: [
          "නවීන ඩිජිටල් පන්ති කාමර",
          "වේගවත් විභාග පරීක්ෂණ මධ්‍යස්ථානය",
          "වයඹ ශිෂ්‍ය සේවා කවුළුව",
          "ප්‍රධාන බස් නැවතුම්පොළට ආසන්නව"
        ],
        badge: "Coming Soon",
        badge_si: "ඉදිරියේදී විවෘත වේ",
        icon: "🏢"
      }
    ];

    for (const inst of defaultList) {
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.saveInstitute === "function") {
        await window.SUPABASE_HELPER.saveInstitute(inst);
      }
    }
    if (window.EDUPEAK_INSTITUTES) {
      const current = window.EDUPEAK_INSTITUTES.getAll();
      defaultList.forEach(d => {
        if (!current.some(c => c.id === d.id)) current.push(d);
      });
      window.EDUPEAK_INSTITUTES.saveAll(current);
    }

    this.renderInstitutes();
    if (window.showToast) {
      window.showToast("🏛️ Default campus branches (including Online LMS) restored!", "success");
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
  async getPapers() {
    const deletedIds = (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getDeletedPapers === "function")
      ? window.SUPABASE_HELPER.getDeletedPapers()
      : JSON.parse(localStorage.getItem("edupeak_deleted_papers") || "[]");
    const filterDeleted = (list) => Array.isArray(list) ? list.filter(p => p && !deletedIds.includes(p.id) && !deletedIds.includes(String(p.id))) : [];

    if (window.SUPABASE_HELPER) {
      const papers = await window.SUPABASE_HELPER.getPapers();
      return filterDeleted(papers);
    }
    const saved = localStorage.getItem("edupeak_papers_db");
    if (saved !== null) {
      try {
        let parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
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
          return filterDeleted(parsed);
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
        size: "4.5 MB",
        url: "https://drive.google.com/file/d/1w3A6i3bWkY4d_sample_edupeak_al_physics_2025/view?usp=sharing"
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
        url: "https://storage.googleapis.com/edupeak-cloud-vault/papers/physics_al_2023.pdf"
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

    const activeDefaults = filterDeleted(defaultPapers);
    try {
      localStorage.setItem("edupeak_papers_db", JSON.stringify(activeDefaults));
    } catch (e) {}
    return activeDefaults;
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
    const badge = document.getElementById("paperCloudDetectBadge");
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
    const urlInput = document.getElementById("paperFormUrl");
    if (!urlInput) return;
    // Official public Google Drive PDF sample link
    urlInput.value = "https://drive.google.com/file/d/1w3A6i3bWkY4d_sample_edupeak_al_physics_2025/view?usp=sharing";
    this.onPaperUrlInput(urlInput);
    const sizeInput = document.getElementById("paperFormSize");
    if (sizeInput && !sizeInput.value) sizeInput.value = "4.2 MB";
    if (window.showToast) {
      window.showToast("✓ Sample Google Drive PDF link inserted!", "info");
    }
  },

  async renderPapers() {
    const tbody = document.getElementById("adminPapersTableBody");
    if (!tbody) return;

    let papers = await this.getPapers();

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

      const cloudInfo = this.parsePdfCloudUrl(p.url);

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
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.35rem; flex-wrap: wrap;">
              <span class="pdf-cloud-badge ${cloudInfo.badgeClass}" style="font-size: 0.7rem; padding: 1px 6px;">
                <i class="${cloudInfo.icon}"></i> ${cloudInfo.label}
              </span>
              ${p.url ? `<span style="font-size: 0.72rem; color: #64748b; font-family: monospace;" title="${p.url}"><i class="fa-solid fa-link"></i> ${p.url.substring(0, 38)}${p.url.length > 38 ? '...' : ''}</span>` : ''}
            </div>
          </td>
          <td>
            <span style="font-size: 0.8rem; font-weight: 700; color: #475569; background: #f8fafc; padding: 0.25rem 0.65rem; border-radius: 6px; border: 1px solid #e2e8f0; display: inline-block;">
              <i class="fa-solid fa-tag" style="color: #227aff;"></i> ${p.unitName || p.unit}
            </span>
          </td>
          <td>
            <span style="font-size: 0.85rem; font-weight: 800; color: #ef4444; background: #fee2e2; padding: 0.25rem 0.6rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.3rem;">
              <i class="fa-solid fa-file-pdf"></i> ${p.size || '3.5 MB'}
            </span>
          </td>
          <td>
            <div class="action-btn-group" style="display: flex; gap: 0.35rem;">
              <button class="btn-icon" title="View Cloud / PDF Preview" onclick="ADMIN_CONTROLLER.previewPaper('${p.id}')" style="background:#eff6ff; color:#227aff; border:1px solid #bfdbfe;">
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
    document.getElementById("paperModalTitle").textContent = "Add New Cloud PDF Paper";
    document.getElementById("paperFormId").value = "";
    document.getElementById("paperFormTitle").value = "";
    document.getElementById("paperFormTitleSi").value = "";
    document.getElementById("paperFormType").value = "national";
    document.getElementById("paperFormYear").value = new Date().getFullYear();
    document.getElementById("paperFormUnit").value = "all";
    document.getElementById("paperFormUnitName").value = "Complete Past Paper Examination";
    document.getElementById("paperFormSize").value = "";
    const urlInput = document.getElementById("paperFormUrl");
    if (urlInput) {
      urlInput.value = "";
      this.onPaperUrlInput(urlInput);
    }

    modal.classList.add("active");
  },

  async openEditPaperModal(paperId) {
    const modal = document.getElementById("adminPaperDrawerModal");
    if (!modal) return;
    const papers = await this.getPapers();
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
    document.getElementById("paperFormSize").value = p.size || "";
    const urlInput = document.getElementById("paperFormUrl");
    if (urlInput) {
      urlInput.value = p.url || "";
      this.onPaperUrlInput(urlInput);
    }

    modal.classList.add("active");
  },

  async handleSavePaperSubmit(event) {
    event.preventDefault();
    const id = document.getElementById("paperFormId").value.trim() || `pap-${Date.now()}`;
    const title = document.getElementById("paperFormTitle").value.trim();
    const title_si = document.getElementById("paperFormTitleSi").value.trim();
    const type = document.getElementById("paperFormType").value;
    const year = parseInt(document.getElementById("paperFormYear").value) || 2024;
    const unit = document.getElementById("paperFormUnit").value;
    const unitName = document.getElementById("paperFormUnitName").value.trim() || "Physics Unit";
    const size = document.getElementById("paperFormSize").value.trim() || "Cloud PDF";
    const url = document.getElementById("paperFormUrl").value.trim() || `assets/docs/paper_${year}.pdf`;

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

    const modal = document.getElementById("adminPaperDrawerModal");
    if (modal) modal.classList.remove("active");

    if (window.showToast) {
      window.showToast(`✓ PDF Paper "${title}" saved and published successfully!`, "success");
    }

    await this.renderPapers();
  },

  async deletePaper(paperId) {
    const papers = await this.getPapers();
    const p = papers.find(item => item.id === paperId);
    const title = p ? p.title : "this paper";

    if (!confirm(`Are you sure you want to delete "${title}"? This will immediately remove it from the Student Paper Vault.`)) {
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

    const cloudInfo = this.parsePdfCloudUrl(p.url);
    const viewerModal = document.getElementById("adminPdfViewerModal");
    
    if (viewerModal) {
      const titleEl = document.getElementById("adminPdfPreviewTitle");
      const metaEl = document.getElementById("adminPdfPreviewMeta");
      const badgeEl = document.getElementById("adminPdfCloudBadge");
      const openDirectBtn = document.getElementById("adminPdfOpenDirectBtn");
      const downloadBtn = document.getElementById("adminPdfDownloadBtn");
      const iframe = document.getElementById("adminPdfPreviewIframe");

      if (titleEl) titleEl.textContent = p.title;
      if (metaEl) metaEl.textContent = `${p.year} Exam • ${p.unitName} • ${p.size || 'PDF Document'}`;
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
  // YOUTUBE VIDEO DURATION & URL FORMATTING ENGINE
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

    if (!document.getElementById("ytDurationProbeMountAdmin")) {
      const probeDiv = document.createElement("div");
      probeDiv.id = "ytDurationProbeMountAdmin";
      probeDiv.style.cssText = "position: fixed; left: -9999px; top: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none; z-index: -1;";
      document.body.appendChild(probeDiv);
    }

    const onApiReady = () => {
      try {
        if (!this._probePlayer && window.YT && window.YT.Player) {
          this._probePlayer = new window.YT.Player("ytDurationProbeMountAdmin", {
            height: "1",
            width: "1",
            videoId: "dQw4w9WgXcQ",
            playerVars: { autoplay: 0, controls: 0, disablekb: 1, mute: 1, rel: 0, playsinline: 1 },
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
      tag.id = "yt-duration-probe-script-admin";
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

  formatEmbedUrl(url) {
    const origin = (typeof window !== "undefined" && window.location && window.location.origin) ? encodeURIComponent(window.location.origin) : "";
    const originSuffix = origin ? `?enablejsapi=1&origin=${origin}` : "";

    if (!url) return `https://www.youtube.com/embed/dQw4w9WgXcQ${originSuffix}`;
    
    if (url.includes("youtube.com/watch?v=")) {
      const videoId = url.split("v=")[1]?.split("&")[0];
      if (videoId) return `https://www.youtube.com/embed/${videoId}${originSuffix}`;
    }
    if (url.includes("youtu.be/")) {
      const videoId = url.split("youtu.be/")[1]?.split("?")[0];
      if (videoId) return `https://www.youtube.com/embed/${videoId}${originSuffix}`;
    }
    if (url.includes("youtube.com/embed/") && !url.includes("origin=")) {
      const sep = url.includes("?") ? "&" : "?";
      return origin ? `${url}${sep}enablejsapi=1&origin=${origin}` : url;
    }
    if (url.includes("vimeo.com/") && !url.includes("player.vimeo.com")) {
      const vimeoId = url.split("vimeo.com/")[1]?.split("?")[0];
      if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
    }
    return url;
  },

  // --------------------------------------------------------------------------
  // COURSE DROPDOWNS POPULATION (FOR LESSONS & QUIZZES)
  // --------------------------------------------------------------------------
  async populateCourseDropdowns() {
    const courses = await window.SUPABASE_HELPER.getCourses();
    const selects = [
      { id: "adminLessonCourseSelect", hasAll: true, allLabel: "🌟 All Courses (View All Lessons)" },
      { id: "adminQuizCourseSelect", hasAll: true, allLabel: "🌟 All Courses (View All Questions)" },
      { id: "adminLessonFormCourse", hasAll: false },
      { id: "adminQuizFormCourse", hasAll: false }
    ];

    selects.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) {
        const prevVal = el.value;
        let optionsHtml = "";
        if (s.hasAll) {
          optionsHtml += `<option value="all">${s.allLabel}</option>`;
        }
        optionsHtml += courses.map(c => `<option value="${c.id}">${c.title} (${c.examYear || c.level || 'A/L'})</option>`).join("");
        el.innerHTML = optionsHtml;
        if (prevVal && (prevVal === "all" || courses.some(c => c.id === prevVal))) {
          el.value = prevVal;
        }
      }
    });
  },

  // --------------------------------------------------------------------------
  // LESSONS & VIDEO CURRICULUM MANAGEMENT
  // --------------------------------------------------------------------------
  getAllLessons() {
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

  async renderLessons() {
    const tbody = document.getElementById("adminLessonsTbody");
    if (!tbody) return;

    await this.populateCourseDropdowns();
    const courses = await window.SUPABASE_HELPER.getCourses();
    const courseMap = {};
    courses.forEach(c => { courseMap[c.id] = c; });

    const selectedCourseId = document.getElementById("adminLessonCourseSelect")?.value || "all";
    const allLessons = this.getAllLessons();

    const filteredLessons = (selectedCourseId && selectedCourseId !== "all")
      ? allLessons.filter(l => l.courseId === selectedCourseId)
      : allLessons;

    const countLabel = document.getElementById("adminLessonsCountLabel");
    if (countLabel) {
      countLabel.textContent = `Showing ${filteredLessons.length} published video lesson${filteredLessons.length === 1 ? '' : 's'}`;
    }

    if (!filteredLessons.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 3rem; color: #64748b;">
            <i class="fa-solid fa-film" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">No Lessons Uploaded for this Selection</div>
            <p style="font-size: 0.825rem; margin-bottom: 1rem;">Click "Add Lesson" to upload video lecture recordings, handouts, and chapter timestamps.</p>
            <button class="btn btn-primary btn-sm" onclick="ADMIN_CONTROLLER.openAddLessonModal()">
              <i class="fa-solid fa-plus"></i> Add Lesson
            </button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredLessons.map((l, idx) => {
      const course = courseMap[l.courseId] || { title: l.courseId || "Physics Class" };
      return `
        <tr>
          <td><strong>#${idx + 1}</strong></td>
          <td>
            <div style="font-weight: 700; color: #0f172a;">${l.title}</div>
            <div style="font-size: 0.75rem; color: #64748b;">${l.title_si || ''}</div>
          </td>
          <td>
            <span class="status-tag active" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; font-weight: 700; font-size: 0.725rem;">
              ${course.title}
            </span>
          </td>
          <td>
            <button type="button" class="btn btn-sm" style="border-radius: 9999px; font-size: 0.75rem; background: #eff6ff; color: #227aff; border: 1px solid #bfdbfe; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; padding: 0.2rem 0.55rem;" onclick="ADMIN_CONTROLLER.openEditLessonModal('${l.id}')" title="Click to edit Chapter Markers">
              <i class="fa-solid fa-list-ol"></i> ${(l.chapters && l.chapters.length) || 0} Chapters <i class="fa-solid fa-pen" style="font-size: 0.6rem; opacity: 0.7;"></i>
            </button>
          </td>
          <td><span class="status-tag active">${l.duration || '50 mins'}</span></td>
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
            ${l.watermarkEnabled ? 
              `<span style="color: #0284c7; font-weight: 700; font-size: 0.75rem; background: #e0f2fe; padding: 2px 6px; border-radius: 6px;"><i class="fa-solid fa-shield-halved"></i> Protected</span>` : 
              `<span style="color: #94a3b8; font-size: 0.75rem;">Default</span>`}
          </td>
          <td>
            <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
              <button class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="ADMIN_CONTROLLER.openEditLessonModal('${l.id}')" title="Edit Lesson & Chapters">
                <i class="fa-solid fa-pen-to-square"></i> Edit
              </button>
              <button class="btn btn-ghost btn-sm" style="color: #ef4444; border: 1px solid #fecaca; font-size: 0.75rem; padding: 0.3rem 0.5rem;" onclick="ADMIN_CONTROLLER.deleteLesson('${l.id}')" title="Delete Lesson">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  async openAddLessonModal(preselectedCourseId = null) {
    await this.populateCourseDropdowns();
    document.getElementById("adminLessonModalTitle").textContent = "Add Lesson to Course";
    document.getElementById("adminLessonFormId").value = "";
    document.getElementById("adminLessonFormTitle").value = "";
    document.getElementById("adminLessonFormDuration").value = "50 mins";
    document.getElementById("adminLessonFormVideoUrl").value = "https://www.youtube.com/embed/dQw4w9WgXcQ";
    
    const courseSelect = document.getElementById("adminLessonFormCourse");
    const filterSelect = document.getElementById("adminLessonCourseSelect");
    const targetCourseId = preselectedCourseId || (filterSelect && filterSelect.value !== "all" ? filterSelect.value : null);
    if (courseSelect && targetCourseId) {
      courseSelect.value = targetCourseId;
    }

    if (document.getElementById("adminLessonHasPdfCheckbox")) {
      document.getElementById("adminLessonHasPdfCheckbox").checked = true;
    }
    if (document.getElementById("adminLessonPdfFieldsRow")) {
      document.getElementById("adminLessonPdfFieldsRow").style.display = "grid";
    }
    if (document.getElementById("adminLessonPdfNameInput")) {
      document.getElementById("adminLessonPdfNameInput").value = "Lesson_Summary_Notes.pdf";
    }
    if (document.getElementById("adminLessonPdfUrlInput")) {
      document.getElementById("adminLessonPdfUrlInput").value = "";
    }
    if (document.getElementById("adminLessonWatermarkCheckbox")) {
      document.getElementById("adminLessonWatermarkCheckbox").checked = false;
    }
    if (document.getElementById("adminLessonDurationAutoBadge")) {
      document.getElementById("adminLessonDurationAutoBadge").innerHTML = "";
    }

    const container = document.getElementById("adminLessonChaptersContainer");
    if (container) container.innerHTML = "";

    const deleteBtn = document.getElementById("adminLessonDeleteBtn");
    if (deleteBtn) deleteBtn.style.display = "none";

    document.getElementById("adminLessonDrawerModal").classList.add("active");

    setTimeout(() => {
      this.autoDetectDuration("adminLessonFormVideoUrl", "adminLessonFormDuration", "adminLessonDurationAutoBadge");
    }, 150);
  },

  quickAddLessonForCourse(courseId) {
    this.switchTab("lessons");
    const select = document.getElementById("adminLessonCourseSelect");
    if (select) select.value = courseId;
    this.renderLessons();
    this.openAddLessonModal(courseId);
  },

  async openEditLessonModal(lessonId) {
    await this.populateCourseDropdowns();
    const lessons = this.getAllLessons();
    const l = lessons.find(item => item.id === lessonId);
    if (!l) return;

    this.currentEditingLessonId = lessonId;
    document.getElementById("adminLessonModalTitle").textContent = "Edit Lesson & Chapter Timeline";
    document.getElementById("adminLessonFormId").value = l.id;
    document.getElementById("adminLessonFormTitle").value = l.title || "";
    document.getElementById("adminLessonFormDuration").value = l.duration || "50 mins";
    document.getElementById("adminLessonFormVideoUrl").value = l.videoUrl || "";

    const courseSelect = document.getElementById("adminLessonFormCourse");
    if (courseSelect) courseSelect.value = l.courseId;

    const isPdfActive = Boolean(l.hasPdf || l.pdfName || l.pdfUrl);
    if (document.getElementById("adminLessonHasPdfCheckbox")) {
      document.getElementById("adminLessonHasPdfCheckbox").checked = isPdfActive;
    }
    if (document.getElementById("adminLessonPdfFieldsRow")) {
      document.getElementById("adminLessonPdfFieldsRow").style.display = isPdfActive ? "grid" : "none";
    }
    if (document.getElementById("adminLessonPdfNameInput")) {
      document.getElementById("adminLessonPdfNameInput").value = l.pdfName || "";
    }
    if (document.getElementById("adminLessonPdfUrlInput")) {
      document.getElementById("adminLessonPdfUrlInput").value = l.pdfUrl || "";
    }
    if (document.getElementById("adminLessonWatermarkCheckbox")) {
      document.getElementById("adminLessonWatermarkCheckbox").checked = Boolean(l.watermarkEnabled);
    }
    if (document.getElementById("adminLessonDurationAutoBadge")) {
      document.getElementById("adminLessonDurationAutoBadge").innerHTML = "";
    }

    // Populate chapters
    const container = document.getElementById("adminLessonChaptersContainer");
    if (container) {
      container.innerHTML = "";
      const chapters = l.chapters || [];
      chapters.forEach(ch => {
        this.addChapterRowToModal(ch.time, ch.title);
      });
    }

    const deleteBtn = document.getElementById("adminLessonDeleteBtn");
    if (deleteBtn) deleteBtn.style.display = "inline-block";

    document.getElementById("adminLessonDrawerModal").classList.add("active");
  },

  addChapterRowToModal(timeVal = "00:00", titleVal = "") {
    const container = document.getElementById("adminLessonChaptersContainer");
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

  handleSaveLessonSubmit(e) {
    e.preventDefault();
    const lessonId = document.getElementById("adminLessonFormId").value;
    const courseId = document.getElementById("adminLessonFormCourse").value;
    const title = document.getElementById("adminLessonFormTitle").value.trim();
    const rawVideoUrl = document.getElementById("adminLessonFormVideoUrl").value.trim();
    const duration = document.getElementById("adminLessonFormDuration").value.trim();
    const hasPdfChecked = document.getElementById("adminLessonHasPdfCheckbox")?.checked;
    const pdfName = document.getElementById("adminLessonPdfNameInput")?.value.trim() || "";
    const pdfUrl = document.getElementById("adminLessonPdfUrlInput")?.value.trim() || "";
    const hasPdf = hasPdfChecked && Boolean(pdfName || pdfUrl);
    const watermarkEnabled = Boolean(document.getElementById("adminLessonWatermarkCheckbox")?.checked);
    const videoUrl = this.formatEmbedUrl(rawVideoUrl);

    // Collect chapters
    const chapters = [];
    const chapterRows = document.querySelectorAll("#adminLessonChaptersContainer .chapter-edit-row");
    chapterRows.forEach(row => {
      const time = row.querySelector(".chapter-time-input")?.value.trim() || "00:00";
      const chTitle = row.querySelector(".chapter-title-input")?.value.trim() || "";
      if (chTitle) {
        chapters.push({ time, title: chTitle });
      }
    });

    const lessons = this.getAllLessons();

    if (lessonId) {
      // Editing existing lesson
      const idx = lessons.findIndex(l => l.id === lessonId);
      if (idx !== -1) {
        lessons[idx] = {
          ...lessons[idx],
          courseId,
          title,
          title_si: title,
          duration: duration || "50 mins",
          videoUrl,
          hasPdf,
          pdfName: hasPdf ? (pdfName || "Notes.pdf") : "",
          pdfUrl: hasPdf ? pdfUrl : "",
          watermarkEnabled,
          chapters
        };
      }
    } else {
      // New lesson
      const newLesson = {
        id: "lsn-" + Date.now().toString(36),
        courseId,
        title,
        title_si: title,
        duration: duration || "50 mins",
        videoUrl,
        hasPdf,
        pdfName: hasPdf ? (pdfName || "Lesson_Summary_Notes.pdf") : "",
        pdfUrl: hasPdf ? pdfUrl : "",
        watermarkEnabled,
        chapters
      };
      lessons.push(newLesson);
    }

    this.saveLessonsDatabase(lessons);

    if (window.showToast) {
      window.showToast(`✓ Lesson "${title}" saved and synced with LMS!`, "success");
    }

    document.getElementById("adminLessonDrawerModal").classList.remove("active");
    this.renderLessons();
  },

  handleDeleteCurrentModalLesson() {
    const id = document.getElementById("adminLessonFormId").value;
    if (id) {
      document.getElementById("adminLessonDrawerModal").classList.remove("active");
      this.deleteLesson(id);
    }
  },

  deleteLesson(lessonId) {
    const lessons = this.getAllLessons();
    const l = lessons.find(item => item.id === lessonId);
    if (!l) return;

    if (confirm(`Are you sure you want to permanently delete lesson "${l.title}"?`)) {
      const updated = lessons.filter(item => item.id !== lessonId);
      this.saveLessonsDatabase(updated);

      if (window.showToast) {
        window.showToast(`🗑️ Lesson "${l.title}" deleted.`, "info");
      }
      this.renderLessons();
    }
  },

  // --------------------------------------------------------------------------
  // SPEED MCQ QUIZ & PAPERS MANAGEMENT
  // --------------------------------------------------------------------------
  getAllQuizzes() {
    let quizzes = null;
    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.getSharedData === "function") {
      const shared = window.SUPABASE_HELPER.getSharedData("edupeak_quizzes_db");
      if (shared !== null && Array.isArray(shared)) {
        quizzes = shared;
      }
    }
    if (quizzes === null) {
      const stored = localStorage.getItem("edupeak_quizzes_db");
      if (stored !== null) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) quizzes = parsed;
        } catch (e) {}
      }
    }
    if (quizzes === null) {
      quizzes = (window.EDUPEAK_DATA && window.EDUPEAK_DATA.quizQuestions) 
        ? JSON.parse(JSON.stringify(window.EDUPEAK_DATA.quizQuestions)) 
        : [];
      try {
        const custom = JSON.parse(localStorage.getItem("edupeak_custom_quizzes") || "[]");
        custom.forEach(cq => {
          if (!quizzes.find(item => item.id == cq.id)) quizzes.push(cq);
        });
      } catch (e) {}
    }

    quizzes.forEach((q, idx) => {
      if (!q.id) q.id = idx + 1;
    });

    try {
      localStorage.setItem("edupeak_quizzes_db", JSON.stringify(quizzes));
    } catch (e) {}
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.quizQuestions = quizzes;
    }
    return quizzes;
  },

  saveQuizzesDatabase(quizzesList) {
    try {
      localStorage.setItem("edupeak_quizzes_db", JSON.stringify(quizzesList));
      localStorage.setItem("edupeak_custom_quizzes", JSON.stringify(quizzesList));
    } catch (e) {}
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.quizQuestions = quizzesList;
    }
    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.setSharedData === "function") {
      window.SUPABASE_HELPER.setSharedData("edupeak_quizzes_db", quizzesList);
    }
  },

  async renderQuizzes() {
    const list = document.getElementById("adminQuizList");
    if (!list) return;

    await this.populateCourseDropdowns();
    const courses = await window.SUPABASE_HELPER.getCourses();
    const courseMap = {};
    courses.forEach(c => { courseMap[c.id] = c; });

    const selectedCourseId = document.getElementById("adminQuizCourseSelect")?.value || "all";
    const questions = this.getAllQuizzes();

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

    const countLabel = document.getElementById("adminQuizzesCountLabel");
    if (countLabel) {
      countLabel.textContent = `Showing ${filteredQuestions.length} speed MCQ question${filteredQuestions.length === 1 ? '' : 's'}`;
    }

    if (!filteredQuestions.length) {
      list.innerHTML = `
        <div style="text-align: center; padding: 3rem; background: #f8fafc; border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
          <i class="fa-solid fa-clipboard-question" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">No MCQ Questions Added Yet</div>
          <p style="font-size: 0.825rem; color: #64748b; margin-bottom: 1rem;">Create online timed MCQs with 4 options and automatic grading solutions.</p>
          <button class="btn btn-primary btn-sm" onclick="ADMIN_CONTROLLER.openAddQuizModal()">
            <i class="fa-solid fa-plus"></i> Add First MCQ Question
          </button>
        </div>
      `;
      return;
    }

    list.innerHTML = filteredQuestions.map((q, idx) => {
      const course = courseMap[q.courseId] || { title: q.courseId || "Physics" };
      return `
        <div class="quiz-question-builder-card" id="adminQuizCard_${q.id}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <span style="font-size: 0.75rem; font-weight: 700; color: #227aff; background: #eff6ff; padding: 0.2rem 0.5rem; border-radius: 6px;">
                Question #${idx + 1} (${q.subject || 'Speed Exam'})
              </span>
              <span style="font-size: 0.75rem; color: #475569; background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 6px; font-weight: 600;">
                <i class="fa-solid fa-book"></i> ${course.title}
              </span>
              <span style="font-size: 0.75rem; color: #10b981; font-weight: 700; background: #ecfdf5; padding: 0.2rem 0.5rem; border-radius: 6px;">
                <i class="fa-solid fa-check"></i> Correct: Option ${q.correctAnswer + 1} (${String.fromCharCode(65 + q.correctAnswer)})
              </span>
            </div>
            <div style="display: flex; gap: 0.35rem; align-items: center;">
              <button type="button" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 0.3rem 0.65rem;" onclick="ADMIN_CONTROLLER.openEditQuizModal('${q.id}')" title="Edit Question">
                <i class="fa-solid fa-pen-to-square"></i> Edit
              </button>
              <button type="button" class="btn btn-ghost btn-sm" style="color: #ef4444; border: 1px solid #fecaca; font-size: 0.75rem; padding: 0.3rem 0.55rem;" onclick="ADMIN_CONTROLLER.deleteQuiz('${q.id}')" title="Delete Question">
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
      `;
    }).join("");
  },

  async openAddQuizModal(preselectedCourseId = null) {
    await this.populateCourseDropdowns();
    document.getElementById("adminQuizModalTitle").textContent = "Create Speed MCQ Question";
    document.getElementById("adminQuizFormId").value = "";
    document.getElementById("adminQuizFormSubject").value = "Physics - Mechanics";
    document.getElementById("adminQuizFormQText").value = "";
    document.getElementById("adminQuizFormQTextSi").value = "";
    document.getElementById("adminQuizFormOptA").value = "";
    document.getElementById("adminQuizFormOptB").value = "";
    document.getElementById("adminQuizFormOptC").value = "";
    document.getElementById("adminQuizFormOptD").value = "";
    document.getElementById("adminQuizFormCorrect").value = "0";
    document.getElementById("adminQuizFormExplanation").value = "";

    const courseSelect = document.getElementById("adminQuizFormCourse");
    const filterSelect = document.getElementById("adminQuizCourseSelect");
    const targetCourseId = preselectedCourseId || (filterSelect && filterSelect.value !== "all" ? filterSelect.value : null);
    if (courseSelect && targetCourseId) {
      courseSelect.value = targetCourseId;
    }

    const deleteBtn = document.getElementById("adminQuizDeleteBtn");
    if (deleteBtn) deleteBtn.style.display = "none";

    document.getElementById("adminQuizDrawerModal").classList.add("active");
  },

  quickAddQuizForCourse(courseId) {
    this.switchTab("quizzes");
    const select = document.getElementById("adminQuizCourseSelect");
    if (select) select.value = courseId;
    this.renderQuizzes();
    this.openAddQuizModal(courseId);
  },

  async openEditQuizModal(quizId) {
    await this.populateCourseDropdowns();
    const questions = this.getAllQuizzes();
    const q = questions.find(item => item.id == quizId);
    if (!q) {
      if (window.showToast) window.showToast("Question not found.", "error");
      return;
    }

    this.currentEditingQuizId = q.id;
    document.getElementById("adminQuizModalTitle").textContent = "Edit MCQ Quiz Question";
    document.getElementById("adminQuizFormId").value = q.id;
    
    const courseSelect = document.getElementById("adminQuizFormCourse");
    if (courseSelect) courseSelect.value = q.courseId;

    document.getElementById("adminQuizFormSubject").value = q.subject || "Physics - Mechanics";
    document.getElementById("adminQuizFormQText").value = q.question || "";
    document.getElementById("adminQuizFormQTextSi").value = q.question_si || "";
    
    const opts = q.options || ["", "", "", ""];
    document.getElementById("adminQuizFormOptA").value = opts[0] || "";
    document.getElementById("adminQuizFormOptB").value = opts[1] || "";
    document.getElementById("adminQuizFormOptC").value = opts[2] || "";
    document.getElementById("adminQuizFormOptD").value = opts[3] || "";

    document.getElementById("adminQuizFormCorrect").value = (q.correctAnswer !== undefined) ? q.correctAnswer : 0;
    document.getElementById("adminQuizFormExplanation").value = q.explanation || q.explanation_si || "";

    const deleteBtn = document.getElementById("adminQuizDeleteBtn");
    if (deleteBtn) deleteBtn.style.display = "inline-block";

    document.getElementById("adminQuizDrawerModal").classList.add("active");
  },

  handleSaveQuizSubmit(e) {
    e.preventDefault();
    const quizId = document.getElementById("adminQuizFormId").value;
    const courseId = document.getElementById("adminQuizFormCourse").value;
    const subject = document.getElementById("adminQuizFormSubject").value.trim();
    const qText = document.getElementById("adminQuizFormQText").value.trim();
    const qTextSi = document.getElementById("adminQuizFormQTextSi").value.trim();
    const optA = document.getElementById("adminQuizFormOptA").value.trim();
    const optB = document.getElementById("adminQuizFormOptB").value.trim();
    const optC = document.getElementById("adminQuizFormOptC").value.trim();
    const optD = document.getElementById("adminQuizFormOptD").value.trim();
    const correctIdx = parseInt(document.getElementById("adminQuizFormCorrect").value, 10);
    const explanation = document.getElementById("adminQuizFormExplanation").value.trim();

    const questions = this.getAllQuizzes();

    if (quizId) {
      // Edit existing
      const idx = questions.findIndex(item => item.id == quizId);
      if (idx !== -1) {
        questions[idx] = {
          ...questions[idx],
          courseId,
          subject: subject || "Physics",
          question: qText,
          question_si: qTextSi || qText,
          options: [optA, optB, optC, optD],
          correctAnswer: correctIdx,
          explanation: explanation,
          explanation_si: explanation
        };
      }
    } else {
      // New quiz
      const newQuestion = {
        id: Date.now(),
        courseId,
        subject: subject || "Physics",
        question: qText,
        question_si: qTextSi || qText,
        options: [optA, optB, optC, optD],
        correctAnswer: correctIdx,
        explanation: explanation,
        explanation_si: explanation
      };
      questions.push(newQuestion);
    }

    this.saveQuizzesDatabase(questions);

    if (window.showToast) {
      window.showToast("✓ MCQ Question saved to Speed Engine!", "success");
    }

    document.getElementById("adminQuizDrawerModal").classList.remove("active");
    this.renderQuizzes();
  },

  handleDeleteCurrentModalQuiz() {
    const id = document.getElementById("adminQuizFormId").value;
    if (id) {
      document.getElementById("adminQuizDrawerModal").classList.remove("active");
      this.deleteQuiz(id);
    }
  },

  deleteQuiz(quizId) {
    const questions = this.getAllQuizzes();
    const q = questions.find(item => item.id == quizId);
    if (!q) return;

    if (confirm("Are you sure you want to permanently delete this MCQ question?")) {
      const updated = questions.filter(item => item.id != quizId);
      this.saveQuizzesDatabase(updated);

      if (window.showToast) {
        window.showToast("🗑️ MCQ Question deleted.", "info");
      }
      this.renderQuizzes();
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
