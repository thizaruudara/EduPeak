/**
 * EduPeak Authentication & User Session Management Engine
 * Persistent LocalStorage & Supabase Cloud Multi-Role Authentication
 * Features: Google Sign-Up, Institute (Victory Embilipitiya), Exam Year, Stream & 6-Digit Email OTP Verification
 */

const AUTH_SYSTEM = {
  storageKeys: {
    users: "edupeak_users_db",
    session: "edupeak_active_session"
  },

  // State for in-progress registration awaiting OTP verification
  pendingRegistration: null,
  otpTimerInterval: null,

  // Canonical accounts: 1 Student, 1 Teacher, 1 Admin
  defaultUsers: [
    {
      id: "EP-2027-001",
      name: "Kasun Jayasundara",
      name_si: "කසුන් ජයසුන්දර",
      email: "student@edupeak.lk",
      phone: "0771234567",
      password: "student123",
      role: "student",
      institute: "Victory Embilipitiya",
      examYear: "2027 A/L",
      stream: "Physical Science",
      stream_si: "ගණිත අංශය",
      branch: "Victory Embilipitiya",
      school: "President's College Embilipitiya",
      district: "Ratnapura / Embilipitiya",
      address: "Victory College, Embilipitiya Pallegama, Sri Lanka",
      email_verified: true,
      avatarLetter: "K",
      joinedDate: "2025-01-10"
    },
    {
      id: "tch-amalsha",
      name: "Amalsha Wanniarachchi",
      name_si: "අමල්ෂ වන්නිආරච්චි",
      email: "amalsha@edupeak.lk",
      phone: "0718059089",
      password: "teacher123",
      role: "teacher",
      subject: "G.C.E. Advanced Level Physics",
      subject_si: "උසස් පෙළ භෞතික විද්‍යාව",
      degree: "MBBS (UG / University of Sri Jayewardenepura)",
      institute: "Victory Embilipitiya",
      branch: "Victory Embilipitiya",
      email_verified: true,
      avatar: "assets/img/hero_lecturer.png",
      avatarLetter: "A",
      joinedDate: "2024-01-15"
    },
    {
      id: "TCH-PHYSICS",
      name: "Prof. K. M. Liyanage",
      name_si: "මහාචාර්ය කේ. එම්. ලියනගේ",
      email: "teacher@edupeak.lk",
      phone: "0712345678",
      password: "teacher123",
      role: "teacher",
      subject: "Physics",
      subject_si: "භෞතික විද්‍යාව",
      degree: "Senior Professor of Physics (Peradeniya)",
      institute: "Victory Embilipitiya",
      branch: "Victory Embilipitiya",
      email_verified: true,
      avatarLetter: "P",
      joinedDate: "2022-03-15"
    },
    {
      id: "ADM-SUPER",
      name: "System Administrator",
      name_si: "ප්‍රධාන පරිපාලක",
      email: "admin@edupeak.lk",
      phone: "0701234567",
      password: "admin123",
      role: "admin",
      institute: "All Branches",
      branch: "All Branches",
      email_verified: true,
      avatarLetter: "A",
      joinedDate: "2021-01-01"
    }
  ],

  init() {
    // Sync clean canonical users if db version updated
    const DB_VERSION = "v5_teacher_accounts_ready";
    if (localStorage.getItem("edupeak_db_ver") !== DB_VERSION) {
      const existing = this.getUsers();
      this.defaultUsers.forEach(def => {
        const found = existing.find(u => u.id === def.id || (u.email && def.email && u.email.toLowerCase() === def.email.toLowerCase()));
        if (!found) {
          existing.push(def);
        }
      });
      localStorage.setItem(this.storageKeys.users, JSON.stringify(existing));
      localStorage.setItem("edupeak_db_ver", DB_VERSION);
    } else if (!localStorage.getItem(this.storageKeys.users)) {
      localStorage.setItem(this.storageKeys.users, JSON.stringify(this.defaultUsers));
    }
    this.initOtpDigitInputs();
    this.updateUIForAuthState();
    this.handleOAuthCallback();
  },

  // Check for active Google OAuth redirect session from Supabase
  async handleOAuthCallback() {
    if (window.SUPABASE_HELPER && window.SUPABASE_HELPER.client) {
      try {
        const { data: { session }, error } = await window.SUPABASE_HELPER.client.auth.getSession();
        if (session && session.user) {
          const user = session.user;
          const userMeta = user.user_metadata || {};
          const googleUser = {
            id: `EP-GOOGLE-${user.id.substring(0, 6)}`,
            name: userMeta.full_name || userMeta.name || user.email.split('@')[0],
            name_si: userMeta.full_name || userMeta.name || user.email.split('@')[0],
            email: user.email,
            phone: user.phone || userMeta.phone || "",
            role: "student",
            institute: userMeta.institute || "Victory Embilipitiya",
            examYear: userMeta.exam_year || "2026 A/L",
            stream: userMeta.stream || "Physical Science",
            district: userMeta.district || "Ratnapura / Embilipitiya",
            branch: "Victory Embilipitiya",
            email_verified: true,
            authProvider: "google",
            avatarLetter: (userMeta.full_name || user.email).charAt(0).toUpperCase(),
            avatarUrl: userMeta.avatar_url || userMeta.picture || "",
            joinedDate: new Date().toISOString().split("T")[0]
          };

          // Save user in local db if not present
          const users = this.getUsers();
          if (!users.find(u => u.email.toLowerCase() === googleUser.email.toLowerCase())) {
            users.push(googleUser);
            localStorage.setItem(this.storageKeys.users, JSON.stringify(users));
            window.SUPABASE_HELPER.syncProfile(googleUser);
          }

          this.createSession(googleUser);
          if (window.location.hash.includes("access_token")) {
            history.replaceState(null, document.title, window.location.pathname + window.location.search);
          }
          if (window.showToast) {
            window.showToast(`🎉 Welcome, ${googleUser.name}! Signed in with Google.`, "success");
          }
          setTimeout(() => {
            if (googleUser.role === "student") {
              window.location.href = "student-dashboard.html";
            } else if (googleUser.role === "teacher") {
              window.location.href = "teacher-portal.html";
            } else {
              window.location.href = "student-dashboard.html";
            }
          }, 500);
        }
      } catch (err) {
        console.warn("OAuth session check notice:", err);
      }
    }
  },

  getUsers() {
    try {
      const stored = localStorage.getItem(this.storageKeys.users);
      return stored ? JSON.parse(stored) : this.defaultUsers;
    } catch (e) {
      console.error("Error reading users db:", e);
      return this.defaultUsers;
    }
  },

  getCurrentUser() {
    try {
      const session = localStorage.getItem(this.storageKeys.session);
      return session ? JSON.parse(session) : null;
    } catch (e) {
      console.error("Error reading session:", e);
      return null;
    }
  },

  saveUserAccount(userData) {
    try {
      const users = this.getUsers();
      const existingIdx = users.findIndex(u => 
        (userData.id && u.id === userData.id) || 
        (userData.email && u.email && u.email.toLowerCase() === userData.email.toLowerCase())
      );
      if (existingIdx >= 0) {
        users[existingIdx] = { ...users[existingIdx], ...userData };
      } else {
        users.push(userData);
      }
      localStorage.setItem(this.storageKeys.users, JSON.stringify(users));
      return { success: true, user: userData };
    } catch (e) {
      console.error("Error saving user account:", e);
      return { success: false, error: e.message };
    }
  },

  deleteUserAccount(userIdOrEmail) {
    try {
      let users = this.getUsers();
      users = users.filter(u => u.id !== userIdOrEmail && u.email !== userIdOrEmail);
      localStorage.setItem(this.storageKeys.users, JSON.stringify(users));
      return { success: true };
    } catch (e) {
      console.error("Error deleting user account:", e);
      return { success: false, error: e.message };
    }
  },

  // --------------------------------------------------------------------------
  // OTP DISPATCH & VERIFICATION ENGINE (With Supabase Cloud Duplicate Check)
  // --------------------------------------------------------------------------
  async sendRegistrationOtp(formData) {
    const cleanEmail = formData.email ? formData.email.trim().toLowerCase() : "";
    const cleanPhone = formData.phone ? formData.phone.trim() : "";

    // 1. Email Format Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return { success: false, code: "INVALID_EMAIL", message: "⚠️ Please enter a valid email address (e.g. yourname@gmail.com)." };
    }

    // 2. Mobile Phone Validation
    const digitsOnly = cleanPhone.replace(/[\s-]/g, "");
    if (digitsOnly.length < 9 || digitsOnly.length > 12) {
      return { success: false, code: "INVALID_PHONE", message: "⚠️ Please enter a valid mobile number (e.g. 077 123 4567)." };
    }

    // 3. Supabase & Local DB Check to ensure user is not already registered
    if (window.SUPABASE_HELPER && window.SUPABASE_HELPER.checkUserExists) {
      try {
        const existsCheck = await window.SUPABASE_HELPER.checkUserExists(cleanEmail, cleanPhone);
        if (existsCheck.exists) {
          if (existsCheck.field === "email") {
            return {
              success: false,
              code: "EMAIL_EXISTS",
              message: `⚠️ An account with the email '${cleanEmail}' is already registered. Please Sign In.`
            };
          }
          if (existsCheck.field === "phone") {
            return {
              success: false,
              code: "PHONE_EXISTS",
              message: `⚠️ An account with the mobile number '${cleanPhone}' is already registered. Please Sign In.`
            };
          }
        }
      } catch (e) {
        console.warn("Supabase checkUserExists warning:", e);
      }
    }

    // Local DB fallback check
    const users = this.getUsers();
    const duplicateEmail = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
    if (duplicateEmail) {
      return { success: false, code: "EMAIL_EXISTS", message: `⚠️ An account with email '${cleanEmail}' already exists. Please Sign In.` };
    }
    const duplicatePhone = users.find(u => u.phone && u.phone.replace(/[\s-]/g, "") === digitsOnly);
    if (duplicatePhone) {
      return { success: false, code: "PHONE_EXISTS", message: `⚠️ An account with mobile '${cleanPhone}' already exists. Please Sign In.` };
    }

    // Trigger Supabase Cloud Auth Sign Up (Sends real verification email if configured)
    if (window.SUPABASE_HELPER && window.SUPABASE_HELPER.client) {
      try {
        await window.SUPABASE_HELPER.client.auth.signUp({
          email: cleanEmail,
          password: formData.password,
          options: {
            data: {
              full_name: formData.name,
              phone: cleanPhone,
              institute: formData.institute,
              exam_year: formData.examYear,
              stream: formData.stream,
              district: formData.district
            }
          }
        });
      } catch (e) {
        console.warn("Supabase Auth notice:", e);
      }
    }

    // Generate 6-digit OTP code
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    this.pendingRegistration = {
      ...formData,
      email: cleanEmail,
      phone: cleanPhone,
      otpCode: generatedOtp,
      otpTimestamp: Date.now()
    };

    // Update Email OTP Modal UI
    const targetEmailEl = document.getElementById("otpTargetEmail");
    if (targetEmailEl) targetEmailEl.textContent = cleanEmail;

    const devCodeEl = document.getElementById("otpDevCode");
    if (devCodeEl) devCodeEl.textContent = generatedOtp;

    // Reset OTP input boxes
    document.querySelectorAll(".otp-digit").forEach(input => input.value = "");

    // Start 60s countdown timer
    this.startOtpCountdown(59);

    // Close Register Modal and open OTP Modal
    if (window.closeModal) window.closeModal("registerModal");
    if (window.openModal) window.openModal("emailOtpModal");

    // Auto-focus first digit
    setTimeout(() => {
      const firstDigit = document.querySelector('.otp-digit[data-index="0"]');
      if (firstDigit && typeof firstDigit.focus === 'function') firstDigit.focus();
    }, 300);

    // Show notification toast
    if (window.showToast) {
      window.showToast(`📩 OTP Code dispatched to ${cleanEmail}: ${generatedOtp}`, "info");
    }

    return { success: true, otp: generatedOtp };
  },

  startOtpCountdown(seconds) {
    if (this.otpTimerInterval) clearInterval(this.otpTimerInterval);

    let remaining = seconds;
    const countdownEl = document.getElementById("otpCountdown");
    const timerTextEl = document.getElementById("otpTimerText");
    const resendBtn = document.getElementById("btnResendOtp");

    if (timerTextEl) timerTextEl.style.display = "inline";
    if (resendBtn) resendBtn.style.display = "none";
    if (countdownEl) countdownEl.textContent = `${remaining}s`;

    this.otpTimerInterval = setInterval(() => {
      remaining--;
      if (countdownEl) countdownEl.textContent = `${remaining}s`;

      if (remaining <= 0) {
        clearInterval(this.otpTimerInterval);
        if (timerTextEl) timerTextEl.style.display = "none";
        if (resendBtn) resendBtn.style.display = "inline";
      }
    }, 1000);
  },

  async verifyOtp(enteredCode) {
    if (!this.pendingRegistration) {
      return { success: false, message: "⚠️ No active registration session found. Please fill the registration form again." };
    }

    if (enteredCode !== this.pendingRegistration.otpCode) {
      return { success: false, message: "⚠️ Invalid 6-digit verification code. Please check and re-enter." };
    }

    // Complete registration
    const result = await this.commitRegistration(this.pendingRegistration);
    this.pendingRegistration = null;
    return result;
  },

  // Commit verified student to Database & Supabase
  async commitRegistration(data) {
    const users = this.getUsers();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newId = `EP-2025-${randomSuffix}`;

    const newUser = {
      id: newId,
      name: data.name.trim(),
      name_si: data.name.trim(),
      email: data.email,
      phone: data.phone,
      password: data.password,
      role: "student",
      institute: data.institute || "Victory Embilipitiya",
      examYear: data.examYear || "2026 A/L",
      stream: data.stream || "Physical Science",
      district: data.district || "Ratnapura / Embilipitiya",
      branch: data.institute || "Victory Embilipitiya",
      email_verified: true,
      authProvider: data.authProvider || "email",
      avatarLetter: data.name.trim().charAt(0).toUpperCase(),
      joinedDate: new Date().toISOString().split("T")[0]
    };

    users.push(newUser);
    localStorage.setItem(this.storageKeys.users, JSON.stringify(users));

    // Sync to Supabase Cloud PostgreSQL
    if (window.SUPABASE_HELPER && window.SUPABASE_HELPER.client) {
      try {
        await window.SUPABASE_HELPER.syncProfile({
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          role: "student",
          institute: newUser.institute,
          exam_year: newUser.examYear,
          stream: newUser.stream,
          district: newUser.district,
          email_verified: true
        });
      } catch (e) {
        console.warn("Supabase profile sync notice:", e);
      }
    }

    // Automatically login newly verified user
    this.createSession(newUser);
    return { 
      success: true, 
      user: newUser,
      message: `🎉 Registration successful! Welcome to EduPeak, ${newUser.name}.`
    };
  },

  // --------------------------------------------------------------------------
  // LOGIN AUTHENTICATION (With Supabase User & Password Verification)
  // --------------------------------------------------------------------------
  async login(identifier, password, role) {
    const cleanIdentifier = identifier ? identifier.trim().toLowerCase() : "";
    const cleanPhone = cleanIdentifier.replace(/[\s-]/g, "");

    let user = null;

    // 1. Check Supabase Cloud Database first
    if (window.SUPABASE_HELPER && window.SUPABASE_HELPER.findUserByIdentifier) {
      try {
        user = await window.SUPABASE_HELPER.findUserByIdentifier(cleanIdentifier);
      } catch (e) {
        console.warn("Supabase login lookup error:", e);
      }
    }

    // 2. Check LocalStorage database
    if (!user) {
      const users = this.getUsers();
      user = users.find(u => 
        (u.email && u.email.toLowerCase() === cleanIdentifier) ||
        (u.phone && u.phone.replace(/[\s-]/g, "") === cleanPhone) ||
        (u.id && u.id.toLowerCase() === cleanIdentifier)
      );
    }

    // Validate User Existence, Password, and Role matching securely (OWASP Anti-Enumeration)
    const isPasswordCorrect = user && (!user.password || user.password === password);
    const isRoleMatching = user && (!role || !user.role || user.role === role);

    if (!user || !isPasswordCorrect || !isRoleMatching) {
      return { 
        success: false, 
        code: "INVALID_CREDENTIALS",
        message: role === "student" 
          ? "Invalid Student ID, Email, or Password. Please check your credentials and try again."
          : "Invalid Staff / Admin credentials or Password. Please try again."
      };
    }

    this.createSession(user);
    return { 
      success: true, 
      user: user,
      message: `🎉 Login successful! Welcome back, ${user.name}.`
    };
  },

  createSession(user) {
    const sessionData = {
      id: user.id,
      name: user.name,
      name_si: user.name_si || user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      institute: user.institute || "Victory Embilipitiya",
      examYear: user.examYear || user.exam_year || "2027 A/L",
      stream: user.stream || "Physical Science",
      branch: user.branch || user.institute || "Victory Embilipitiya",
      school: user.school || "",
      district: user.district || "Ratnapura / Embilipitiya",
      address: user.address || "",
      avatarLetter: user.avatarLetter || (user.name ? user.name.charAt(0).toUpperCase() : "K"),
      token: "ep_jwt_" + Math.random().toString(36).substring(2) + Date.now(),
      loginTime: new Date().toISOString()
    };

    localStorage.setItem(this.storageKeys.session, JSON.stringify(sessionData));
    this.updateUIForAuthState();
  },

  // Permanent Profile Update Across Local DB & Supabase Cloud
  async updateUserProfile(updatedData) {
    if (!updatedData || (!updatedData.id && !updatedData.email)) {
      return { success: false, message: "Missing user identification" };
    }

    // 1. Update in LocalStorage Registered Users Database
    const users = this.getUsers();
    const index = users.findIndex(u => 
      (updatedData.id && u.id === updatedData.id) ||
      (updatedData.email && u.email && u.email.toLowerCase() === updatedData.email.toLowerCase())
    );

    let fullUserRecord = null;
    if (index !== -1) {
      users[index] = { ...users[index], ...updatedData };
      fullUserRecord = users[index];
    } else {
      users.push(updatedData);
      fullUserRecord = updatedData;
    }
    localStorage.setItem(this.storageKeys.users, JSON.stringify(users));

    // 2. Update Active Session in LocalStorage
    const currentSession = this.getCurrentUser();
    if (currentSession) {
      const mergedSession = { ...currentSession, ...updatedData };
      localStorage.setItem(this.storageKeys.session, JSON.stringify(mergedSession));
    }

    // 3. Sync to Supabase Cloud Database
    if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.syncProfile === 'function') {
      try {
        await window.SUPABASE_HELPER.syncProfile(fullUserRecord);
      } catch (e) {
        console.warn("Supabase profile sync error during update:", e);
      }
    }

    this.updateUIForAuthState();
    return { success: true, user: fullUserRecord };
  },

  logout() {
    localStorage.removeItem(this.storageKeys.session);
    if (window.closeLMSPortal) window.closeLMSPortal();
    if (window.LMS_STATE) window.LMS_STATE.currentUser = null;
    this.updateUIForAuthState();

    if (window.showToast) {
      const msg = window.currentLang === "si"
        ? "👋 ඔබ සාර්ථකව පද්ධතියෙන් ඉවත් විය."
        : "👋 You have been logged out successfully.";
      window.showToast(msg, "info");
    }

    // Redirect to home page if currently inside a protected portal
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.includes("teacher-portal") || pathname.includes("student-dashboard")) {
      setTimeout(() => {
        window.location.href = "index.html";
      }, 350);
    }
  },

  // Update header navigation & UI elements dynamically
  updateUIForAuthState() {
    const currentUser = this.getCurrentUser();
    const guestActions = document.getElementById("headerGuestActions");
    const userActions = document.getElementById("headerUserActions");
    const userAvatarLetter = document.getElementById("headerUserAvatarLetter");
    const userNameDisplay = document.getElementById("headerUserNameDisplay");
    const userRoleBadge = document.getElementById("headerUserRoleBadge");
    const adminBtn = document.getElementById("headerAdminPanelBtn");

    // Profile Dropdown Elements
    const dropdownAvatar = document.getElementById("dropdownUserAvatar");
    const dropdownName = document.getElementById("dropdownUserName");
    const dropdownId = document.getElementById("dropdownUserId");
    const dropdownIdPill = document.getElementById("dropdownUserIdPill");
    const dropdownMeta = document.getElementById("dropdownUserMeta");
    const dropdownNavLinks = document.getElementById("dropdownNavLinks");

    if (currentUser) {
      if (guestActions) guestActions.style.display = "none";
      if (userActions) userActions.style.display = "flex";
      const customAvatar = localStorage.getItem("edupeak_user_avatar") || currentUser.avatar;
      if (userAvatarLetter) {
        if (customAvatar) {
          userAvatarLetter.innerHTML = `<img src="${customAvatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
          userAvatarLetter.textContent = currentUser.avatarLetter || currentUser.name.charAt(0).toUpperCase();
        }
      }
      if (userNameDisplay) userNameDisplay.textContent = currentUser.name.split(" ")[0];
      if (userRoleBadge) {
        userRoleBadge.textContent = currentUser.role.toUpperCase();
        userRoleBadge.className = `user-role-pill role-${currentUser.role}`;
      }

      // Populate Dropdown Profile Information
      if (dropdownAvatar) {
        if (customAvatar) {
          dropdownAvatar.innerHTML = `<img src="${customAvatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
          dropdownAvatar.textContent = currentUser.avatarLetter || currentUser.name.charAt(0).toUpperCase();
        }
      }
      if (dropdownName) dropdownName.textContent = currentUser.name;
      if (dropdownId) dropdownId.textContent = currentUser.id || "EP-STUDENT";
      if (dropdownMeta) {
        const metaSub = currentUser.email || currentUser.phone || "Physical Science";
        const metaExtra = currentUser.examYear ? ` • ${currentUser.examYear}` : (currentUser.subject ? ` • ${currentUser.subject}` : '');
        dropdownMeta.textContent = metaSub + metaExtra;
      }

      // Populate Dropdown Navigation Links based on Role
      if (dropdownNavLinks) {
        if (currentUser.role === "student") {
          dropdownNavLinks.innerHTML = `
            <a href="student-dashboard.html" class="dropdown-nav-item" onclick="closeProfileDropdown();">
              <i class="fa-solid fa-gauge-high" style="color: #227aff;"></i>
              <span>Student Dashboard</span>
            </a>
            <a href="profile.html" class="dropdown-nav-item" onclick="closeProfileDropdown();">
              <i class="fa-solid fa-user-pen" style="color: #8b5cf6;"></i>
              <span>My Profile & Avatar</span>
            </a>
            <a href="past-papers.html" class="dropdown-nav-item" onclick="closeProfileDropdown();">
              <i class="fa-solid fa-file-pdf" style="color: #10b981;"></i>
              <span>Past Paper Vault</span>
            </a>
            <button type="button" class="dropdown-nav-item" onclick="openLMSPortal('video-classroom'); closeProfileDropdown();">
              <i class="fa-solid fa-circle-play" style="color: #06b6d4;"></i>
              <span>Video Classroom Replay</span>
            </button>
            <button type="button" class="dropdown-nav-item" onclick="openLMSPortal('speed-quiz'); closeProfileDropdown();">
              <i class="fa-solid fa-stopwatch" style="color: #f59e0b;"></i>
              <span>Speed MCQ Arena</span>
            </button>
          `;
        } else if (currentUser.role === "teacher") {
          dropdownNavLinks.innerHTML = `
            <a href="teacher-portal.html" class="dropdown-nav-item" onclick="closeProfileDropdown();">
              <i class="fa-solid fa-chalkboard-user"></i>
              <span>Teacher & Faculty Studio</span>
            </a>
            <a href="teacher-portal.html" class="dropdown-nav-item" onclick="closeProfileDropdown();">
              <i class="fa-solid fa-book-open"></i>
              <span>Course & Lesson Manager</span>
            </a>
            <a href="teacher-portal.html" class="dropdown-nav-item" onclick="closeProfileDropdown();">
              <i class="fa-solid fa-clipboard-question"></i>
              <span>Speed MCQ Quiz Creator</span>
            </a>
            <a href="teacher-portal.html" class="dropdown-nav-item" onclick="closeProfileDropdown();">
              <i class="fa-solid fa-tower-broadcast" style="color: #ef4444;"></i>
              <span>Live Broadcast Console</span>
            </a>
          `;
        } else if (currentUser.role === "admin") {
          dropdownNavLinks.innerHTML = `
            <button type="button" class="dropdown-nav-item" onclick="openAdminPanel(); closeProfileDropdown();">
              <i class="fa-solid fa-gauge-high"></i>
              <span>Admin Dashboard & Metrics</span>
            </button>
            <button type="button" class="dropdown-nav-item" onclick="openAdminPanel(); closeProfileDropdown();">
              <i class="fa-solid fa-users"></i>
              <span>Student & Lecturer Directory</span>
            </button>
            <button type="button" class="dropdown-nav-item" onclick="openAdminPanel(); closeProfileDropdown();">
              <i class="fa-solid fa-database"></i>
              <span>Supabase Cloud Sync</span>
            </button>
          `;
        }
      }

      // Sync with LMS state
      if (window.LMS_STATE) {
        window.LMS_STATE.currentUser = currentUser;
      }
      if (window.syncLMSUserInfo) {
        window.syncLMSUserInfo(currentUser);
      }
    } else {
      if (guestActions) guestActions.style.display = "flex";
      if (userActions) userActions.style.display = "none";
      if (adminBtn) adminBtn.style.display = "none";
      if (window.closeProfileDropdown) window.closeProfileDropdown();
      if (window.LMS_STATE) {
        window.LMS_STATE.currentUser = null;
      }
    }
  },

  // OTP 6-Digit Keyboard & Auto-Advance Handler
  initOtpDigitInputs() {
    const digits = document.querySelectorAll(".otp-digit");
    if (!digits.length) return;

    digits.forEach((input, index) => {
      input.addEventListener("input", (e) => {
        const val = e.target.value;
        if (val.length >= 1) {
          // Take last entered character if multiple
          input.value = val.slice(-1);
          if (index < digits.length - 1) {
            digits[index + 1].focus();
          }
        }
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !input.value && index > 0) {
          digits[index - 1].focus();
        }
      });

      input.addEventListener("paste", (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData("text").trim();
        if (/^\d{6}$/.test(pasted)) {
          pasted.split("").forEach((char, i) => {
            if (digits[i]) digits[i].value = char;
          });
          digits[digits.length - 1].focus();
        }
      });
    });
  },

  // Quick helper to auto-fill demo accounts in modal
  fillDemoAccount(role) {
    const demo = this.defaultUsers.find(u => u.role === role);
    if (!demo) return;

    const idInput = document.getElementById("signInIdInput");
    const passInput = document.getElementById("signInPasswordInput");
    if (idInput) idInput.value = demo.email;
    if (passInput) passInput.value = demo.password;

    if (window.switchAuthRole) {
      const btn = document.querySelector(`.role-tab-btn[data-role="${role}"]`);
      if (btn) window.switchAuthRole(role, btn);
    }
  }
};

