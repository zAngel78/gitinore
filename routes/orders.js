const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const NotificationConfig = require('../models/NotificationConfig');
const { protect, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { sendNewOrderNotification } = require('../services/emailService');

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

    // Buscar pedidos del mismo cliente en las últimas 24 horas
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Buscar órdenes del mismo cliente creadas en las últimas 24 horas
    const recentOrders = await Order.find({
      customer: orderData.customer,
      createdAt: { $gte: twentyFourHoursAgo },
      status: { $in: ['pendiente', 'compra'] }
    });

    // Verificar si algún producto ya existe en las órdenes recientes (24h)
    const duplicates = [];
    for (const item of orderData.items) {
      for (const order of recentOrders) {
        const existingItem = order.items.find(existing => 
          existing.product.toString() === item.product &&
          (existing.status === 'pendiente' || existing.status === 'compra')
        );
        if (existingItem) {
          const product = products.find(p => p._id.toString() === item.product);
          duplicates.push({
            orderId: order._id,
            orderNumber: order.order_number,
            itemId: existingItem._id,
            productId: item.product,
            productName: product?.name || 'Producto no encontrado',
            existingQty: existingItem.quantity,
            newQty: item.quantity,
            unitOfMeasure: existingItem.unit_of_measure
          });
        }
      }
    }

    // Si hay duplicados, consolidar automáticamente
    if (duplicates.length > 0) {
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
        message: 'Productos agregados al pedido existente del mismo cliente (últimas 24h)',
        merged: duplicates.length,
        consolidatedOrders: duplicates.map(d => d.orderNumber)
      });
    }

    // Si hay duplicados pero se quiere ignorar y crear nueva línea, continuar normalmente

    // Completar datos faltantes del producto (sin precios - enfoque logístico)
    orderData.items = orderData.items.map(item => {
      const product = products.find(p => p._id.toString() === item.product);
      return {
        ...item,
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

    // Enviar notificaciones por email según configuración
    try {
      const notificationConfig = await NotificationConfig.getOrCreateConfig();
      const emailResult = await sendNewOrderNotification(order, notificationConfig);
      console.log(`📧 Notificaciones enviadas: ${emailResult.sent || 0} exitosas, ${emailResult.failed || 0} fallidas de ${emailResult.totalConfigured || 0} configurados`);
    } catch (emailError) {
      console.error('Error enviando notificaciones por email:', emailError);
      // No fallar la creación del pedido por errores de email
    }

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

    // Si se cambia a un estado anterior (compra/pendiente), limpiar fecha de entrega
    if (['compra', 'pendiente'].includes(status) && order.delivered_at) {
      order.delivered_at = null;
    }

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

// @desc    Actualizar orden para facturador (campos permitidos)
// @route   PATCH /api/orders/:id
// @access  Private (Facturador, Admin)
router.patch('/:id', authorize('facturador', 'admin'), async (req, res) => {
  try {
    const { status, location, notes, delivery_due, customer, items } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    // Actualizar campos permitidos para facturador/admin
    if (status && ['pendiente', 'compra', 'facturado', 'nulo'].includes(status)) {
      order.status = status;
      order.items.forEach(item => {
        item.status = status;
      });

      // Si se cambia a un estado anterior (compra/pendiente), limpiar fecha de entrega
      if (['compra', 'pendiente'].includes(status) && order.delivered_at) {
        order.delivered_at = null;
      }
    }

    if (location !== undefined) {
      order.location = location;
    }

    if (notes !== undefined) {
      order.notes = notes;
    }

    if (delivery_due) {
      order.delivery_due = new Date(delivery_due);
    }

    if (customer) {
      order.customer = customer;
    }

    if (items && Array.isArray(items)) {
      order.items = items;
    }

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
      message: 'Orden actualizada exitosamente'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar orden', error: error.message });
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