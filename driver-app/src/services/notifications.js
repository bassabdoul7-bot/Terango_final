var Notifications = require('expo-notifications');
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