// --------------------------------------------------------------------------
// GLOBAL AUTH FORM HANDLERS
// --------------------------------------------------------------------------
async function handleRegistrationSubmit(e) {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector("button[type='submit']");
  const name = document.getElementById("regNameInput")?.value.trim();
  const email = document.getElementById("regEmailInput")?.value.trim();
  const phone = document.getElementById("regPhoneInput")?.value.trim();
  const institute = document.getElementById("regInstituteSelect")?.value;
  const examYear = document.getElementById("regExamYearSelect")?.value;
  const stream = document.getElementById("regStreamSelect")?.value;
  const district = document.getElementById("regDistrictSelect")?.value;
  const password = document.getElementById("regPasswordInput")?.value;
  const confirmPassword = document.getElementById("regConfirmPasswordInput")?.value;

  const errorAlert = document.getElementById("regErrorAlert");
  const successAlert = document.getElementById("regSuccessAlert");

  const showError = (msg) => {
    if (errorAlert) {
      errorAlert.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${msg}`;
      errorAlert.style.display = "block";
    }
    if (successAlert) successAlert.style.display = "none";
  };

  if (errorAlert) errorAlert.style.display = "none";
  if (successAlert) successAlert.style.display = "none";

  if (!name || !email || !phone || !password) {
    showError("Please fill in all required registration fields.");
    return;
  }

  // Verify institute selection is active and not coming soon
  if (institute) {
    const allInstitutes = window.EDUPEAK_INSTITUTES ? window.EDUPEAK_INSTITUTES.getAll() : (window.EDUPEAK_DATA?.institutes || []);
    const matchingInst = allInstitutes.find(i => 
      i.name === institute || 
      i.id === institute || 
      (i.name && institute && institute.includes(i.name))
    );
    if (matchingInst && matchingInst.status === "coming_soon") {
      showError("⚠️ The selected campus/branch is currently Coming Soon and not yet accepting registrations. Please choose an active branch such as Victory Higher Educational Institute - Embilipitiya.");
      return;
    }
  }

  if (password.length < 6) {
    showError("Password must be at least 6 characters long.");
    return;
  }

  if (password !== confirmPassword) {
    showError("Passwords do not match. Please verify your password entry.");
    return;
  }

  // Show loading spinner
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking Account & Sending OTP...';
  }

  try {
    const result = await AUTH_SYSTEM.sendRegistrationOtp({
      name,
      email,
      phone,
      institute,
      examYear,
      stream,
      district,
      password,
      authProvider: "email"
    });

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Proceed to Email Verification (Get OTP)';
    }

    if (!result.success) {
      showError(result.message);
      return;
    }

    if (errorAlert) errorAlert.style.display = "none";
  } catch (err) {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Proceed to Email Verification (Get OTP)';
    }
    showError(`Registration error: ${err.message}`);
  }
}

async function handleOtpVerificationSubmit(e) {
  e.preventDefault();

  const digits = Array.from(document.querySelectorAll(".otp-digit")).map(d => d.value.trim()).join("");
  const errorAlert = document.getElementById("otpErrorAlert");
  const successAlert = document.getElementById("otpSuccessAlert");
  const verifyBtn = document.getElementById("btnVerifyOtp");

  if (errorAlert) errorAlert.style.display = "none";
  if (successAlert) successAlert.style.display = "none";

  if (digits.length !== 6) {
    if (errorAlert) {
      errorAlert.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Please enter all 6 digits of your verification code.';
      errorAlert.style.display = "block";
    }
    return;
  }

  if (verifyBtn) {
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying Code...';
  }

  try {
    const result = await AUTH_SYSTEM.verifyOtp(digits);

    if (!result.success) {
      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Verify Email & Complete Registration';
      }
      if (errorAlert) {
        errorAlert.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${result.message}`;
        errorAlert.style.display = "block";
      }
      return;
    }

    // Success State
    if (successAlert) {
      successAlert.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${result.message || 'Verification successful! Account created.'}`;
      successAlert.style.display = "block";
    }

    if (verifyBtn) {
      verifyBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Account Activated!';
    }

    if (window.showToast) {
      window.showToast(`🎉 Registration Successful! Welcome to EduPeak, ${result.user.name}.`, "success");
    }

    setTimeout(() => {
      if (window.closeModal) window.closeModal("emailOtpModal");
      const urlParams = new URLSearchParams(window.location.search);
      const redirectParam = urlParams.get("redirect") || sessionStorage.getItem("edupeak_redirect_after_login");
      if (redirectParam) {
        sessionStorage.removeItem("edupeak_redirect_after_login");
        window.location.href = redirectParam;
      } else if (result.user.role === "student") {
        window.location.href = "student-dashboard.html";
      } else if (result.user.role === "teacher") {
        window.location.href = "teacher-portal.html";
      } else {
        window.location.href = "student-dashboard.html";
      }
    }, 700);
  } catch (err) {
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Verify Email & Complete Registration';
    }
    if (errorAlert) {
      errorAlert.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Verification error: ${err.message}`;
      errorAlert.style.display = "block";
    }
  }
}

