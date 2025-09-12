const express = require('express');
const Customer = require('../models/Customer');
const { protect, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Aplicar protección a todas las rutas
router.use(protect);

// @desc    Obtener todos los clientes
// @route   GET /api/customers
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, search, active } = req.query;
    
    let query = {};
    
    // Filtro por estado activo
    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    // Búsqueda por texto
    if (search) {
      query.$text = { $search: search };
    }

    const customers = await Customer.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Customer.countDocuments(query);

    res.json({
      success: true,
      data: customers,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener clientes', error: error.message });
  }
});

// @desc    Obtener cliente por ID
// @route   GET /api/customers/:id
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('createdBy', 'name email');
      
    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener cliente', error: error.message });
  }
});

// @desc    Crear nuevo cliente
// @route   POST /api/customers
// @access  Private (Vendedor, Admin)
router.post('/', authorize('vendedor', 'admin'), validate(schemas.customer), async (req, res) => {
  try {
    const customerData = {
      ...req.body,
      createdBy: req.user.id
    };

    const customer = await Customer.create(customerData);
    await customer.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      data: customer
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear cliente', error: error.message });
  }
});

// @desc    Actualizar cliente
// @route   PUT /api/customers/:id
// @access  Private (Admin)
router.put('/:id', authorize('admin'), validate(schemas.customer), async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar cliente', error: error.message });
  }
});

// @desc    Eliminar cliente (soft delete)
// @route   DELETE /api/customers/:id
// @access  Private (Admin)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    res.json({
      success: true,
      message: 'Cliente desactivado correctamente'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar cliente', error: error.message });
  }
});

// @desc    Importación masiva de clientes desde CSV
// @route   POST /api/customers/bulk
// @access  Private (Vendedor, Admin)
router.post('/bulk', authorize('vendedor', 'admin'), async (req, res) => {
  try {
    const { customers } = req.body;
    
    if (!customers || !Array.isArray(customers)) {
      return res.status(400).json({ message: 'Array de clientes requerido' });
    }

    const customersData = customers.map(customer => ({
      ...customer,
      createdBy: req.user.id
    }));

    const result = await Customer.insertMany(customersData, { ordered: false });

    res.status(201).json({
      success: true,
      message: `${result.length} clientes importados correctamente`,
      data: result
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en importación masiva', error: error.message });
  }
});

module.exports = router;