var fs = require('fs');

// 1. Update driver app api.service.js
var driverApi = 'C:/Users/bassa/Projects/terango-final/driver-app/src/services/api.service.js';
var driverCode = fs.readFileSync(driverApi, 'utf8');

driverCode = driverCode.replace(
  "  sendOTP: (phone, mode) => api.post('/auth/send-otp', { phone, mode }),\n  verifyOTP: (phone, otp, name, role) =>\n    api.post('/auth/verify-otp', { phone, otp, name, role }),",
  "  sendOTP: (phone, mode) => api.post('/auth/send-otp', { phone, mode }),\n  verifyOTP: (phone, otp, name, role) =>\n    api.post('/auth/verify-otp', { phone, otp, name, role }),\n  register: (phone, name, email, pin, role) => api.post('/auth/register', { phone, name, email, pin, role }),\n  loginWithPin: (phone, pin) => api.post('/auth/login', { phone, pin }),\n  forgotPin: (phone) => api.post('/auth/forgot-pin', { phone }),\n  resetPin: (phone, otp, newPin) => api.post('/auth/reset-pin', { phone, otp, newPin }),"
);

fs.writeFileSync(driverApi, driverCode, 'utf8');
console.log('1. Driver api.service.js updated');

// 2. Update rider app api.service.js
var riderApi = 'C:/Users/bassa/Projects/terango-final/rider-app/src/services/api.service.js';
var riderCode = fs.readFileSync(riderApi, 'utf8');

// Check what the rider api looks like
var riderMatch = riderCode.match(/sendOTP.*?\n.*?verifyOTP.*?\n.*?verify-otp.*?\}/s);
if (riderMatch) {
  riderCode = riderCode.replace(riderMatch[0],
    riderMatch[0].replace('},', '},\n  register: (phone, name, email, pin, role) => api.post(\'/auth/register\', { phone, name, email, pin, role }),\n  loginWithPin: (phone, pin) => api.post(\'/auth/login\', { phone, pin }),\n  forgotPin: (phone) => api.post(\'/auth/forgot-pin\', { phone }),\n  resetPin: (phone, otp, newPin) => api.post(\'/auth/reset-pin\', { phone, otp, newPin }),')
  );
} else {
  // Try simpler approach
  riderCode = riderCode.replace(
    "verifyOTP: (phone, otp, name, role) =>",
    "register: (phone, name, email, pin, role) => api.post('/auth/register', { phone, name, email, pin, role }),\n  loginWithPin: (phone, pin) => api.post('/auth/login', { phone, pin }),\n  forgotPin: (phone) => api.post('/auth/forgot-pin', { phone }),\n  resetPin: (phone, otp, newPin) => api.post('/auth/reset-pin', { phone, otp, newPin }),\n  verifyOTP: (phone, otp, name, role) =>"
  );
}

fs.writeFileSync(riderApi, riderCode, 'utf8');
console.log('2. Rider api.service.js updated');

// 3. Update driver AuthContext to support PIN login
var driverAuth = 'C:/Users/bassa/Projects/terango-final/driver-app/src/context/AuthContext.js';
var driverAuthCode = fs.readFileSync(driverAuth, 'utf8');

// Add loginWithPin method
driverAuthCode = driverAuthCode.replace(
  "  const login = async (phone, otp, name = 'Driver', role = 'driver', vehicleInfo = null) => {\n    try {\n      const response = await authService.verifyOTP(phone, otp, name, role);",
  "  const loginWithPin = async (phone, pin) => {\n    try {\n      const response = await authService.loginWithPin(phone, pin);\n      if (response.success) {\n        await AsyncStorage.setItem('token', response.token);\n        await AsyncStorage.setItem('user', JSON.stringify(response.user));\n        setUser(response.user);\n        setIsAuthenticated(true);\n        await fetchDriverProfile();\n        registerForPushNotifications().then(function(token) {\n          if (token) authService.registerPushToken(token);\n        });\n        return response;\n      } else {\n        throw new Error(response.message || 'Login failed');\n      }\n    } catch (error) {\n      console.error('Login error:', error);\n      throw error;\n    }\n  };\n\n  const registerUser = async (phone, name, email, pin) => {\n    try {\n      const response = await authService.register(phone, name, email, pin, 'driver');\n      if (response.success) {\n        await AsyncStorage.setItem('token', response.token);\n        await AsyncStorage.setItem('user', JSON.stringify(response.user));\n        setUser(response.user);\n        setIsAuthenticated(true);\n        await fetchDriverProfile();\n        registerForPushNotifications().then(function(token) {\n          if (token) authService.registerPushToken(token);\n        });\n        return response;\n      } else {\n        throw new Error(response.message || 'Registration failed');\n      }\n    } catch (error) {\n      console.error('Register error:', error);\n      throw error;\n    }\n  };\n\n  const login = async (phone, otp, name = 'Driver', role = 'driver', vehicleInfo = null) => {\n    try {\n      const response = await authService.verifyOTP(phone, otp, name, role);"
);

// Add to provider value
driverAuthCode = driverAuthCode.replace(
  "        login,\n          logout,",
  "        login,\n          loginWithPin,\n          registerUser,\n          logout,"
);

fs.writeFileSync(driverAuth, driverAuthCode, 'utf8');
console.log('3. Driver AuthContext updated with loginWithPin and registerUser');

console.log('\\nDone! Verify syntax next.');
