const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Aplicar protección a todas las rutas
router.use(protect);

// @desc    Obtener métricas del dashboard
// @route   GET /api/dashboard/metrics
// @access  Private
router.get('/metrics', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Métricas generales
    const [
      totalOrders,
      totalCustomers,
      totalProducts,
      activeProducts
    ] = await Promise.all([
      Order.countDocuments(),
      Customer.countDocuments({ isActive: true }),
      Product.countDocuments(),
      Product.countDocuments({ isActive: true })
    ]);

    // KPIs por período
    const getKPIForPeriod = async (startDate) => {
      const orders = await Order.find({ 
        createdAt: { $gte: startDate } 
      }).populate('items.product');
      
      const statusCount = {
        pendiente: 0,
        compra: 0,
        facturado: 0,
        nulo: 0
      };

      let totalAmount = 0;
      let totalItems = 0;

      orders.forEach(order => {
        statusCount[order.status]++;
        totalAmount += order.total;
        totalItems += order.itemCount;
      });

      return {
        orders: orders.length,
        items: totalItems,
        total: totalAmount,
        statusCount
      };
    };

    const [dailyKPI, weeklyKPI, monthlyKPI] = await Promise.all([
      getKPIForPeriod(today),
      getKPIForPeriod(startOfWeek),
      getKPIForPeriod(startOfMonth)
    ]);

    // Estados de entrega
    const deliveryStats = await Order.aggregate([
      {
        $match: {
          status: 'facturado'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          delivered: {
            $sum: {
              $cond: [{ $ne: ['$delivered_at', null] }, 1, 0]
            }
          },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$delivered_at', null] },
                    { $lt: ['$delivery_due', today] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const deliverySummary = deliveryStats.length > 0 ? deliveryStats[0] : {
      total: 0,
      delivered: 0,
      overdue: 0
    };

    deliverySummary.pending = deliverySummary.total - deliverySummary.delivered;

    res.json({
      success: true,
      data: {
        general: {
          totalOrders,
          totalCustomers,
          totalProducts,
          activeProducts
        },
        kpis: {
          daily: dailyKPI,
          weekly: weeklyKPI,
          monthly: monthlyKPI
        },
        delivery: deliverySummary
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener métricas', error: error.message });
  }
});

// @desc    Obtener órdenes recientes para el dashboard
// @route   GET /api/dashboard/recent-orders
// @access  Private
router.get('/recent-orders', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const orders = await Order.find()
      .populate('customer', 'name tax_id')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener órdenes recientes', error: error.message });
  }
});

// @desc    Obtener productos con stock bajo
// @route   GET /api/dashboard/low-stock
// @access  Private
router.get('/low-stock', async (req, res) => {
  try {
    const products = await Product.find({
      isActive: true,
      $expr: { $lte: ['$stock.current', '$stock.min_stock'] }
    }).sort({ 'stock.current': 1 });

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener productos con stock bajo', error: error.message });
  }
});

// @desc    Obtener estadísticas por período personalizado
// @route   GET /api/dashboard/stats
// @access  Private
router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate y endDate son requeridos' });
    }

    let groupFormat;
    switch (groupBy) {
      case 'day':
        groupFormat = '%Y-%m-%d';
        break;
      case 'week':
        groupFormat = '%Y-%U';
        break;
      case 'month':
        groupFormat = '%Y-%m';
        break;
      default:
        groupFormat = '%Y-%m-%d';
    }

    const stats = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: groupFormat, date: '$createdAt' } },
            status: '$status'
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$total' }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          stats: {
            $push: {
              status: '$_id.status',
              count: '$count',
              totalAmount: '$totalAmount'
            }
          },
          totalOrders: { $sum: '$count' },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message });
  }
});

// @desc    Obtener top productos más vendidos
// @route   GET /api/dashboard/top-products
// @access  Private
router.get('/top-products', async (req, res) => {
  try {
    const { limit = 10, period = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $ne: 'nulo' }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
          totalAmount: { $sum: { $multiply: ['$items.quantity', '$items.unit_price'] } },
          orderCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.name',
          sku: '$product.sku',
          brand: '$product.brand',
          totalQuantity: 1,
          totalAmount: 1,
          orderCount: 1
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: topProducts
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener top productos', error: error.message });
  }
});

// @desc    Obtener top clientes
// @route   GET /api/dashboard/top-customers
// @access  Private
router.get('/top-customers', async (req, res) => {
  try {
    const { limit = 10, period = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const topCustomers = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $ne: 'nulo' }
        }
      },
      {
        $group: {
          _id: '$customer',
          totalAmount: { $sum: '$total' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$total' }
        }
      },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: '$customer' },
      {
        $project: {
          name: '$customer.name',
          tax_id: '$customer.tax_id',
          email: '$customer.email',
          totalAmount: 1,
          orderCount: 1,
          avgOrderValue: { $round: ['$avgOrderValue', 0] }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: topCustomers
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener top clientes', error: error.message });
  }
});

module.exports = router;