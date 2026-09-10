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

  // Initialize Supabase Client if credentials exist
  init() {
    const config = this.getConfig();
    if (config.url && config.anonKey && window.supabase) {
      try {
        this.client = window.supabase.createClient(config.url, config.anonKey);
        this.testConnection();
        return true;
      } catch (err) {
        console.warn("Supabase init error:", err);
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
        if (error.code === "PGRST116" || (error.message && error.message.includes("does not exist"))) {
          // Connected to Supabase instance, table not created yet
          this.isConnected = true;
          this.updateStatusBadge(true, "Connected to Supabase Cloud");
          return { success: true, message: "Connected to Supabase project!" };
        } else {
          // Real error (invalid URL, network failure, bad API key)
          this.isConnected = false;
          this.updateStatusBadge(false, "Offline / Connection Failed");
          return { success: false, message: error.message || "Failed to connect to Supabase" };
        }
      }
      this.isConnected = true;
      this.updateStatusBadge(true, "Connected to Supabase Cloud");
      return { success: true, message: "Connected to Supabase project!" };
    } catch (err) {
      this.isConnected = false;
      this.updateStatusBadge(false, "Connection Failed: " + err.message);
      return { success: false, message: err.message };
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
    // 1. Check shared root domain cookie (shares between admin.edupeak.lk, edupeak.lk, teacher.edupeak.lk)
    try {
      const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + key + '=([^;]*)'));
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]);
        const parsed = JSON.parse(decoded);
        localStorage.setItem(key, decoded);
        return parsed;
      }
    } catch (e) {}

    // 2. Check localStorage
    try {
      const local = localStorage.getItem(key);
      if (local !== null) {
        return JSON.parse(local);
      }
    } catch (e) {}
    return null;
  },

  setSharedData(key, data) {
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(key, json);
      // Write to shared domain cookie for cross-subdomain synchronization
      const hostname = window.location.hostname;
      let domainStr = "";
      if (hostname.includes(".")) {
        const parts = hostname.split(".");
        if (parts.length >= 2 && !hostname.startsWith("127.") && !hostname.startsWith("localhost")) {
          domainStr = `; domain=.${parts.slice(-2).join(".")}`;
        }
      }
      document.cookie = `${key}=${encodeURIComponent(json)}; path=/${domainStr}; max-age=31536000; SameSite=Lax`;
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
    if (shared !== null && Array.isArray(shared) && shared.length > 0) {
      if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.teachers = shared;
      try { localStorage.setItem("edupeak_teachers_db", JSON.stringify(shared)); } catch (e) {}
      return shared;
    }
    try {
      const stored = localStorage.getItem("edupeak_teachers_db");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
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
    if (shared !== null && Array.isArray(shared) && shared.length > 0) {
      if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.courses = shared;
      try {
        localStorage.setItem("edupeak_courses_db", JSON.stringify(shared));
      } catch (e) {}
      return shared;
    }
    try {
      const stored = localStorage.getItem("edupeak_courses_db");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
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
      try {
        localStorage.setItem("edupeak_courses_db", JSON.stringify(defaultCourses));
      } catch (e) {}
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
      if (typeof window.renderCourses === "function") window.renderCourses();
    }
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
      if (typeof window.renderCourses === "function") window.renderCourses();
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
    if (shared !== null && Array.isArray(shared) && shared.length > 0) {
      try { localStorage.setItem("edupeak_papers_db", JSON.stringify(shared)); } catch (e) {}
      return shared;
    }
    try {
      const stored = localStorage.getItem("edupeak_papers_db");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.setSharedData("edupeak_papers_db", parsed);
          return parsed;
        }
      }
    } catch (e) {}

    const defaultPapers = [
      {
        id: "pp-2024-al-phy",
        title: "2024 G.C.E. A/L Physics Past Paper & Structured Marking Scheme",
        title_si: "2024 උසස් පෙළ භෞතික විද්‍යාව පසුගිය විභාග ප්‍රශ්න පත්‍රය සහ ලකුණු දීමේ පටිපාටිය",
        year: 2024,
        type: "past_paper",
        unitName: "Complete Paper (Part I & II)",
        fileSize: "4.8 MB",
        downloadCount: 3840,
        pdfUrl: "assets/papers/2024_AL_Physics_Paper.pdf",
        storageType: "local"
      },
      {
        id: "pp-2023-al-phy",
        title: "2023 G.C.E. A/L Physics Past Paper & Detailed Marking Scheme",
        title_si: "2023 උසස් පෙළ භෞතික විද්‍යාව පසුගිය විභාග ප්‍රශ්න පත්‍රය සහ පිළිතුරු විවරණය",
        year: 2023,
        type: "past_paper",
        unitName: "Complete Paper (Part I & II)",
        fileSize: "5.2 MB",
        downloadCount: 5120,
        pdfUrl: "assets/papers/2023_AL_Physics_Paper.pdf",
        storageType: "local"
      },
      {
        id: "pp-2022-al-phy",
        title: "2022 G.C.E. A/L Physics Past Paper with MCQ Explanations",
        title_si: "2022 උසස් පෙළ භෞතික විද්‍යාව පසුගිය විභාග ප්‍රශ්න පත්‍රය හා විවරණය",
        year: 2022,
        type: "past_paper",
        unitName: "Complete Paper (Part I & II)",
        fileSize: "4.5 MB",
        downloadCount: 6200,
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
  async getInstitutes() {
    if (this.isConnected && this.client) {
      try {
        const { data, error } = await this.client.from("institutes").select("*");
        if (!error && Array.isArray(data) && data.length > 0) {
          this.setSharedData("edupeak_institutes_db", data);
          try { localStorage.setItem("edupeak_institutes_db", JSON.stringify(data)); } catch (e) {}
          if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.institutes = data;
          return data;
        }
      } catch (e) {
        console.warn("Supabase fetch institutes error, using local:", e);
      }
    }
    const shared = this.getSharedData("edupeak_institutes_db");
    if (shared !== null && Array.isArray(shared) && shared.length > 0) {
      if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.institutes = shared;
      try { localStorage.setItem("edupeak_institutes_db", JSON.stringify(shared)); } catch (e) {}
      return shared;
    }
    try {
      const stored = localStorage.getItem("edupeak_institutes_db");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.setSharedData("edupeak_institutes_db", parsed);
          if (window.EDUPEAK_DATA) window.EDUPEAK_DATA.institutes = parsed;
          return parsed;
        }
      }
    } catch (e) {}

    const defaultInstitutes = (window.EDUPEAK_DATA && Array.isArray(window.EDUPEAK_DATA.institutes) && window.EDUPEAK_DATA.institutes.length > 0)
      ? window.EDUPEAK_DATA.institutes
      : [];
    if (defaultInstitutes.length > 0) {
      this.setSharedData("edupeak_institutes_db", defaultInstitutes);
      try { localStorage.setItem("edupeak_institutes_db", JSON.stringify(defaultInstitutes)); } catch (e) {}
    }
    return defaultInstitutes;
  },

  async saveInstitute(instData) {
    if (this.isConnected && this.client) {
      try {
        const { data, error } = await this.client.from("institutes").upsert([instData]).select();
        if (!error && data) return data[0];
      } catch (e) {
        console.warn("Supabase upsert institute error:", e);
      }
    }
    const institutes = await this.getInstitutes();
    const existingIndex = institutes.findIndex(i => i.id === instData.id);
    if (existingIndex >= 0) {
      institutes[existingIndex] = { ...institutes[existingIndex], ...instData };
    } else {
      institutes.push(instData);
    }
    this.setSharedData("edupeak_institutes_db", institutes);
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.institutes = institutes;
      if (window.renderInstitutes) window.renderInstitutes();
    }
    if (window.EDUPEAK_INSTITUTES && window.EDUPEAK_INSTITUTES.populateDropdowns) {
      window.EDUPEAK_INSTITUTES.populateDropdowns();
    }
    return instData;
  },

  async deleteInstitute(instId) {
    if (this.isConnected && this.client) {
      try {
        await this.client.from("institutes").delete().eq("id", instId);
      } catch (e) {
        console.warn("Supabase delete institute error:", e);
      }
    }
    let institutes = await this.getInstitutes();
    institutes = institutes.filter(i => i.id !== instId);
    this.setSharedData("edupeak_institutes_db", institutes);
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.institutes = institutes;
      if (window.renderInstitutes) window.renderInstitutes();
    }
    if (window.EDUPEAK_INSTITUTES && window.EDUPEAK_INSTITUTES.populateDropdowns) {
      window.EDUPEAK_INSTITUTES.populateDropdowns();
    }
    return true;
  },

  // 6. SYNC LOCAL DATA TO SUPABASE CLOUD
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
        await this.client.from("institutes").upsert(institutes);
      }

      return { success: true, message: `Synced ${teachers.length} teachers, ${courses.length} courses, ${users.length} profiles, ${papers.length} papers, and ${institutes.length} campuses to Supabase Cloud!` };
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
    image TEXT NOT NULL,
    stream TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create COURSES Table
