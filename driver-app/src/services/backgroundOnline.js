import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';

const LOCATION_TASK_NAME = 'terango-driver-heartbeat';
const API_URL = 'https://api.terango.sn/api';

// Define the task at module load so TaskManager can resume it after a cold start.
// Safe to call more than once — TaskManager dedupes by name.
TaskManager.defineTask(LOCATION_TASK_NAME, async function(input) {
  var data = input && input.data;
  var err = input && input.error;
  if (err) {
    console.error('Background heartbeat task error:', err);
    return;
  }
  if (!data || !data.locations || !data.locations[0] || !data.locations[0].coords) return;
  var loc = data.locations[0];
  try {
    var token = await SecureStore.getItemAsync('token');
    if (!token) return;
    await fetch(API_URL + '/driver/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      })
    });
  } catch (e) {
    console.error('Background heartbeat request failed:', e);
  }
});

export async function startBackgroundOnline() {
  try {
    var fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;
    // Foreground service with notification needs only ACCESS_FINE_LOCATION on
    // Android 10+; no ACCESS_BACKGROUND_LOCATION required (and avoiding it
    // sidesteps Play Console's sensitive-permission declaration).
    var alreadyStarted = false;
    try { alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME); } catch (e) { alreadyStarted = false; }
    if (alreadyStarted) return true;
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60000,
      distanceInterval: 0,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'TeranGO',
        notificationBody: 'Vous \u00eates en ligne \u2014 pr\u00eat pour les courses',
        notificationColor: '#00853F'
      }
    });
    return true;
  } catch (e) {
    console.error('startBackgroundOnline failed:', e);
    return false;
  }
}

export async function stopBackgroundOnline() {
  try {
    var started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (started) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch (e) {
    console.error('stopBackgroundOnline failed:', e);
  }
}
