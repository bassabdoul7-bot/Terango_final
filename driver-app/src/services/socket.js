import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';

var SOCKET_URL = 'http://178.104.14.252';

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

