var Partner = require('../models/Partner');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const Rider = require('../models/Rider');
const Driver = require('../models/Driver');
const OTP = require('../models/OTP');
const { generateToken } = require('../utils/jwt');
const { generateOTP } = require('../utils/otp');
const { formatPhoneNumber, isValidSenegalPhone } = require('../utils/phone');

// @desc    Send OTP to phone number
// @route   POST /api/auth/send-otp
// @access  Public
exports.sendOTP = async (req, res) => {
  try {
    let { phone } = req.body;

    if (!isValidSenegalPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Numéro de téléphone invalide'
      });
    }

    phone = formatPhoneNumber(phone);

    if (req.body.mode === 'login') {
      const existingUser = await User.findOne({ phone });
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'Aucun compte trouvé avec ce numéro. Veuillez vous inscrire.'
        });
      }
    }

    const otp = generateOTP();

    await OTP.create({
      phone,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    console.log('OTP for', phone, ':', otp);

    res.status(200).json({
      success: true,
      message: 'Code OTP envoyé',
      phone
    });

  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'envoi du code OTP"
    });
  }
};

// @desc    Verify OTP and login/register
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
  try {
    let { phone, otp, name, role } = req.body;

    phone = formatPhoneNumber(phone);

    const otpRecord = await OTP.findOne({
      phone,
      otp,
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Code OTP invalide ou expiré'
      });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    let user = await User.findOne({ phone });

    if (!user) {
      if (!name || !role) {
        return res.status(400).json({
          success: false,
          message: "Nom et rôle requis pour l'inscription"
        });
      }

      user = await User.create({
        phone,
        name,
        role,
        isVerified: true
      });

      if (role === 'rider') {
        await Rider.create({ userId: user._id });
      } else if (role === 'driver') {
        await Driver.create({ userId: user._id });
      }
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: user.isNew ? 'Compte créé avec succès' : 'Connexion réussie',
      token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        profilePhoto: user.profilePhoto,
        rating: user.rating
      }
    });

  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du code'
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = req.user;

    let profileData = {};
    if (user.role === 'rider') {
      profileData = await Rider.findOne({ userId: user._id });
    } else if (user.role === 'driver') {
      profileData = await Driver.findOne({ userId: user._id });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePhoto: user.profilePhoto,
        rating: user.rating,
        totalRatings: user.totalRatings,
        ...profileData?._doc
      }
    });

  } catch (error) {
    console.error('Get Me Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, profilePhoto } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email, profilePhoto },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profil mis à jour',
      user
    });

  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil'
    });
  }
};

// @desc    Admin login with email/password
// @route   POST /api/auth/admin-login
// @access  Public
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
    }
    const user = await User.findOne({ email: email.toLowerCase(), role: { $in: ['admin', 'partner'] } }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Identifiants invalides' });
    }
    if (!user.password) {
      return res.status(401).json({ success: false, message: 'Mot de passe non configuré. Contactez le support.' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Identifiants invalides' });
    }
    const jwt = require('jsonwebtoken');
    // Check if partner is approved
    if (user.role === 'partner') {
      var partnerCheck = await Partner.findOne({ userId: user._id });
      if (!partnerCheck || partnerCheck.verificationStatus !== 'approved') {
        return res.status(403).json({ success: false, message: 'Votre compte partenaire est en attente de validation' });
      }
    }
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

// @desc    Register push notification token
// @route   PUT /api/auth/push-token
// @access  Private
exports.registerPushToken = async (req, res) => {
  try {
    var { pushToken } = req.body;
    if (!pushToken) {
      return res.status(400).json({ success: false, message: 'Token requis' });
    }
    await User.findByIdAndUpdate(req.user._id, { pushToken: pushToken });
    res.json({ success: true, message: 'Token enregistré' });
  } catch (error) {
    console.error('Register Push Token Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// @desc    Register new user with PIN
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    let { phone, name, email, pin, role } = req.body;

    if (!phone || !name || !pin || !role) {
      return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ success: false, message: 'Le PIN doit contenir 4 chiffres' });
    }

    phone = formatPhoneNumber(phone);

    var existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Ce numéro est déjà enregistré' });
    }

    if (email) {
      var existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'Cet email est déjà utilisé' });
      }
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
      var RiderModel = require('../models/Rider');
      await RiderModel.create({ userId: user._id });
    } else if (role === 'driver') {
      var DriverModel = require('../models/Driver');
      await DriverModel.create({ userId: user._id, verificationStatus: 'pending' });
    }

    var token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
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
    res.status(500).json({ success: false, message: "Erreur lors de l'inscription" });
  }
};

