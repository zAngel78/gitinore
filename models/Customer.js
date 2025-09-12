const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del cliente es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  tax_id: {
    type: String,
    trim: true,
    maxlength: [20, 'El RUT no puede exceder 20 caracteres'],
    match: [/^[0-9]+[-|‐]{1}[0-9kK]{1}$|^[0-9]{1,2}[.]{1}[0-9]{3}[.]{1}[0-9]{3}[-|‐]{1}[0-9kK]{1}$/, 'Formato de RUT inválido']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [15, 'El teléfono no puede exceder 15 caracteres']
  },
  address: {
    street: String,
    city: String,
    region: String,
    postalCode: String
  },
  notes: {
    type: String,
    maxlength: [500, 'Las notas no pueden exceder 500 caracteres']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Índices para búsquedas eficientes
customerSchema.index({ name: 'text', tax_id: 'text', email: 'text' });
customerSchema.index({ tax_id: 1 }, { unique: true, sparse: true });
customerSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Customer', customerSchema);