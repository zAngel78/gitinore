const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      console.log('❌ Error de validación:', error.details);
      console.log('📦 Datos recibidos:', JSON.stringify(req.body, null, 2));
      return res.status(400).json({
        message: 'Datos de entrada inválidos',
        details: error.details.map(detail => detail.message)
      });
    }
    console.log('✅ Validación exitosa');
    next();
  };
};

// Esquemas de validación
const schemas = {
  register: Joi.object({
    name: Joi.string().required().min(2).max(100),
    email: Joi.string().email().required(),
    password: Joi.string().required().min(6),
    role: Joi.string().valid('vendedor', 'facturador', 'admin').default('vendedor')
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  customer: Joi.object({
    name: Joi.string().required().min(2).max(100),
    tax_id: Joi.string().allow('').pattern(/^[0-9]+[-|‐]{1}[0-9kK]{1}$|^[0-9]{1,2}[.]{1}[0-9]{3}[.]{1}[0-9]{3}[-|‐]{1}[0-9kK]{1}$/),
    email: Joi.string().email().allow(''),
    phone: Joi.string().allow('').max(15),
    address: Joi.object({
      street: Joi.string().allow(''),
      city: Joi.string().allow(''),
      region: Joi.string().allow(''),
      postalCode: Joi.string().allow('')
    }).optional(),
    notes: Joi.string().allow('').max(500)
  }),

  product: Joi.object({
    sku: Joi.string().required().max(50),
    name: Joi.string().required().min(2).max(200),
    description: Joi.string().allow('').max(1000),
    brand: Joi.string().allow('').max(100),
    format: Joi.string().allow('').max(100),
    unit_price: Joi.number().required().min(0),
    cost_price: Joi.number().min(0).optional(),
    stock: Joi.object({
      current: Joi.number().min(0).default(0),
      min_stock: Joi.number().min(0).default(0)
    }).optional(),
    category: Joi.string().allow('').max(100),
    unit_of_measure: Joi.string().valid('unidad', 'par', 'metro', 'caja', 'kg', 'litro', 'pack').default('unidad')
  }),

  order: Joi.object({
    customer: Joi.string().required(),
    items: Joi.array().items(
      Joi.object({
        product: Joi.string().required(),
        quantity: Joi.number().required().min(0.1),
        notes: Joi.string().allow('').optional()
      })
    ).min(1).max(20).required(), // Máximo 20 productos por pedido
    delivery_due: Joi.date().optional(),
    order_number: Joi.string().allow('').max(50).optional(),
    notes: Joi.string().allow('').max(1000).optional(),
    location: Joi.string().allow('').max(200).optional()
  }),

  orderStatus: Joi.object({
    status: Joi.string().valid('pendiente', 'compra', 'facturado', 'nulo').required()
  })
};

module.exports = { validate, schemas };