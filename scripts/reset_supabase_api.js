const SUPABASE_URL = "https://hkonbtrxmsxisggcxpww.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__8XHrx1z8XIXWXRLvKE-ng_Ap2p1Ev0";

async function syncUsersNative() {
  try {
    console.log('Connecting to Supabase REST endpoint...');

    const headers = {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates"
    };

    const canonicalAccounts = [
      {
        id: "EP-2025-001",
        name: "Kasun Jayasundara",
        name_si: "කසුන් ජයසුන්දර",
        email: "student@edupeak.lk",
        phone: "0771234567",
        password: "student123",
        role: "student",
        stream: "Physical Science",
        branch: "Victory Embilipitiya",
        avatar_letter: "K"
      },
      {
        id: "TCH-PHYSICS",
        name: "Prof. K. M. Liyanage",
        name_si: "මහාචාර්ය කේ. එම්. ලියනගේ",
        email: "teacher@edupeak.lk",
        phone: "0712345678",
        password: "teacher123",
        role: "teacher",
        stream: "Physical Science",
        branch: "Victory Embilipitiya",
        avatar_letter: "P"
      },
      {
        id: "ADM-SUPER",
        name: "System Administrator",
        name_si: "ප්‍රධාන පරිපාලක",
        email: "admin@edupeak.lk",
        phone: "0701234567",
        password: "admin123",
        role: "admin",
        stream: "All Streams",
        branch: "All Branches",
        avatar_letter: "A"
      }
    ];

    console.log('Upserting canonical accounts via REST API...');
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers,
      body: JSON.stringify(canonicalAccounts)
    });

    console.log('Upsert status:', upsertRes.status, upsertRes.statusText);

    // Read back all users
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,name,email,phone,role,password`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (getRes.ok) {
      const users = await getRes.json();
      console.log('\n📊 Current Users in Supabase Cloud:');
      console.table(users);
    } else {
      const errText = await getRes.text();
      console.log('Fetch response:', errText);
    }
  } catch (err) {
    console.error('REST API Sync error:', err);
  }
}

syncUsersNative();
