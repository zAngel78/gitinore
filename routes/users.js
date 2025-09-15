const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @desc    Crear usuario admin de emergencia (solo si no hay admins)
// @route   POST /api/users/emergency-admin
// @access  Public (solo funciona si no hay admins en el sistema)
router.post('/emergency-admin', async (req, res) => {
  try {
    // Verificar si ya hay administradores
    const adminCount = await User.countDocuments({ role: 'admin' });

    if (adminCount > 0) {
      return res.status(400).json({
        message: 'Ya existen administradores en el sistema. Use el proceso normal.'
      });
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Todos los campos son requeridos' });
    }

    // Crear el primer admin
    const admin = await User.create({
      name,
      email,
      password,
      role: 'admin'
    });

    res.status(201).json({
      success: true,
      message: 'Administrador de emergencia creado exitosamente',
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear administrador', error: error.message });
  }
});

// Aplicar protección a todas las rutas restantes
router.use(protect);
router.use(authorize('admin')); // Solo administradores

// @desc    Obtener todos los usuarios
// @route   GET /api/users
// @access  Private (Admin)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;

    const query = {};

    if (role && role !== 'all') {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
  }
});

// @desc    Crear nuevo usuario
// @route   POST /api/users
// @access  Private (Admin)
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validaciones
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Todos los campos son requeridos' });
    }

    // Verificar si el email ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Ya existe un usuario con este email' });
    }

    // Validar rol
    const validRoles = ['admin', 'facturador', 'vendedor'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Rol inválido' });
    }

    // Crear usuario
    const user = await User.create({
      name,
      email,
      password, // Se hashea automáticamente en el modelo
      role
    });

    // Responder sin la contraseña
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      data: userResponse,
      credentials: {
        email: user.email,
        password: password // Enviar la contraseña original para compartir
      },
      message: 'Usuario creado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear usuario', error: error.message });
  }
});

// @desc    Actualizar usuario
// @route   PUT /api/users/:id
// @access  Private (Admin)
router.put('/:id', async (req, res) => {
  try {
    const { name, email, role, isActive } = req.body;
    const userId = req.params.id;

    // Verificar que el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar que no sea el mismo admin tratando de desactivarse
    if (userId === req.user.id && isActive === false) {
      return res.status(400).json({ message: 'No puedes desactivar tu propia cuenta' });
    }

    // Verificar email único si se está cambiando
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({ message: 'Ya existe un usuario con este email' });
      }
    }

    // Validar rol
    if (role) {
      const validRoles = ['admin', 'facturador', 'vendedor'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Rol inválido' });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, email, role, isActive },
      { new: true, select: '-password' }
    );

    res.json({
      success: true,
      data: updatedUser,
      message: 'Usuario actualizado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar usuario', error: error.message });
  }
});

// @desc    Resetear contraseña de usuario
// @route   PUT /api/users/:id/reset-password
// @access  Private (Admin)
router.put('/:id/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    const userId = req.params.id;

    if (!newPassword) {
      return res.status(400).json({ message: 'Nueva contraseña es requerida' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Hashear la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(userId, { password: hashedPassword });

    res.json({
      success: true,
      message: 'Contraseña reseteada exitosamente',
      newCredentials: {
        email: user.email,
        password: newPassword
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al resetear contraseña', error: error.message });
  }
});

// @desc    Eliminar usuario
// @route   DELETE /api/users/:id
// @access  Private (Admin)
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    // Verificar que no sea el mismo admin tratando de eliminarse
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar usuario', error: error.message });
  }
});

// @desc    Generar contraseña temporal
// @route   POST /api/users/generate-password
// @access  Private (Admin)
router.post('/generate-password', (req, res) => {
  try {
    // Generar contraseña temporal segura
    const length = 8;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let password = '';

    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    res.json({
      success: true,
      password: password
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al generar contraseña', error: error.message });
  }
});

// @desc    Obtener estadísticas de usuarios
// @route   GET /api/users/stats
// @access  Private (Admin)
router.get('/stats', async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
          admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          facturadores: { $sum: { $cond: [{ $eq: ['$role', 'facturador'] }, 1, 0] } },
          vendedores: { $sum: { $cond: [{ $eq: ['$role', 'vendedor'] }, 1, 0] } }
        }
      }
    ]);

    const summary = stats[0] || {
      total: 0,
      active: 0,
      admins: 0,
      facturadores: 0,
      vendedores: 0
    };

    summary.inactive = summary.total - summary.active;

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message });
  }
});

module.exports = router;