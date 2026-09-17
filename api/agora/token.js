const { RtcTokenBuilder, RtcRole } = require('agora-token');

const AGORA_APP_ID = process.env.AGORA_APP_ID || '13256742c55e4a7687838c72cd148cad';
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '6b24a3938c7b4bdb8bb5267ebcd65a39';

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const channel = (req.query && req.query.channel) || 'edupeak_physics_live';
    const uid = parseInt((req.query && req.query.uid) || '0', 10);
    const roleParam = (req.query && req.query.role) || 'publisher';
    const role = roleParam === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;
    const days = parseInt((req.query && req.query.days) || '30', 10);
    const expireSeconds = Math.max(3600, days * 86400);

    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channel,
      uid,
      role,
      expireSeconds,
      expireSeconds
    );

    return res.status(200).json({
      success: true,
      token,
      appId: AGORA_APP_ID,
      channel,
      uid,
      role: roleParam === 'subscriber' ? 'subscriber' : 'publisher',
      expiresInSeconds: expireSeconds,
      expiresAt: new Date(Date.now() + expireSeconds * 1000).toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