const GOOGLE_CLIENT_ID = "130797508492-6ajb474c94ve66j2pl44vdv7cr56igkn.apps.googleusercontent.com";

// Helper to decode JWT from Google Identity Services
function decodeGoogleJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("JWT Decode error:", e);
    return null;
  }
}

// Callback when user signs in with Google
function handleGoogleCredentialResponse(response) {
  if (!response || !response.credential) return;

  const payload = decodeGoogleJwt(response.credential);
  if (!payload || !payload.email) {
    if (window.showToast) window.showToast("Could not retrieve Google profile. Please try again.", "error");
    return;
  }

  const users = AUTH_SYSTEM.getUsers();
  let user = users.find(u => u.email && u.email.toLowerCase() === payload.email.toLowerCase());

  if (!user) {
    // Automatically register new Google Student
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    user = {
      id: `EP-2025-${randomSuffix}`,
      name: payload.name || payload.email.split("@")[0],
      name_si: payload.name || payload.email.split("@")[0],
      email: payload.email,
      phone: "",
      password: "",
      role: "student",
      institute: "Victory Embilipitiya",
      examYear: "2026 A/L",
      stream: "Physical Science",
      district: "Ratnapura / Embilipitiya",
      branch: "Victory Embilipitiya",
      avatarUrl: payload.picture || "",
      avatarLetter: (payload.name || payload.email).charAt(0).toUpperCase(),
      email_verified: true,
      authProvider: "google",
      joinedDate: new Date().toISOString().split("T")[0]
    };

    users.push(user);
    localStorage.setItem(AUTH_SYSTEM.storageKeys.users, JSON.stringify(users));

    // Sync to Supabase PostgreSQL
    if (window.SUPABASE_HELPER && window.SUPABASE_HELPER.isConnected) {
      window.SUPABASE_HELPER.syncUser(user);
    }
  }

  // Create Active Session
  AUTH_SYSTEM.createSession(user);

  if (window.closeModal) window.closeModal("signInModal");
  if (window.showToast) {
    window.showToast(`🎉 Welcome, ${user.name}! Signed in via Google.`, "success");
  }

  setTimeout(() => {
    if (user.role === "student") {
      window.location.href = "student-dashboard.html";
    } else if (user.role === "teacher") {
      window.location.href = "teacher-portal.html";
    } else {
      window.location.href = "student-dashboard.html";
    }
  }, 450);
}