CREATE TABLE IF NOT EXISTS public.courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    title_si TEXT,
    teacher TEXT,
    teacherName TEXT,
    teacher_id TEXT,
    stream TEXT,
    price TEXT,
    fee TEXT,
    category TEXT,
    examYear TEXT,
    level TEXT,
    liveTime TEXT,
    medium TEXT,
    rating NUMERIC DEFAULT 4.99,
    students NUMERIC DEFAULT 0,
    modulesCount NUMERIC DEFAULT 24,
    thumbnailIcon TEXT DEFAULT 'fa-atom',
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
    url TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create INSTITUTES Table (Campus Branches)
CREATE TABLE IF NOT EXISTS public.institutes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_si TEXT,
    city TEXT,
    district TEXT,
    address TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active',
    hasPhysicalLocation BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create ENROLLMENTS Table
CREATE TABLE IF NOT EXISTS public.enrollments (
    id BIGSERIAL PRIMARY KEY,
    student_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id TEXT REFERENCES public.courses(id) ON DELETE CASCADE,
    payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'cancelled')),
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_id, course_id)
);

-- 7. Enable Row Level Security (RLS) & Public Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Allow public access
CREATE POLICY "Public can view teachers" ON public.teachers FOR SELECT USING (true);
CREATE POLICY "Public can view courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Public can view past_papers" ON public.past_papers FOR ALL USING (true);
CREATE POLICY "Public can view institutes" ON public.institutes FOR ALL USING (true);
CREATE POLICY "Public can view and insert profiles" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Public can view and insert enrollments" ON public.enrollments FOR ALL USING (true);

