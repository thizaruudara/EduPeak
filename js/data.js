/**
 * EduPeak Educational Institute & LMS - Master Data Repository
 * Bilingual content (Sinhala & English) for Sri Lankan A/L, O/L & Professional Studies
 */

const EDUPEAK_DATA = {
  institution: {
    name: "EduPeak Higher Educational Institute",
    name_si: "එඩියුපීක් උසස් අධ්‍යාපන ආයතනය",
    tagline: "Empowering Sri Lanka's Future Leaders with Hybrid Smart Learning",
    tagline_si: "ස්මාර්ට් තාක්ෂණයෙන් සවිබල ගැන්වූ ශ්‍රී ලංකාවේ ප්‍රමුඛතම උසස් අධ්‍යාපන පීඨය",
    hotline: "+94 76 068 7578",
    whatsapp: "+94 76 068 7578",
    whatsappLink: "https://wa.me/94760687578",
    email: "info@edupeak.lk",
    address: "No. 450, High Level Road, Nugegoda, Colombo, Sri Lanka",
    stats: {
      activeStudents: "1,000+",
      lectureHours: "20,000+ Hrs",
      passRate: "90%"
    }
  },

  teachers: [
    {
      id: "tch-physics",
      name: "Amalsha Wanniarachchi",
      name_si: "අමල්ෂ වන්නිආරච්චි",
      subject: "G.C.E. Advanced Level Physics (භෞතික විද්‍යාව)",
      subject_si: "උසස් පෙළ භෞතික විද්‍යාව",
      degree: "MBBS (UG / University of Sri Jayewardenepura)",
      degree_si: "ශ්‍රී ජයවර්ධනපුර විශ්වවිද්‍යාලයේ වෛද්‍ය පීඨය (MBBS UG)",
      designation: "Senior Physics Master Educator & Medical Scholar",
      designation_si: "ප්‍රධාන භෞතික විද්‍යා දේශක",
      image: "assets/img/hero_lecturer.png",
      experience: "Academic Excellence & Top Island Results",
      experience_si: "විශිෂ්ට ඉගැන්වීම් පළපුරුද්ද හා විශිෂ්ට ප්‍රතිඵල",
      rating: 4.99,
      studentsCount: "15,000+",
      branches: ["Victory Embilipitiya", "EduPeak Institute"],
      branches_si: ["වික්ටරි ඇඹිලිපිටිය", "එඩියුපීක් ආයතනය"],
      stream: "Physical Science",
      stream_si: "භෞතික විද්‍යා අංශය",
      badge: "Medical Scholar & Master Educator",
      badge_si: "වෛද්‍ය විද්‍යාර්ථී හා ප්‍රධාන දේශක",
      bio: "Amalsha Wanniarachchi is a medical scholar (MBBS UG, University of Sri Jayewardenepura) and leading Advanced Level Physics master educator at Victory Embilipitiya, renowned for analytical concept breakdown, speed MCQ problem-solving methods, and structured paper discussions.",
      bio_si: "අමල්ෂ වන්නිආරච්චි යනු ශ්‍රී ජයවර්ධනපුර විශ්වවිද්‍යාලයේ වෛද්‍ය විද්‍යාර්ථියෙකු (MBBS UG) වන අතර වික්ටරි ඇඹිලිපිටිය ප්‍රධාන භෞතික විද්‍යා දේශකවරයාය.",
      schedule: "Every Saturday 7:30 AM - 1:30 PM (Theory) | Every Monday 7:00 PM (Paper Class)",
      previewLesson: {
        title: "Rotational Dynamics & Hydrodynamics Masterclass",
        title_si: "ඝූර්ණක චලිතය සහ ද්‍රවස්ථිතික විද්‍යාව",
        duration: "45 mins",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ"
      }
    }
  ],

  courses: [
    {
      id: "crs-phy-2027-theory",
      category: "theory",
      examYear: "2027 A/L",
      title: "2027 A/L Physics - Complete Theory & Mechanics Masterclass",
      title_si: "2027 උ/පෙළ භෞතික විද්‍යාව - පූර්ණ සිද්ධාන්ත හා යාන්ත්‍ර විද්‍යාව",
      teacherId: "tch-physics",
      teacherName: "Amalsha Wanniarachchi",
      stream: "Physical Science",
      stream_si: "භෞතික විද්‍යා අංශය",
      medium: "Sinhala & English Medium",
      medium_si: "සිංහල හා ඉංග්‍රීසි මාධ්‍ය",
      level: "2027 A/L",
      level_si: "2027 උ/පෙළ",
      rating: 4.99,
      students: 5400,
      fee: "LKR 3,500 / Month",
      fee_si: "රු. 3,500 / මාසිකව",
      badge: "2027 Theory Masterclass",
      badge_si: "2027 සිද්ධාන්ත පන්තිය",
      modulesCount: 28,
      liveTime: "Every Saturday 7:30 AM",
      thumbnailIcon: "fa-atom",
      color: "from-blue-600 to-indigo-600"
    },
    {
      id: "crs-phy-2027-revision",
      category: "revision",
      examYear: "2027 A/L",
      title: "2027 A/L Physics - Rapid Unit Revision & Model Paper Class",
      title_si: "2027 උ/පෙළ භෞතික විද්‍යාව - වේගවත් ඒකක පුනරීක්ෂණය සහ ප්‍රශ්න පත්‍ර සාකච්ඡාව",
      teacherId: "tch-physics",
      teacherName: "Amalsha Wanniarachchi",
      stream: "Physical Science",
      stream_si: "භෞතික විද්‍යා අංශය",
      medium: "Sinhala & English Medium",
      medium_si: "සිංහල හා ඉංග්‍රීසි මාධ්‍ය",
      level: "2027 A/L",
      level_si: "2027 උ/පෙළ",
      rating: 4.98,
      students: 4200,
      fee: "LKR 3,000 / Month",
      fee_si: "රු. 3,000 / මාසිකව",
      badge: "2027 Revision",
      badge_si: "2027 පුනරීක්ෂණ",
      modulesCount: 22,
      liveTime: "Every Wednesday 3:30 PM",
      thumbnailIcon: "fa-bolt",
      color: "from-amber-600 to-orange-600"
    },
    {
      id: "crs-phy-2028-theory",
      category: "theory",
      examYear: "2028 A/L",
      title: "2028 A/L Physics - Fundamental Principles & Units Masterclass",
      title_si: "2028 උ/පෙළ භෞතික විද්‍යාව - මිනුම් සහ මූලික සිද්ධාන්ත ආරම්භක පන්තිය",
      teacherId: "tch-physics",
      teacherName: "Amalsha Wanniarachchi",
      stream: "Physical Science",
      stream_si: "භෞතික විද්‍යා අංශය",
      medium: "Sinhala & English Medium",
      medium_si: "සිංහල හා ඉංග්‍රීසි මාධ්‍ය",
      level: "2028 A/L",
      level_si: "2028 උ/පෙළ",
      rating: 4.99,
      students: 3800,
      fee: "LKR 3,500 / Month",
      fee_si: "රු. 3,500 / මාසිකව",
      badge: "2028 New Batch",
      badge_si: "2028 නව කණ්ඩායම",
      modulesCount: 32,
      liveTime: "Every Sunday 7:30 AM",
      thumbnailIcon: "fa-calculator",
      color: "from-cyan-600 to-blue-600"
    },
    {
      id: "crs-phy-2028-paper",
      category: "papers",
      examYear: "2028 A/L",
      title: "2028 A/L Physics - 50 Timed Speed MCQ & Evaluation Arena",
      title_si: "2028 උ/පෙළ භෞතික විද්‍යාව - වේගවත් බහුවරණ 50ක් සහ ඇගයීම් පන්තිය",
      teacherId: "tch-physics",
      teacherName: "Amalsha Wanniarachchi",
      stream: "Physical Science",
      stream_si: "භෞතික විද්‍යා අංශය",
      medium: "Sinhala & English Medium",
      medium_si: "සිංහල හා ඉංග්‍රීසි මාධ්‍ය",
      level: "2028 A/L",
      level_si: "2028 උ/පෙළ",
      rating: 4.99,
      students: 3200,
      fee: "LKR 2,500 / Month",
      fee_si: "රු. 2,500 / මාසිකව",
      badge: "Speed MCQ Arena",
      badge_si: "වේගවත් MCQ",
      modulesCount: 20,
      liveTime: "Every Monday 7:00 PM",
      thumbnailIcon: "fa-stopwatch",
      color: "from-red-600 to-rose-600"
    },
    {
      id: "crs-phy-2029-theory",
      category: "theory",
      examYear: "2029 A/L",
      title: "2029 A/L Physics - Foundation & Future Scholars Starter",
      title_si: "2029 උ/පෙළ භෞතික විද්‍යාව - මූලික පදනම සහ ආරම්භක පන්තිය",
      teacherId: "tch-physics",
      teacherName: "Amalsha Wanniarachchi",
      stream: "Physical Science",
      stream_si: "භෞතික විද්‍යා අංශය",
      medium: "Sinhala & English Medium",
      medium_si: "සිංහල හා ඉංග්‍රීසි මාධ්‍ය",
      level: "2029 A/L",
      level_si: "2029 උ/පෙළ",
      rating: 4.99,
      students: 2100,
      fee: "LKR 3,500 / Month",
      fee_si: "රු. 3,500 / මාසිකව",
      badge: "2029 Foundation Batch",
      badge_si: "2029 ආරම්භක කණ්ඩායම",
      modulesCount: 30,
      liveTime: "Every Tuesday 3:30 PM",
      thumbnailIcon: "fa-lightbulb",
      color: "from-purple-600 to-indigo-600"
    }
  ],

  institutes: [
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
  ],

  lmsLessons: [
    {
      id: "les-01",
      courseId: "crs-phy-2027-theory",
      title: "Module 01: Complete Mechanics & Dynamic Equilibrium Masterclass",
      title_si: "මොඩියුලය 01: යාන්ත්‍ර විද්‍යාව සහ ගතික සමතුලිතතාව මාස්ටර්ක්ලාස්",
      teacher: "Amalsha Wanniarachchi (MBBS UG)",
      subject: "G.C.E. A/L Physics",
      duration: "2h 15m",
      views: "24.8k",
      status: "Completed",
      hasPdf: true,
      pdfName: "Physics_Mechanics_Master_Tute_2025.pdf",
      pdfUrl: "https://drive.google.com/file/d/1ExampleDrivePdfMechanics/view?usp=sharing",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      chapters: [
        { time: "00:00", title: "Vector Resolution & Coplanar Force Systems" },
        { time: "25:40", title: "Newton's 2nd Law & Variable Mass Systems" },
        { time: "58:15", title: "Past Paper Advanced Essay Problems (2015-2024)" },
        { time: "1:45:00", title: "MCQ Elimination Shortcuts & Exam Traps" }
      ],
      notes: "Key principle: For coplanar forces in equilibrium, ∑Fx = 0, ∑Fy = 0, and algebraic sum of moments about any axis ∑M = 0. Always choose a moment axis passing through the point of unknown reactions."
    },
    {
      id: "les-02",
      courseId: "crs-phy-2028-theory",
      title: "Module 02: Fundamental Principles, Dimensions & Units Masterclass",
      title_si: "මොඩියුලය 02: මිනුම් ඒකක, මාන සහ දෛශික මූලධර්ම",
      teacher: "Amalsha Wanniarachchi (MBBS UG)",
      subject: "G.C.E. A/L Physics",
      duration: "1h 45m",
      views: "19.4k",
      status: "In Progress",
      hasPdf: true,
      pdfName: "Physics_Units_Dimensions_Complete_Tute.pdf",
      pdfUrl: "https://drive.google.com/file/d/1ExampleDrivePdfUnits/view?usp=sharing",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      chapters: [
        { time: "00:00", title: "SI Base Units & Dimensional Homogeneity" },
        { time: "30:15", title: "Vernier Callipers & Micrometer Screw Gauge Zero Errors" },
        { time: "1:05:00", title: "Fractional and Percentage Error Propagation" }
      ],
      notes: "Remember: Fractional error in quantity Q = a^m * b^n is ΔQ/Q = m(Δa/a) + n(Δb/b). Constants with zero uncertainty do not contribute to error propagation."
    },
    {
      id: "les-03",
      courseId: "crs-phy-2027-revision",
      title: "Module 03: Rapid Unit Revision - Simple Harmonic Motion & Waves",
      title_si: "මොඩියුලය 03: ඒකක පුනරීක්ෂණය - සරල අනුවර්තී චලිතය සහ තරංග",
      teacher: "Amalsha Wanniarachchi (MBBS UG)",
      subject: "G.C.E. A/L Physics",
      duration: "2h 00m",
      views: "21.6k",
      status: "Available",
      hasPdf: true,
      pdfName: "Physics_SHM_Waves_Rapid_Revision.pdf",
      pdfUrl: "https://drive.google.com/file/d/1ExampleDrivePdfWaves/view?usp=sharing",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      chapters: [
        { time: "00:00", title: "SHM Acceleration Condition: a = -ω²x" },
        { time: "40:20", title: "Doppler Effect & Frequency Shift Calculations" },
        { time: "1:20:00", title: "Standing Waves in Organ Pipes & Resonance Tubes" }
      ],
      notes: "In Doppler effect: Observed frequency f' = f * (v ± vo) / (v ∓ vs), where v is speed of sound, vo is observer velocity, and vs is source velocity."
    },
    {
      id: "les-04",
      courseId: "crs-phy-2028-paper",
      title: "Module 04: 50 Timed Speed MCQ Arena - Past Paper & Model Test Breakdown",
      title_si: "මොඩියුලය 04: තත්පර 60 වේගවත් MCQ විසඳුම් ක්‍රම හා ආදර්ශ ප්‍රශ්නාවලි",
      teacher: "Amalsha Wanniarachchi (MBBS UG)",
      subject: "G.C.E. A/L Physics",
      duration: "1h 30m",
      views: "28.3k",
      status: "Available",
      hasPdf: true,
      pdfName: "50_Speed_MCQ_Model_Paper_01.pdf",
      pdfUrl: "https://drive.google.com/file/d/1ExampleDrivePdfMCQ/view?usp=sharing",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      chapters: [
        { time: "00:00", title: "Speed Tactic 01: Dimensional Analysis Elimination" },
        { time: "28:10", title: "Speed Tactic 02: Limiting Boundary Conditions (0 & ∞)" },
        { time: "55:40", title: "Full 25-Question Live Timed Speed Run" }
      ],
      notes: "When solving MCQs quickly, test extremes (θ = 0, θ = 90° or m1 >> m2) to eliminate 3 out of 5 choices without tedious algebra."
    }
  ],

  quizQuestions: [
    {
      id: 1,
      courseId: "crs-phy-2027-theory",
      subject: "Physics - Mechanics",
      subject_si: "භෞතික විද්‍යාව - යාන්ත්‍ර විද්‍යාව",
      question: "A projectile is launched with velocity u at an angle θ to the horizontal. At the highest point of its trajectory, what is its acceleration?",
      question_si: "තිරසට θ කෝණයකින් u ප්‍රවේගයෙන් ප්‍රක්ෂේපණය කළ වස්තුවක උපරිම උසෙහිදී ත්වරණය කුමක්ද?",
      options: [
        "g directed vertically downwards (සිරස්ව පහළට g)",
        "Zero (ශුන්‍ය වේ)",
        "g cos θ (g cos θ වේ)",
        "u cos θ (u cos θ වේ)"
      ],
      correctAnswer: 0,
      explanation: "Throughout the flight, the only force acting on the projectile is gravity (neglecting air resistance). Therefore, the acceleration is always g directed vertically downwards, including at the apex.",
      explanation_si: "ප්‍රක්ෂේපණ චලිතය පුරාම ක්‍රියාකරන්නේ ගුරුත්වාකර්ෂණ බලය පමණක් බැවින්, උපරිම උස ඇතුළු ඕනෑම ලක්ෂ්‍යයකදී ත්වරණය සිරස්ව පහළට g වේ."
    },
    {
      id: 2,
      courseId: "crs-phy-2027-theory",
      subject: "Physics - Oscillations & Waves",
      subject_si: "භෞතික විද්‍යාව - සරල අනුවර්තී චලිතය",
      question: "In simple harmonic motion (SHM), when the displacement from equilibrium is maximum (x = A), what is the velocity of the particle?",
      question_si: "සරල අනුවර්තී චලිතයක (SHM) විස්ථාපනය උපරිම වන මොහොතේ (x = A) අංශුවේ ප්‍රවේගය කුමක්ද?",
      options: [
        "Maximum velocity: v = ωA (උපරිම වේ)",
        "Zero velocity: v = 0 (ශුන්‍ය වේ)",
        "Half maximum: v = 0.5 ωA (උපරිමයෙන් අඩක් වේ)",
        "Constant non-zero (නියත අගයක් ගනී)"
      ],
      correctAnswer: 1,
      explanation: "In SHM, velocity v = ω √(A^2 - x^2). When displacement x = A (amplitude limit), v = ω √(A^2 - A^2) = 0.",
      explanation_si: "සරල අනුවර්තී චලිතයේ ප්‍රවේගය v = ω √(A^2 - x^2) වේ. විස්ථාපනය x = A (උපරිම විස්තාරය) වන විට, ප්‍රවේගය v = 0 (ශුන්‍ය) වේ."
    },
    {
      id: 3,
      courseId: "crs-phy-2027-revision",
      subject: "Physics - Thermal Physics",
      subject_si: "භෞතික විද්‍යාව - තාප භෞතික විද්‍යාව",
      question: "An ideal gas undergoes an adiabatic expansion. What is the relation between heat absorbed Q, work done W, and internal energy change ΔU?",
      question_si: "තාප පරිවාරක (Adiabatic) ප්‍රසාරණයකදී තාප හුවමාරුව Q, කළ කාර්යය W සහ අභ්‍යන්තර ශක්ති වෙනස ΔU අතර සම්බන්ධය කුමක්ද?",
      options: [
        "Q = 0 and ΔU = -W (තාප හුවමාරුව Q = 0 වන අතර ΔU = -W වේ)",
        "ΔU = 0 and Q = W (අභ්‍යන්තර ශක්ති වෙනස ශුන්‍ය වේ)",
        "W = 0 and Q = ΔU (කළ කාර්යය ශුන්‍ය වේ)",
        "Q = W + ΔU > 0 (තාපය පද්ධතිය තුළට ගලා එයි)"
      ],
      correctAnswer: 0,
      explanation: "In an adiabatic process, no heat enters or leaves the system (Q = 0). By the First Law of Thermodynamics ΔQ = ΔU + W, so ΔU = -W. Work is done at the expense of internal energy, causing cooling.",
      explanation_si: "තාප පරිවාරක ක්‍රියාවලියකදී තාප හුවමාරුව ශුන්‍ය වේ (Q = 0). තාපගති විද්‍යාවේ පළමු නියමය ΔQ = ΔU + W අනුව, 0 = ΔU + W හෙවත් ΔU = -W වේ. වායුවේ අභ්‍යන්තර ශක්තිය වැයවී උෂ්ණත්වය පහළ බසී."
    },
    {
      id: 4,
      courseId: "crs-phy-2027-revision",
      subject: "Physics - Electric Fields",
      subject_si: "භෞතික විද්‍යාව - විද්‍යුත් ක්ෂේත්‍ර",
      question: "Two point charges +q and +4q are separated by a distance d. At what distance from +q along the line joining them is the resultant electric field zero?",
      question_si: "+q සහ +4q ලක්ෂ්‍ය ආරෝපණ දෙකක් d දුරකින් තබා ඇත. +q ආරෝපණයේ සිට කුමන දුරකදී සම්ප්‍රයුක්ත විද්‍යුත් ක්ෂේත්‍ර තීව්‍රතාව ශුන්‍ය වේද?",
      options: [
        "d / 3",
        "d / 2",
        "d / 4",
        "2d / 3"
      ],
      correctAnswer: 0,
      explanation: "Let point be at distance x from +q. For E_net = 0: (1/4πε₀)(q/x^2) = (1/4πε₀)(4q/(d-x)^2). Taking square root: 1/x = 2/(d-x) => d - x = 2x => 3x = d => x = d/3.",
      explanation_si: "+q සිට දුර x නම්, ක්ෂේත්‍ර තීව්‍රතා සමතුලිත වීමට: q/x^2 = 4q/(d-x)^2 වේ. දෙපසම වර්ගමූලය ගත් විට 1/x = 2/(d-x) => d - x = 2x => 3x = d => x = d/3 වේ."
    },
    {
      id: 5,
      courseId: "crs-phy-2027-theory",
      subject: "Physics - Gravitation",
      subject_si: "භෞතික විද්‍යාව - ගුරුත්වාකර්ෂණ ක්ෂේත්‍ර",
      question: "If the radius of the Earth shrinks by 1% while its mass remains constant, what is the approximate percentage change in the gravitational acceleration g at the surface?",
      question_si: "පෘථිවියේ ස්කන්ධය නියතව තිබියදී අරය 1% කින් හැකිලුනහොත්, පෘෂ්ඨය මත ගුරුත්වාකර්ෂණ ත්වරණය g හි ආසන්න ප්‍රතිශත වෙනස කුමක්ද?",
      options: [
        "Increases by 2% (2% කින් වැඩිවේ)",
        "Decreases by 2% (2% කින් අඩුවේ)",
        "Increases by 1% (1% කින් වැඩිවේ)",
        "Remains unchanged (වෙනස් නොවේ)"
      ],
      correctAnswer: 0,
      explanation: "Surface gravity g = GM/R^2. Fractional change: dg/g = -2 (dR/R). If dR/R = -1% (shrinkage), dg/g = -2(-1%) = +2%. Thus g increases by approximately 2%.",
      explanation_si: "පෘෂ්ඨික ගුරුත්වජ ත්වරණය g = GM/R^2 වේ. ආසන්න වෙනස්වීම් සඳහා dg/g = -2 (dR/R) වේ. අරය 1% කින් අඩු වන විට (dR/R = -1%), dg/g = +2% ක් වේ. එනම් g ආසන්න වශයෙන් 2% කින් වැඩි වේ."
    },
    {
      id: 6,
      courseId: "crs-phy-2028-paper",
      subject: "Physics - Circular Motion",
      subject_si: "භෞතික විද්‍යාව - වෘත්ත චලිතය",
      question: "A car negotiates a curved horizontal road of radius R with friction coefficient μ. The maximum safe speed without skidding is:",
      question_si: "ඝර්ෂණ සංගුණකය μ වන R අරයක් සහිත තිරස් වක්‍ර මාර්ගයක ලිස්සා යාමකින් තොරව ධාවනය කළ හැකි උපරිම ආරක්ෂිත ප්‍රවේගය කුමක්ද?",
      options: [
        "√(μgR)",
        "μgR",
        "√(gR / μ)",
        "μ√(gR)"
      ],
      correctAnswer: 0,
      explanation: "Centripetal force is provided by limiting static friction: mv^2 / R = μmg => v = √(μgR).",
      explanation_si: "කේන්ද්‍රාභිසාරී බලය සපයන්නේ උපරිම ස්ථිතික ඝර්ෂණ බලය මගිනි: mv^2 / R = μmg => v = √(μgR) වේ."
    }
  ],

  faqs: [
    {
      q: "How do I enroll in EduPeak physical or online classes?",
      q_si: "එඩියුපීක් භෞතික හෝ මාර්ගගත පන්ති සඳහා ලියාපදිංචි වන්නේ කෙසේද?",
      a: "Click on the [Register] button in the top navigation, enter your details, select your Grade/Stream and preferred branch (Colombo, Kandy, Gampaha, Galle, or Online), and select the courses of your choice.",
      a_si: "ඉහළ මෙනුවේ ඇති [Register / ලියාපදිංචි වන්න] බොත්තම ක්ලික් කර ඔබගේ තොරතුරු ඇතුළත් කරන්න. ඉන්පසු ඔබගේ ශ්‍රේණිය, විභාග වර්ෂය සහ ශාඛාව තෝරා පාඨමාලා සඳහා ක්ෂණිකව ලියාපදිංචි විය හැක."
    },
    {
      q: "Can I watch missed live classes as recorded lectures?",
      q_si: "සජීවී පන්තියකට සහභාගී වීමට නොහැකි වුවහොත් පටිගත කිරීම් (Recordings) නැරඹිය හැකිද?",
      a: "Yes! All live sessions are automatically uploaded to your student LMS dashboard within 2 hours in 1080p HD quality, with unlimited access throughout the academic year.",
      a_si: "ඔව්! සියලුම සජීවී පන්ති අවසන් වූ වහාම පැය 2ක් ඇතුළත Ultra HD තත්ත්වයෙන් ඔබගේ ශිෂ්‍ය LMS ගිණුමට එකතු වන අතර වසර පුරා ඕනෑම වාර ගණනක් නැවත නැරඹිය හැක."
    },
    {
      q: "How are printed study packs and tutes delivered for online students?",
      q_si: "මාර්ගගතව (Online) ඉගෙනුම ලබන සිසුන්ට නිබන්ධන සහ ප්‍රශ්න පත්‍ර ලැබෙන්නේ කෙසේද?",
      a: "EduPeak Express Courier delivers your monthly printed book pack directly to your doorstep anywhere in Sri Lanka within 2-3 business days. Digital PDF copies are also instantly available in the LMS.",
      a_si: "එඩියුපීක් කුරියර් සේවාව මගින් දිවයිනේ ඕනෑම ප්‍රදේශයකට දින 2-3ක් ඇතුළත ඔබේ නිවසටම මුද්‍රිත නිබන්ධන කට්ටලය ගෙන්වා දෙනු ලැබේ. ඊට අමතරව ඩිජිටල් PDF පිටපත් LMS එකෙන් ක්ෂණිකව බාගත කරගත හැක."
    },
    {
      q: "What payment methods are supported on the EduPeak LMS?",
      q_si: "ගෙවීම් සිදුකළ හැකි ක්‍රමවේද මොනවාද?",
      a: "We support Visa/Mastercard credit/debit cards, LankaQR, Online Banking transfers, Frimi, Genie, and direct cash payments at any EduPeak branch counter or commercial bank deposit.",
      a_si: "Visa, Mastercard, LankaQR, බැංකු තැන්පතු, Frimi, Genie මෙන්ම ඕනෑම එඩියුපීක් ශාඛා කවුන්ටරයකින් සෘජුව මුදල් ගෙවා කාඩ්පත සක්‍රිය කරගත හැක."
    }
  ]
};

window.EDUPEAK_DATA = EDUPEAK_DATA;
