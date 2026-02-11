var fs = require('fs');

// 1. Add registerPushToken to driver app api.service.js
var driverApi = 'C:/Users/bassa/Projects/terango-final/driver-app/src/services/api.service.js';
var driverApiCode = fs.readFileSync(driverApi, 'utf8');

// Find the authService object and add pushToken method
driverApiCode = driverApiCode.replace(
  "var authService = {",
  "var authService = {\n  registerPushToken: function(pushToken) { return api.put('/auth/push-token', { pushToken: pushToken }); },"
);

// Check if authService uses export or module pattern
if (driverApiCode.indexOf("var authService = {") === -1) {
  // Try const/let pattern
  driverApiCode = fs.readFileSync(driverApi, 'utf8');
  driverApiCode = driverApiCode.replace(
    "const authService = {",
    "const authService = {\n  registerPushToken: (pushToken) => api.put('/auth/push-token', { pushToken }),\n"
  );
}

fs.writeFileSync(driverApi, driverApiCode, 'utf8');
console.log('1. Driver api.service.js updated');

// 2. Add registerPushToken to rider app api.service.js
var riderApi = 'C:/Users/bassa/Projects/terango-final/rider-app/src/services/api.service.js';
var riderApiCode = fs.readFileSync(riderApi, 'utf8');

riderApiCode = riderApiCode.replace(
  "const authService = {",
  "const authService = {\n  registerPushToken: (pushToken) => api.put('/auth/push-token', { pushToken }),\n"
);

fs.writeFileSync(riderApi, riderApiCode, 'utf8');
console.log('2. Rider api.service.js updated');

// 3. Update driver app AuthContext - add push registration after login
var driverAuth = 'C:/Users/bassa/Projects/terango-final/driver-app/src/context/AuthContext.js';
var driverAuthCode = fs.readFileSync(driverAuth, 'utf8');

// Add import
driverAuthCode = driverAuthCode.replace(
  "import { authService, driverService } from '../services/api.service';",
  "import { authService, driverService } from '../services/api.service';\nimport { registerForPushNotifications } from '../services/notifications';"
);

// Add push registration after successful login
driverAuthCode = driverAuthCode.replace(
  "        await fetchDriverProfile();\n        return response;",
  "        await fetchDriverProfile();\n        // Register push notifications\n        registerForPushNotifications().then(function(token) {\n          if (token) authService.registerPushToken(token);\n        });\n        return response;"
);

// Also register on auto-login (checkAuth)
driverAuthCode = driverAuthCode.replace(
  "        if (driverData) {\n          setDriver(JSON.parse(driverData));\n        } else {\n          await fetchDriverProfile();\n        }",
  "        if (driverData) {\n          setDriver(JSON.parse(driverData));\n        } else {\n          await fetchDriverProfile();\n        }\n        // Register push on auto-login\n        registerForPushNotifications().then(function(token) {\n          if (token) authService.registerPushToken(token);\n        });"
);

fs.writeFileSync(driverAuth, driverAuthCode, 'utf8');
console.log('3. Driver AuthContext updated');

// 4. Update rider app AuthContext - add push registration after login
var riderAuth = 'C:/Users/bassa/Projects/terango-final/rider-app/src/context/AuthContext.js';
var riderAuthCode = fs.readFileSync(riderAuth, 'utf8');

// Add import
riderAuthCode = riderAuthCode.replace(
  "import { authService } from '../services/api.service';",
  "import { authService } from '../services/api.service';\nimport { registerForPushNotifications } from '../services/notifications';"
);

// Add push registration after successful login
riderAuthCode = riderAuthCode.replace(
  "        setIsAuthenticated(true);\n        return response;\n      } else {\n        throw new Error",
  "        setIsAuthenticated(true);\n        // Register push notifications\n        registerForPushNotifications().then((token) => {\n          if (token) authService.registerPushToken(token);\n        });\n        return response;\n      } else {\n        throw new Error"
);

// Also register on auto-login
riderAuthCode = riderAuthCode.replace(
  "        setUser(JSON.parse(userData));\n        setIsAuthenticated(true);\n      }",
  "        setUser(JSON.parse(userData));\n        setIsAuthenticated(true);\n        // Register push on auto-login\n        registerForPushNotifications().then((token) => {\n          if (token) authService.registerPushToken(token);\n        });\n      }"
);

fs.writeFileSync(riderAuth, riderAuthCode, 'utf8');
console.log('4. Rider AuthContext updated');

console.log('\\nDone! All push registration wired up.');
