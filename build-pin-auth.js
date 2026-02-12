var fs = require('fs');

// 1. Add PIN field to User model
var userFile = 'C:/Users/bassa/Projects/terango-final/backend/models/User.js';
var userCode = fs.readFileSync(userFile, 'utf8');
userCode = userCode.replace(
  "password: { type: String, select: false },",
  "password: { type: String, select: false },\n  pin: { type: String, select: false },"
);
fs.writeFileSync(userFile, userCode, 'utf8');
console.log('1. User model - PIN field added');

// 2. Rewrite authController with new endpoints
var authFile = 'C:/Users/bassa/Projects/terango-final/backend/controllers/authController.js';
var authCode = fs.readFileSync(authFile, 'utf8');

// Add bcrypt and nodemailer requires at top
authCode = authCode.replace(
  "const User = require('../models/User');",
  "const User = require('../models/User');\nconst bcrypt = require('bcryptjs');\nconst nodemailer = require('nodemailer');"
);

// Add register with PIN endpoint
var registerCode = `

// @desc    Register new user with PIN
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    let { phone, name, email, pin, role } = req.body;

    if (!phone || !name || !pin || !role) {
      return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
    }

    if (pin.length !== 4 || !/^\\d{4}$/.test(pin)) {
      return res.status(400).json({ success: false, message: 'Le PIN doit contenir 4 chiffres' });
    }

    phone = formatPhoneNumber(phone);

    var existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Ce num\\u00e9ro est d\\u00e9j\\u00e0 enregistr\\u00e9' });
    }

    var hashedPin = await bcrypt.hash(pin, 10);

    var user = await User.create({
      phone: phone,
      name: name,
      email: email || '',
      pin: hashedPin,
      role: role,
      isVerified: true
    });

    if (role === 'rider') {
      var Rider = require('../models/Rider');
      await Rider.create({ userId: user._id });
    } else if (role === 'driver') {
      var Driver = require('../models/Driver');
      await Driver.create({ userId: user._id, verificationStatus: 'approved' });
    }

    var token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Compte cr\\u00e9\\u00e9 avec succ\\u00e8s',
      token: token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePhoto: user.profilePhoto,
        rating: user.rating
      }
    });
  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\\'inscription' });
  }
};

// @desc    Login with phone + PIN
// @route   POST /api/auth/login
// @access  Public
exports.loginWithPin = async (req, res) => {
  try {
    let { phone, pin } = req.body;

    if (!phone || !pin) {
      return res.status(400).json({ success: false, message: 'T\\u00e9l\\u00e9phone et PIN requis' });
    }

    phone = formatPhoneNumber(phone);

    var user = await User.findOne({ phone }).select('+pin');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Identifiants invalides' });
    }

    if (!user.pin) {
      return res.status(401).json({ success: false, message: 'Aucun PIN configur\\u00e9. Veuillez vous r\\u00e9inscrire.' });
    }

    var isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'PIN incorrect' });
    }

    var token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Connexion r\\u00e9ussie',
      token: token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePhoto: user.profilePhoto,
        rating: user.rating
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Erreur de connexion' });
  }
};

// @desc    Forgot PIN - send reset code to email
// @route   POST /api/auth/forgot-pin
// @access  Public
exports.forgotPin = async (req, res) => {
  try {
    let { phone } = req.body;
    phone = formatPhoneNumber(phone);

    var user = await User.findOne({ phone });
    if (!user || !user.email) {
      return res.status(404).json({ success: false, message: 'Aucun compte avec email trouv\\u00e9 pour ce num\\u00e9ro' });
    }

    var otp = generateOTP();
    await OTP.create({ phone: phone, otp: otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });

    var transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: '"TeranGO" <' + process.env.EMAIL_USER + '>',
      to: user.email,
      subject: 'R\\u00e9initialisation de votre PIN TeranGO',
      html: '<div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:20px;"><h2 style="color:#4CD964;">TeranGO</h2><p>Votre code de r\\u00e9initialisation:</p><h1 style="text-align:center;color:#4CD964;font-size:36px;letter-spacing:8px;">' + otp + '</h1><p>Ce code expire dans 10 minutes.</p></div>'
    });

    res.json({ success: true, message: 'Code envoy\\u00e9 \\u00e0 votre email' });
  } catch (error) {
    console.error('Forgot PIN Error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\\'envoi du code' });
  }
};

// @desc    Reset PIN with email OTP
// @route   POST /api/auth/reset-pin
// @access  Public
exports.resetPin = async (req, res) => {
  try {
    let { phone, otp, newPin } = req.body;

    if (!newPin || newPin.length !== 4 || !/^\\d{4}$/.test(newPin)) {
      return res.status(400).json({ success: false, message: 'Le PIN doit contenir 4 chiffres' });
    }

    phone = formatPhoneNumber(phone);

    var otpRecord = await OTP.findOne({ phone: phone, otp: otp, verified: false, expiresAt: { $gt: new Date() } });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Code invalide ou expir\\u00e9' });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    var hashedPin = await bcrypt.hash(newPin, 10);
    await User.findOneAndUpdate({ phone: phone }, { pin: hashedPin });

    res.json({ success: true, message: 'PIN r\\u00e9initialis\\u00e9 avec succ\\u00e8s' });
  } catch (error) {
    console.error('Reset PIN Error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la r\\u00e9initialisation' });
  }
};
`;

authCode = authCode + registerCode;
fs.writeFileSync(authFile, authCode, 'utf8');
console.log('2. Auth controller - register, loginWithPin, forgotPin, resetPin added');

// 3. Update auth routes
var routeFile = 'C:/Users/bassa/Projects/terango-final/backend/routes/authRoutes.js';
var routeCode = fs.readFileSync(routeFile, 'utf8');

routeCode = routeCode.replace(
  "registerPushToken\n}",
  "registerPushToken,\n  register,\n  loginWithPin,\n  forgotPin,\n  resetPin\n}"
);

routeCode = routeCode.replace(
  "// Push token",
  "// Register with PIN\nrouter.post('/register', register);\n\n// Login with PIN\nrouter.post('/login', loginWithPin);\n\n// Forgot PIN\nrouter.post('/forgot-pin', forgotPin);\n\n// Reset PIN\nrouter.post('/reset-pin', resetPin);\n\n// Push token"
);

fs.writeFileSync(routeFile, routeCode, 'utf8');
console.log('3. Auth routes updated');

console.log('\\nBackend PIN auth done! Now need to install nodemailer and update apps.');
