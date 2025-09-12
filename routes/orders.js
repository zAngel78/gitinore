const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Aplicar protección a todas las rutas
router.use(protect);

// @desc    Obtener todas las órdenes
// @route   GET /api/orders
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status, 
      customer, 
      overdue, 
      delivered,
      startDate,
      endDate
    } = req.query;
    
    let query = {};
    
    // Filtro por estado
    if (status) {
      query.status = status;
    }

    // Filtro por cliente
    if (customer) {
      query.customer = customer;
    }

    // Filtro por fechas
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(query)
      .populate('customer', 'name tax_id email')
      .populate('items.product', 'name sku brand')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    // Aplicar filtros post-query para campos virtuales
    let filteredOrders = orders;
    
    if (overdue === 'true') {
      filteredOrders = orders.filter(order => order.isOverdue);
    }
    
    if (delivered === 'true') {
      filteredOrders = orders.filter(order => order.isDelivered);
    } else if (delivered === 'false') {
      filteredOrders = orders.filter(order => !order.isDelivered);
    }

    res.json({
      success: true,
      data: filteredOrders,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener órdenes', error: error.message });
  }
});

// @desc    Obtener orden por ID
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer')
      .populate('items.product')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
      
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener orden', error: error.message });
  }
});

// @desc    Crear nueva orden
// @route   POST /api/orders
// @access  Private (Vendedor, Admin)
router.post('/', authorize('vendedor', 'admin'), validate(schemas.order), async (req, res) => {
  try {
    const orderData = {
      ...req.body,
      createdBy: req.user.id
    };

    // Verificar que todos los productos existen y están activos
    const productIds = orderData.items.map(item => item.product);
    const products = await Product.find({ _id: { $in: productIds }, isActive: true });
    
    if (products.length !== productIds.length) {
      return res.status(400).json({ message: 'Uno o más productos no están disponibles' });
    }

    // Detectar duplicados (mismo cliente + producto + día)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    
    // Buscar órdenes del mismo cliente creadas hoy
    const todayOrders = await Order.find({
      customer: orderData.customer,
      createdAt: { $gte: startOfDay, $lt: endOfDay },
      status: { $in: ['pendiente', 'compra'] }
    });

    // Verificar si algún producto ya existe en las órdenes de hoy
    const duplicates = [];
    for (const item of orderData.items) {
      for (const order of todayOrders) {
        const existingItem = order.items.find(existing => 
          existing.product.toString() === item.product &&
          (existing.status === 'pendiente' || existing.status === 'compra')
        );
        if (existingItem) {
          duplicates.push({
            orderId: order._id,
            itemId: existingItem._id,
            productId: item.product,
            existingQty: existingItem.quantity,
            newQty: item.quantity
          });
        }
      }
    }

    // Si hay duplicados y no se especifica qué hacer, devolver aviso
    if (duplicates.length > 0 && !req.body.handleDuplicates) {
      return res.status(409).json({ 
        message: 'Productos duplicados detectados',
        duplicates: duplicates,
        suggestion: 'merge' // suggest merging quantities
      });
    }

    // Si hay duplicados y se quiere hacer merge
    if (duplicates.length > 0 && req.body.handleDuplicates === 'merge') {
      for (const dup of duplicates) {
        const order = await Order.findById(dup.orderId);
        const itemIndex = order.items.findIndex(item => item._id.toString() === dup.itemId.toString());
        if (itemIndex !== -1) {
          order.items[itemIndex].quantity += dup.newQty;
          await order.save();
        }
      }
      
      return res.status(200).json({
        success: true,
        message: 'Cantidades sumadas a pedidos existentes',
        merged: duplicates.length
      });
    }

    // Si hay duplicados pero se quiere ignorar y crear nueva línea, continuar normalmente

    // Validar precios y completar datos faltantes
    orderData.items = orderData.items.map(item => {
      const product = products.find(p => p._id.toString() === item.product);
      return {
        ...item,
        unit_price: item.unit_price || product.unit_price,
        brand: item.brand || product.brand,
        format: item.format || product.format,
        unit_of_measure: item.unit_of_measure || product.unit_of_measure
      };
    });

    const order = await Order.create(orderData);
    await order.populate([
      { path: 'customer', select: 'name tax_id email' },
      { path: 'items.product', select: 'name sku brand' },
      { path: 'createdBy', select: 'name email' }
    ]);

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear orden', error: error.message });
  }
});

