var { Expo } = require('expo-server-sdk');
var User = require('../models/User');

var expo = new Expo();

async function sendPushNotification(userId, title, body, data) {
  try {
    var user = await User.findById(userId);
    if (!user || !user.pushToken || !Expo.isExpoPushToken(user.pushToken)) {
      console.log('No valid push token for user:', userId);
      return;
    }

    var message = {
      to: user.pushToken,
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
      }
    }
    console.log('Push sent to', user.name, ':', title);
  } catch (error) {
    console.error('Push notification error:', error);
  }
}

async function sendPushToMultiple(userIds, title, body, data) {
  var messages = [];
  for (var i = 0; i < userIds.length; i++) {
    try {
      var user = await User.findById(userIds[i]);
      if (user && user.pushToken && Expo.isExpoPushToken(user.pushToken)) {
        messages.push({
          to: user.pushToken,
          sound: 'default',
          title: title,
          body: body,
          data: data || {}
        });
      }
    } catch (e) {}
  }
  if (messages.length === 0) return;
  var chunks = expo.chunkPushNotifications(messages);
  for (var j = 0; j < chunks.length; j++) {
    try { await expo.sendPushNotificationsAsync(chunks[j]); } catch (e) {}
  }
}

module.exports = { sendPushNotification, sendPushToMultiple };
