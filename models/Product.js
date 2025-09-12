const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: [true, 'El SKU es requerido'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [50, 'El SKU no puede exceder 50 caracteres']
  },
  name: {
    type: String,
    required: [true, 'El nombre del producto es requerido'],
    trim: true,
    maxlength: [200, 'El nombre no puede exceder 200 caracteres']
  },
  description: {
    type: String,
    maxlength: [1000, 'La descripción no puede exceder 1000 caracteres']
  },
  brand: {
    type: String,
    trim: true,
    maxlength: [100, 'La marca no puede exceder 100 caracteres']
  },
  format: {
    type: String,
    trim: true,
    maxlength: [100, 'El formato no puede exceder 100 caracteres']
  },
  unit_price: {
    type: Number,
    required: [true, 'El precio unitario es requerido'],
    min: [0, 'El precio no puede ser negativo']
  },
  cost_price: {
    type: Number,
    min: [0, 'El precio de costo no puede ser negativo']
  },
  stock: {
    current: {
      type: Number,
      default: 0,
      min: [0, 'El stock no puede ser negativo']
    },
    min_stock: {
      type: Number,
      default: 0,
      min: [0, 'El stock mínimo no puede ser negativo']
    }
  },
  category: {
    type: String,
    trim: true,
    maxlength: [100, 'La categoría no puede exceder 100 caracteres']
  },
  unit_of_measure: {
    type: String,
    enum: ['unidad', 'par', 'metro', 'caja', 'kg', 'litro', 'pack'],
    default: 'unidad'
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
productSchema.index({ name: 'text', sku: 'text', brand: 'text' });
productSchema.index({ sku: 1 });
productSchema.index({ category: 1 });
productSchema.index({ createdBy: 1 });
productSchema.index({ 'stock.current': 1 });

// Método virtual para verificar stock bajo
productSchema.virtual('isLowStock').get(function() {
  return this.stock.current <= this.stock.min_stock;
});

module.exports = mongoose.model('Product', productSchema);