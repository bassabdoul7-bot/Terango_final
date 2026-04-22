var { Expo } = require('expo-server-sdk');
var User = require('../models/User');

var expo = new Expo();

// Pick the Expo push token that matches the target app. `role` is optional;
// when given ('driver' or 'rider') we prefer the role-specific token (so a
// dual-registered user's iPhone rider app doesn't steal driver pushes from
// their Android driver app). Falls back to the legacy single pushToken.
function resolvePushToken(user, role) {
  if (!user) return '';
  if (role === 'driver' && user.driverPushToken && Expo.isExpoPushToken(user.driverPushToken)) return user.driverPushToken;
  if (role === 'rider' && user.riderPushToken && Expo.isExpoPushToken(user.riderPushToken)) return user.riderPushToken;
  return user.pushToken && Expo.isExpoPushToken(user.pushToken) ? user.pushToken : '';
}

async function sendPushNotification(userId, title, body, data, role) {
  try {
    var user = await User.findById(userId);
    var token = resolvePushToken(user, role);
    if (!token) {
      console.log('No valid push token for user:', userId, 'role:', role || 'legacy');
      return;
    }

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
        // Retry once after 2 seconds
        try {
          await new Promise(function(resolve) { setTimeout(resolve, 2000); });
          await expo.sendPushNotificationsAsync(chunks[i]);
        } catch (retryErr) {
          console.error('Push send retry failed:', retryErr);
        }
      }
    }
    console.log('Push sent to', user.name, ':', title);
  } catch (error) {
    console.error('Push notification error:', error);
  }
}

async function sendPushToMultiple(userIds, title, body, data, role) {
  var messages = [];
  for (var i = 0; i < userIds.length; i++) {
    try {
      var user = await User.findById(userIds[i]);
      var token = resolvePushToken(user, role);
      if (token) {
        messages.push({
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
  if (messages.length === 0) return;
  var chunks = expo.chunkPushNotifications(messages);
  for (var j = 0; j < chunks.length; j++) {
    try {
      await expo.sendPushNotificationsAsync(chunks[j]);
    } catch (e) {
      // PUSH_TOO_MANY_EXPERIENCE_IDS: batch contained tokens from multiple
      // Expo projects (e.g. a dual-registered user has a rider-app token on
      // their user record while we're pushing to drivers). Fall back to
      // sending each message individually so the valid ones still land.
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
      // Retry once after 2 seconds
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
