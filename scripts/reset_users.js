const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.qebmrmxomuvdtrgkvpck:Edupeak12345!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function resetUsers() {
  try {
    console.log('Connecting to PostgreSQL on Supabase...');
    await client.connect();
    console.log('Connected!');

    console.log('Clearing all existing users in public.profiles...');
    await client.query('DELETE FROM public.profiles;');

    console.log('Inserting 3 canonical accounts: 1 Student, 1 Teacher, 1 Admin...');
    const insertQuery = `
      INSERT INTO public.profiles (id, name, name_si, email, phone, password, role, stream, branch, avatar_letter)
      VALUES
      ('EP-2025-001', 'Kasun Jayasundara', 'කසුන් ජයසුන්දර', 'student@edupeak.lk', '0771234567', 'student123', 'student', 'Physical Science', 'Victory Embilipitiya', 'K'),
      ('TCH-PHYSICS', 'Prof. K. M. Liyanage', 'මහාචාර්ය කේ. එම්. ලියනගේ', 'teacher@edupeak.lk', '0712345678', 'teacher123', 'teacher', 'Physical Science', 'Victory Embilipitiya', 'P'),
      ('ADM-SUPER', 'System Administrator', 'ප්‍රධාන පරිපාලක', 'admin@edupeak.lk', '0701234567', 'admin123', 'admin', 'All Streams', 'All Branches', 'A');
    `;
    await client.query(insertQuery);

    const res = await client.query('SELECT id, name, email, phone, password, role FROM public.profiles;');
    console.log('\n✅ User database successfully reset! Current accounts in Supabase:');
    console.table(res.rows);

    await client.end();
    console.log('Done!');
  } catch (err) {
    console.error('Error resetting users:', err);
    process.exit(1);
  }
}

resetUsers();
