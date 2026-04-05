const mongoose = require('mongoose');
const StockMovement = require('../models/StockMovement');
const Product = require('../models/Product');
const {
  abortOptionalTransaction,
  commitOptionalTransaction,
  endOptionalSession,
  getSessionOptions,
  startOptionalSession,
  withOptionalSession,
} = require('../utils/mongoTransaction');

/**
 * Formater un mouvement pour le frontend
 */
const formatMovement = (movement) => ({
  id: movement._id,
  date: movement.date.toISOString().split('T')[0],
  product: movement.product,
  productId: movement.productId?._id || movement.productId,
  supplierId: movement.productId?.supplierId?._id || movement.productId?.supplierId || '',
  type: movement.type,
  quantity: movement.quantity,
  user: movement.user,
  userId: movement.createdBy?._id || movement.createdBy || '',
  note: movement.note || '',
  reason: movement.reason
});

/**
 * Gérer les erreurs de manière sécurisée
 */
const handleError = (error, res, defaultMessage = 'Erreur serveur') => {
  console.error(`❌ ${defaultMessage}:`, error);
  const message = process.env.NODE_ENV === 'production' 
    ? defaultMessage 
    : error.message;
  res.status(500).json({ message });
};

// ===== GET /api/stock =====
exports.getAll = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 100, 
      productId, 
      startDate, 
      endDate, 
      type,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Construire le filtre
    const filter = {};
    if (productId) filter.productId = productId;
    if (type && type !== 'all') filter.type = type;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Construire le tri
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Exécuter en parallèle
    const [movements, total] = await Promise.all([
      StockMovement.find(filter)
        .populate('productId', 'name category price supplierId')
        .populate('createdBy', '_id')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockMovement.countDocuments(filter)
    ]);

    // Statistiques pour la page
    const stats = {
      totalEntries: movements.filter(m => m.type === 'entrée').reduce((s, m) => s + m.quantity, 0),
      totalExits: movements.filter(m => m.type === 'sortie').reduce((s, m) => s + Math.abs(m.quantity), 0)
    };

    res.json({
      movements: movements.map(m => ({
        ...formatMovement(m),
        productDetails: m.productId ? {
          name: m.productId.name,
          category: m.productId.category,
          price: m.productId.price,
          supplierId: m.productId.supplierId?._id || m.productId.supplierId || ''
        } : null
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      stats
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des mouvements');
  }
};

// ===== POST /api/stock/entry =====
exports.addEntry = async (req, res) => {
  const session = await startOptionalSession();

  try {
    const { productId, quantity, reason, notes } = req.body;

    // Validations
    if (!productId) {
      return res.status(400).json({ message: 'ID produit requis' });
    }
    if (!quantity || parseInt(quantity) <= 0) {
      return res.status(400).json({ message: 'Quantité valide requise' });
    }

    const product = await withOptionalSession(Product.findById(productId), session);
    if (!product) {
      throw new Error('Produit non trouvé');
    }

    // Créer le mouvement
    const movement = new StockMovement({
      productId: product._id,
      product: product.name,
      type: 'entrée',
      quantity: parseInt(quantity),
      user: req.user?.email || 'system',
      note: notes || '',
      reason: reason || 'adjustment',
      createdBy: req.user?._id
    });

    await movement.save(getSessionOptions(session));

    // Mettre à jour le stock
    const oldStock = product.stock;
    product.stock += parseInt(quantity);
    product.updatedAt = Date.now();
    product.updatedBy = req.user?._id;
    await product.save(getSessionOptions(session));

    await commitOptionalTransaction(session);

    // Log pour audit
    console.log(`✅ Entrée stock: ${quantity} x ${product.name} (${oldStock} → ${product.stock})`);

    res.status(201).json({
      movement: formatMovement(movement),
      product: {
        id: product._id,
        name: product.name,
        stock: product.stock,
        status: product.status
      }
    });
  } catch (error) {
    await abortOptionalTransaction(session);
    res.status(400).json({ message: error.message });
  } finally {
    endOptionalSession(session);
  }
};

// ===== POST /api/stock/exit =====
exports.addExit = async (req, res) => {
  const session = await startOptionalSession();

  try {
    const { productId, quantity, reason, notes } = req.body;

    // Validations
    if (!productId) {
      return res.status(400).json({ message: 'ID produit requis' });
    }
    if (!quantity || parseInt(quantity) <= 0) {
      return res.status(400).json({ message: 'Quantité valide requise' });
    }

    const product = await withOptionalSession(Product.findById(productId), session);
    if (!product) {
      throw new Error('Produit non trouvé');
    }

    // Vérifier stock suffisant
    const qty = parseInt(quantity);
    if (product.stock < qty) {
      return res.status(400).json({ 
        message: 'Stock insuffisant',
        currentStock: product.stock,
        requested: qty
      });
    }

    // Créer le mouvement
    const movement = new StockMovement({
      productId: product._id,
      product: product.name,
      type: 'sortie',
      quantity: qty,
      user: req.user?.email || 'system',
      note: notes || '',
      reason: reason || 'sale',
      createdBy: req.user?._id
    });

    await movement.save(getSessionOptions(session));

    // Mettre à jour le stock
    const oldStock = product.stock;
    product.stock -= qty;
    product.updatedAt = Date.now();
    product.updatedBy = req.user?._id;
    await product.save(getSessionOptions(session));

    await commitOptionalTransaction(session);

    // Log pour audit
    console.log(`✅ Sortie stock: ${qty} x ${product.name} (${oldStock} → ${product.stock})`);

    res.status(201).json({
      movement: formatMovement(movement),
      product: {
        id: product._id,
        name: product.name,
        stock: product.stock,
        status: product.status
      }
    });
  } catch (error) {
    await abortOptionalTransaction(session);
    res.status(400).json({ message: error.message });
  } finally {
    endOptionalSession(session);
  }
};

// ===== DELETE /api/stock/:id =====
exports.delete = async (req, res) => {
  const session = await startOptionalSession();

  try {
    const { id } = req.params;

    // Validation ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID mouvement invalide' });
    }

    const movement = await withOptionalSession(StockMovement.findById(id), session);
    if (!movement) {
      return res.status(404).json({ message: 'Mouvement non trouvé' });
    }

    // Vérifier si le mouvement est récent (moins de 24h)
    const hoursDiff = (Date.now() - movement.date) / (1000 * 60 * 60);
    if (hoursDiff > 24) {
      return res.status(400).json({ 
        message: 'Impossible de supprimer un mouvement de plus de 24h',
        movementDate: movement.date.toISOString().split('T')[0]
      });
    }

    const product = await withOptionalSession(Product.findById(movement.productId), session);
    if (!product) {
      throw new Error('Produit associé non trouvé');
    }

    // Inverser l'effet du mouvement sur le stock
    const oldStock = product.stock;
    if (movement.type === 'entrée') {
      product.stock -= movement.quantity;
    } else {
      product.stock += movement.quantity;
    }

    // Vérifier que le stock ne devient pas négatif
    if (product.stock < 0) {
      throw new Error('La suppression rendrait le stock négatif');
    }

    product.updatedAt = Date.now();
    product.updatedBy = req.user?._id;
    await product.save(getSessionOptions(session));

    await movement.deleteOne(getSessionOptions(session));
    await commitOptionalTransaction(session);

    // Log pour audit
    console.log(`✅ Mouvement supprimé: ${movement.type} ${movement.quantity} x ${product.name}`);

    res.json({ 
      message: 'Mouvement supprimé avec succès',
      movementId: movement._id,
      product: {
        id: product._id,
        name: product.name,
        stock: product.stock
      }
    });
  } catch (error) {
    await abortOptionalTransaction(session);
    res.status(400).json({ message: error.message });
  } finally {
    endOptionalSession(session);
  }
};

// ===== GET /api/stock/stats =====
exports.getStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    let groupBy;
    switch (period) {
      case 'day':
        groupBy = { 
          year: { $year: '$date' }, 
          month: { $month: '$date' }, 
          day: { $dayOfMonth: '$date' } 
        };
        break;
      case 'week':
        groupBy = { 
          year: { $year: '$date' }, 
          week: { $week: '$date' } 
        };
        break;
      default: // month
        groupBy = { 
          year: { $year: '$date' }, 
          month: { $month: '$date' } 
        };
    }

    const stats = await StockMovement.aggregate([
      {
        $group: {
          _id: groupBy,
          entries: {
            $sum: {
              $cond: [{ $eq: ['$type', 'entrée'] }, '$quantity', 0]
            }
          },
          exits: {
            $sum: {
              $cond: [{ $eq: ['$type', 'sortie'] }, '$quantity', 0]
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } }
    ]);

    // Statistiques globales
    const globalStats = await StockMovement.aggregate([
      {
        $group: {
          _id: null,
          totalEntries: {
            $sum: {
              $cond: [{ $eq: ['$type', 'entrée'] }, '$quantity', 0]
            }
          },
          totalExits: {
            $sum: {
              $cond: [{ $eq: ['$type', 'sortie'] }, '$quantity', 0]
            }
          },
          totalMovements: { $sum: 1 },
          uniqueProducts: { $addToSet: '$productId' }
        }
      },
      {
        $project: {
          _id: 0,
          totalEntries: 1,
          totalExits: 1,
          totalMovements: 1,
          uniqueProducts: { $size: '$uniqueProducts' }
        }
      }
    ]);

    // Top produits les plus mouvementés
    const topProducts = await StockMovement.aggregate([
      {
        $group: {
          _id: '$productId',
          totalMoved: { $sum: '$quantity' },
          entries: {
            $sum: {
              $cond: [{ $eq: ['$type', 'entrée'] }, '$quantity', 0]
            }
          },
          exits: {
            $sum: {
              $cond: [{ $eq: ['$type', 'sortie'] }, '$quantity', 0]
            }
          }
        }
      },
      { $sort: { totalMoved: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $project: {
          productId: '$_id',
          productName: { $arrayElemAt: ['$product.name', 0] },
          totalMoved: 1,
          entries: 1,
          exits: 1
        }
      }
    ]);

    res.json({
      period,
      stats,
      global: globalStats[0] || {
        totalEntries: 0,
        totalExits: 0,
        totalMovements: 0,
        uniqueProducts: 0
      },
      topProducts
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des statistiques');
  }
};

// ===== GET /api/stock/product/:productId =====
exports.getByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 50 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'ID produit invalide' });
    }

    const movements = await StockMovement.find({ productId })
      .sort('-date')
      .limit(parseInt(limit))
      .lean();

    // Calculer les stats pour ce produit
    const stats = {
      totalEntries: movements
        .filter(m => m.type === 'entrée')
        .reduce((sum, m) => sum + m.quantity, 0),
      totalExits: movements
        .filter(m => m.type === 'sortie')
        .reduce((sum, m) => sum + m.quantity, 0),
      lastMovement: movements[0] || null
    };

    res.json({
      productId,
      movements: movements.map(formatMovement),
      stats
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des mouvements du produit');
  }
};
