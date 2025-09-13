const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { sendTestEmail } = require('../services/emailService');
const NotificationConfig = require('../models/NotificationConfig');
const User = require('../models/User');

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

// @desc    Obtener configuración completa de notificaciones
// @route   GET /api/notifications/config
// @access  Private (Admin)
router.get('/config', authorize('admin'), async (req, res) => {
  try {
    const notificationConfig = await NotificationConfig.getOrCreateConfig();

    const config = {
      gmail_configured: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
      gmail_user: process.env.GMAIL_USER || 'No configurado',
      notifications_enabled: notificationConfig.settings.enabled,
      settings: notificationConfig.settings,
      userNotifications: notificationConfig.userNotifications,
      extraEmails: notificationConfig.extraEmails,
      totalActiveEmails: notificationConfig.getActiveEmails().length
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

// @desc    Actualizar configuración de notificaciones
// @route   PUT /api/notifications/config
// @access  Private (Admin)
router.put('/config', authorize('admin'), async (req, res) => {
  try {
    const { settings, userNotifications, extraEmails } = req.body;

    const notificationConfig = await NotificationConfig.getOrCreateConfig();

    // Actualizar settings
    if (settings) {
      notificationConfig.settings = { ...notificationConfig.settings, ...settings };
    }

    // Actualizar configuración de usuarios
    if (userNotifications) {
      notificationConfig.userNotifications = userNotifications;
    }

    // Actualizar emails extra
    if (extraEmails) {
      notificationConfig.extraEmails = extraEmails;
    }

    notificationConfig.lastUpdatedBy = req.user.id;
    await notificationConfig.save();

    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      data: notificationConfig
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error actualizando configuración',
      error: error.message
    });
  }
});

// @desc    Agregar email extra
// @route   POST /api/notifications/extra-email
// @access  Private (Admin)
router.post('/extra-email', authorize('admin'), async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ message: 'Email y nombre son requeridos' });
    }

    const notificationConfig = await NotificationConfig.getOrCreateConfig();

    // Verificar si ya existe
    const exists = notificationConfig.extraEmails.some(extra => extra.email === email);
    if (exists) {
      return res.status(400).json({ message: 'Este email ya está configurado' });
    }

    notificationConfig.extraEmails.push({
      email,
      name,
      enabled: true
    });

    notificationConfig.lastUpdatedBy = req.user.id;
    await notificationConfig.save();

    res.json({
      success: true,
      message: 'Email agregado exitosamente',
      data: notificationConfig.extraEmails
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error agregando email',
      error: error.message
    });
  }
});

// @desc    Eliminar email extra
// @route   DELETE /api/notifications/extra-email/:email
// @access  Private (Admin)
router.delete('/extra-email/:email', authorize('admin'), async (req, res) => {
  try {
    const { email } = req.params;

    const notificationConfig = await NotificationConfig.getOrCreateConfig();

    notificationConfig.extraEmails = notificationConfig.extraEmails.filter(
      extra => extra.email !== email
    );

    notificationConfig.lastUpdatedBy = req.user.id;
    await notificationConfig.save();

    res.json({
      success: true,
      message: 'Email eliminado exitosamente',
      data: notificationConfig.extraEmails
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error eliminando email',
      error: error.message
    });
  }
});

// @desc    Sincronizar usuarios del sistema
// @route   POST /api/notifications/sync-users
// @access  Private (Admin)
router.post('/sync-users', authorize('admin'), async (req, res) => {
  try {
    const notificationConfig = await NotificationConfig.getOrCreateConfig();
    const systemUsers = await User.find({ isActive: { $ne: false } }, 'name email');

    // Obtener usuarios actuales en configuración
    const currentUserIds = notificationConfig.userNotifications.map(u => u.userId.toString());

    // Agregar nuevos usuarios
    systemUsers.forEach(user => {
      if (!currentUserIds.includes(user._id.toString()) && user.email) {
        notificationConfig.userNotifications.push({
          userId: user._id,
          email: user.email,
          name: user.name,
          enabled: true
        });
      }
    });

    notificationConfig.lastUpdatedBy = req.user.id;
    await notificationConfig.save();

    res.json({
      success: true,
      message: 'Usuarios sincronizados exitosamente',
      data: notificationConfig.userNotifications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error sincronizando usuarios',
      error: error.message
    });
  }
});

module.exports = router;