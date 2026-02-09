const User = require('../models/User');
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

    // Validate phone number
    if (!isValidSenegalPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Numéro de téléphone invalide'
      });
    }

    // Format phone number
    phone = formatPhoneNumber(phone);


    // If mode is "login", check user exists first
    if (req.body.mode === 'login') {
      const existingUser = await User.findOne({ phone });
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'Aucun compte trouv\u00e9 avec ce num\u00e9ro. Veuillez vous inscrire.'
        });
      }
    }

    // Generate OTP
    const otp = generateOTP();

    // Save OTP to database
    await OTP.create({
      phone,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    // TODO: Send OTP via SMS
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
