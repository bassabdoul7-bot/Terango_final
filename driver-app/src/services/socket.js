import * as SecureStore from 'expo-secure-store';
import io from 'socket.io-client';

var SOCKET_URL = 'https://api.terango.sn';

// Track disconnect callbacks
var disconnectCallbacks = [];

export function onDisconnect(callback) {
  disconnectCallbacks.push(callback);
  return function unsubscribe() {
    disconnectCallbacks = disconnectCallbacks.filter(function(cb) { return cb !== callback; });
  };
}

function isTokenExpired(token) {
  if (!token) return true;
  try {
    var parts = token.split('.');
    if (parts.length !== 3) return true;
    var payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    // Consider expired if less than 60 seconds remaining
    return (payload.exp * 1000) < (Date.now() + 60000);
  } catch (e) {
    return false;
  }
}

export async function createAuthSocket(options) {
  var token = await SecureStore.getItemAsync('token');

  // Check if token is expired before connecting
  if (isTokenExpired(token)) {
    // Try to get a fresh token (the auth context should have refreshed it)
    token = await SecureStore.getItemAsync('token');
    if (isTokenExpired(token)) {
      console.error('Socket: token is expired, forcing re-auth');
      // Emit a custom event for screens to handle
      disconnectCallbacks.forEach(function(cb) {
        try { cb('token_expired'); } catch (e) {}
      });
    }
  }

  var socketOptions = {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.3,
    pingInterval: 10000,
    pingTimeout: 30000,
    auth: { token: token }
  };
  if (options) {
    Object.assign(socketOptions, options);
  }
  var socket = io(SOCKET_URL, socketOptions);

  // Notify all disconnect listeners when socket disconnects
  socket.on('disconnect', function(reason) {
    console.error('Socket disconnected, reason:', reason);
    disconnectCallbacks.forEach(function(cb) {
      try { cb(reason); } catch (e) {}
    });
  });

  // On reconnect attempt, check if token needs refresh
  socket.on('reconnect_attempt', function() {
    SecureStore.getItemAsync('token').then(function(freshToken) {
      if (isTokenExpired(freshToken)) {
        console.error('Socket: token expired during reconnect, notifying listeners');
        disconnectCallbacks.forEach(function(cb) {
          try { cb('token_expired'); } catch (e) {}
        });
      } else if (freshToken && freshToken !== socket.auth.token) {
        socket.auth.token = freshToken;
      }
    }).catch(function(err) {
      console.error('Socket: failed to refresh token on reconnect:', err);
    });
  });

  return socket;
}

export { SOCKET_URL };
