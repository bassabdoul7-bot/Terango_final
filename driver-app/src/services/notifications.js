// Driver-app push notifications via @react-native-firebase/messaging.
// Uses FCM directly (Android native) and APNs (iOS, handled by firebase auto).
// Token format: raw FCM token, NOT ExponentPushToken — backend pushService
// auto-detects and routes accordingly.

var messaging = require('@react-native-firebase/messaging').default;
var Platform = require('react-native').Platform;
var PermissionsAndroid = require('react-native').PermissionsAndroid;

async function requestNotificationPermission() {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      // Android 13+: runtime POST_NOTIFICATIONS permission
      var granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) return false;
    }
    var authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch (e) {
    console.error('Push permission error:', e);
    return false;
  }
}

async function registerForPushNotifications() {
  try {
    var granted = await requestNotificationPermission();
    if (!granted) {
      console.log('Push notification permission denied');
      return null;
    }
    var token = await messaging().getToken();
    if (!token) return null;
    console.log('FCM token:', token.substring(0, 20) + '...');
    return token;
  } catch (e) {
    console.error('Push registration error:', e);
    return null;
  }
}

// Foreground message handler — logs receipt. UI-relevant pushes (ride offers)
// are already delivered via socket when the app is foregrounded, so we don't
// need a local notification banner here.
function setupForegroundListener() {
  return messaging().onMessage(async function(remoteMessage) {
    console.log('FCM foreground message:', remoteMessage && remoteMessage.messageId);
  });
}

// Called once at module load (in App.js) to register the background handler.
// Must be set before the app is backgrounded; RN-firebase requires it at
// module scope, not inside a component.
function registerBackgroundHandler() {
  messaging().setBackgroundMessageHandler(async function(remoteMessage) {
    console.log('FCM background message:', remoteMessage && remoteMessage.messageId);
  });
}

module.exports = {
  registerForPushNotifications: registerForPushNotifications,
  setupForegroundListener: setupForegroundListener,
  registerBackgroundHandler: registerBackgroundHandler
};
