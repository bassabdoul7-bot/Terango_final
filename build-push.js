var fs = require('fs');

// 1. Backend push notification service
fs.writeFileSync('C:/Users/bassa/Projects/terango-final/backend/services/pushService.js',
`var { Expo } = require('expo-server-sdk');
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
`, 'utf8');
console.log('1. pushService.js created');

// 2. Add push token registration endpoint to authController
var authFile = 'C:/Users/bassa/Projects/terango-final/backend/controllers/authController.js';
var authCode = fs.readFileSync(authFile, 'utf8');

var registerPushCode = `
// @desc    Register push notification token
// @route   PUT /api/auth/push-token
// @access  Private
exports.registerPushToken = async (req, res) => {
  try {
    var { pushToken } = req.body;
    if (!pushToken) {
      return res.status(400).json({ success: false, message: 'Token requis' });
    }
    await User.findByIdAndUpdate(req.user._id, { pushToken: pushToken });
    res.json({ success: true, message: 'Token enregistr\\u00e9' });
  } catch (error) {
    console.error('Register Push Token Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
`;
authCode = authCode + registerPushCode;
fs.writeFileSync(authFile, authCode, 'utf8');
console.log('2. registerPushToken added to authController');

// 3. Add route for push token
var routeFile = 'C:/Users/bassa/Projects/terango-final/backend/routes/authRoutes.js';
var routeCode = fs.readFileSync(routeFile, 'utf8');

routeCode = routeCode.replace(
  "adminLogin\n}",
  "adminLogin,\n  registerPushToken\n}"
);

routeCode = routeCode.replace(
  "// Admin login",
  "// Push token\nrouter.put('/push-token', protect, registerPushToken);\n\n// Admin login"
);

fs.writeFileSync(routeFile, routeCode, 'utf8');
console.log('3. Push token route added');

// 4. Add push notifications to server.js socket events
var serverFile = 'C:/Users/bassa/Projects/terango-final/backend/server.js';
var serverCode = fs.readFileSync(serverFile, 'utf8');

// Add require at top - after existing requires
serverCode = serverCode.replace(
  "var adminRoutes = require('./routes/adminRoutes');",
  "var adminRoutes = require('./routes/adminRoutes');\nvar { sendPushNotification } = require('./services/pushService');"
);

fs.writeFileSync(serverFile, serverCode, 'utf8');
console.log('4. pushService imported in server.js');

console.log('\\nBackend push setup done! Now creating app-side code...');

// 5. Create notification helper for driver app (ES5 style)
fs.writeFileSync('C:/Users/bassa/Projects/terango-final/driver-app/src/services/notifications.js',
`var Notifications = require('expo-notifications');
var Device = require('expo-device');
var Platform = require('react-native').Platform;
var Alert = require('react-native').Alert;

Notifications.setNotificationHandler({
  handleNotification: function() {
    return Promise.resolve({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true
    });
  }
});

function registerForPushNotifications() {
  return new Promise(function(resolve) {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      resolve(null);
      return;
    }

    Notifications.getPermissionsAsync().then(function(status) {
      var finalStatus = status.status;
      if (finalStatus !== 'granted') {
        return Notifications.requestPermissionsAsync().then(function(askStatus) {
          return askStatus.status;
        });
      }
      return finalStatus;
    }).then(function(finalStatus) {
      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        resolve(null);
        return;
      }
      return Notifications.getExpoPushTokenAsync({
        projectId: require('expo-constants').default.expoConfig.extra
          ? require('expo-constants').default.expoConfig.extra.eas.projectId
          : undefined
      });
    }).then(function(tokenData) {
      if (tokenData) {
        console.log('Push token:', tokenData.data);
        resolve(tokenData.data);
      } else {
        resolve(null);
      }
    }).catch(function(err) {
      console.log('Push registration error:', err);
      resolve(null);
    });

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: true
      });
    }
  });
}

module.exports = { registerForPushNotifications: registerForPushNotifications };
`, 'utf8');
console.log('5. Driver app notifications.js created');

// 6. Create notification helper for rider app (modern syntax)
fs.writeFileSync('C:/Users/bassa/Projects/terango-final/rider-app/src/services/notifications.js',
`import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('Push token:', tokenData.data);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: true,
      });
    }

    return tokenData.data;
  } catch (error) {
    console.log('Push registration error:', error);
    return null;
  }
}
`, 'utf8');
console.log('6. Rider app notifications.js created');

console.log('\\nAll push notification files created!');
