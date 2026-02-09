import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';

var SOCKET_URL = 'https://terango-api.fly.dev';

export async function createAuthSocket(options) {
  var token = await AsyncStorage.getItem('token');
  var socketOptions = {
    transports: ['websocket'],
    reconnection: true,
    auth: { token: token }
  };
  if (options) {
    Object.assign(socketOptions, options);
  }
  return io(SOCKET_URL, socketOptions);
}

export { SOCKET_URL };
