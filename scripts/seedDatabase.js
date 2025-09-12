const mongoose = require('mongoose');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Order = require('../models/Order');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
};

const clearDatabase = async () => {
  try {
    await User.deleteMany({});
    await Customer.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    console.log('🗑️  Base de datos limpiada');
  } catch (error) {
    console.error('❌ Error limpiando base de datos:', error.message);
  }
};

const seedUsers = async () => {
  try {
    const users = [
      {
        name: 'Administrador',
        email: 'admin@empresa.cl',
        password: '123456',
        role: 'admin'
      },
      {
        name: 'Juan Vendedor',
        email: 'vendedor@empresa.cl',
        password: '123456',
        role: 'vendedor'
      },
      {
        name: 'María Facturadora',
        email: 'facturador@empresa.cl',
        password: '123456',
        role: 'facturador'
      }
    ];

    const createdUsers = [];
    for (const userData of users) {
      const user = await User.create(userData);
      createdUsers.push(user);
    }
    console.log('👥 Usuarios creados exitosamente');
    return createdUsers;
  } catch (error) {
    console.error('❌ Error creando usuarios:', error.message);
    return [];
  }
};

const seedCustomers = async (adminId) => {
  try {
    const customers = [
      {
        name: 'Ferretería El Martillo',
        tax_id: '96.789.123-4',
        email: 'compras@elmartillo.cl',
        phone: '+56912345678',
        address: {
          street: 'Av. Libertador 1234',
          city: 'Santiago',
          region: 'Región Metropolitana',
          postalCode: '8320000'
        },
        notes: 'Cliente VIP con descuentos especiales',
        createdBy: adminId
      },
      {
        name: 'Construcciones Pérez',
        tax_id: '78.456.789-1',
        email: 'info@construccionesperez.cl',
        phone: '+56987654321',
        address: {
          street: 'Calle San Martín 567',
          city: 'Valparaíso',
          region: 'Región de Valparaíso',
          postalCode: '2340000'
        },
        notes: 'Solicita factura electrónica siempre',
        createdBy: adminId
      },
      {
        name: 'Taller Mecánico Los Andes',
        tax_id: '12.345.678-9',
        email: 'taller@losandes.cl',
        phone: '+56956781234',
        address: {
          street: 'Ruta 57 Km 45',
          city: 'Los Andes',
          region: 'Región de Valparaíso',
          postalCode: '2100000'
        },
        notes: 'Pago contra entrega únicamente',
        createdBy: adminId
      },
      {
        name: 'Supermercado Santa Isabel',
        tax_id: '89.123.456-7',
        email: 'compras@santaisabel.cl',
        phone: '+56922334455',
        address: {
          street: 'Av. Providencia 2890',
          city: 'Santiago',
          region: 'Región Metropolitana',
          postalCode: '7500000'
        },
        createdBy: adminId
      }
    ];

    const createdCustomers = await Customer.insertMany(customers);
    console.log('🏢 Clientes creados exitosamente');
    return createdCustomers;
  } catch (error) {
    console.error('❌ Error creando clientes:', error.message);
    return [];
  }
};

const seedProducts = async (adminId) => {
  try {
    const products = [
      {
        sku: 'MART-001',
        name: 'Martillo Carpintero 16oz',
        description: 'Martillo profesional con mango de madera, cabeza de acero forjado',
        brand: 'Stanley',
        format: 'Unidad',
        unit_price: 15990,
        cost_price: 9500,
        stock: { current: 25, min_stock: 5 },
        category: 'Herramientas Manuales',
        unit_of_measure: 'unidad',
        createdBy: adminId
      },
      {
        sku: 'TORN-002',
        name: 'Tornillos Autorroscantes 3/4"',
        description: 'Tornillos autorroscantes galvanizados para madera',
        brand: 'Hilti',
        format: 'Caja 100 unidades',
        unit_price: 4500,
        cost_price: 2800,
        stock: { current: 8, min_stock: 10 },
        category: 'Tornillería',
        unit_of_measure: 'caja',
        createdBy: adminId
      },
      {
        sku: 'PINT-003',
        name: 'Pintura Látex Blanco',
        description: 'Pintura látex lavable para interiores, rendimiento 40m²/galón',
        brand: 'Sherwin Williams',
        format: 'Galón 3.78L',
        unit_price: 28900,
        cost_price: 18500,
        stock: { current: 15, min_stock: 8 },
        category: 'Pinturas',
        unit_of_measure: 'litro',
        createdBy: adminId
      },
      {
        sku: 'TUBE-004',
        name: 'Tubería PVC 110mm',
        description: 'Tubería PVC sanitaria clase 10, 6 metros',
        brand: 'Tigre',
        format: '6 metros',
        unit_price: 12300,
        cost_price: 8900,
        stock: { current: 30, min_stock: 12 },
        category: 'Plomería',
        unit_of_measure: 'metro',
        createdBy: adminId
      },
      {
        sku: 'ALAM-005',
        name: 'Alambre Galvanizado N°8',
        description: 'Alambre galvanizado calibre 8, rollo 25kg',
        brand: 'Gerdau',
        format: 'Rollo 25kg',
        unit_price: 35700,
        cost_price: 24500,
        stock: { current: 5, min_stock: 8 },
        category: 'Fierrería',
        unit_of_measure: 'kg',
        createdBy: adminId
      },
      {
        sku: 'CEMN-006',
        name: 'Cemento Especial',
        description: 'Cemento Portland especial para obras estructurales',
        brand: 'Melón',
        format: 'Saco 25kg',
        unit_price: 6890,
        cost_price: 5200,
        stock: { current: 50, min_stock: 20 },
        category: 'Cemento',
        unit_of_measure: 'kg',
        createdBy: adminId
      }
    ];

    const createdProducts = await Product.insertMany(products);
    console.log('📦 Productos creados exitosamente');
    return createdProducts;
  } catch (error) {
    console.error('❌ Error creando productos:', error.message);
    return [];
  }
};

