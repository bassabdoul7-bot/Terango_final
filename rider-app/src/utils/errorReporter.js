import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://api.terango.sn/api/errors/report';

const reportError = async (screen, error, stack) => {
  try {
    var userId = null;
    try { var userData = await AsyncStorage.getItem('user'); if (userData) userId = JSON.parse(userData).id; } catch(e) {}
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: 'rider',
        screen: screen || 'unknown',
        error: error ? error.toString().substring(0, 200) : 'unknown',
        stack: stack ? stack.toString().substring(0, 500) : '',
        userId: userId,
        device: Platform.OS + ' ' + Platform.Version,
        version: '1.0.0'
      })
    }).catch(function(){});
  } catch(e) {}
};

export default reportError;