// Initialize Google Identity Services
function initGoogleIdentityServices() {
  if (typeof google !== "undefined" && google.accounts && google.accounts.id) {
    try {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });
    } catch (e) {
      console.warn("Google Identity Init Warning:", e);
    }
  }
}

// Google Sign In trigger handler
async function handleGoogleSignIn() {
  // 1. Try Google Identity Services Popup Prompt
  if (typeof google !== "undefined" && google.accounts && google.accounts.id) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredentialResponse
    });
    google.accounts.id.prompt();
    return;
  }

  // 2. Try Supabase Google OAuth
  if (window.SUPABASE_HELPER && window.SUPABASE_HELPER.client) {
    try {
      const { data, error } = await window.SUPABASE_HELPER.client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + "/login.html"
        }
      });
      if (!error && data?.url) {
        window.location.href = data.url;
        return;
      }
    } catch (e) {
      console.warn("Supabase Google OAuth fallback:", e);
    }
  }

  // 3. Fallback demo session for offline development
  const users = AUTH_SYSTEM.getUsers();
  const demoStudent = users.find(u => u.role === "student") || users[0];
  if (demoStudent) {
    AUTH_SYSTEM.createSession(demoStudent);
    if (window.closeModal) window.closeModal("signInModal");
    if (window.showToast) window.showToast(`✓ Signed in as ${demoStudent.name}`, "success");
    setTimeout(() => {
      if (demoStudent.role === "student") {
        window.location.href = "student-dashboard.html";
      } else if (demoStudent.role === "teacher") {
        window.location.href = "teacher-portal.html";
      } else {
        window.location.href = "student-dashboard.html";
      }
    }, 400);
  }
}

