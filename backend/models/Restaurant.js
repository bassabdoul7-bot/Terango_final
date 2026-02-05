var mongoose = require('mongoose');

var menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true },
  image: { type: String, default: '' },
  category: { type: String, required: true },
  isAvailable: { type: Boolean, default: true },
  preparationTime: { type: Number, default: 15 },
  options: [{
    name: String,
    choices: [{
      label: String,
      priceAdd: { type: Number, default: 0 }
    }]
  }]
});

var restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true },
  description: { type: String, default: '' },
  phone: { type: String, required: true },
  email: { type: String, default: '' },
  logo: { type: String, default: '' },
  coverImage: { type: String, default: '' },
  address: {
    street: { type: String, required: true },
    city: { type: String, default: 'Dakar' },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    }
  },
  categories: [{ type: String }],
  cuisine: [{ type: String }],
  menu: [menuItemSchema],
  hours: {
    monday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    tuesday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    wednesday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    thursday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    friday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    saturday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    sunday: { open: String, close: String, isClosed: { type: Boolean, default: true } }
  },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalRatings: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  commissionRate: { type: Number, default: 12 },
  minimumOrder: { type: Number, default: 1000 },
  estimatedDeliveryTime: { type: Number, default: 30 },
  deliveryRadius: { type: Number, default: 10 },
  isActive: { type: Boolean, default: true },
  isOpen: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  owner: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    password: { type: String, required: true }
  },
  bankInfo: {
    method: { type: String, enum: ['wave', 'orange_money', 'bank'], default: 'wave' },
    phoneNumber: String,
    accountNumber: String
  },
  totalRevenue: { type: Number, default: 0 }
}, { timestamps: true });

restaurantSchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
  }
  next();
});

restaurantSchema.index({ 'address.coordinates.latitude': 1, 'address.coordinates.longitude': 1 });
restaurantSchema.index({ isActive: 1, isOpen: 1 });

module.exports = mongoose.model('Restaurant', restaurantSchema);