// @desc    Login with phone + PIN
// @route   POST /api/auth/login
// @access  Public
exports.loginWithPin = async (req, res) => {
  try {
    let { phone, pin } = req.body;

    if (!phone || !pin) {
      return res.status(400).json({ success: false, message: 'Téléphone et PIN requis' });
    }

    phone = formatPhoneNumber(phone);

    var user = await User.findOne({ phone }).select('+pin');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Identifiants invalides' });
    }

    if (!user.pin) {
      return res.status(401).json({ success: false, message: 'Aucun PIN configuré. Veuillez vous réinscrire.' });
    }

    var isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'PIN incorrect' });
    }

    var token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Connexion réussie',
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
      return res.status(404).json({ success: false, message: 'Aucun compte avec email trouvé pour ce numéro' });
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
      subject: 'Réinitialisation de votre PIN TeranGO',
      html: '<div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:20px;"><h2 style="color:#4CD964;">TeranGO</h2><p>Votre code de réinitialisation:</p><h1 style="text-align:center;color:#4CD964;font-size:36px;letter-spacing:8px;">' + otp + '</h1><p>Ce code expire dans 10 minutes.</p></div>'
    });

    res.json({ success: true, message: 'Code envoyé à votre email' });
  } catch (error) {
    console.error('Forgot PIN Error:', error);
    res.status(500).json({ success: false, message: "Erreur lors de l'envoi du code" });
  }
};

// @desc    Reset PIN with email OTP
// @route   POST /api/auth/reset-pin
// @access  Public
exports.resetPin = async (req, res) => {
  try {
    let { phone, otp, newPin } = req.body;

    if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ success: false, message: 'Le PIN doit contenir 4 chiffres' });
    }

    phone = formatPhoneNumber(phone);

    var otpRecord = await OTP.findOne({ phone: phone, otp: otp, verified: false, expiresAt: { $gt: new Date() } });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Code invalide ou expiré' });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    var hashedPin = await bcrypt.hash(newPin, 10);
    await User.findOneAndUpdate({ phone: phone }, { pin: hashedPin });

    res.json({ success: true, message: 'PIN réinitialisé avec succès' });
  } catch (error) {
    console.error('Reset PIN Error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la réinitialisation' });
  }
};

// @desc    Partner self-registration
// @route   POST /api/auth/register-partner
// @access  Public
exports.registerPartner = async (req, res) => {
  try {
    var { name, phone, email, password, businessName, businessAddress } = req.body;

    if (!name || !phone || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nom, telephone, email et mot de passe sont requis'
      });
    }

    // Check existing
    var existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'Email deja utilise' });
    }
    var existingPhone = await User.findOne({ phone: phone });
    if (existingPhone) {
      return res.status(400).json({ success: false, message: 'Telephone deja utilise' });
    }

    var salt = await bcrypt.genSalt(10);
    var hashedPassword = await bcrypt.hash(password, salt);

    var user = await User.create({
      name: name,
      phone: phone,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'partner',
      isActive: true
    });

    // Get ID photo URL from multer/cloudinary if uploaded
    var idPhotoUrl = '';
    if (req.file) {
      idPhotoUrl = req.file.path || req.file.secure_url || '';
    }

    var partner = await Partner.create({
      userId: user._id,
      businessName: businessName || name,
      businessPhone: phone,
      businessAddress: businessAddress || '',
      idPhoto: idPhotoUrl,
      verificationStatus: 'pending',
      commissionRate: 3
    });

    res.status(201).json({
      success: true,
      message: 'Inscription reussie. Votre compte est en attente de validation.',
      partner: {
        id: partner._id,
        name: user.name,
        verificationStatus: 'pending'
      }
    });
  } catch (error) {
    console.error('Partner Registration Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};


// @desc    Partner self-registration
// @route   POST /api/auth/register-partner
// @access  Public
exports.registerPartner = async (req, res) => {
  try {
    var { name, phone, email, password, businessName, businessAddress } = req.body;

    if (!name || !phone || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nom, telephone, email et mot de passe sont requis'
      });
    }

    // Check existing
    var existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'Email deja utilise' });
    }
    var existingPhone = await User.findOne({ phone: phone });
    if (existingPhone) {
      return res.status(400).json({ success: false, message: 'Telephone deja utilise' });
    }

    var salt = await bcrypt.genSalt(10);
    var hashedPassword = await bcrypt.hash(password, salt);

    var user = await User.create({
      name: name,
      phone: phone,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'partner',
      isActive: true
    });

    // Get ID photo URL from multer/cloudinary if uploaded
    var idPhotoUrl = '';
    if (req.file) {
      idPhotoUrl = req.file.path || req.file.secure_url || '';
    }

    var partner = await Partner.create({
      userId: user._id,
      businessName: businessName || name,
      businessPhone: phone,
      businessAddress: businessAddress || '',
      idPhoto: idPhotoUrl,
      verificationStatus: 'pending',
      commissionRate: 3
    });

    res.status(201).json({
      success: true,
      message: 'Inscription reussie. Votre compte est en attente de validation.',
      partner: {
        id: partner._id,
        name: user.name,
        verificationStatus: 'pending'
      }
    });
  } catch (error) {
    console.error('Partner Registration Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};


exports.updateSecurityPin = async (req, res) => {
  try {
    const { securityPinEnabled } = req.body;
    await User.findByIdAndUpdate(req.user._id, { securityPinEnabled });
    res.status(200).json({ success: true, message: 'Parametre mis a jour' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};