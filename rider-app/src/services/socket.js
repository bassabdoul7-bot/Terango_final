import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';

var SOCKET_URL = 'https://api.terango.sn';

export async function createAuthSocket(options) {
  var token = await AsyncStorage.getItem('token');
  var socketOptions = {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    pingInterval: 10000,
    pingTimeout: 30000,
    auth: { token: token }
  };
  if (options) {
    Object.assign(socketOptions, options);
  }
  return io(SOCKET_URL, socketOptions);
}

export { SOCKET_URL };






