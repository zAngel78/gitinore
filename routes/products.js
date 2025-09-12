const express = require('express');
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Aplicar protección a todas las rutas
router.use(protect);

// @desc    Obtener todos los productos
// @route   GET /api/products
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, search, category, active, lowStock } = req.query;
    
    let query = {};
    
    // Filtro por estado activo
    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    // Filtro por categoría
    if (category) {
      query.category = category;
    }

    // Filtro por stock bajo
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$stock.current', '$stock.min_stock'] };
    }

    // Búsqueda por texto
    if (search) {
      query.$text = { $search: search };
    }

    const products = await Product.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    // Agregar campo virtual isLowStock
    const productsWithLowStock = products.map(product => ({
      ...product.toObject(),
      isLowStock: product.stock.current <= product.stock.min_stock
    }));

    res.json({
      success: true,
      data: productsWithLowStock,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener productos', error: error.message });
  }
});

// @desc    Obtener producto por ID
// @route   GET /api/products/:id
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('createdBy', 'name email');
      
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({
      success: true,
      data: {
        ...product.toObject(),
        isLowStock: product.stock.current <= product.stock.min_stock
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener producto', error: error.message });
  }
});

// @desc    Crear nuevo producto
// @route   POST /api/products
// @access  Private (Vendedor, Admin)
router.post('/', authorize('vendedor', 'admin'), validate(schemas.product), async (req, res) => {
  try {
    const productData = {
      ...req.body,
      createdBy: req.user.id
    };

    const product = await Product.create(productData);
    await product.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear producto', error: error.message });
  }
});

// @desc    Actualizar producto
// @route   PUT /api/products/:id
// @access  Private (Admin)
router.put('/:id', authorize('admin'), validate(schemas.product), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar producto', error: error.message });
  }
});

// @desc    Eliminar producto (soft delete)
// @route   DELETE /api/products/:id
// @access  Private (Admin)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({
      success: true,
      message: 'Producto desactivado correctamente'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar producto', error: error.message });
  }
});

// @desc    Actualizar stock de producto
// @route   PATCH /api/products/:id/stock
// @access  Private (Vendedor, Admin)
router.patch('/:id/stock', authorize('vendedor', 'admin'), async (req, res) => {
  try {
    const { current, min_stock } = req.body;
    
    const updateData = {};
    if (current !== undefined) updateData['stock.current'] = current;
    if (min_stock !== undefined) updateData['stock.min_stock'] = min_stock;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({
      success: true,
      data: product,
      message: 'Stock actualizado correctamente'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar stock', error: error.message });
  }
});

// @desc    Obtener categorías únicas
// @route   GET /api/products/categories
// @access  Private
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    
    res.json({
      success: true,
      data: categories.filter(cat => cat && cat.trim() !== '')
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener categorías', error: error.message });
  }
});

// @desc    Importación masiva de productos desde CSV
// @route   POST /api/products/bulk
// @access  Private (Vendedor, Admin)
router.post('/bulk', authorize('vendedor', 'admin'), async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ message: 'Array de productos requerido' });
    }

    const productsData = products.map(product => ({
      ...product,
      createdBy: req.user.id,
      sku: product.sku || `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    }));

    const result = await Product.insertMany(productsData, { ordered: false });

    res.status(201).json({
      success: true,
      message: `${result.length} productos importados correctamente`,
      data: result
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en importación masiva', error: error.message });
  }
});

module.exports = router;