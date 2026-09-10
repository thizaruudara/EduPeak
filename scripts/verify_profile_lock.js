const http = require('http');

http.get('http://localhost:5050/profile.html', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status code:', res.statusCode);
    console.log('Has locked-input class:', data.includes('locked-input'));
    console.log('Has readonly on fullName:', data.includes('id="profileFullName" readonly'));
    console.log('Has readonly on studentId:', data.includes('id="profileStudentId" readonly'));
    console.log('Has readonly on nic:', data.includes('id="profileNic" readonly'));
    console.log('Has readonly on email:', data.includes('id="profileEmail" readonly'));
    console.log('Has readonly on phone:', data.includes('id="profilePhone" readonly'));
    console.log('Has disabled on examYear:', data.includes('id="profileExamYear" disabled'));
    console.log('Has disabled on stream:', data.includes('id="profileStream" disabled'));
    console.log('Has readonly on school:', data.includes('id="profileSchool" readonly'));
    console.log('Has readonly on district:', data.includes('id="profileDistrict" readonly'));
    console.log('Has readonly on address:', data.includes('id="profileAddress" rows="1" readonly'));
    console.log('Has locked security banner:', data.includes('locked-security-banner'));
    console.log('Has WhatsApp support request button:', data.includes('btn-whatsapp-support'));
    console.log('Has details locked button:', data.includes('btn-locked-status'));
  });
}).on('error', (err) => {
  console.error('Fetch error:', err.message);
});
