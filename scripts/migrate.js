const { Client } = require('pg');

const client = new Client({
  host: 'db.hkonbtrxmsxisggcxpww.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'Thisaru@20070310',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

const schema = `
-- 1. Create PROFILES Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_si TEXT,
    email TEXT,
    phone TEXT,
    password TEXT,
    role TEXT DEFAULT 'student',
    stream TEXT,
    stream_si TEXT,
    branch TEXT,
    status TEXT DEFAULT 'active',
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
    teacher TEXT NOT NULL,
    teacher_id TEXT,
    stream TEXT NOT NULL,
    price TEXT,
    fee_numeric NUMERIC DEFAULT 0,
    icon TEXT DEFAULT 'fa-book',
    badge TEXT,
    badge_si TEXT,
    mode TEXT DEFAULT 'Hybrid (Physical + Live Stream)',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create ENROLLMENTS Table
CREATE TABLE IF NOT EXISTS public.enrollments (
    id BIGSERIAL PRIMARY KEY,
    student_id TEXT,
    course_id TEXT,
    payment_status TEXT DEFAULT 'paid',
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable Row Level Security (RLS) & Public Read/Write Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view teachers' AND tablename = 'teachers') THEN
    CREATE POLICY "Public can view teachers" ON public.teachers FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view courses' AND tablename = 'courses') THEN
    CREATE POLICY "Public can view courses" ON public.courses FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view and insert profiles' AND tablename = 'profiles') THEN
    CREATE POLICY "Public can view and insert profiles" ON public.profiles FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view and insert enrollments' AND tablename = 'enrollments') THEN
    CREATE POLICY "Public can view and insert enrollments" ON public.enrollments FOR ALL USING (true);
  END IF;
END
$$;

-- 6. Insert Default Faculty Members
INSERT INTO public.teachers (id, name, name_si, subject, subject_si, degree, image, stream) VALUES
('tch-1', 'Eng. Dhanushka Senanayake', 'ඉංජි. ධනුෂ්ක සේනානායක', 'Combined Mathematics', 'සංයුක්ත ගණිතය', 'B.Sc. (Eng) Hons (University of Moratuwa)', 'assets/img/teacher_maths.jpg', 'maths'),
('tch-2', 'Prof. Sanath Wickramasinghe', 'මහාචාර්ය සනත් වික්‍රමසිංහ', 'Physics', 'භෞතික විද්‍යාව', 'B.Sc. (Hons) Sp, M.Sc., Ph.D. (Peradeniya)', 'assets/img/teacher_physics.jpg', 'maths'),
('tch-3', 'Dr. Charith Jayasuriya', 'ආචාර්ය චරිත් ජයසූරිය', 'Chemistry', 'රසායන විද්‍යාව', 'B.Sc. (Hons) Special (USJ), Ph.D. (UK)', 'assets/img/teacher_chemistry.jpg', 'science'),
('tch-4', 'Dr. Ruwanthi Fernando', 'වෛද්‍ය රුවන්ති ප්‍රනාන්දු', 'Biology', 'ජීව විද්‍යාව', 'MBBS (Colombo), MD (Senior Lecturer)', 'assets/img/teacher_biology.jpg', 'science'),
('tch-5', 'Lec. Kavinda Alwis', 'කථිකාචාර්ය කාවින්ද අල්විස්', 'Information & Communication Tech (ICT)', 'තොරතුරු තාක්ෂණය (ICT)', 'B.Sc. (Hons) Computing, MBCS, M.Sc.', 'assets/img/teacher_ict.jpg', 'tech')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  degree = EXCLUDED.degree,
  image = EXCLUDED.image;

-- 7. Insert Default Courses
INSERT INTO public.courses (id, title, title_si, teacher, stream, price, icon) VALUES
('crs-cm-2025', '2025 A/L Combined Mathematics Master Theory & Revision', '2025 උසස් පෙළ සංයුක්ත ගණිතය පූර්ණ සිද්ධාන්ත හා පුනරීක්ෂණ', 'Eng. Dhanushka Senanayake', 'maths', 'Rs. 4,500 / month', 'fa-square-root-variable'),
('crs-phy-2025', '2025 A/L Physics Complete Theory + Practical Booster', '2025 උසස් පෙළ භෞතික විද්‍යාව සිද්ධාන්ත හා ප්‍රායෝගික පරීක්ෂණ', 'Prof. Sanath Wickramasinghe', 'maths', 'Rs. 4,500 / month', 'fa-atom'),
('crs-chem-2025', '2025 A/L Chemistry Organic & Inorganic Accelerated', '2025 උසස් පෙළ රසායන විද්‍යාව කාබනික හා අකාබනික විශේෂ පාඨමාලාව', 'Dr. Charith Jayasuriya', 'science', 'Rs. 4,500 / month', 'fa-flask-vial'),
('crs-bio-2025', '2025 A/L Biology Resource Book Precision Masterclass', '2025 උසස් පෙළ ජීව විද්‍යාව සම්පත් පොත සම්පූර්ණ විවරණය', 'Dr. Ruwanthi Fernando', 'science', 'Rs. 4,500 / month', 'fa-dna'),
('crs-ict-2025', '2025 A/L ICT Python Programming & Networking Specialist', '2025 උසස් පෙළ ICT පයිතන් ක්‍රමලේඛනය සහ පරිගණක ජාලකරණය', 'Lec. Kavinda Alwis', 'tech', 'Rs. 4,000 / month', 'fa-network-wired')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  teacher = EXCLUDED.teacher,
  price = EXCLUDED.price;

-- 8. Insert Default Profiles
INSERT INTO public.profiles (id, name, name_si, email, phone, password, role, stream, branch, avatar_letter) VALUES
('ADM-001', 'Campus Registrar Admin', 'පරිපාලන නිලධාරී', 'admin@edupeak.lk', '0117592000', 'admin123', 'admin', 'All Streams', 'All Branches', 'A'),
('EP-2025-01', 'Kasun Jayasundara', 'කසුන් ජයසුන්දර', 'student@edupeak.lk', '0771234567', 'student123', 'student', 'Physical Science', 'Colombo Flagship', 'K')
ON CONFLICT (id) DO NOTHING;
`;

async function run() {
  try {
    console.log('Connecting to PostgreSQL on Supabase...');
    await client.connect();
    console.log('Connected! Executing schema migration...');
    await client.query(schema);
    console.log('✅ Schema migration completed successfully!');
    
    const res1 = await client.query('SELECT count(*) FROM public.teachers;');
    console.log('Teachers count in Supabase:', res1.rows[0].count);
    
    const res2 = await client.query('SELECT count(*) FROM public.courses;');
    console.log('Courses count in Supabase:', res2.rows[0].count);

    const res3 = await client.query('SELECT count(*) FROM public.profiles;');
    console.log('Profiles count in Supabase:', res3.rows[0].count);
    
    await client.end();
  } catch(err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