-- Insert Default Faculty Members
INSERT INTO public.teachers (id, name, name_si, subject, subject_si, degree, image, stream) VALUES
('tch-1', 'Eng. Dhanushka Senanayake', 'ඉංජි. ධනුෂ්ක සේනානායක', 'Combined Mathematics', 'සංයුක්ත ගණිතය', 'B.Sc. (Eng) Hons (University of Moratuwa)', 'assets/img/teacher_maths.jpg', 'maths'),
('tch-2', 'Prof. Sanath Wickramasinghe', 'මහාචාර්ය සනත් වික්‍රමසිංහ', 'Physics', 'භෞතික විද්‍යාව', 'B.Sc. (Hons) Sp, M.Sc., Ph.D. (Peradeniya)', 'assets/img/teacher_physics.jpg', 'maths'),
('tch-3', 'Dr. Charith Jayasuriya', 'ආචාර්ය චරිත් ජයසූරිය', 'Chemistry', 'රසායන විද්‍යාව', 'B.Sc. (Hons) Special (USJ), Ph.D. (UK)', 'assets/img/teacher_chemistry.jpg', 'science'),
('tch-4', 'Dr. Ruwanthi Fernando', 'වෛද්‍ය රුවන්ති ප්‍රනාන්දු', 'Biology', 'ජීව විද්‍යාව', 'MBBS (Colombo), MD (Senior Lecturer)', 'assets/img/teacher_biology.jpg', 'science'),
('tch-5', 'Lec. Kavinda Alwis', 'කථිකාචාර්ය කාවින්ද අල්විස්', 'Information & Communication Tech (ICT)', 'තොරතුරු තාක්ෂණය (ICT)', 'B.Sc. (Hons) Computing, MBCS, M.Sc.', 'assets/img/teacher_ict.jpg', 'tech')
ON CONFLICT (id) DO NOTHING;
`;
  }
};

// Global export
window.SUPABASE_HELPER = SUPABASE_HELPER;
document.addEventListener("DOMContentLoaded", () => {
  SUPABASE_HELPER.init();
});
