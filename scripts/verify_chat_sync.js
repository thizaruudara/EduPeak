const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function findChromePath() {
  const commonPaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(__dirname, '..', reqPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

async function run() {
  const port = 13399;
  await new Promise(resolve => server.listen(port, resolve));
  console.log(`Server running on port ${port}`);

  const executablePath = findChromePath();
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // 1. Student context (isolated profile)
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();

    // 2. Teacher context (completely separate browser context / incognito profile!)
    const teacherContext = await browser.newContext();
    const teacherPage = await teacherContext.newPage();

    const mockSession = {
      id: 'sched-physics-2027',
      topic: '2027 A/L Quantum Mechanics Masterclass',
      status: 'live',
      provider: 'youtube',
      rawUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?enablejsapi=1&rel=0',
      teacherName: 'Amalsha Wanniarachchi',
      scheduleTime: 'Today • 08:30 AM - 12:30 PM'
    };

    // Mock student user in student context
    await studentContext.addInitScript((sess) => {
      localStorage.setItem('edupeak_active_session', JSON.stringify({
        id: 'EP-2027-001',
        name: 'Kasun Jayasundara',
        role: 'student',
        nic: '200512345678',
        email: 'student@edupeak.lk'
      }));
      localStorage.setItem('edupeak_schedules_db', JSON.stringify([sess]));
      localStorage.setItem('edupeak_last_active_stream', sess.id);
    }, mockSession);

    // Mock teacher user in teacher context
    await teacherContext.addInitScript((sess) => {
      localStorage.setItem('edupeak_active_session', JSON.stringify({
        id: 'tch-amalsha',
        name: 'Amalsha Wanniarachchi',
        role: 'teacher',
        nic: '951234567V',
        email: 'amalsha@edupeak.lk'
      }));
      localStorage.setItem('edupeak_schedules_db', JSON.stringify([sess]));
      localStorage.setItem('edupeak_last_active_stream', sess.id);
    }, mockSession);

    console.log('Loading live-class.html on Student page...');
    await studentPage.goto(`http://127.0.0.1:${port}/live-class.html`, { waitUntil: 'domcontentloaded' });
    await studentPage.waitForTimeout(2000);

    const activeSessionId = await studentPage.evaluate(() => LIVE_APP.activeSessionId);
    console.log('Active session ID on student page:', activeSessionId);

    console.log('Loading live-class.html on Teacher page (separate isolated context)...');
    await teacherPage.goto(`http://127.0.0.1:${port}/live-class.html?stream=${activeSessionId}`, { waitUntil: 'domcontentloaded' });
    await teacherPage.waitForTimeout(2000);

    // Verify baseline greeting messages are present on both
    const teacherChatInitial = await teacherPage.locator('.chat-messages-container').innerText();
    console.log('Teacher initial chat contains greeting:', teacherChatInitial.includes('Welcome to the EduPeak Real-Time Live Classroom'));

    // Student sends 👍
    console.log('Student sends "👍" emoji message...');
    await studentPage.locator('#chatInputMessage').fill('👍');
    await studentPage.locator('#liveChatForm button[type="submit"]').click();
    await studentPage.waitForTimeout(1000);

    const studentChatAfter = await studentPage.locator('.chat-messages-container').innerText();
    console.log('Student chat has Kasun message:', studentChatAfter.includes('Kasun Jayasundara') && studentChatAfter.includes('👍'));

    // Wait up to 5 seconds for Teacher's polling / realtime to pick it up in isolated context
    console.log('Waiting for Teacher page to receive student message...');
    let teacherReceived = false;
    for (let i = 0; i < 10; i++) {
      await teacherPage.waitForTimeout(1000);
      const text = await teacherPage.locator('.chat-messages-container').innerText();
      if (text.includes('Kasun Jayasundara') && text.includes('👍')) {
        teacherReceived = true;
        console.log(`Teacher received student message successfully after ${i + 1}s!`);
        break;
      }
    }

    if (!teacherReceived) {
      console.error('FAIL: Teacher did not receive message!');
      const finalChat = await teacherPage.locator('.chat-messages-container').innerText();
      console.log('Teacher final chat contents:\n', finalChat);
      process.exitCode = 1;
    } else {
      console.log('SUCCESS: Cross-context live chat synchronization VERIFIED!');
    }

  } catch (err) {
    console.error('Error running test:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}

run();