// @desc    Actualizar estado de orden
// @route   PATCH /api/orders/:id/status
// @access  Private (Facturador, Admin)
router.patch('/:id/status', authorize('facturador', 'admin'), validate(schemas.orderStatus), async (req, res) => {
  try {
    const { status } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    // Actualizar estado de la orden y todos sus items
    order.status = status;
    order.items.forEach(item => {
      item.status = status;
    });
    order.updatedBy = req.user.id;

    await order.save();
    
    await order.populate([
      { path: 'customer', select: 'name tax_id email' },
      { path: 'items.product', select: 'name sku brand' },
      { path: 'updatedBy', select: 'name email' }
    ]);

    res.json({
      success: true,
      data: order,
      message: `Estado actualizado a: ${status}`
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar estado', error: error.message });
  }
});

// @desc    Marcar orden como entregada
// @route   PATCH /api/orders/:id/deliver
// @access  Private (Facturador, Admin)
router.patch('/:id/deliver', authorize('facturador', 'admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    if (order.status !== 'facturado') {
      return res.status(400).json({ message: 'Solo órdenes facturadas pueden marcarse como entregadas' });
    }

    order.delivered_at = new Date();
    order.updatedBy = req.user.id;
    await order.save();

    await order.populate([
      { path: 'customer', select: 'name tax_id email' },
      { path: 'updatedBy', select: 'name email' }
    ]);

    res.json({
      success: true,
      data: order,
      message: 'Orden marcada como entregada'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al marcar como entregada', error: error.message });
  }
});

// @desc    Marcar orden como nula (regla 7 días)
// @route   PATCH /api/orders/:id/nullify
// @access  Private (Facturador, Admin)
router.patch('/:id/nullify', authorize('facturador', 'admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    // Verificar regla de 7 días
    const createdDate = new Date(order.createdAt);
    const today = new Date();
    const daysDiff = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));

    if (daysDiff < 7) {
      return res.status(400).json({ 
        message: `No se puede anular. Han pasado solo ${daysDiff} días (mínimo 7)` 
      });
    }

    if (!['pendiente', 'compra'].includes(order.status)) {
      return res.status(400).json({ 
        message: 'Solo órdenes pendientes o en compra pueden anularse' 
      });
    }

    order.status = 'nulo';
    order.items.forEach(item => {
      item.status = 'nulo';
    });
    order.updatedBy = req.user.id;
    await order.save();

    await order.populate([
      { path: 'customer', select: 'name tax_id email' },
      { path: 'updatedBy', select: 'name email' }
    ]);

    res.json({
      success: true,
      data: order,
      message: 'Orden marcada como nula'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al anular orden', error: error.message });
  }
});

// @desc    Actualizar orden completa
// @route   PUT /api/orders/:id
// @access  Private (Admin)
router.put('/:id', authorize('admin'), validate(schemas.order), async (req, res) => {
  try {
    const orderData = {
      ...req.body,
      updatedBy: req.user.id
    };

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      orderData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'customer', select: 'name tax_id email' },
      { path: 'items.product', select: 'name sku brand' },
      { path: 'updatedBy', select: 'name email' }
    ]);

    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar orden', error: error.message });
  }
});

// @desc    Eliminar orden (soft delete)
// @route   DELETE /api/orders/:id
// @access  Private (Admin)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'nulo',
        updatedBy: req.user.id
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    res.json({
      success: true,
      message: 'Orden eliminada correctamente'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar orden', error: error.message });
  }
});

module.exports = router;