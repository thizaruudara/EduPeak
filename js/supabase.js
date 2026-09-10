/**
 * EduPeak Supabase Database Integration Layer
 * Connects to Supabase Cloud PostgreSQL with seamless LocalStorage offline fallback
 */

const SUPABASE_CONFIG_KEY = "edupeak_supabase_config";

const SUPABASE_HELPER = {
  client: null,
  isConnected: false,

  // Load saved credentials from LocalStorage (with default user project)
  getConfig() {
    try {
      const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.url && parsed.anonKey) return parsed;
      }
    } catch (e) {
      console.warn("Storage error:", e);
    }
    return {
      url: "https://hkonbtrxmsxisggcxpww.supabase.co",
      anonKey: "sb_publishable__8XHrx1z8XIXWXRLvKE-ng_Ap2p1Ev0"
    };
  },

  saveConfig(url, anonKey) {
    const config = { url: url.trim(), anonKey: anonKey.trim() };
    localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
    return this.init();
  },

  // Initialize Supabase Client if credentials exist (Singleton instance)
  init() {
    if (this.client) return true;
    if (window.__EDUPEAK_SUPABASE_CLIENT__) {
      this.client = window.__EDUPEAK_SUPABASE_CLIENT__;
      this.isConnected = true;
      return true;
    }
    const config = this.getConfig();
    if (config.url && config.anonKey && window.supabase && typeof window.supabase.createClient === "function") {
      try {
        this.client = window.supabase.createClient(config.url, config.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
          }
        });
        window.__EDUPEAK_SUPABASE_CLIENT__ = this.client;
        this.testConnection();
        return true;
      } catch (err) {
        console.warn("Supabase init notice:", err);
        this.client = null;
        this.isConnected = false;
        return false;
      }
    } else {
      this.client = null;
      this.isConnected = false;
      return false;
    }
  },

  // Test live connection to Supabase
  async testConnection() {
    if (!this.client) {
      this.isConnected = false;
      this.updateStatusBadge(false, "Not Configured (Using Local Storage)");
      return { success: false, message: "Missing Supabase Project URL or Anon Key" };
    }

    try {
      // Simple health query to 'profiles' or public schema
      const { data, error } = await this.client.from("profiles").select("count", { count: "exact", head: true });
      if (error) {
        if (error.code === "PGRST116" || error.code === "PGRST205" || (error.message && (error.message.includes("does not exist") || error.message.includes("Could not find the table") || error.message.includes("schema cache")))) {
          // Connected to Supabase instance, but database tables have not been created yet
          this.isConnected = false;
          this.updateStatusBadge(false, "Setup Required: Run SQL Schema in Supabase SQL Editor");
          return { success: false, message: "Connected to Supabase, but database tables are missing. Please run the SQL Schema Script in your Supabase SQL Editor." };
        } else {
          // Real error (invalid URL, network failure, bad API key)
          this.isConnected = false;
          this.updateStatusBadge(false, "Offline / Connection Failed");
          return { success: false, message: error.message || "Failed to connect to Supabase" };
        }
      }
      this.isConnected = true;
      this.updateStatusBadge(true, "Connected to Supabase Cloud");
      this.syncAllCloudData();
      this.setupRealtimeSubscriptions();
      return { success: true, message: "Connected to Supabase project!" };
    } catch (err) {
      this.isConnected = false;
      this.updateStatusBadge(false, "Connection Failed: " + err.message);
      return { success: false, message: err.message };
    }
  },

  // Asynchronously synchronize all cloud databases with local storage & UI
  async syncAllCloudData() {
    try {
      await Promise.allSettled([
        this.syncCourses(),
        this.syncTeachers(),
        this.syncPapers(),
        this.syncInstitutes(),
        this.syncLessons(),
        this.syncQuizzes(),
        this.syncSchedules()
      ]);
    } catch (e) {
      console.warn("syncAllCloudData warning:", e);
    }
  },

  async syncCourses() {
    if (!this.isConnected || !this.client) return null;
    try {
      const { data, error } = await this.client.from("courses").select("*");
      if (!error && Array.isArray(data) && data.length > 0) {
        this.setSharedData("edupeak_courses_db", data);
        try { localStorage.setItem("edupeak_courses_db", JSON.stringify(data)); } catch (e) {}
        if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.courses = data;

        if (typeof window.dispatchEvent === "function") {
          window.dispatchEvent(new CustomEvent("edupeak:courses-synced", { detail: data }));
        }

        if (typeof window.renderCourses === "function") window.renderCourses();
        if (typeof window.renderCategorizedCourses === "function") window.renderCategorizedCourses();
        if (typeof window.updateCategoryCounts === "function") window.updateCategoryCounts();
        if (typeof window.renderStudentCourses === "function") window.renderStudentCourses();
        if (typeof window.updateStudentCategoryCounts === "function") window.updateStudentCategoryCounts();
        if (window.TEACHER_CONTROLLER) {
          if (typeof window.TEACHER_CONTROLLER.loadCustomData === "function") window.TEACHER_CONTROLLER.loadCustomData();
          if (typeof window.TEACHER_CONTROLLER.renderMetrics === "function") window.TEACHER_CONTROLLER.renderMetrics();
          if (window.TEACHER_CONTROLLER.currentTab === "courses" && typeof window.TEACHER_CONTROLLER.renderCourses === "function") {
            window.TEACHER_CONTROLLER.renderCourses();
          }
        }
        if (window.ADMIN_CONTROLLER) {
          if (typeof window.ADMIN_CONTROLLER.renderCourses === "function") window.ADMIN_CONTROLLER.renderCourses();
          if (typeof window.ADMIN_CONTROLLER.renderOverview === "function") window.ADMIN_CONTROLLER.renderOverview();
        }
        return data;
      }
    } catch (e) {
      console.warn("syncCourses error:", e);
    }
    return null;
  },

  async syncTeachers() {
    if (!this.isConnected || !this.client) return null;
    try {
      const { data, error } = await this.client.from("teachers").select("*");
      if (!error && Array.isArray(data) && data.length > 0) {
        this.setSharedData("edupeak_teachers_db", data);
        try { localStorage.setItem("edupeak_teachers_db", JSON.stringify(data)); } catch (e) {}
        if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.teachers = data;

        if (typeof window.dispatchEvent === "function") {
          window.dispatchEvent(new CustomEvent("edupeak:teachers-synced", { detail: data }));
        }

        if (typeof window.renderTeachers === "function") window.renderTeachers();
        if (window.ADMIN_CONTROLLER && typeof window.ADMIN_CONTROLLER.renderTeachers === "function") {
          window.ADMIN_CONTROLLER.renderTeachers();
        }
        return data;
      }
    } catch (e) {
      console.warn("syncTeachers error:", e);
    }
    return null;
  },

  async syncPapers() {
    if (!this.isConnected || !this.client) return null;
    try {
      const { data, error } = await this.client.from("past_papers").select("*").order("year", { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) {
        this.setSharedData("edupeak_papers_db", data);
        try { localStorage.setItem("edupeak_papers_db", JSON.stringify(data)); } catch (e) {}

        if (typeof window.dispatchEvent === "function") {
          window.dispatchEvent(new CustomEvent("edupeak:papers-synced", { detail: data }));
        }

        if (typeof window.renderPastPapersGrid === "function") window.renderPastPapersGrid();
        if (typeof window.renderPaperVaultPage === "function") window.renderPaperVaultPage();
        if (window.TEACHER_CONTROLLER && window.TEACHER_CONTROLLER.currentTab === "papers" && typeof window.TEACHER_CONTROLLER.renderPapers === "function") {
          window.TEACHER_CONTROLLER.renderPapers();
        }
        return data;
      }
    } catch (e) {
      console.warn("syncPapers error:", e);
    }
    return null;
  },

  async syncInstitutes() {
    if (!this.isConnected || !this.client) return null;
    try {
      const { data, error } = await this.client.from("institutes").select("*");
      if (!error && Array.isArray(data) && data.length > 0) {
        const normalizedList = data.map(item => this.normalizeInstitute(item));
        this.setSharedData("edupeak_institutes_db", normalizedList);
        try { localStorage.setItem("edupeak_institutes_db", JSON.stringify(normalizedList)); } catch (e) {}
        if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.institutes = normalizedList;

        if (typeof window.dispatchEvent === "function") {
          window.dispatchEvent(new CustomEvent("edupeak:institutes-synced", { detail: normalizedList }));
        }

        if (typeof window.renderInstitutes === "function") window.renderInstitutes();
        if (window.EDUPEAK_INSTITUTES && typeof window.EDUPEAK_INSTITUTES.populateDropdowns === "function") {
          window.EDUPEAK_INSTITUTES.populateDropdowns();
        }
        if (window.ADMIN_CONTROLLER && typeof window.ADMIN_CONTROLLER.renderInstitutes === "function") {
          window.ADMIN_CONTROLLER.renderInstitutes();
        }
        return normalizedList;
      }
    } catch (e) {
      console.warn("syncInstitutes error:", e);
    }
    return null;
  },

  async syncLessons() {
    if (!this.isConnected || !this.client) return null;
    try {
      const { data, error } = await this.client.from("lessons").select("*");
      if (!error && Array.isArray(data) && data.length > 0) {
        this.setSharedData("edupeak_lessons_db", data);
        try { localStorage.setItem("edupeak_lessons_db", JSON.stringify(data)); } catch (e) {}
        if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.lmsLessons = data;

        if (window.TEACHER_CONTROLLER && window.TEACHER_CONTROLLER.currentTab === "lessons" && typeof window.TEACHER_CONTROLLER.renderLessons === "function") {
          window.TEACHER_CONTROLLER.renderLessons();
        }
        return data;
      }
    } catch (e) {
      console.warn("syncLessons error:", e);
    }
    return null;
  },

  async syncQuizzes() {
    if (!this.isConnected || !this.client) return null;
    try {
      const { data, error } = await this.client.from("quizzes").select("*");
      if (!error && Array.isArray(data) && data.length > 0) {
        this.setSharedData("edupeak_quizzes_db", data);
        try { localStorage.setItem("edupeak_quizzes_db", JSON.stringify(data)); } catch (e) {}
        if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.quizQuestions = data;

        if (window.TEACHER_CONTROLLER && window.TEACHER_CONTROLLER.currentTab === "quizzes" && typeof window.TEACHER_CONTROLLER.renderQuizzes === "function") {
          window.TEACHER_CONTROLLER.renderQuizzes();
        }
        return data;
      }
    } catch (e) {
      console.warn("syncQuizzes error:", e);
    }
    return null;
  },

  async syncSchedules() {
    if (!this.isConnected || !this.client) return null;
    try {
      const { data, error } = await this.client.from("broadcast_schedules").select("*");
      if (!error && Array.isArray(data) && data.length > 0) {
        this.setSharedData("edupeak_schedules_db", data);
        try { localStorage.setItem("edupeak_schedules_db", JSON.stringify(data)); } catch (e) {}

        if (window.TEACHER_CONTROLLER && typeof window.TEACHER_CONTROLLER.renderSchedulesTable === "function") {
          window.TEACHER_CONTROLLER.renderSchedulesTable();
        }
        if (typeof syncLiveStreamWithTeacher === "function") {
          syncLiveStreamWithTeacher();
        }
        return data;
      }
    } catch (e) {
      console.warn("syncSchedules error:", e);
    }
    return null;
  },

  setupRealtimeSubscriptions() {
    if (!this.client || this._realtimeSubscribed) return;
    try {
      this._realtimeSubscribed = true;
      this.client
        .channel('public-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => {
          this.syncCourses();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teachers' }, () => {
          this.syncTeachers();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'past_papers' }, () => {
          this.syncPapers();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'institutes' }, () => {
          this.syncInstitutes();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lessons' }, () => {
          this.syncLessons();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, () => {
          this.syncQuizzes();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_schedules' }, () => {
          this.syncSchedules();
        })
        .subscribe();
    } catch (e) {
      console.warn("Realtime subscription setup failed:", e);
    }
  },

  updateStatusBadge(connected, text) {
    const badge = document.getElementById("supabaseStatusBadge");
    const textEl = document.getElementById("supabaseStatusText");
    if (badge) {
      badge.className = connected ? "status-indicator connected" : "status-indicator disconnected";
    }
    if (textEl) {
      textEl.textContent = text;
    }
  },

  // --------------------------------------------------------------------------
  // CRUD Methods (With fallback to LocalStorage/Memory)
  // --------------------------------------------------------------------------

  // 1. PROFILES (Students & Users)
  async getProfiles() {
    if (this.isConnected && this.client) {
      try {
        const { data, error } = await this.client.from("profiles").select("*").order("created_at", { ascending: false });
        if (!error && data) return data;
      } catch (e) {
        console.warn("Supabase fetch profiles error, using local:", e);
      }
    }
    return window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getUsers() : [];
  },

  // Check if a user is already registered in Supabase
  async checkUserExists(email, phone) {
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPhone = (phone || "").trim().replace(/[\s-]/g, "");

    if (this.isConnected && this.client) {
      try {
        if (cleanEmail) {
          const { data: emailData } = await this.client.from("profiles").select("id, name, email").eq("email", cleanEmail).limit(1);
          if (emailData && emailData.length > 0) {
            return { exists: true, field: "email", user: emailData[0] };
          }
        }
        if (cleanPhone) {
          const { data: phoneData } = await this.client.from("profiles").select("id, name, phone").eq("phone", cleanPhone).limit(1);
          if (phoneData && phoneData.length > 0) {
            return { exists: true, field: "phone", user: phoneData[0] };
          }
        }
      } catch (e) {
        console.warn("Supabase checkUserExists error, checking local:", e);
      }
    }

    // Check Local Storage
    const localUsers = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getUsers() : [];
    const foundEmail = cleanEmail ? localUsers.find(u => u.email && u.email.toLowerCase() === cleanEmail) : null;
    if (foundEmail) return { exists: true, field: "email", user: foundEmail };

    const foundPhone = cleanPhone ? localUsers.find(u => u.phone && u.phone.replace(/[\s-]/g, "") === cleanPhone) : null;
    if (foundPhone) return { exists: true, field: "phone", user: foundPhone };

    return { exists: false };
  },

  // Find user by Student ID, Email, or Mobile
  async findUserByIdentifier(identifier) {
    const clean = (identifier || "").trim().toLowerCase();
    const cleanPhone = clean.replace(/[\s-]/g, "");

    if (this.isConnected && this.client) {
      try {
        const { data, error } = await this.client.from("profiles").select("*")
          .or(`email.ilike.${clean},id.ilike.${clean},phone.eq.${cleanPhone}`)
          .limit(1);
        if (!error && data && data.length > 0) {
          return data[0];
        }
      } catch (e) {
        console.warn("Supabase findUserByIdentifier error, checking local:", e);
      }
    }

    // Check Local Storage
    const localUsers = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getUsers() : [];
    return localUsers.find(u => 
      (u.email && u.email.toLowerCase() === clean) ||
      (u.id && u.id.toLowerCase() === clean) ||
      (u.phone && u.phone.replace(/[\s-]/g, "") === cleanPhone)
    ) || null;
  },

  async createProfile(profileData) {
    if (this.isConnected && this.client) {
      try {
        const { data, error } = await this.client.from("profiles").insert([profileData]).select();
        if (!error && data) return data[0];
      } catch (e) {
        console.warn("Supabase insert profile error:", e);
      }
    }
    // Local fallback
    if (window.AUTH_SYSTEM) {
      return window.AUTH_SYSTEM.register(profileData);
    }
    return profileData;
  },

  async syncProfile(profileData) {
    if (this.isConnected && this.client) {
      try {
        const payload = {
          id: profileData.id,
          name: profileData.name || profileData.full_name,
          email: profileData.email,
          phone: profileData.phone,
          nic: profileData.nic || "",
          role: profileData.role || "student",
          institute: profileData.institute || "Victory Embilipitiya",
          exam_year: profileData.exam_year || profileData.examYear || "2026 A/L",
          stream: profileData.stream || "Physical Science",
          district: profileData.district || "Ratnapura / Embilipitiya",
          status: "active"
        };
        const { data, error } = await this.client.from("profiles").upsert([payload]).select();
        if (!error && data) return data[0];
      } catch (e) {
        console.warn("Supabase upsert profile error:", e);
      }
    }
    return profileData;
  },

  async updateProfileStatus(id, status) {
    if (this.isConnected && this.client) {
      try {
        await this.client.from("profiles").update({ status: status }).eq("id", id);
      } catch (e) {
        console.warn("Supabase update profile error:", e);
      }
    }
    // Local update
    const users = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getUsers() : [];
    const target = users.find(u => u.id === id);
    if (target) {
      target.status = status;
      localStorage.setItem("edupeak_users_db", JSON.stringify(users));
    }
    return true;
  },

  // 2. TEACHERS
  // Cross-subdomain shared storage (*.edupeak.lk) helper
  getSharedData(key) {
    // 1. Check localStorage first (reliable, 5MB+ capacity, avoids 4KB cookie limit truncation)
    try {
      const local = localStorage.getItem(key);
      if (local !== null) {
        const parsed = JSON.parse(local);
        if (parsed !== null) {
          return parsed;
        }
      }
    } catch (e) {}

    // 2. Check shared root domain cookie (fallback for cross-subdomain initial sync)
    try {
      const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + key + '=([^;]*)'));
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]);
        const parsed = JSON.parse(decoded);
        if (parsed !== null) {
          try { localStorage.setItem(key, decoded); } catch(e) {}
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  },

  setSharedData(key, data) {
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(key, json);
      // Write to shared domain cookie for cross-subdomain synchronization
      const hostname = (window.location && window.location.hostname) ? window.location.hostname : "";
      let domainStr = "";
      if (hostname && hostname.includes(".")) {
        const parts = hostname.split(".");
        if (parts.length >= 2 && !hostname.startsWith("127.") && !hostname.startsWith("localhost")) {
          domainStr = `; domain=.${parts.slice(-2).join(".")}`;
        }
      }
      if (typeof document !== "undefined") {
        document.cookie = `${key}=${encodeURIComponent(json)}; path=/${domainStr}; max-age=31536000; SameSite=Lax`;
      }
    } catch (e) {
      console.warn("setSharedData error:", e);
    }
  },

  async getTeachers() {
    if (this.isConnected && this.client) {
      try {
        const { data, error } = await this.client.from("teachers").select("*");
        if (!error && Array.isArray(data) && data.length > 0) {
          this.setSharedData("edupeak_teachers_db", data);
          try { localStorage.setItem("edupeak_teachers_db", JSON.stringify(data)); } catch (e) {}
          if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.teachers = data;
          return data;
        }
      } catch (e) {
        console.warn("Supabase fetch teachers error, using local:", e);
      }
    }
    const shared = this.getSharedData("edupeak_teachers_db");
    if (shared !== null && Array.isArray(shared)) {
      if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.teachers = shared;
      try { localStorage.setItem("edupeak_teachers_db", JSON.stringify(shared)); } catch (e) {}
      return shared;
    }
    try {
      const stored = localStorage.getItem("edupeak_teachers_db");
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.setSharedData("edupeak_teachers_db", parsed);
          if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.teachers = parsed;
          return parsed;
        }
      }
    } catch (e) {}

    const defaultTeachers = (window.EDUPEAK_DATA && Array.isArray(window.EDUPEAK_DATA.teachers) && window.EDUPEAK_DATA.teachers.length > 0)
      ? window.EDUPEAK_DATA.teachers
      : [];
    if (defaultTeachers.length > 0) {
      this.setSharedData("edupeak_teachers_db", defaultTeachers);
      try { localStorage.setItem("edupeak_teachers_db", JSON.stringify(defaultTeachers)); } catch (e) {}
    }
    return defaultTeachers;
  },

  async saveTeacher(teacherData) {
    if (this.isConnected && this.client) {
      try {
        const { data, error } = await this.client.from("teachers").upsert([teacherData]).select();
        if (!error && data) return data[0];
      } catch (e) {
        console.warn("Supabase upsert teacher error:", e);
      }
    }
    // Local save
    const teachers = await this.getTeachers();
    const existingIndex = teachers.findIndex(t => t.id === teacherData.id);
    if (existingIndex >= 0) {
      teachers[existingIndex] = { ...teachers[existingIndex], ...teacherData };
    } else {
      teachers.push(teacherData);
    }
    this.setSharedData("edupeak_teachers_db", teachers);
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.teachers = teachers;
      if (window.renderTeachers) window.renderTeachers();
    }
    return teacherData;
  },

  async deleteTeacher(teacherId) {
    if (this.isConnected && this.client) {
      try {
        await this.client.from("teachers").delete().eq("id", teacherId);
      } catch (e) {
        console.warn("Supabase delete teacher error:", e);
      }
    }
    let teachers = await this.getTeachers();
    teachers = teachers.filter(t => t.id !== teacherId);
    this.setSharedData("edupeak_teachers_db", teachers);
    try { localStorage.setItem("edupeak_teachers_db", JSON.stringify(teachers)); } catch (e) {}
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.teachers = teachers;
      if (window.renderTeachers) window.renderTeachers();
    }
    return true;
  },

  // 3. COURSES
  async getCourses() {
    if (this.isConnected && this.client) {
      try {
        const { data, error } = await this.client.from("courses").select("*");
        if (!error && Array.isArray(data) && data.length > 0) {
          this.setSharedData("edupeak_courses_db", data);
          try {
            localStorage.setItem("edupeak_courses_db", JSON.stringify(data));
          } catch (e) {}
          if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.courses = data;
          return data;
        }
      } catch (e) {
        console.warn("Supabase fetch courses error, using local:", e);
      }
    }
    const shared = this.getSharedData("edupeak_courses_db");
    if (shared !== null && Array.isArray(shared)) {
      if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.courses = shared;
      try {
        localStorage.setItem("edupeak_courses_db", JSON.stringify(shared));
      } catch (e) {}
      return shared;
    }
    try {
      const stored = localStorage.getItem("edupeak_courses_db");
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.setSharedData("edupeak_courses_db", parsed);
          if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.courses = parsed;
          return parsed;
        }
      }
    } catch (e) {}

    const defaultCourses = (window.EDUPEAK_DATA && Array.isArray(window.EDUPEAK_DATA.courses) && window.EDUPEAK_DATA.courses.length > 0)
      ? window.EDUPEAK_DATA.courses
      : [];
    if (defaultCourses.length > 0) {
      this.setSharedData("edupeak_courses_db", defaultCourses);
      try { localStorage.setItem("edupeak_courses_db", JSON.stringify(defaultCourses)); } catch (e) {}
    }
    return defaultCourses;
  },

  async saveCourse(courseData) {
    if (!courseData || !courseData.id) return null;
    if (this.isConnected && this.client) {
      try {
        const { data, error } = await this.client.from("courses").upsert([courseData]).select();
        if (!error && data && data.length > 0) courseData = data[0];
      } catch (e) {
        console.warn("Supabase upsert course error:", e);
      }
    }
    const courses = await this.getCourses();
    const existingIndex = courses.findIndex(c => c.id === courseData.id);
    if (existingIndex >= 0) {
      courses[existingIndex] = { ...courses[existingIndex], ...courseData };
    } else {
      courses.push(courseData);
    }
    this.setSharedData("edupeak_courses_db", courses);
    try {
      localStorage.setItem("edupeak_courses_db", JSON.stringify(courses));
    } catch (e) {}
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.courses = courses;
    }
    if (typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("edupeak:courses-synced", { detail: courses }));
    }
    if (typeof window.renderCourses === "function") window.renderCourses();
    if (typeof window.renderCategorizedCourses === "function") window.renderCategorizedCourses();
    if (typeof window.updateCategoryCounts === "function") window.updateCategoryCounts();
    if (typeof window.renderStudentCourses === "function") window.renderStudentCourses();
    if (typeof window.updateStudentCategoryCounts === "function") window.updateStudentCategoryCounts();
    return courseData;
  },

  async deleteCourse(courseId) {
    if (!courseId) return false;
    if (this.isConnected && this.client) {
      try {
        await this.client.from("courses").delete().eq("id", courseId);
      } catch (e) {
        console.warn("Supabase delete course error:", e);
      }
    }
    let courses = await this.getCourses();
    courses = courses.filter(c => c.id !== courseId);
    this.setSharedData("edupeak_courses_db", courses);
    try {
      localStorage.setItem("edupeak_courses_db", JSON.stringify(courses));
    } catch (e) {}
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.courses = courses;
    }

    const matchId = (id1, id2) => {
      if (!id1 || !id2) return false;
      if (id1 === id2) return true;
      if (typeof window.matchCourseId === "function") return window.matchCourseId(id1, id2);
      const s1 = String(id1).toLowerCase().replace(/^crs-|^course-|^cls-|^ep-/gi, '').replace(/[^a-z0-9]/gi, '');
      const s2 = String(id2).toLowerCase().replace(/^crs-|^course-|^cls-|^ep-/gi, '').replace(/[^a-z0-9]/gi, '');
      return s1 && s2 && s1 === s2;
    };

    // Cascade delete lessons and custom lessons belonging to this course
    try {
      const storedLessons = localStorage.getItem("edupeak_lessons_db");
      let lessons = storedLessons ? JSON.parse(storedLessons) : ((window.EDUPEAK_DATA && window.EDUPEAK_DATA.lmsLessons) ? window.EDUPEAK_DATA.lmsLessons : []);
      lessons = lessons.filter(l => l.courseId && !matchId(l.courseId, courseId) && courses.some(c => matchId(c.id, l.courseId)));
      localStorage.setItem("edupeak_lessons_db", JSON.stringify(lessons));
      if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.lmsLessons = lessons;

      let customLessons = JSON.parse(localStorage.getItem("edupeak_custom_lessons") || "[]");
      customLessons = customLessons.filter(l => l.courseId && !matchId(l.courseId, courseId) && courses.some(c => matchId(c.id, l.courseId)));
      localStorage.setItem("edupeak_custom_lessons", JSON.stringify(customLessons));
    } catch (e) {}

    // Cascade delete quizzes belonging to this course
    try {
      const storedQuizzes = localStorage.getItem("edupeak_quizzes_db");
      let quizzes = storedQuizzes ? JSON.parse(storedQuizzes) : ((window.EDUPEAK_DATA && window.EDUPEAK_DATA.quizQuestions) ? window.EDUPEAK_DATA.quizQuestions : []);
      quizzes = quizzes.filter(q => q.courseId && !matchId(q.courseId, courseId) && courses.some(c => matchId(c.id, q.courseId)));
      localStorage.setItem("edupeak_quizzes_db", JSON.stringify(quizzes));
      if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.quizQuestions = quizzes;

      let customQuizzes = JSON.parse(localStorage.getItem("edupeak_custom_quizzes") || "[]");
      customQuizzes = customQuizzes.filter(q => q.courseId && !matchId(q.courseId, courseId) && courses.some(c => matchId(c.id, q.courseId)));
      localStorage.setItem("edupeak_custom_quizzes", JSON.stringify(customQuizzes));
    } catch (e) {}

    // Cascade delete student course enrollments
    try {
      const usersStr = localStorage.getItem("edupeak_users_db");
      if (usersStr) {
        let users = JSON.parse(usersStr);
        users.forEach(u => {
          if (Array.isArray(u.enrolledCourses)) {
            u.enrolledCourses = u.enrolledCourses.filter(cid => !matchId(cid, courseId) && courses.some(c => matchId(c.id, cid)));
          }
        });
        localStorage.setItem("edupeak_users_db", JSON.stringify(users));
      }

      const sessionStr = localStorage.getItem("edupeak_active_session");
      if (sessionStr) {
        let session = JSON.parse(sessionStr);
        if (Array.isArray(session.enrolledCourses)) {
          session.enrolledCourses = session.enrolledCourses.filter(cid => !matchId(cid, courseId) && courses.some(c => matchId(c.id, cid)));
          localStorage.setItem("edupeak_active_session", JSON.stringify(session));
        }
      }

      const enrolledStr = localStorage.getItem("edupeak_enrolled");
      if (enrolledStr) {
        let enrolled = JSON.parse(enrolledStr);
        enrolled = enrolled.filter(cid => !matchId(cid, courseId) && courses.some(c => matchId(c.id, cid)));
        localStorage.setItem("edupeak_enrolled", JSON.stringify(enrolled));
      }

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("edupeak_student_courses_")) {
          try {
            let sc = JSON.parse(localStorage.getItem(key) || "[]");
            if (Array.isArray(sc)) {
              sc = sc.filter(cid => !matchId(cid, courseId) && courses.some(c => matchId(c.id, cid)));
              localStorage.setItem(key, JSON.stringify(sc));
            }
          } catch (e) {}
        }
      }
    } catch (e) {}

    if (typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("edupeak:courses-synced", { detail: courses }));
    }
    if (typeof window.renderCourses === "function") window.renderCourses();
    if (typeof window.renderCategorizedCourses === "function") window.renderCategorizedCourses();
    if (typeof window.updateCategoryCounts === "function") window.updateCategoryCounts();
    if (typeof window.renderStudentCourses === "function") window.renderStudentCourses();
    if (typeof window.updateStudentCategoryCounts === "function") window.updateStudentCategoryCounts();
    if (window.TEACHER_CONTROLLER) {
      if (typeof window.TEACHER_CONTROLLER.loadCustomData === "function") window.TEACHER_CONTROLLER.loadCustomData();
      if (typeof window.TEACHER_CONTROLLER.renderMetrics === "function") window.TEACHER_CONTROLLER.renderMetrics();
      if (window.TEACHER_CONTROLLER.currentTab === "courses" && typeof window.TEACHER_CONTROLLER.renderCourses === "function") {
        window.TEACHER_CONTROLLER.renderCourses();
      }
      if (window.TEACHER_CONTROLLER.currentTab === "lessons" && typeof window.TEACHER_CONTROLLER.renderLessons === "function") {
        window.TEACHER_CONTROLLER.renderLessons();
      }
      if (window.TEACHER_CONTROLLER.currentTab === "quizzes" && typeof window.TEACHER_CONTROLLER.renderQuizzes === "function") {
        window.TEACHER_CONTROLLER.renderQuizzes();
      }
      if (window.TEACHER_CONTROLLER.currentTab === "students" && typeof window.TEACHER_CONTROLLER.renderStudents === "function") {
        window.TEACHER_CONTROLLER.renderStudents();
      }
      if (typeof window.TEACHER_CONTROLLER.populateCourseDropdowns === "function") {
        window.TEACHER_CONTROLLER.populateCourseDropdowns();
      }
    }
    if (window.ADMIN_CONTROLLER) {
      if (typeof window.ADMIN_CONTROLLER.renderCourses === "function") window.ADMIN_CONTROLLER.renderCourses();
      if (typeof window.ADMIN_CONTROLLER.renderOverview === "function") window.ADMIN_CONTROLLER.renderOverview();
      if (typeof window.ADMIN_CONTROLLER.renderStudents === "function") window.ADMIN_CONTROLLER.renderStudents();
    }
    return true;
  },

  // 4. PAST PAPERS (PDF Vault)
  async getPapers() {
    if (this.isConnected && this.client) {
      try {
        const { data, error } = await this.client.from("past_papers").select("*").order("year", { ascending: false });
        if (!error && Array.isArray(data) && data.length > 0) {
          this.setSharedData("edupeak_papers_db", data);
          try { localStorage.setItem("edupeak_papers_db", JSON.stringify(data)); } catch (e) {}
          return data;
        }
      } catch (e) {
        console.warn("Supabase fetch past_papers error, using local:", e);
      }
    }
    const shared = this.getSharedData("edupeak_papers_db");
    if (shared !== null && Array.isArray(shared)) {
      try { localStorage.setItem("edupeak_papers_db", JSON.stringify(shared)); } catch (e) {}
      return shared;
    }
    try {
      const stored = localStorage.getItem("edupeak_papers_db");
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.setSharedData("edupeak_papers_db", parsed);
          return parsed;
        }
      }
    } catch (e) {}

    const defaultPapers = [
      {
        id: "pap-al-2024",
        title: "2024 G.C.E. A/L Physics Past Paper & Structured Marking Scheme",
        title_si: "2024 උසස් පෙළ භෞතික විද්‍යාව පසුගිය විභාග ප්‍රශ්න පත්‍රය සහ ලකුණු දීමේ පටිපාටිය",
        year: 2024,
        type: "national",
        unit: "all",
        unitName: "Complete Paper (Part I & II)",
        size: "4.8 MB",
        fileSize: "4.8 MB",
        downloadCount: 3840,
        url: "assets/papers/2024_AL_Physics_Paper.pdf",
        pdfUrl: "assets/papers/2024_AL_Physics_Paper.pdf",
        storageType: "local"
      },
      {
        id: "pap-al-2023",
        title: "2023 G.C.E. A/L Physics Past Paper & Detailed Marking Scheme",
        title_si: "2023 උසස් පෙළ භෞතික විද්‍යාව පසුගිය විභාග ප්‍රශ්න පත්‍රය සහ පිළිතුරු විවරණය",
        year: 2023,
        type: "national",
        unit: "all",
        unitName: "Complete Paper (Part I & II)",
        size: "5.2 MB",
        fileSize: "5.2 MB",
        downloadCount: 5120,
        url: "assets/papers/2023_AL_Physics_Paper.pdf",
        pdfUrl: "assets/papers/2023_AL_Physics_Paper.pdf",
        storageType: "local"
      },
      {
        id: "pap-al-2022",
        title: "2022 G.C.E. A/L Physics Past Paper with MCQ Explanations",
        title_si: "2022 උසස් පෙළ භෞතික විද්‍යාව පසුගිය විභාග ප්‍රශ්න පත්‍රය හා විවරණය",
        year: 2022,
        type: "national",
        unit: "all",
        unitName: "Complete Paper (Part I & II)",
        size: "4.5 MB",
        fileSize: "4.5 MB",
        downloadCount: 6200,
        url: "assets/papers/2022_AL_Physics_Paper.pdf",
        pdfUrl: "assets/papers/2022_AL_Physics_Paper.pdf",
        storageType: "local"
      }
    ];

    this.setSharedData("edupeak_papers_db", defaultPapers);
    try { localStorage.setItem("edupeak_papers_db", JSON.stringify(defaultPapers)); } catch (e) {}
    return defaultPapers;
  },

  async savePaper(paperData) {
    if (this.isConnected && this.client) {
      try {
        const { data, error } = await this.client.from("past_papers").upsert([paperData]).select();
        if (!error && data) return data[0];
      } catch (e) {
        console.warn("Supabase upsert past_paper error:", e);
      }
    }
    const papers = await this.getPapers();
    const existingIndex = papers.findIndex(p => p.id === paperData.id);
    if (existingIndex >= 0) {
      papers[existingIndex] = { ...papers[existingIndex], ...paperData };
    } else {
      papers.unshift(paperData);
    }
    this.setSharedData("edupeak_papers_db", papers);
    try { localStorage.setItem("edupeak_papers_db", JSON.stringify(papers)); } catch (e) {}
    return paperData;
  },

  async deletePaper(paperId) {
    if (this.isConnected && this.client) {
      try {
        await this.client.from("past_papers").delete().eq("id", paperId);
      } catch (e) {
        console.warn("Supabase delete past_paper error:", e);
      }
    }
    let papers = await this.getPapers();
    papers = papers.filter(p => p.id !== paperId);
    this.setSharedData("edupeak_papers_db", papers);
    try { localStorage.setItem("edupeak_papers_db", JSON.stringify(papers)); } catch (e) {}
    return true;
  },

  // 5. CAMPUS BRANCHES & INSTITUTES
  normalizeInstitute(inst) {
    if (!inst || typeof inst !== "object") return inst;
    const isPhysical = (inst.hasPhysicalLocation !== undefined)
      ? Boolean(inst.hasPhysicalLocation)
      : (inst.hasphysicallocation !== undefined ? Boolean(inst.hasphysicallocation) : !String(inst.type || "").toLowerCase().includes("online"));

    const mapUrl = inst.mapUrl || inst.mapurl || inst.map_url || "";
    let facs = inst.facilities;
    if (typeof facs === "string") {
      try { facs = JSON.parse(facs); } catch (e) { facs = facs.split("\n").filter(Boolean); }
    }
    if (!Array.isArray(facs)) facs = [];

    let facsSi = inst.facilities_si || inst.facilitiesSi;
    if (typeof facsSi === "string") {
      try { facsSi = JSON.parse(facsSi); } catch (e) { facsSi = facsSi.split("\n").filter(Boolean); }
    }
    if (!Array.isArray(facsSi)) facsSi = facs;

    const status = (inst.status === "coming_soon" || inst.status === "pending" || inst.status === "inactive") ? "coming_soon" : "active";

    return {
      ...inst,
      id: String(inst.id || "").trim(),
      name: inst.name || "",
      name_si: inst.name_si || inst.nameSi || inst.name || "",
      status: status,
      hasPhysicalLocation: isPhysical,
      hasphysicallocation: isPhysical,
      type: inst.type || (isPhysical ? "Physical Campus & Smart Auditorium" : "Online Educational Platform & LMS"),
      type_si: inst.type_si || inst.typeSi || inst.type || "",
      badge: inst.badge || (status === "coming_soon" ? "Coming Soon" : (isPhysical ? "Physical Campus Hub" : "24/7 Global Cloud LMS")),
      badge_si: inst.badge_si || inst.badgeSi || (status === "coming_soon" ? "ඉදිරියේදී විවෘත වේ" : (isPhysical ? "ප්‍රධාන භෞතික මධ්‍යස්ථානය" : "ගෝලීය මාර්ගගත LMS")),
      icon: inst.icon || (isPhysical ? "🏫" : "🌐"),
      location: inst.location || "",
      location_si: inst.location_si || inst.locationSi || inst.location || "",
      phone: inst.phone || "+94 76 068 7578",
      email: inst.email || "",
      mapUrl: mapUrl,
      mapurl: mapUrl,
      website: inst.website || "",
      facebook: inst.facebook || "",
      facilities: facs.length > 0 ? facs : ["Air Conditioned Auditorium", "Smart Campus Wi-Fi"],
      facilities_si: facsSi.length > 0 ? facsSi : ["වායුසමනය කළ ශ්‍රවණාගාරය", "Smart LMS Wi-Fi"]
    };
  },

  async getInstitutes() {
    if (this.isConnected && this.client) {
      try {
        const { data, error } = await this.client.from("institutes").select("*");
        if (!error && Array.isArray(data) && data.length > 0) {
          const normalizedList = data.map(item => this.normalizeInstitute(item));
          this.setSharedData("edupeak_institutes_db", normalizedList);
          try { localStorage.setItem("edupeak_institutes_db", JSON.stringify(normalizedList)); } catch (e) {}
          if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.institutes = normalizedList;
          return normalizedList;
        }
      } catch (e) {
        console.warn("Supabase fetch institutes error, using local:", e);
      }
    }
    const shared = this.getSharedData("edupeak_institutes_db");
    if (shared !== null && Array.isArray(shared) && shared.length > 0) {
      const normalizedList = shared.map(item => this.normalizeInstitute(item));
      if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.institutes = normalizedList;
      try { localStorage.setItem("edupeak_institutes_db", JSON.stringify(normalizedList)); } catch (e) {}
      return normalizedList;
    }
    try {
      const stored = localStorage.getItem("edupeak_institutes_db");
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalizedList = parsed.map(item => this.normalizeInstitute(item));
          this.setSharedData("edupeak_institutes_db", normalizedList);
          if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.institutes = normalizedList;
          return normalizedList;
        }
      }
    } catch (e) {}

    const defaultInstitutes = (window.EDUPEAK_DATA && Array.isArray(window.EDUPEAK_DATA.institutes) && window.EDUPEAK_DATA.institutes.length > 0)
      ? window.EDUPEAK_DATA.institutes.map(item => this.normalizeInstitute(item))
      : [];
    if (defaultInstitutes.length > 0) {
      this.setSharedData("edupeak_institutes_db", defaultInstitutes);
      try { localStorage.setItem("edupeak_institutes_db", JSON.stringify(defaultInstitutes)); } catch (e) {}
    }
    return defaultInstitutes;
  },

  async saveInstitute(instData) {
    if (!instData || !instData.id) return null;
    const normalized = this.normalizeInstitute(instData);

    // 1. Immediately update in local storage & memory
    let institutes = this.getSharedData("edupeak_institutes_db");
    if (!Array.isArray(institutes) || institutes.length === 0) {
      try {
        institutes = JSON.parse(localStorage.getItem("edupeak_institutes_db") || "[]");
      } catch (e) {
        institutes = [];
      }
    }
    if (!Array.isArray(institutes) || institutes.length === 0) {
      institutes = (window.EDUPEAK_DATA && Array.isArray(window.EDUPEAK_DATA.institutes)) ? [...window.EDUPEAK_DATA.institutes] : [];
    }

    const existingIndex = institutes.findIndex(i => i.id === normalized.id);
    if (existingIndex >= 0) {
      institutes[existingIndex] = { ...institutes[existingIndex], ...normalized };
    } else {
      institutes.push(normalized);
    }

    this.setSharedData("edupeak_institutes_db", institutes);
    try { localStorage.setItem("edupeak_institutes_db", JSON.stringify(institutes)); } catch (e) {}
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.institutes = institutes;
    }
    if (typeof window.renderInstitutes === "function") window.renderInstitutes();
    if (window.EDUPEAK_INSTITUTES && typeof window.EDUPEAK_INSTITUTES.populateDropdowns === "function") {
      window.EDUPEAK_INSTITUTES.populateDropdowns();
    }
    if (window.ADMIN_CONTROLLER && typeof window.ADMIN_CONTROLLER.renderInstitutes === "function") {
      window.ADMIN_CONTROLLER.renderInstitutes();
    }

    // 2. Persist to Supabase Cloud
    if (this.isConnected && this.client) {
      try {
        // Build payload matching PostgreSQL column definitions
        const payload = {
          id: normalized.id,
          name: normalized.name,
          name_si: normalized.name_si,
          status: normalized.status,
          hasphysicallocation: normalized.hasPhysicalLocation,
          hasPhysicalLocation: normalized.hasPhysicalLocation,
          type: normalized.type,
          type_si: normalized.type_si,
          badge: normalized.badge,
          badge_si: normalized.badge_si,
          icon: normalized.icon,
          location: normalized.location,
          location_si: normalized.location_si,
          phone: normalized.phone,
          email: normalized.email,
          mapurl: normalized.mapUrl,
          mapUrl: normalized.mapUrl,
          website: normalized.website,
          facebook: normalized.facebook,
          facilities: normalized.facilities,
          facilities_si: normalized.facilities_si
        };

        const { data, error } = await this.client.from("institutes").upsert([payload]).select();
        if (error) {
          // Fallback with sanitized strictly lowercase PostgreSQL keys if column cache error
          const cleanPayload = {
            id: normalized.id,
            name: normalized.name,
            name_si: normalized.name_si,
            status: normalized.status,
            hasphysicallocation: normalized.hasPhysicalLocation,
            type: normalized.type,
            type_si: normalized.type_si,
            badge: normalized.badge,
            badge_si: normalized.badge_si,
            icon: normalized.icon,
            location: normalized.location,
            location_si: normalized.location_si,
            phone: normalized.phone,
            email: normalized.email,
            mapurl: normalized.mapUrl,
            website: normalized.website,
            facebook: normalized.facebook,
            facilities: normalized.facilities,
            facilities_si: normalized.facilities_si
          };
          const fallbackRes = await this.client.from("institutes").upsert([cleanPayload]).select();
          if (fallbackRes.error) {
            console.warn("Supabase institute upsert fallback warning:", fallbackRes.error);
          }
        }
      } catch (e) {
        console.warn("Supabase upsert institute error:", e);
      }
    }

    return normalized;
  },

  async deleteInstitute(instId) {
    let institutes = this.getSharedData("edupeak_institutes_db");
    if (!Array.isArray(institutes) || institutes.length === 0) {
      try { institutes = JSON.parse(localStorage.getItem("edupeak_institutes_db") || "[]"); } catch (e) { institutes = []; }
    }
    institutes = institutes.filter(i => i.id !== instId);
    this.setSharedData("edupeak_institutes_db", institutes);
    try { localStorage.setItem("edupeak_institutes_db", JSON.stringify(institutes)); } catch (e) {}
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.institutes = institutes;
    }
    if (typeof window.renderInstitutes === "function") window.renderInstitutes();
    if (window.EDUPEAK_INSTITUTES && typeof window.EDUPEAK_INSTITUTES.populateDropdowns === "function") {
      window.EDUPEAK_INSTITUTES.populateDropdowns();
    }
    if (window.ADMIN_CONTROLLER && typeof window.ADMIN_CONTROLLER.renderInstitutes === "function") {
      window.ADMIN_CONTROLLER.renderInstitutes();
    }
    if (this.isConnected && this.client) {
      try {
        await this.client.from("institutes").delete().eq("id", instId);
      } catch (e) {
        console.warn("Supabase delete institute error:", e);
      }
    }
    return true;
  },

  // 6. LESSONS MANAGEMENT (Sync with Supabase)
  async getLessons() {
    if (this.isConnected && this.client) {
      try {
        const { data, error } = await this.client.from("lessons").select("*");
        if (!error && Array.isArray(data) && data.length > 0) {
          this.setSharedData("edupeak_lessons_db", data);
          try { localStorage.setItem("edupeak_lessons_db", JSON.stringify(data)); } catch (e) {}
          if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.lmsLessons = data;
          return data;
        }
      } catch (e) {
        console.warn("Supabase fetch lessons error, using local:", e);
      }
    }
    const shared = this.getSharedData("edupeak_lessons_db");
    if (shared !== null && Array.isArray(shared)) {
      if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.lmsLessons = shared;
      try { localStorage.setItem("edupeak_lessons_db", JSON.stringify(shared)); } catch (e) {}
      return shared;
    }
    try {
      const stored = localStorage.getItem("edupeak_lessons_db");
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.setSharedData("edupeak_lessons_db", parsed);
          if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.lmsLessons = parsed;
          return parsed;
        }
      }
    } catch (e) {}
    return (window.EDUPEAK_DATA && window.EDUPEAK_DATA.lmsLessons) ? window.EDUPEAK_DATA.lmsLessons : [];
  },

  async saveLesson(lessonData) {
    if (!lessonData || !lessonData.id) return null;
    if (this.isConnected && this.client) {
      try {
        const payload = {
          id: lessonData.id,
          course_id: lessonData.courseId || lessonData.course_id,
          courseId: lessonData.courseId || lessonData.course_id,
          title: lessonData.title,
          title_si: lessonData.title_si || lessonData.title,
          duration: lessonData.duration || "50 mins",
          videoUrl: lessonData.videoUrl,
          hasPdf: Boolean(lessonData.hasPdf),
          pdfName: lessonData.pdfName || "",
          pdfUrl: lessonData.pdfUrl || "",
          watermarkEnabled: Boolean(lessonData.watermarkEnabled),
          chapters: lessonData.chapters || []
        };
        const { data, error } = await this.client.from("lessons").upsert([payload]).select();
        if (!error && data && data.length > 0) lessonData = data[0];
      } catch (e) {
        console.warn("Supabase upsert lesson error:", e);
      }
    }
    const lessons = await this.getLessons();
    const existingIndex = lessons.findIndex(l => l.id === lessonData.id);
    if (existingIndex >= 0) {
      lessons[existingIndex] = { ...lessons[existingIndex], ...lessonData };
    } else {
      lessons.push(lessonData);
    }
    this.setSharedData("edupeak_lessons_db", lessons);
    try { localStorage.setItem("edupeak_lessons_db", JSON.stringify(lessons)); } catch (e) {}
    if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.lmsLessons = lessons;
    return lessonData;
  },

  async deleteLesson(lessonId) {
    if (this.isConnected && this.client) {
      try {
        await this.client.from("lessons").delete().eq("id", lessonId);
      } catch (e) {
        console.warn("Supabase delete lesson error:", e);
      }
    }
    let lessons = await this.getLessons();
    lessons = lessons.filter(l => l.id !== lessonId);
    this.setSharedData("edupeak_lessons_db", lessons);
    try { localStorage.setItem("edupeak_lessons_db", JSON.stringify(lessons)); } catch (e) {}
    if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.lmsLessons = lessons;
    return true;
  },

  // 7. QUIZZES MANAGEMENT (Sync with Supabase)
  async getQuizzes() {
    if (this.isConnected && this.client) {
      try {
        const { data, error } = await this.client.from("quizzes").select("*");
        if (!error && Array.isArray(data) && data.length > 0) {
          this.setSharedData("edupeak_quizzes_db", data);
          try { localStorage.setItem("edupeak_quizzes_db", JSON.stringify(data)); } catch (e) {}
          if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.quizQuestions = data;
          return data;
        }
      } catch (e) {
        console.warn("Supabase fetch quizzes error, using local:", e);
      }
    }
    const shared = this.getSharedData("edupeak_quizzes_db");
    if (shared !== null && Array.isArray(shared)) {
      if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.quizQuestions = shared;
      try { localStorage.setItem("edupeak_quizzes_db", JSON.stringify(shared)); } catch (e) {}
      return shared;
    }
    try {
      const stored = localStorage.getItem("edupeak_quizzes_db");
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.setSharedData("edupeak_quizzes_db", parsed);
          if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.quizQuestions = parsed;
          return parsed;
        }
      }
    } catch (e) {}
    return (window.EDUPEAK_DATA && window.EDUPEAK_DATA.quizQuestions) ? window.EDUPEAK_DATA.quizQuestions : [];
  },

  async saveQuiz(quizData) {
    if (!quizData || !quizData.id) return null;
    if (this.isConnected && this.client) {
      try {
        const payload = {
          id: String(quizData.id),
          course_id: quizData.courseId || quizData.course_id,
          courseId: quizData.courseId || quizData.course_id,
          question: quizData.question,
          question_si: quizData.question_si || quizData.question,
          options: quizData.options || [],
          options_si: quizData.options_si || quizData.options || [],
          correctAnswer: Number(quizData.correctAnswer !== undefined ? quizData.correctAnswer : 0),
          explanation: quizData.explanation || "",
          explanation_si: quizData.explanation_si || quizData.explanation || "",
          timeLimit: Number(quizData.timeLimit || 60)
        };
        const { data, error } = await this.client.from("quizzes").upsert([payload]).select();
        if (!error && data && data.length > 0) quizData = data[0];
      } catch (e) {
        console.warn("Supabase upsert quiz error:", e);
      }
    }
    const quizzes = await this.getQuizzes();
    const existingIndex = quizzes.findIndex(q => String(q.id) === String(quizData.id));
    if (existingIndex >= 0) {
      quizzes[existingIndex] = { ...quizzes[existingIndex], ...quizData };
    } else {
      quizzes.push(quizData);
    }
    this.setSharedData("edupeak_quizzes_db", quizzes);
    try { 
      localStorage.setItem("edupeak_quizzes_db", JSON.stringify(quizzes)); 
      localStorage.setItem("edupeak_custom_quizzes", JSON.stringify(quizzes));
    } catch (e) {}
    if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.quizQuestions = quizzes;
    return quizData;
  },

  async deleteQuiz(quizId) {
    if (this.isConnected && this.client) {
      try {
        await this.client.from("quizzes").delete().eq("id", String(quizId));
      } catch (e) {
        console.warn("Supabase delete quiz error:", e);
      }
    }
    let quizzes = await this.getQuizzes();
    quizzes = quizzes.filter(q => String(q.id) !== String(quizId));
    this.setSharedData("edupeak_quizzes_db", quizzes);
    try { 
      localStorage.setItem("edupeak_quizzes_db", JSON.stringify(quizzes)); 
      localStorage.setItem("edupeak_custom_quizzes", JSON.stringify(quizzes));
    } catch (e) {}
    if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.quizQuestions = quizzes;
    return true;
  },

  // 8. BROADCAST SCHEDULES & MULTI-LIVE SESSIONS
  normalizeLiveSession(sched) {
    if (!sched || typeof sched !== "object") return sched;
    const provider = sched.provider || "youtube";
    let embedUrl = sched.embedUrl || sched.embed_url || "";
    const rawUrl = sched.rawUrl || sched.raw_url || "";
    
    // Auto-compute clean embed URL if not provided
    if (!embedUrl && rawUrl) {
      if (rawUrl.includes("youtube.com") || rawUrl.includes("youtu.be")) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = rawUrl.match(regExp);
        const yId = (match && match[2].length === 11) ? match[2] : rawUrl;
        embedUrl = `https://www.youtube.com/embed/${yId}?enablejsapi=1&rel=0`;
      } else if (rawUrl.includes("vimeo.com")) {
        const vId = rawUrl.split("/").filter(Boolean).pop();
        embedUrl = `https://player.vimeo.com/video/${vId}`;
      } else {
        embedUrl = rawUrl;
      }
    }

    const status = (sched.status === "live" || sched.status === "ended") ? sched.status : "scheduled";
    const examYear = sched.examYear || sched.exam_year || sched.batch || "2027 A/L";
    const subject = sched.subject || "Physics";

    return {
      ...sched,
      id: String(sched.id || ("sched-" + Date.now().toString(36))).trim(),
      topic: sched.topic || "Physics Live Masterclass",
      topic_si: sched.topic_si || sched.topicSi || sched.topic || "භෞතික විද්‍යාව සජීවී පන්තිය",
      courseId: sched.courseId || sched.course_id || "",
      course_id: sched.courseId || sched.course_id || "",
      courseTitle: sched.courseTitle || sched.course_title || "",
      subject: subject,
      subject_si: sched.subject_si || sched.subjectSi || (subject === "Physics" ? "භෞතික විද්‍යාව" : subject),
      examYear: examYear,
      exam_year: examYear,
      teacherId: sched.teacherId || sched.teacher_id || "tch-amalsha",
      teacher_id: sched.teacherId || sched.teacher_id || "tch-amalsha",
      teacherName: sched.teacherName || sched.teacher_name || "Amalsha Wanniarachchi",
      teacher_name: sched.teacherName || sched.teacher_name || "Amalsha Wanniarachchi",
      creatorId: sched.creatorId || sched.creator_id || sched.teacherId || "tch-amalsha",
      creator_id: sched.creatorId || sched.creator_id || sched.teacherId || "tch-amalsha",
      creatorName: sched.creatorName || sched.creator_name || sched.teacherName || "Faculty Instructor",
      creatorEmail: sched.creatorEmail || sched.creator_email || "",
      creatorRole: sched.creatorRole || sched.creator_role || "teacher",
      scheduleDate: sched.scheduleDate || sched.schedule_date || new Date().toISOString().split("T")[0],
      scheduleStartTime: sched.scheduleStartTime || sched.schedule_start_time || "08:30",
      scheduleEndTime: sched.scheduleEndTime || sched.schedule_end_time || "12:30",
      scheduleTime: sched.scheduleTime || sched.schedule_time || "Today • 08:30 AM - 12:30 PM",
      provider: provider,
      rawUrl: rawUrl,
      raw_url: rawUrl,
      embedUrl: embedUrl,
      embed_url: embedUrl,
      zoomUrl: sched.zoomUrl || sched.zoom_url || "",
      zoom_url: sched.zoomUrl || sched.zoom_url || "",
      status: status,
      watermarkEnabled: sched.watermarkEnabled !== undefined ? Boolean(sched.watermarkEnabled) : true,
      chatEnabled: sched.chatEnabled !== undefined ? Boolean(sched.chatEnabled) : true,
      description: sched.description || "",
      pinnedNotice: sched.pinnedNotice || sched.pinned_notice || "",
      recordingUrl: sched.recordingUrl || sched.recording_url || "",
      viewersCount: Number(sched.viewersCount || sched.viewers_count || (status === "live" ? 180 : 0)),
      startedAt: sched.startedAt || sched.started_at || null,
      endedAt: sched.endedAt || sched.ended_at || null,
      createdAt: sched.createdAt || sched.created_at || new Date().toISOString(),
      updatedAt: sched.updatedAt || sched.updated_at || new Date().toISOString()
    };
  },

  canManageLiveSession(session, user) {
    if (!user) return false;
    if (user.role === "admin") return true;
    if (user.role === "teacher") {
      if (!session) return true; // Teachers can create new lives
      const sTeacherId = String(session.teacherId || session.teacher_id || "").toLowerCase();
      const sCreatorId = String(session.creatorId || session.creator_id || "").toLowerCase();
      const sCreatorEmail = String(session.creatorEmail || session.creator_email || "").toLowerCase();
      const sTeacherName = String(session.teacherName || session.teacher_name || "").toLowerCase();

      const uId = String(user.id || "").toLowerCase();
      const uEmail = String(user.email || "").toLowerCase();
      const uName = String(user.name || "").toLowerCase();

      if (sTeacherId && (sTeacherId === uId || sTeacherId.includes(uId) || uId.includes(sTeacherId))) return true;
      if (sCreatorId && (sCreatorId === uId || sCreatorId.includes(uId) || uId.includes(sCreatorId))) return true;
      if (sCreatorEmail && sCreatorEmail === uEmail) return true;
      if (sTeacherName && uName && (sTeacherName.includes(uName) || uName.includes(sTeacherName))) return true;
    }
    return false;
  },

  async getSchedules() {
    return this.getLiveSessions();
  },

  async getLiveSessions() {
    let localSchedules = [];
    const shared = this.getSharedData("edupeak_schedules_db");
    if (shared !== null && Array.isArray(shared)) {
      localSchedules = shared.map(s => this.normalizeLiveSession(s));
    } else {
      try {
        const stored = localStorage.getItem("edupeak_schedules_db");
        if (stored !== null) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            localSchedules = parsed.map(s => this.normalizeLiveSession(s));
          }
        }
      } catch (e) {}
    }

    if (this.isConnected && this.client) {
      try {
        const { data, error } = await this.client.from("broadcast_schedules").select("*").order("updated_at", { ascending: false });
        if (!error && Array.isArray(data) && data.length > 0) {
          const remoteNormalized = data.map(s => this.normalizeLiveSession(s));
          // Merge remote with local schedules so newly created or locally modified schedules are NEVER lost
          const merged = [...remoteNormalized];
          localSchedules.forEach(local => {
            const idx = merged.findIndex(m => m.id === local.id);
            if (idx === -1) {
              merged.push(local);
            } else {
              const remoteTime = new Date(merged[idx].updatedAt || merged[idx].updated_at || 0).getTime();
              const localTime = new Date(local.updatedAt || local.updated_at || 0).getTime();
              if (localTime >= remoteTime) {
                merged[idx] = { ...merged[idx], ...local };
              }
            }
          });
          this.setSharedData("edupeak_schedules_db", merged);
          try { localStorage.setItem("edupeak_schedules_db", JSON.stringify(merged)); } catch (e) {}
          return merged;
        }
      } catch (e) {
        console.warn("Supabase fetch schedules error, using local:", e);
      }
    }

    if (localSchedules.length > 0) {
      this.setSharedData("edupeak_schedules_db", localSchedules);
      try { localStorage.setItem("edupeak_schedules_db", JSON.stringify(localSchedules)); } catch (e) {}
      return localSchedules;
    }

    return [];
  },

  async saveSchedule(schedData) {
    return this.saveLiveSession(schedData);
  },

  async saveLiveSession(schedData) {
    if (!schedData || !schedData.id) return null;
    const normalized = this.normalizeLiveSession(schedData);

    // 1. Immediately update local storage & memory
    let schedules = this.getSharedData("edupeak_schedules_db");
    if (!Array.isArray(schedules) || schedules.length === 0) {
      try {
        schedules = JSON.parse(localStorage.getItem("edupeak_schedules_db") || "[]");
      } catch (e) {
        schedules = [];
      }
    }
    if (!Array.isArray(schedules)) schedules = [];

    const existingIndex = schedules.findIndex(s => s.id === normalized.id);
    if (existingIndex >= 0) {
      schedules[existingIndex] = { ...schedules[existingIndex], ...normalized };
    } else {
      schedules.unshift(normalized);
    }
    this.setSharedData("edupeak_schedules_db", schedules);
    try { localStorage.setItem("edupeak_schedules_db", JSON.stringify(schedules)); } catch (e) {}

    // Also update legacy single-live config for backward compatibility
    if (normalized.status === "live" || !localStorage.getItem("edupeak_live_stream_config")) {
      try {
        localStorage.setItem("edupeak_live_stream_config", JSON.stringify(normalized));
        this.setSharedData("edupeak_live_stream_config", normalized);
      } catch (e) {}
    }

    // 2. Persist to Supabase Cloud
    if (this.isConnected && this.client) {
      try {
        const payload = {
          id: normalized.id,
          topic: normalized.topic,
          topic_si: normalized.topic_si,
          course_id: normalized.courseId,
          subject: normalized.subject,
          subject_si: normalized.subject_si,
          examYear: normalized.examYear,
          teacherId: normalized.teacherId,
          teacherName: normalized.teacherName,
          scheduleDate: normalized.scheduleDate,
          scheduleStartTime: normalized.scheduleStartTime,
          scheduleEndTime: normalized.scheduleEndTime,
          scheduleTime: normalized.scheduleTime,
          provider: normalized.provider,
          rawUrl: normalized.rawUrl,
          embedUrl: normalized.embedUrl,
          zoomUrl: normalized.zoomUrl,
          status: normalized.status,
          pinnedNotice: normalized.pinnedNotice,
          recordingUrl: normalized.recordingUrl,
          updated_at: new Date().toISOString()
        };
        const { data, error } = await this.client.from("broadcast_schedules").upsert([payload]).select();
        if (error) {
          console.warn("Supabase upsert broadcast_schedule warning:", error);
        }
      } catch (e) {
        console.warn("Supabase upsert broadcast_schedule error:", e);
      }
    }

    // Dispatch global reactive broadcast event
    try {
      window.dispatchEvent(new CustomEvent("edupeak-live-sessions-updated", { detail: { session: normalized, all: schedules } }));
    } catch(e) {}

    return normalized;
  },

  async updateLiveSessionStatus(sessionId, newStatus, extraData = {}) {
    let schedules = await this.getLiveSessions();
    let target = schedules.find(s => s.id === sessionId);
    if (!target) {
      try {
        const stored = JSON.parse(localStorage.getItem("edupeak_schedules_db") || "[]");
        target = stored.find(s => s.id === sessionId);
      } catch (e) {}
    }
    if (!target) {
      console.warn("updateLiveSessionStatus: target session not found for id:", sessionId);
      return null;
    }

    target.status = newStatus;
    target.updatedAt = new Date().toISOString();
    if (newStatus === "live") {
      target.startedAt = target.startedAt || new Date().toISOString();
      target.viewersCount = Math.max(Number(target.viewersCount || 0), 120);
    }
    if (newStatus === "ended") {
      target.endedAt = new Date().toISOString();
    }
    if (extraData && typeof extraData === "object") {
      Object.assign(target, extraData);
    }

    return this.saveLiveSession(target);
  },

  async deleteSchedule(schedId) {
    return this.deleteLiveSession(schedId);
  },

  async deleteLiveSession(schedId) {
    let schedules = this.getSharedData("edupeak_schedules_db");
    if (!Array.isArray(schedules) || schedules.length === 0) {
      try { schedules = JSON.parse(localStorage.getItem("edupeak_schedules_db") || "[]"); } catch (e) { schedules = []; }
    }
    if (Array.isArray(schedules)) {
      schedules = schedules.filter(s => s.id !== schedId);
      this.setSharedData("edupeak_schedules_db", schedules);
      try { localStorage.setItem("edupeak_schedules_db", JSON.stringify(schedules)); } catch (e) {}
    }

    if (this.isConnected && this.client) {
      try {
        await this.client.from("broadcast_schedules").delete().eq("id", schedId);
      } catch (e) {
        console.warn("Supabase delete broadcast_schedule error:", e);
      }
    }

    try {
      window.dispatchEvent(new CustomEvent("edupeak-live-sessions-updated", { detail: { deletedId: schedId, all: schedules } }));
    } catch(e) {}

    return true;
  },

  // 9. REAL-TIME LIVE CHAT ENGINE
  async getLiveChatMessages(sessionId = null) {
    if (this.isConnected && this.client) {
      try {
        let query = this.client.from("live_chat_messages").select("*").order("timestamp", { ascending: true }).limit(200);
        if (sessionId) {
          query = query.eq("sessionId", sessionId);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          const key = sessionId ? `edupeak_live_chat_${sessionId}` : "edupeak_live_chat_messages";
          this.setSharedData(key, data);
          try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
          return data;
        }
      } catch (e) {
        console.warn("Supabase fetch live chat messages error:", e);
      }
    }

    const key = sessionId ? `edupeak_live_chat_${sessionId}` : "edupeak_live_chat_messages";
    const shared = this.getSharedData(key);
    if (shared !== null && Array.isArray(shared)) {
      try { localStorage.setItem(key, JSON.stringify(shared)); } catch (e) {}
      return shared;
    }
    try {
      const stored = localStorage.getItem(key) || (sessionId ? localStorage.getItem("edupeak_live_chat_messages") : null);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          if (sessionId) {
            const filtered = parsed.filter(m => !m.sessionId || m.sessionId === sessionId);
            return filtered;
          }
          return parsed;
        }
      }
    } catch (e) {}
    return [];
  },

  async saveLiveChatMessage(msgObj) {
    if (!msgObj || !msgObj.text) return null;
    if (!msgObj.id) {
      msgObj.id = "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
    }
    if (!msgObj.timestamp) msgObj.timestamp = Date.now();
    if (!msgObj.time) {
      msgObj.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    if (this.isConnected && this.client) {
      try {
        const payload = {
          id: msgObj.id,
          sessionId: msgObj.sessionId || "global",
          courseId: msgObj.courseId || "",
          senderName: msgObj.senderName || "User",
          userRole: msgObj.userRole || "student",
          userId: msgObj.userId || "",
          senderNic: msgObj.senderNic || "",
          time: msgObj.time,
          timestamp: msgObj.timestamp,
          text: msgObj.text,
          isPinned: Boolean(msgObj.isPinned),
          isAnnouncement: Boolean(msgObj.isAnnouncement),
          created_at: new Date().toISOString()
        };
        await this.client.from("live_chat_messages").upsert([payload]);
      } catch (e) {
        console.warn("Supabase save live chat error:", e);
      }
    }

    // Save to global & session local stores
    const allKey = "edupeak_live_chat_messages";
    let allMessages = [];
    try {
      allMessages = JSON.parse(localStorage.getItem(allKey) || "[]");
    } catch (e) {}
    allMessages.push(msgObj);
    if (allMessages.length > 200) allMessages.splice(0, allMessages.length - 200);
    this.setSharedData(allKey, allMessages);
    try { localStorage.setItem(allKey, JSON.stringify(allMessages)); } catch (e) {}

    if (msgObj.sessionId) {
      const sessionKey = `edupeak_live_chat_${msgObj.sessionId}`;
      let sessionMessages = [];
      try {
        sessionMessages = JSON.parse(localStorage.getItem(sessionKey) || "[]");
      } catch (e) {}
      sessionMessages.push(msgObj);
      if (sessionMessages.length > 200) sessionMessages.splice(0, sessionMessages.length - 200);
      this.setSharedData(sessionKey, sessionMessages);
      try { localStorage.setItem(sessionKey, JSON.stringify(sessionMessages)); } catch (e) {}
    }

    try {
      window.dispatchEvent(new CustomEvent("edupeak-live-chat-updated", { detail: msgObj }));
    } catch (e) {}

    return msgObj;
  },

  async clearLiveChat(sessionId = null) {
    if (sessionId) {
      const sessionKey = `edupeak_live_chat_${sessionId}`;
      this.setSharedData(sessionKey, []);
      try { localStorage.removeItem(sessionKey); } catch (e) {}
    }
    const allKey = "edupeak_live_chat_messages";
    let all = [];
    if (sessionId) {
      try {
        all = JSON.parse(localStorage.getItem(allKey) || "[]");
        all = all.filter(m => m.sessionId !== sessionId);
      } catch (e) {}
    }
    this.setSharedData(allKey, all);
    try { localStorage.setItem(allKey, JSON.stringify(all)); } catch (e) {}

    if (this.isConnected && this.client) {
      try {
        if (sessionId) {
          await this.client.from("live_chat_messages").delete().eq("sessionId", sessionId);
        } else {
          await this.client.from("live_chat_messages").delete().neq("id", "none");
        }
      } catch (e) {}
    }

    try {
      window.dispatchEvent(new CustomEvent("edupeak-live-chat-updated", { detail: { cleared: true, sessionId } }));
    } catch (e) {}
    return true;
  },

  // 10. SYNC LOCAL DATA TO SUPABASE CLOUD
  async syncLocalToCloud() {
    if (!this.client || !this.isConnected) {
      return { success: false, message: "Please connect to Supabase first before syncing." };
    }

    try {
      const teachers = window.EDUPEAK_DATA ? window.EDUPEAK_DATA.teachers : [];
      const courses = window.EDUPEAK_DATA ? window.EDUPEAK_DATA.courses : [];
      const users = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getUsers() : [];
      let papers = [];
      try {
        papers = JSON.parse(localStorage.getItem("edupeak_papers_db") || "[]");
      } catch(e) {}
      let institutes = [];
      try {
        institutes = JSON.parse(localStorage.getItem("edupeak_institutes_db") || "[]");
      } catch(e) {}
      let lessons = [];
      try {
        lessons = JSON.parse(localStorage.getItem("edupeak_lessons_db") || "[]");
      } catch(e) {}
      let quizzes = [];
      try {
        quizzes = JSON.parse(localStorage.getItem("edupeak_quizzes_db") || "[]");
      } catch(e) {}
      let schedules = [];
      try {
        schedules = JSON.parse(localStorage.getItem("edupeak_schedules_db") || "[]");
      } catch(e) {}

      // Sync teachers
      if (teachers.length > 0) {
        await this.client.from("teachers").upsert(teachers);
      }
      // Sync courses
      if (courses.length > 0) {
        await this.client.from("courses").upsert(courses);
      }
      // Sync profiles
      if (users.length > 0) {
        await this.client.from("profiles").upsert(users);
      }
      // Sync past papers
      if (papers.length > 0) {
        await this.client.from("past_papers").upsert(papers);
      }
      // Sync institutes
      if (institutes.length > 0) {
        const normalizedInsts = institutes.map(inst => this.normalizeInstitute(inst));
        await this.client.from("institutes").upsert(normalizedInsts);
      }
      // Sync lessons
      if (lessons.length > 0) {
        await this.client.from("lessons").upsert(lessons);
      }
      // Sync quizzes
      if (quizzes.length > 0) {
        await this.client.from("quizzes").upsert(quizzes);
      }
      // Sync schedules
      if (schedules.length > 0) {
        await this.client.from("broadcast_schedules").upsert(schedules);
      }

      return { success: true, message: `Synced ${teachers.length} teachers, ${courses.length} courses, ${users.length} profiles, ${papers.length} papers, ${institutes.length} campuses, ${lessons.length} lessons, ${quizzes.length} quizzes, and ${schedules.length} live broadcast schedules to Supabase Cloud!` };
    } catch (err) {
      return { success: false, message: "Sync error: " + err.message };
    }
  },

  // Ready-to-execute SQL Schema Script for Supabase SQL Editor
  getSqlSchemaScript() {
    return `-- ============================================================================
-- EduPeak Higher Educational Institute & LMS - Supabase PostgreSQL Schema
-- Run this script in your Supabase Project -> SQL Editor -> New Query
-- ============================================================================

-- 1. Create PROFILES Table (Students, Teachers, Admins)
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_si TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    password TEXT,
    role TEXT DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
    institute TEXT DEFAULT 'Victory Embilipitiya',
    exam_year TEXT DEFAULT '2026 A/L',
    stream TEXT,
    stream_si TEXT,
    district TEXT DEFAULT 'Ratnapura / Embilipitiya',
    branch TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    email_verified BOOLEAN DEFAULT true,
    avatar_letter TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create TEACHERS Table
CREATE TABLE IF NOT EXISTS public.teachers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_si TEXT,
    subject TEXT NOT NULL,
    subject_si TEXT,
    degree TEXT NOT NULL,
    degree_si TEXT,
    designation TEXT,
    designation_si TEXT,
    image TEXT NOT NULL,
    stream TEXT,
    stream_si TEXT,
    rating NUMERIC DEFAULT 4.99,
    studentsCount TEXT DEFAULT '15,000+',
    branches JSONB DEFAULT '[]'::jsonb,
    branches_si JSONB DEFAULT '[]'::jsonb,
    badge TEXT,
    badge_si TEXT,
    bio TEXT,
    bio_si TEXT,
    schedule TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create COURSES Table
CREATE TABLE IF NOT EXISTS public.courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    title_si TEXT,
    teacher TEXT,
    teacherName TEXT,
    teacherId TEXT,
    teacher_id TEXT,
    stream TEXT,
    stream_si TEXT,
    price TEXT,
    fee TEXT,
    fee_si TEXT,
    category TEXT,
    examYear TEXT,
    level TEXT,
    level_si TEXT,
    liveTime TEXT,
    medium TEXT,
    medium_si TEXT,
    rating NUMERIC DEFAULT 4.99,
    students NUMERIC DEFAULT 0,
    modulesCount NUMERIC DEFAULT 24,
    thumbnailIcon TEXT DEFAULT 'fa-atom',
    color TEXT,
    badge TEXT,
    badge_si TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create PAST_PAPERS Table (PDF Vault)
CREATE TABLE IF NOT EXISTS public.past_papers (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    title_si TEXT,
    type TEXT DEFAULT 'national',
    unit TEXT DEFAULT 'all',
    unitName TEXT DEFAULT 'Complete Past Paper Examination',
    year NUMERIC DEFAULT 2024,
    size TEXT DEFAULT 'Cloud PDF',
    fileSize TEXT DEFAULT 'Cloud PDF',
    downloadCount NUMERIC DEFAULT 0,
    url TEXT NOT NULL,
    pdfUrl TEXT,
    storageType TEXT DEFAULT 'cloud',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create INSTITUTES Table (Campus Branches)
CREATE TABLE IF NOT EXISTS public.institutes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_si TEXT,
    status TEXT DEFAULT 'active',
    hasPhysicalLocation BOOLEAN DEFAULT true,
    type TEXT,
    type_si TEXT,
    badge TEXT,
    badge_si TEXT,
    icon TEXT DEFAULT '🏫',
    location TEXT,
    location_si TEXT,
    phone TEXT,
    email TEXT,
    mapUrl TEXT,
    website TEXT,
    facebook TEXT,
    facilities JSONB DEFAULT '[]'::jsonb,
    facilities_si JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create LESSONS Table
CREATE TABLE IF NOT EXISTS public.lessons (
    id TEXT PRIMARY KEY,
    course_id TEXT,
    courseId TEXT,
    title TEXT NOT NULL,
    title_si TEXT,
    duration TEXT DEFAULT '50 mins',
    videoUrl TEXT NOT NULL,
    hasPdf BOOLEAN DEFAULT false,
    pdfName TEXT,
    pdfUrl TEXT,
    watermarkEnabled BOOLEAN DEFAULT false,
    chapters JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Create QUIZZES Table
CREATE TABLE IF NOT EXISTS public.quizzes (
    id TEXT PRIMARY KEY,
    course_id TEXT,
    courseId TEXT,
    question TEXT NOT NULL,
    question_si TEXT,
    options JSONB NOT NULL,
    options_si JSONB,
    correctAnswer NUMERIC NOT NULL,
    explanation TEXT,
    explanation_si TEXT,
    timeLimit NUMERIC DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Create BROADCAST_SCHEDULES Table (Multi-Live Broadcasting & Arbitrary Scheduling)
CREATE TABLE IF NOT EXISTS public.broadcast_schedules (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    topic_si TEXT,
    course_id TEXT,
    courseId TEXT,
    courseTitle TEXT,
    subject TEXT DEFAULT 'Physics',
    subject_si TEXT DEFAULT 'භෞතික විද්‍යාව',
    examYear TEXT DEFAULT '2026 A/L',
    teacherId TEXT DEFAULT 'TCH-PHYSICS',
    teacherName TEXT DEFAULT 'Amalsha Wanniarachchi',
    scheduleDate TEXT,
    scheduleStartTime TEXT,
    scheduleEndTime TEXT,
    scheduleTime TEXT,
    provider TEXT DEFAULT 'youtube',
    rawUrl TEXT,
    embedUrl TEXT,
    zoomUrl TEXT,
    status TEXT DEFAULT 'scheduled',
    watermarkEnabled BOOLEAN DEFAULT false,
    chatEnabled BOOLEAN DEFAULT true,
    description TEXT,
    pinnedNotice TEXT,
    recordingUrl TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Create LIVE_CHAT_MESSAGES Table (Real-Time Live Chat Moderation)
CREATE TABLE IF NOT EXISTS public.live_chat_messages (
    id TEXT PRIMARY KEY,
    sessionId TEXT DEFAULT 'global',
    courseId TEXT,
    senderName TEXT NOT NULL,
    userRole TEXT DEFAULT 'student',
    userId TEXT,
    senderNic TEXT,
    time TEXT NOT NULL,
    timestamp NUMERIC NOT NULL,
    text TEXT NOT NULL,
    isPinned BOOLEAN DEFAULT false,
    isAnnouncement BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Create ENROLLMENTS Table
CREATE TABLE IF NOT EXISTS public.enrollments (
    id BIGSERIAL PRIMARY KEY,
    student_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id TEXT REFERENCES public.courses(id) ON DELETE CASCADE,
    payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'cancelled')),
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_id, course_id)
);

-- 11. Enable Row Level Security (RLS) & Public Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Allow public access
CREATE POLICY "Public can view teachers" ON public.teachers FOR SELECT USING (true);
CREATE POLICY "Public can modify teachers" ON public.teachers FOR ALL USING (true);
CREATE POLICY "Public can view courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Public can modify courses" ON public.courses FOR ALL USING (true);
CREATE POLICY "Public can view past_papers" ON public.past_papers FOR ALL USING (true);
CREATE POLICY "Public can view institutes" ON public.institutes FOR ALL USING (true);
CREATE POLICY "Public can modify institutes" ON public.institutes FOR ALL USING (true);
CREATE POLICY "Public can view lessons" ON public.lessons FOR ALL USING (true);
CREATE POLICY "Public can view quizzes" ON public.quizzes FOR ALL USING (true);
CREATE POLICY "Public can view broadcast_schedules" ON public.broadcast_schedules FOR ALL USING (true);
CREATE POLICY "Public can modify broadcast_schedules" ON public.broadcast_schedules FOR ALL USING (true);
CREATE POLICY "Public can view live_chat_messages" ON public.live_chat_messages FOR ALL USING (true);
CREATE POLICY "Public can modify live_chat_messages" ON public.live_chat_messages FOR ALL USING (true);
CREATE POLICY "Public can view and insert profiles" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Public can view and insert enrollments" ON public.enrollments FOR ALL USING (true);

-- Insert Default Institutes
INSERT INTO public.institutes (id, name, name_si, status, hasPhysicalLocation, type, type_si, badge, badge_si, icon, location, location_si, phone, email, mapUrl, facilities, facilities_si) VALUES
('inst-embilipitiya', 'Victory Higher Educational Institute - Embilipitiya', 'වික්ටරි උසස් අධ්‍යාපන ආයතනය - ඇඹිලිපිටිය', 'active', true, 'Physical Campus & Smart Auditorium', 'ප්‍රධාන භෞතික ශ්‍රවණාගාරය හා පරිශ්‍රය', 'Physical Campus Hub', 'ප්‍රධාන භෞතික මධ්‍යස්ථානය', '🏫', 'Victory College Embilipitiya, Embilipitiya Pallegama, Sri Lanka, 70200', 'වික්ටරි කොලේජ්, ඇඹිලිපිටිය පල්ලෙගම, ශ්‍රී ලංකාව, 70200', '+94 47 226 2808 / +94 76 068 7578 (WhatsApp)', 'victorycollege.emb@gmail.com', 'https://www.google.com/maps/search/?api=1&query=Victory+College+Embilipitiya+Pallegama', '["Air Conditioned 1,500-seat Ultra-Modern Auditorium", "High-Speed Smart LMS Campus Wi-Fi", "Digital Physics Demonstration Lab & Visual Projection", "Dedicated Tute Counter & Student Helpdesk (047 226 2808)", "Official WhatsApp Support: +94 76 068 7578"]'::jsonb, '["වායුසමනය කළ ආසන 1,500ක අතිනවීන ශ්‍රවණාගාරය", "අධිවේගී Smart LMS Wi-Fi පද්ධතිය", "භෞතික විද්‍යා ආදර්ශන සහ ඩිජිටල් ප්‍රක්ෂේපණ පද්ධතිය", "නිබන්ධන කවුළුව සහ ශිෂ්‍ය තාක්ෂණික සහාය (047 226 2808)", "නිල WhatsApp සහාය: +94 76 068 7578"]'::jsonb),
('inst-online', 'EduPeak 24/7 Global Online LMS', 'එඩියුපීක් 24/7 ගෝලීය මාර්ගගත LMS', 'coming_soon', false, 'Online Educational Platform & LMS', '100% ක්ලවුඩ් LMS පද්ධතිය', 'Coming Soon (Online)', 'ඉදිරියේදී විවෘත වේ', '🌐', 'Online Hybrid Cloud Platform (Island-Wide)', 'සමස්ත ලංකා මාර්ගගත ක්ලවුඩ් පද්ධතිය (Online)', '+94 76 068 7578 (WhatsApp / Hotline)', 'support@edupeak.lk', '', '["Ultra HD 1080p Low-Latency Live Streaming", "Instant MCQ Speed Testing & Ranking", "Island-wide Tute Home Delivery (Speed Post)", "24/7 AI-Powered Doubt Clearing Chat"]'::jsonb, '["අඩු ඩේටා වැයවන Ultra HD සජීවී විකාශය", "ක්ෂණික MCQ ලකුණු හා සමස්ත ලංකා ශ්‍රේණිගත කිරීම්", "දිවයින පුරා නිවසටම නිබන්ධන කුරියර් සේවාව", "24/7 ක්‍රියාත්මක AI සහායක සහ ගැටළු නිරාකරණය"]'::jsonb),
('inst-kandy', 'EduPeak Kandy Royal Center', 'එඩියුපීක් මහනුවර රෝයල් මධ්‍යස්ථානය', 'coming_soon', true, 'Upcoming Central Province Campus Hub', 'මධ්‍යම පළාත් නව ශාඛාව', 'Coming Soon', 'ඉදිරියේදී විවෘත වේ', '🏛️', 'Royal Center, Peradeniya Road, Kandy, Sri Lanka', 'රෝයල් මධ්‍යස්ථානය, පේරාදෙණිය පාර, මහනුවර', '+94 81 223 4567 / +94 71 805 9089', 'kandy@edupeak.lk', 'https://maps.google.com/?q=Kandy', '["800-seat Multimedia Lecture Hall", "Physics Experiment Demonstration Unit", "Kandy District Tute Counter & Express Courier", "Student Study Lounge & Free Wi-Fi"]'::jsonb, '["ආසන 800ක බහුමාධ්‍ය ශ්‍රවණාගාරය", "භෞතික විද්‍යා ප්‍රායෝගික ආදර්ශන ඒකකය", "මහනුවර දිස්ත්‍රික් නිබන්ධන කවුළුව", "නොමිලේ Wi-Fi සහ අධ්‍යයන ශාලාව"]'::jsonb),
('inst-kurunegala', 'EduPeak Kurunegala Premier Hub', 'එඩියුපීක් කුරුණෑගල ප්‍රිමියර් මධ්‍යස්ථානය', 'coming_soon', true, 'Upcoming North Western Province Hub', 'වයඹ පළාත් නව ශාඛාව', 'Coming Soon', 'ඉදිරියේදී විවෘත වේ', '🏢', 'Premier Hub, Colombo Road, Kurunegala, Sri Lanka', 'ප්‍රිමියර් මධ්‍යස්ථානය, කොළඹ පාර, කුරුණෑගල', '+94 37 222 3344 / +94 71 805 9089', 'kurunegala@edupeak.lk', 'https://maps.google.com/?q=Kurunegala', '["Modern Digital Classroom with Visual Monitors", "Speed Exam Testing Center", "Wayamba Student Support Desk", "Direct Bus Route Accessibility"]'::jsonb, '["නවීන ඩිජිටල් පන්ති කාමර", "වේගවත් විභාග පරීක්ෂණ මධ්‍යස්ථානය", "වයඹ ශිෂ්‍ය සේවා කවුළුව", "ප්‍රධාන බස් නැවතුම්පොළට ආසන්නව"]'::jsonb)
ON CONFLICT (id) DO NOTHING;
`;
  }
};

// Global export
window.SUPABASE_HELPER = SUPABASE_HELPER;
document.addEventListener("DOMContentLoaded", () => {
  SUPABASE_HELPER.init();
});
