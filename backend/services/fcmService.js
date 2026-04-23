// Direct Firebase Cloud Messaging sender for Android pushes.
// Complements expo-server-sdk in pushService.js; pushService decides
// which transport to use based on token format.
//
// Requires the Firebase service account JSON at the path given by
// FCM_SERVICE_ACCOUNT_PATH (default: /root/terango-fcm-sa.json).
// The JSON is gitignored and lives only on the server.

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

var initialized = false;
var initError = null;

function initIfNeeded() {
  if (initialized || initError) return;
  var saPath = process.env.FCM_SERVICE_ACCOUNT_PATH || '/root/terango-fcm-sa.json';
  if (!fs.existsSync(saPath)) {
    initError = new Error('FCM service account JSON not found at ' + saPath);
    console.error('[fcm] ' + initError.message + ' - Android native pushes disabled');
    return;
  }
  try {
    var sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    initialized = true;
    console.log('[fcm] Firebase admin initialized for project', sa.project_id);
  } catch (e) {
    initError = e;
    console.error('[fcm] Failed to initialize firebase-admin:', e.message);
  }
}

function isReady() {
  initIfNeeded();
  return initialized;
}

// Raw FCM tokens look nothing like ExponentPushToken[...] -- they're long
// opaque strings often containing a colon. This heuristic is good enough
// in practice; anything that's NOT the Expo prefix is assumed to be FCM.
function isFcmToken(token) {
  if (!token || typeof token !== 'string') return false;
  if (token.indexOf('ExponentPushToken[') === 0) return false;
  return token.length > 20;
}

async function sendToToken(token, title, body, data) {
  initIfNeeded();
  if (!initialized) throw initError || new Error('FCM not initialized');
  var message = {
    token: token,
    notification: { title: String(title || ''), body: String(body || '') },
    data: Object.keys(data || {}).reduce(function(acc, k) { acc[k] = String(data[k]); return acc; }, {}),
    android: {
      priority: 'high',
      notification: { sound: 'default', channelId: 'default' }
    }
  };
  return admin.messaging().send(message);
}

async function sendToMany(tokens, title, body, data) {
  initIfNeeded();
  if (!initialized) throw initError || new Error('FCM not initialized');
  if (!tokens || tokens.length === 0) return { successCount: 0, failureCount: 0, responses: [] };
  var results = { successCount: 0, failureCount: 0, responses: [] };
  // firebase-admin sendEachForMulticast caps at 500 per call; we send well
  // under that in practice, but chunk defensively.
  for (var i = 0; i < tokens.length; i += 500) {
    var chunk = tokens.slice(i, i + 500);
    try {
      var res = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title: String(title || ''), body: String(body || '') },
        data: Object.keys(data || {}).reduce(function(acc, k) { acc[k] = String(data[k]); return acc; }, {}),
        android: {
          priority: 'high',
          notification: { sound: 'default', channelId: 'default' }
        }
      });
      results.successCount += res.successCount;
      results.failureCount += res.failureCount;
      results.responses = results.responses.concat(res.responses || []);
    } catch (e) {
      console.error('[fcm] sendEachForMulticast failed:', e.message);
      results.failureCount += chunk.length;
    }
  }
  return results;
}

module.exports = { isReady, isFcmToken, sendToToken, sendToMany };
