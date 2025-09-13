const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { sendTestEmail } = require('../services/emailService');

const router = express.Router();

// Aplicar protección a todas las rutas
router.use(protect);

// @desc    Enviar email de prueba
// @route   POST /api/notifications/test
// @access  Private (Admin)
router.post('/test', authorize('admin'), async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email es requerido' });
    }

    const result = await sendTestEmail(email);

    if (result.success) {
      res.json({
        success: true,
        message: 'Email de prueba enviado correctamente'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error enviando email de prueba',
        error: result.message
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      error: error.message
    });
  }
});

// @desc    Obtener configuración de notificaciones
// @route   GET /api/notifications/config
// @access  Private (Admin)
router.get('/config', authorize('admin'), async (req, res) => {
  try {
    const config = {
      gmail_configured: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
      gmail_user: process.env.GMAIL_USER || 'No configurado',
      notifications_enabled: true
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo configuración',
      error: error.message
    });
  }
});

module.exports = router;