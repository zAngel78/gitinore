const nodemailer = require('nodemailer');

// Configuración del transporter de Gmail
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD, // App password, no la contraseña normal
    },
  });
};

// Plantilla de email para nuevo pedido
const generateNewOrderEmail = (order, customer, user) => {
  return {
    subject: `🆕 Nuevo Pedido #${order.order_number} - ${customer.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px;">
          <h1 style="margin: 0; font-size: 24px;">📦 Nuevo Pedido Creado</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Sistema de Pedidos y Facturación</p>
        </div>

        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #059669; margin: 0 0 10px 0; font-size: 18px;">Información del Pedido</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Número de Pedido:</td>
              <td style="padding: 8px 0; color: #059669; font-weight: bold;">#${order.order_number}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Cliente:</td>
              <td style="padding: 8px 0;">${customer.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Estado:</td>
              <td style="padding: 8px 0;"><span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 16px; font-size: 12px; text-transform: uppercase;">${order.status}</span></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Fecha de Entrega:</td>
              <td style="padding: 8px 0;">${new Date(order.delivery_due).toLocaleDateString('es-CL')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Total:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #059669; font-size: 16px;">$${order.total.toLocaleString('es-CL')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Creado por:</td>
              <td style="padding: 8px 0;">${user.name} (${user.role})</td>
            </tr>
          </table>
        </div>

        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #059669; margin: 0 0 15px 0; font-size: 16px;">Productos Solicitados</h3>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #e5e7eb;">
                <th style="padding: 12px; text-align: left; font-weight: bold; color: #374151; border-bottom: 1px solid #d1d5db;">Producto</th>
                <th style="padding: 12px; text-align: center; font-weight: bold; color: #374151; border-bottom: 1px solid #d1d5db;">Cantidad</th>
                <th style="padding: 12px; text-align: right; font-weight: bold; color: #374151; border-bottom: 1px solid #d1d5db;">Precio</th>
                <th style="padding: 12px; text-align: right; font-weight: bold; color: #374151; border-bottom: 1px solid #d1d5db;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 12px;">
                    <div style="font-weight: bold; color: #374151;">${item.product?.name || 'Producto eliminado'}</div>
                    ${item.brand ? `<div style="font-size: 12px; color: #6b7280;">Marca: ${item.brand}</div>` : ''}
                    ${item.format ? `<div style="font-size: 12px; color: #6b7280;">Formato: ${item.format}</div>` : ''}
                  </td>
                  <td style="padding: 12px; text-align: center;">${item.quantity} ${item.unit_of_measure}</td>
                  <td style="padding: 12px; text-align: right;">$${item.unit_price.toLocaleString('es-CL')}</td>
                  <td style="padding: 12px; text-align: right; font-weight: bold;">$${(item.quantity * item.unit_price).toLocaleString('es-CL')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${order.notes ? `
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
            <h4 style="margin: 0 0 8px 0; color: #92400e; font-size: 14px;">📝 Observaciones:</h4>
            <p style="margin: 0; color: #92400e;">${order.notes}</p>
          </div>
        ` : ''}

        <div style="background: #e0f2fe; padding: 15px; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #0277bd; font-size: 14px;">
            💡 <strong>¿Necesitas hacer cambios?</strong><br>
            Accede al sistema para gestionar este pedido
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            Este email fue enviado automáticamente por el Sistema de Pedidos y Facturación<br>
            Fecha: ${new Date().toLocaleString('es-CL')}
          </p>
        </div>
      </div>
    `
  };
};

// Función para enviar notificación de nuevo pedido
const sendNewOrderNotification = async (order, allUsers) => {
  try {
    const transporter = createTransporter();

    // Validar configuración
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.log('⚠️ Configuración de Gmail no encontrada - saltando envío de email');
      return { success: false, message: 'Configuración de Gmail no encontrada' };
    }

    // Populate data necesaria
    await order.populate([
      { path: 'customer', select: 'name email tax_id' },
      { path: 'items.product', select: 'name sku brand' },
      { path: 'createdBy', select: 'name email role' }
    ]);

    const emailContent = generateNewOrderEmail(order, order.customer, order.createdBy);

    // Enviar email a todos los usuarios activos
    const activeUsers = allUsers.filter(user => user.isActive !== false);
    const emailPromises = activeUsers.map(user => {
      if (!user.email) return Promise.resolve({ success: false, user: user.name, error: 'Sin email' });

      return transporter.sendMail({
        from: `"Sistema de Pedidos" <${process.env.GMAIL_USER}>`,
        to: user.email,
        ...emailContent
      }).then(() => ({
        success: true,
        user: user.name,
        email: user.email
      })).catch(error => ({
        success: false,
        user: user.name,
        email: user.email,
        error: error.message
      }));
    });

    const results = await Promise.allSettled(emailPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;

    console.log(`📧 Notificaciones enviadas: ${successful} exitosas, ${failed} fallidas`);

    return {
      success: true,
      sent: successful,
      failed: failed,
      details: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
    };

  } catch (error) {
    console.error('Error enviando notificaciones por email:', error);
    return { success: false, message: error.message };
  }
};

// Función para enviar email de prueba
const sendTestEmail = async (to) => {
  try {
    const transporter = createTransporter();

    await transporter.sendMail({
      from: `"Sistema de Pedidos" <${process.env.GMAIL_USER}>`,
      to: to,
      subject: '✅ Prueba de Configuración de Gmail',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <div style="text-align: center; color: #059669;">
            <h2>🎉 ¡Configuración Exitosa!</h2>
            <p>El sistema de notificaciones por Gmail está funcionando correctamente.</p>
            <p style="font-size: 12px; color: #666;">Fecha: ${new Date().toLocaleString('es-CL')}</p>
          </div>
        </div>
      `
    });

    return { success: true, message: 'Email de prueba enviado correctamente' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = {
  sendNewOrderNotification,
  sendTestEmail
};