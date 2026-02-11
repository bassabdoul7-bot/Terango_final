var fs = require('fs');

// 1. Add password field to User model
var userFile = 'C:/Users/bassa/Projects/terango-final/backend/models/User.js';
var userCode = fs.readFileSync(userFile, 'utf8');
userCode = userCode.replace(
  "email: { type: String, trim: true, lowercase: true },",
  "email: { type: String, trim: true, lowercase: true },\n  password: { type: String, select: false },"
);
fs.writeFileSync(userFile, userCode, 'utf8');
console.log('1. User model updated with password field');

// 2. Add adminLogin to authController
var authFile = 'C:/Users/bassa/Projects/terango-final/backend/controllers/authController.js';
var authCode = fs.readFileSync(authFile, 'utf8');

var adminLoginCode = `
// @desc    Admin login with email/password
// @route   POST /api/auth/admin-login
// @access  Public
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
    }
    const user = await User.findOne({ email: email.toLowerCase(), role: 'admin' }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Identifiants invalides' });
    }
    if (!user.password) {
      return res.status(401).json({ success: false, message: 'Mot de passe non configur\u00e9. Contactez le support.' });
    }
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Identifiants invalides' });
    }
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true,
      token: token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone }
    });
  } catch (error) {
    console.error('Admin Login Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
`;

authCode = authCode + adminLoginCode;
fs.writeFileSync(authFile, authCode, 'utf8');
console.log('2. adminLogin added to authController');

// 3. Add admin login route
var routeFile = 'C:/Users/bassa/Projects/terango-final/backend/routes/authRoutes.js';
var routeCode = fs.readFileSync(routeFile, 'utf8');

// Add adminLogin to imports
routeCode = routeCode.replace(
  "const { sendOTP, verifyOTP",
  "const { sendOTP, verifyOTP, adminLogin"
);

// Add route before module.exports
routeCode = routeCode.replace(
  "module.exports = router;",
  "// Admin login\nrouter.post('/admin-login', adminLogin);\n\nmodule.exports = router;"
);

fs.writeFileSync(routeFile, routeCode, 'utf8');
console.log('3. Admin login route added');

// 4. Update admin dashboard API service
var apiFile = 'C:/Users/bassa/Projects/terango-final/admin-dashboard/src/services/api.js';
var apiCode = fs.readFileSync(apiFile, 'utf8');
apiCode = apiCode.replace(
  "login: function(phone, otp) { return api.post('/auth/verify-otp', { phone: phone, otp: otp }); },\n  sendOTP: function(phone) { return api.post('/auth/send-otp', { phone: phone, mode: 'login' }); }",
  "login: function(email, password) { return api.post('/auth/admin-login', { email: email, password: password }); }"
);
fs.writeFileSync(apiFile, apiCode, 'utf8');
console.log('4. Admin API service updated');

// 5. Rewrite LoginPage with email/password
var loginFile = 'C:/Users/bassa/Projects/terango-final/admin-dashboard/src/pages/LoginPage.jsx';
var loginCode = `import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';

export default function LoginPage() {
  var [email, setEmail] = useState('');
  var [password, setPassword] = useState('');
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState('');
  var { login } = useAuth();
  var navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    authService.login(email, password).then(function(res) {
      if (res.success) {
        login(res.token, res.user);
        navigate('/');
      } else {
        setError(res.message || 'Erreur de connexion');
        setLoading(false);
      }
    }).catch(function(err) {
      setError(err.message || 'Identifiants invalides');
      setLoading(false);
    });
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-emerald-400 mb-2">TeranGO</h1>
          <p className="text-gray-500">Panneau d'administration</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-6">Connexion</h2>
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-red-400 text-sm">{error}</div>}
          <form onSubmit={handleSubmit}>
            <label className="block text-sm text-gray-400 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={function(e) { setEmail(e.target.value); }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white mb-4 focus:outline-none focus:border-emerald-500"
              placeholder="admin@terango.sn"
              required
            />
            <label className="block text-sm text-gray-400 mb-2">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={function(e) { setPassword(e.target.value); }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white mb-6 focus:outline-none focus:border-emerald-500"
              placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
              required
            />
            <button type="submit" disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync(loginFile, loginCode, 'utf8');
console.log('5. LoginPage rewritten with email/password');

console.log('\\nDone! Now install bcryptjs and set admin password.');