const seedOrders = async (adminId, customers, products) => {
  try {
    if (!customers.length || !products.length) {
      console.log('⚠️  No hay clientes o productos para crear órdenes');
      return [];
    }

    const orders = [
      {
        customer: customers[0]._id,
        items: [
          {
            product: products[0]._id,
            quantity: 5,
            unit_price: products[0].unit_price,
            brand: products[0].brand,
            format: products[0].format,
            unit_of_measure: products[0].unit_of_measure,
            status: 'facturado'
          },
          {
            product: products[1]._id,
            quantity: 2,
            unit_price: products[1].unit_price,
            brand: products[1].brand,
            format: products[1].format,
            unit_of_measure: products[1].unit_of_measure,
            status: 'facturado'
          }
        ],
        status: 'facturado',
        delivery_due: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 días
        notes: 'Entrega en horario de mañana',
        location: 'Bodega principal',
        createdBy: adminId
      },
      {
        customer: customers[1]._id,
        items: [
          {
            product: products[2]._id,
            quantity: 3,
            unit_price: products[2].unit_price,
            brand: products[2].brand,
            format: products[2].format,
            unit_of_measure: products[2].unit_of_measure,
            status: 'compra'
          },
          {
            product: products[3]._id,
            quantity: 10,
            unit_price: products[3].unit_price,
            brand: products[3].brand,
            format: products[3].format,
            unit_of_measure: products[3].unit_of_measure,
            status: 'compra'
          }
        ],
        status: 'compra',
        delivery_due: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 días
        notes: 'Confirmar disponibilidad antes de facturar',
        createdBy: adminId
      },
      {
        customer: customers[2]._id,
        items: [
          {
            product: products[4]._id,
            quantity: 1,
            unit_price: products[4].unit_price,
            brand: products[4].brand,
            format: products[4].format,
            unit_of_measure: products[4].unit_of_measure,
            status: 'pendiente'
          }
        ],
        status: 'pendiente',
        delivery_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        notes: 'Cliente requiere cotización formal',
        createdBy: adminId
      },
      {
        customer: customers[0]._id,
        items: [
          {
            product: products[0]._id,
            quantity: 2,
            unit_price: products[0].unit_price,
            brand: products[0].brand,
            format: products[0].format,
            unit_of_measure: products[0].unit_of_measure,
            status: 'facturado'
          }
        ],
        status: 'facturado',
        delivery_due: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Vencido hace 2 días
        delivered_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Entregado ayer
        notes: 'Pedido urgente - entregado exitosamente',
        createdBy: adminId
      }
    ];

    const createdOrders = await Order.insertMany(orders);
    console.log('📋 Órdenes creadas exitosamente');
    return createdOrders;
  } catch (error) {
    console.error('❌ Error creando órdenes:', error.message);
    return [];
  }
};

const main = async () => {
  console.log('🚀 Iniciando inicialización de la base de datos...\n');
  
  await connectDB();
  
  console.log('⚠️  ¿Deseas limpiar la base de datos existente? (Se eliminará toda la data)');
  await clearDatabase();
  
  console.log('\n📝 Creando datos de prueba...\n');
  
  const users = await seedUsers();
  const adminUser = users.find(u => u.role === 'admin');
  
  if (!adminUser) {
    console.error('❌ No se pudo crear el usuario admin');
    return;
  }
  
  const customers = await seedCustomers(adminUser._id);
  const products = await seedProducts(adminUser._id);
  const orders = await seedOrders(adminUser._id, customers, products);
  
  console.log('\n✅ ¡Inicialización completada exitosamente!\n');
  console.log('🔐 CREDENCIALES DE ACCESO:\n');
  
  console.log('👑 ADMINISTRADOR:');
  console.log('   Email: admin@empresa.cl');
  console.log('   Contraseña: 123456');
  console.log('   Permisos: Acceso completo\n');
  
  console.log('🛍️  VENDEDOR:');
  console.log('   Email: vendedor@empresa.cl');
  console.log('   Contraseña: 123456');
  console.log('   Permisos: Crear pedidos, productos y clientes\n');
  
  console.log('📋 FACTURADOR:');
  console.log('   Email: facturador@empresa.cl');
  console.log('   Contraseña: 123456');
  console.log('   Permisos: Cambiar estados y marcar entregas\n');
  
  console.log('📊 DATOS CREADOS:');
  console.log(`   👥 ${users.length} usuarios`);
  console.log(`   🏢 ${customers.length} clientes`);
  console.log(`   📦 ${products.length} productos`);
  console.log(`   📋 ${orders.length} órdenes de prueba\n`);
  
  console.log('🌐 Frontend: http://localhost:5173');
  console.log('🔗 Backend:  http://localhost:5000\n');
  
  console.log('🎯 ¡Puedes iniciar sesión con cualquiera de las credenciales de arriba!\n');
  
  await mongoose.connection.close();
  console.log('📡 Conexión a MongoDB cerrada');
};

// Ejecutar el script
if (require.main === module) {
  main()
    .then(() => {
      console.log('🏁 Script completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error en el script:', error);
      process.exit(1);
    });
}

module.exports = { main };