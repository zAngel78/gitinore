const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: [true, 'La cantidad es requerida'],
    min: [0.1, 'La cantidad debe ser mayor a 0']
  },
  unit_price: {
    type: Number,
    min: [0, 'El precio no puede ser negativo'],
    default: 0
  },
  unit_of_measure: {
    type: String,
    enum: ['unidad', 'par', 'metro', 'caja', 'kg', 'litro', 'pack'],
    default: 'unidad'
  },
  brand: String,
  format: String,
  status: {
    type: String,
    enum: ['pendiente', 'compra', 'facturado', 'nulo'],
    default: 'pendiente'
  },
  notes: String
}, {
  _id: true
});

// Virtual para calcular subtotal de cada item (sin precios en modo logístico)
orderItemSchema.virtual('subtotal').get(function() {
  return this.quantity * (this.unit_price || 0);
});

const orderSchema = new mongoose.Schema({
  order_number: {
    type: String,
    trim: true,
    maxlength: [50, 'El número de orden no puede exceder 50 caracteres']
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'El cliente es requerido']
  },
  items: [orderItemSchema],
  status: {
    type: String,
    enum: ['pendiente', 'compra', 'facturado', 'nulo'],
    default: 'pendiente'
  },
  delivery_due: {
    type: Date
  },
  delivered_at: {
    type: Date
  },
  notes: {
    type: String,
    maxlength: [1000, 'Las notas no pueden exceder 1000 caracteres']
  },
  location: {
    type: String,
    maxlength: [200, 'La ubicación no puede exceder 200 caracteres']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Virtual para calcular total del pedido (sin precios en modo logístico)
orderSchema.virtual('total').get(function() {
  return this.items.reduce((sum, item) => sum + (item.quantity * (item.unit_price || 0)), 0);
});

// Virtual para contar items
orderSchema.virtual('itemCount').get(function() {
  return this.items.length;
});

// Virtual para verificar si está vencido (solo si tiene fecha de entrega)
orderSchema.virtual('isOverdue').get(function() {
  if (this.status !== 'facturado' || this.delivered_at || !this.delivery_due) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(this.delivery_due);
  due.setHours(0, 0, 0, 0);
  return due < today;
});

// Virtual para verificar si está pendiente de entrega
orderSchema.virtual('isPendingDelivery').get(function() {
  return this.status === 'facturado' && !this.delivered_at;
});

// Virtual para verificar si está entregado
orderSchema.virtual('isDelivered').get(function() {
  return !!this.delivered_at;
});

// Índices
orderSchema.index({ customer: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ delivery_due: 1 }, { sparse: true }); // Solo indexar cuando tenga fecha
orderSchema.index({ createdBy: 1 });
orderSchema.index({ order_number: 1 });

// Middleware para auto-generar número de orden
orderSchema.pre('save', async function(next) {
  if (this.isNew && !this.order_number) {
    const count = await mongoose.model('Order').countDocuments();
    this.order_number = `OC-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Asegurar que virtuals se incluyan en JSON
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);