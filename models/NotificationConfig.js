const mongoose = require('mongoose');

const notificationConfigSchema = new mongoose.Schema({
  // Configuración de usuarios del sistema
  userNotifications: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    email: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    enabled: {
      type: Boolean,
      default: true
    }
  }],

  // Emails extra (no usuarios del sistema)
  extraEmails: [{
    email: {
      type: String,
      required: true,
      match: [/^\S+@\S+\.\S+$/, 'Email inválido']
    },
    name: {
      type: String,
      required: true
    },
    enabled: {
      type: Boolean,
      default: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Configuración global
  settings: {
    enabled: {
      type: Boolean,
      default: true
    },
    notifyOnOrderCreate: {
      type: Boolean,
      default: true
    },
    notifyOnStatusChange: {
      type: Boolean,
      default: false
    },
    notifyOnDelivery: {
      type: Boolean,
      default: false
    }
  },

  // Metadata
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Solo puede existir una configuración
notificationConfigSchema.index({}, { unique: true });

// Middleware para actualizar updatedAt
notificationConfigSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Método para obtener todos los emails activos
notificationConfigSchema.methods.getActiveEmails = function() {
  const activeUserEmails = this.userNotifications
    .filter(user => user.enabled)
    .map(user => ({
      email: user.email,
      name: user.name,
      type: 'user'
    }));

  const activeExtraEmails = this.extraEmails
    .filter(extra => extra.enabled)
    .map(extra => ({
      email: extra.email,
      name: extra.name,
      type: 'extra'
    }));

  return [...activeUserEmails, ...activeExtraEmails];
};

// Método estático para obtener o crear configuración por defecto
notificationConfigSchema.statics.getOrCreateConfig = async function() {
  let config = await this.findOne();

  if (!config) {
    // Crear configuración inicial con todos los usuarios activos
    const User = mongoose.model('User');
    const users = await User.find({ isActive: { $ne: false } }, 'name email');

    config = new this({
      userNotifications: users.map(user => ({
        userId: user._id,
        email: user.email,
        name: user.name,
        enabled: true
      })),
      extraEmails: [],
      settings: {
        enabled: true,
        notifyOnOrderCreate: true,
        notifyOnStatusChange: false,
        notifyOnDelivery: false
      }
    });

    await config.save();
  }

  return config;
};

module.exports = mongoose.model('NotificationConfig', notificationConfigSchema);