/**
 * EduPeak Agora RTC Token Generator
 * Uses Agora AccessToken2 (Token007) algorithm to sign secure channels
 * with App ID: 13256742c55e4a7687838c72cd148cad and Primary Certificate: 6b24a3938c7b4bdb8bb5267ebcd65a39.
 */

const { RtcTokenBuilder, RtcRole } = require('agora-token');

const AGORA_APP_ID = process.env.AGORA_APP_ID || '13256742c55e4a7687838c72cd148cad';
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '6b24a3938c7b4bdb8bb5267ebcd65a39';

function generateAgoraRtcToken({
  channel = 'edupeak_physics_live',
  uid = 0,
  role = 'publisher',
  expireDays = 30,
  appId = AGORA_APP_ID,
  appCertificate = AGORA_APP_CERTIFICATE
} = {}) {
  const finalAppId = (appId || AGORA_APP_ID).trim();
  const finalCert = (appCertificate || AGORA_APP_CERTIFICATE).trim();
  const finalChannel = (channel || 'edupeak_physics_live').trim();
  const finalUid = parseInt(uid || '0', 10);
  const rtcRole = role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;
  const expireSeconds = Math.max(3600, parseInt(expireDays || 30, 10) * 86400);

  const token = RtcTokenBuilder.buildTokenWithUid(
    finalAppId,
    finalCert,
    finalChannel,
    finalUid,
    rtcRole,
    expireSeconds,
    expireSeconds
  );

  return {
    success: true,
    token,
    appId: finalAppId,
    channel: finalChannel,
    uid: finalUid,
    role: role === 'subscriber' ? 'subscriber' : 'publisher',
    expiresInSeconds: expireSeconds,
    expiresAt: new Date(Date.now() + expireSeconds * 1000).toISOString()
  };
}

module.exports = {
  AGORA_APP_ID,
  AGORA_APP_CERTIFICATE,
  generateAgoraRtcToken
};

// If run directly from terminal:
if (require.main === module) {
  const args = process.argv.slice(2);
  const channel = args[0] || 'edupeak_physics_live';
  const days = args[1] ? parseInt(args[1], 10) : 30;
  const res = generateAgoraRtcToken({ channel, expireDays: days });
  console.log('\n======================================================');
  console.log('⚡ EduPeak Agora AccessToken2 Generated Successfully');
  console.log('======================================================');
  console.log(`App ID:      ${res.appId}`);
  console.log(`Channel:     ${res.channel}`);
  console.log(`Valid For:   ${days} days (${res.expiresAt})`);
  console.log(`Token:       \n${res.token}\n`);
  console.log('======================================================\n');
}