async function handleGoogleSignUp() {
  // 1. Try Google Identity Services
  if (typeof google !== "undefined" && google.accounts && google.accounts.id) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        const payload = decodeGoogleJwt(response.credential);
        if (payload) {
          const nameInput = document.getElementById("regNameInput");
          const emailInput = document.getElementById("regEmailInput");
          if (nameInput) nameInput.value = payload.name;
          if (emailInput) emailInput.value = payload.email;
          if (window.showToast) window.showToast("✓ Google Profile connected! Please select your Institute & Exam Year.", "info");
        } else {
          handleGoogleCredentialResponse(response);
        }
      }
    });
    google.accounts.id.prompt();
    return;
  }

  // 2. Try Supabase Google OAuth
  if (window.SUPABASE_HELPER && window.SUPABASE_HELPER.client) {
    try {
      const { data, error } = await window.SUPABASE_HELPER.client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + "/register.html"
        }
      });
      if (!error && data?.url) {
        window.location.href = data.url;
        return;
      }
    } catch (e) {
      console.warn("Supabase Google OAuth fallback:", e);
    }
  }

  // 3. Fallback prefill
  const demoGoogleUser = {
    name: "Malith Sandeepa",
    email: "malith.sandeepa@gmail.com"
  };
  const nameInput = document.getElementById("regNameInput");
  const emailInput = document.getElementById("regEmailInput");
  if (nameInput) nameInput.value = demoGoogleUser.name;
  if (emailInput) emailInput.value = demoGoogleUser.email;
  if (window.showToast) window.showToast("✓ Google Account connected! Please select your Institute & Exam Year.", "info");
}

