var { Expo } = require('expo-server-sdk');
var User = require('../models/User');
var fcm = require('./fcmService');

var expo = new Expo();

// Pick the Expo push token that matches the target app. `role` is optional;
// when given ('driver' or 'rider') we prefer the role-specific token (so a
// dual-registered user's iPhone rider app doesn't steal driver pushes from
// their Android driver app). Falls back to the legacy single pushToken.
function tokenLooksValid(token) {
  if (!token || typeof token !== 'string') return false;
  return Expo.isExpoPushToken(token) || fcm.isFcmToken(token);
}

function resolvePushToken(user, role) {
  if (!user) return '';
  if (role === 'driver' && tokenLooksValid(user.driverPushToken)) return user.driverPushToken;
  if (role === 'rider' && tokenLooksValid(user.riderPushToken)) return user.riderPushToken;
  return tokenLooksValid(user.pushToken) ? user.pushToken : '';
}

// Route a single outbound push to the right transport based on token format.
async function sendSingle(token, title, body, data) {
  if (fcm.isFcmToken(token)) {
    try {
      await fcm.sendToToken(token, title, body, data);
    } catch (e) {
      console.error('[push] FCM send failed for', token.substring(0, 20) + '...:', e.message);
    }
    return;
  }
  // Assume Expo token
  var message = {
    to: token,
    sound: 'default',
    title: title,
    body: body,
    data: data || {}
  };
  var chunks = expo.chunkPushNotifications([message]);
  for (var i = 0; i < chunks.length; i++) {
    try {
      await expo.sendPushNotificationsAsync(chunks[i]);
    } catch (err) {
      console.error('Push send error:', err);
      try {
        await new Promise(function(r) { setTimeout(r, 2000); });
        await expo.sendPushNotificationsAsync(chunks[i]);
      } catch (retry) { console.error('Push retry failed:', retry); }
    }
  }
}

async function sendPushNotification(userId, title, body, data, role) {
  try {
    var user = await User.findById(userId);
    var token = resolvePushToken(user, role);
    if (!token) {
      console.log('No valid push token for user:', userId, 'role:', role || 'legacy');
      return;
    }
    await sendSingle(token, title, body, data);
    console.log('Push sent to', user.name, '(' + (fcm.isFcmToken(token) ? 'FCM' : 'Expo') + '):', title);
  } catch (error) {
    console.error('Push notification error:', error);
  }
}

async function sendPushToMultiple(userIds, title, body, data, role) {
  var expoMessages = [];
  var fcmTokens = [];
  for (var i = 0; i < userIds.length; i++) {
    try {
      var user = await User.findById(userIds[i]);
      var token = resolvePushToken(user, role);
      if (!token) continue;
      if (fcm.isFcmToken(token)) {
        fcmTokens.push(token);
      } else {
        expoMessages.push({
          to: token,
          sound: 'default',
          title: title,
          body: body,
          data: data || {}
        });
      }
    } catch (e) {
      console.error('Push notification failed:', e);
    }
  }

  // FCM path (Android native, direct to Google)
  if (fcmTokens.length > 0) {
    try {
      var fcmRes = await fcm.sendToMany(fcmTokens, title, body, data);
      console.log('[push] FCM multicast: ' + fcmRes.successCount + ' ok, ' + fcmRes.failureCount + ' failed');
    } catch (e) {
      console.error('[push] FCM multicast error:', e.message);
    }
  }

  // Expo path (legacy / iOS / unmigrated users)
  if (expoMessages.length === 0) return;
  var chunks = expo.chunkPushNotifications(expoMessages);
  for (var j = 0; j < chunks.length; j++) {
    try {
      await expo.sendPushNotificationsAsync(chunks[j]);
    } catch (e) {
      if (e && (e.code === 'PUSH_TOO_MANY_EXPERIENCE_IDS' ||
                (e.message && e.message.indexOf('same project') !== -1))) {
        console.log('Mixed-project push batch; falling back to per-token sends for ' + chunks[j].length + ' messages');
        for (var k = 0; k < chunks[j].length; k++) {
          try {
            await expo.sendPushNotificationsAsync([chunks[j][k]]);
          } catch (perErr) {
            console.error('Per-token push failed for ' + chunks[j][k].to + ':', perErr.message || perErr);
          }
        }
        continue;
      }
      console.error('Push notification failed:', e);
      try {
        await new Promise(function(resolve) { setTimeout(resolve, 2000); });
        await expo.sendPushNotificationsAsync(chunks[j]);
      } catch (retryErr) {
        console.error('Push notification retry failed:', retryErr);
      }
    }
  }
}

module.exports = { sendPushNotification, sendPushToMultiple };
