import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

var API_URL = 'https://api.terango.sn/api/logs';
var BATCH_URL = 'https://api.terango.sn/api/logs/batch';
var SOURCE = 'rider-app';
var BUFFER_KEY = '@terango_log_buffer';
var MAX_BUFFER = 20;
var FLUSH_INTERVAL = 60000; // 60 seconds

var logBuffer = [];
var flushTimer = null;

function getDeviceInfo() {
  return {
    platform: Platform.OS,
    osVersion: String(Platform.Version),
    appVersion: '1.0.0',
    deviceModel: Platform.OS === 'ios' ? 'iPhone' : 'Android'
  };
}

async function getUserId() {
  try {
    var userData = await AsyncStorage.getItem('user');
    if (userData) return JSON.parse(userData).id || '';
  } catch(e) {}
  return '';
}

async function flushLogs() {
  if (logBuffer.length === 0) return;
  var logsToSend = logBuffer.splice(0, logBuffer.length);
  try {
    var res = await fetch(BATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: logsToSend })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    await AsyncStorage.removeItem(BUFFER_KEY).catch(function() {});
  } catch(e) {
    try {
      var existing = await AsyncStorage.getItem(BUFFER_KEY);
      var saved = existing ? JSON.parse(existing) : [];
      saved = saved.concat(logsToSend).slice(-MAX_BUFFER);
      await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(saved));
    } catch(err) {}
  }
}

function bufferLog(entry) {
  logBuffer.push(entry);
  if (logBuffer.length >= MAX_BUFFER) flushLogs();
}

var reportError = async function(screen, error, stack) {
  try {
    var userId = await getUserId();
    var entry = {
      level: 'error',
      source: SOURCE,
      screen: screen || 'unknown',
      message: error ? error.toString().substring(0, 2000) : 'unknown',
      stack: stack ? stack.toString().substring(0, 5000) : '',
      userId: userId,
      deviceInfo: getDeviceInfo(),
      metadata: {},
      createdAt: new Date().toISOString()
    };
    bufferLog(entry);
    // Also send immediately for errors
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    }).catch(function() {});
  } catch(e) {}
};

reportError.log = function(level, screen, message, metadata) {
  getUserId().then(function(userId) {
    bufferLog({
      level: level || 'info',
      source: SOURCE,
      screen: screen || '',
      message: (message || '').substring(0, 2000),
      stack: '',
      userId: userId,
      deviceInfo: getDeviceInfo(),
      metadata: metadata || {},
      createdAt: new Date().toISOString()
    });
  }).catch(function() {});
};

reportError.init = function() {
  // Flush persisted logs from previous session
  AsyncStorage.getItem(BUFFER_KEY).then(function(data) {
    if (data) {
      var saved = JSON.parse(data);
      if (saved.length > 0) {
        logBuffer = logBuffer.concat(saved);
        flushLogs();
      }
    }
  }).catch(function() {});

  // Periodic flush
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = setInterval(flushLogs, FLUSH_INTERVAL);
};

export default reportError;