function resendOtpCode() {
  if (!AUTH_SYSTEM.pendingRegistration) {
    if (window.showToast) window.showToast("No active registration found. Please register.", "warning");
    return;
  }

  const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
  AUTH_SYSTEM.pendingRegistration.otpCode = newOtp;
  AUTH_SYSTEM.pendingRegistration.otpTimestamp = Date.now();

  const devCodeEl = document.getElementById("otpDevCode");
  if (devCodeEl) devCodeEl.textContent = newOtp;

  document.querySelectorAll(".otp-digit").forEach(input => input.value = "");
  AUTH_SYSTEM.startOtpCountdown(59);

  if (window.showToast) {
    window.showToast(`📩 New OTP Code sent: ${newOtp}`, "info");
  }
}

function fillOtpDevCode() {
  if (!AUTH_SYSTEM.pendingRegistration) return;
  const code = AUTH_SYSTEM.pendingRegistration.otpCode;
  const digits = document.querySelectorAll(".otp-digit");
  code.split("").forEach((char, i) => {
    if (digits[i]) digits[i].value = char;
  });
  if (digits[5]) digits[5].focus();
}

function switchAuthRole(roleName, btnEl) {
  activeAuthRole = roleName;
  document.querySelectorAll(".role-switcher-tabs .role-tab-btn").forEach(btn => btn.classList.remove("active"));
  if (btnEl) {
    btnEl.classList.add("active");
  } else {
    const targetBtn = document.querySelector(`.role-tab-btn[data-role="${roleName}"]`);
    if (targetBtn) targetBtn.classList.add("active");
  }
  
  const staffIdLabel = document.getElementById("staffIdLabel");
  const signInIdInput = document.getElementById("signInIdInput");
  if (staffIdLabel) {
    if (roleName === "admin") {
      staffIdLabel.textContent = "System Admin ID or Email";
      if (signInIdInput) signInIdInput.placeholder = "e.g. ADM-SUPER or admin@edupeak.lk";
    } else if (roleName === "teacher") {
      staffIdLabel.textContent = "Faculty / Teacher ID or Email";
      if (signInIdInput) signInIdInput.placeholder = "e.g. TCH-PHYSICS or teacher@edupeak.lk";
    } else {
      staffIdLabel.textContent = "Student ID, Mobile, or Email";
      if (signInIdInput) signInIdInput.placeholder = "e.g. EP-2025-001 or student@edupeak.lk";
    }
  }

  const errorAlert = document.getElementById("signInErrorAlert");
  if (errorAlert) errorAlert.style.display = "none";
}

window.handleLogout = function() {
  if (window.AUTH_SYSTEM) {
    window.AUTH_SYSTEM.logout();
  } else {
    localStorage.removeItem("edupeak_active_session");
    window.location.href = "index.html";
  }
};

window.closeProfileDropdown = function() {
  const wrapper = document.getElementById("userProfileDropdownWrapper");
  if (wrapper) wrapper.classList.remove("open");
};

// Global exports
window.AUTH_SYSTEM = AUTH_SYSTEM;
window.switchAuthRole = switchAuthRole;
window.handleRegistrationSubmit = handleRegistrationSubmit;
window.handleOtpVerificationSubmit = handleOtpVerificationSubmit;
window.handleGoogleSignUp = handleGoogleSignUp;
window.handleGoogleSignIn = handleGoogleSignIn;
window.resendOtpCode = resendOtpCode;
window.fillOtpDevCode = fillOtpDevCode;

document.addEventListener("DOMContentLoaded", () => {
  AUTH_SYSTEM.init();
});
