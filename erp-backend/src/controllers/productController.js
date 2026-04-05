const mongoose = require('mongoose');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Category = require('../models/Category');
const StockMovement = require('../models/StockMovement');
const {
  abortOptionalTransaction,
  commitOptionalTransaction,
  endOptionalSession,
  getSessionOptions,
  startOptionalSession,
  withOptionalSession,
} = require('../utils/mongoTransaction');

/**
 * Formatter un produit pour le frontend
 * @param {Object} product - Produit MongoDB
 * @returns {Object} Produit formaté
 */
const formatProduct = (product) => ({
  id: product._id,
  name: product.name,
  sku: product.sku || '',
  category: product.category,
  stock: product.stock,
  price: product.price,
  status: product.status, // Utilise le virtual
  supplierId: product.supplierId?._id || product.supplierId,
  supplier: product.supplierId ? {
    id: product.supplierId._id,
    name: product.supplierId.name,
    code: product.supplierId.code || '',
    email: product.supplierId.email,
    phone: product.supplierId.phone,
    rating: product.supplierId.rating
  } : null,
  minStock: product.minStock,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt
});

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Gérer les erreurs de manière sécurisée
 * @param {Error} error - Erreur catchée
 * @param {Response} res - Express response
 * @param {string} defaultMessage - Message par défaut
 */
const handleError = (error, res, defaultMessage = 'Erreur serveur') => {
  console.error(`❌ ${defaultMessage}:`, error);
  
  // En production, ne pas exposer les détails techniques
  const message = process.env.NODE_ENV === 'production' 
    ? defaultMessage 
    : error.message;
  
  res.status(500).json({ message });
};

// ===== GET /api/products =====
exports.getAll = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      category, 
      status,
      search 
    } = req.query;

    // Construire le filtre
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Exécuter les requêtes en parallèle
    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('supplierId', 'name code email phone rating')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit))
        .lean(), // lean() pour meilleures performances
      
      Product.countDocuments(filter)
    ]);

    // Formater les produits
    const formattedProducts = products.map(formatProduct);
    
    res.json({
      products: formattedProducts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des produits');
  }
};

// ===== GET /api/products/:id =====
exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validation de l'ID MongoDB
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID produit invalide' });
    }

    // Récupérer le produit avec ses relations
    const product = await Product.findById(id)
      .populate('supplierId')
      .lean();

    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    // Récupérer les mouvements récents
    const movements = await StockMovement.find({ productId: product._id })
      .sort('-date')
      .limit(50)
      .lean();

    // Statistiques du produit
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
      product: formatProduct(product),
      movements: movements.map(m => ({
        id: m._id,
        date: m.date.toISOString().split('T')[0],
        product: m.product,
        productId: m.productId,
        type: m.type,
        quantity: m.quantity,
        user: m.user,
        userId: m.createdBy || '',
        note: m.note,
        reason: m.reason
      })),
      stats
    });
    
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération du produit');
  }
};

// ===== POST /api/products =====
exports.create = async (req, res) => {
  const createProduct = async (session = null) => {
    const { name, category, stock, price, supplierId, minStock = 5, sku } = req.body;
    const normalizedCategory = typeof category === 'string' ? category.trim() : '';
    const normalizedSku = typeof sku === 'string' ? sku.trim().toUpperCase() : '';

    if (!normalizedSku) {
      throw new Error('La clé unique du produit est requise');
    }

    // Validations
    if (!name || !category || !supplierId || !normalizedSku) {
      throw new Error('Nom, catégorie et fournisseur sont requis');
    }

    // Vérifier si le fournisseur existe
    const supplier = await withOptionalSession(Supplier.findById(supplierId), session);
    const categoryDoc = await withOptionalSession(Category.findOne({ name: normalizedCategory }), session);
    if (!categoryDoc) {
      throw new Error('Catégorie non trouvée. Créez-la d\'abord avec sa clé unique');
    }
    if (!supplier) {
      throw new Error('Fournisseur non trouvé');
    }

    // Vérifier si le produit existe déjà
    const existingProduct = await withOptionalSession(Product.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      supplierId 
    }), session);
    const existingSku = await withOptionalSession(Product.findOne({
      sku: { $regex: new RegExp(`^${escapeRegex(normalizedSku)}$`, 'i') }
    }), session);
    
    if (existingProduct) {
      throw new Error('Un produit avec ce nom existe déjà pour ce fournisseur');
    }

    // Créer le produit
    if (existingSku) {
      throw new Error('Un produit avec cette clé unique existe déjà');
    }

    const product = new Product({
      name: name.trim(),
      sku: normalizedSku,
      category: normalizedCategory,
      stock: parseInt(stock) || 0,
      price: parseFloat(price) || 0,
      supplierId,
      minStock: parseInt(minStock) || 5,
      createdBy: req.user?._id
    });

    await product.save(getSessionOptions(session));

    // Mettre à jour ou créer la catégorie
    categoryDoc.productCount += 1;
    await categoryDoc.save(getSessionOptions(session));

    // Mettre à jour le fournisseur
    supplier.products = (supplier.products || 0) + 1;
    await supplier.save(getSessionOptions(session));

    // Créer un mouvement pour le stock initial
    if (product.stock > 0) {
      const movement = new StockMovement({
        productId: product._id,
        product: product.name,
        type: 'entrée',
        quantity: product.stock,
        user: req.user?.email || 'system',
        note: 'Stock initial',
        reason: 'initial',
        createdBy: req.user?._id
      });
      await movement.save(getSessionOptions(session));
    }

    // Récupérer le produit avec ses relations
    const populatedProduct = await Product.findById(product._id)
      .populate('supplierId', 'name code email phone rating')
      .lean();

    return formatProduct(populatedProduct);
  };

  let session = null;

  try {
    session = await startOptionalSession();

    const createdProduct = await createProduct(session);
    await commitOptionalTransaction(session);
    res.status(201).json(createdProduct);

  } catch (error) {
    await abortOptionalTransaction(session);

    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Erreur de validation', 
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];
      const message = duplicateField === 'sku'
        ? 'Un produit avec cette clé unique existe déjà'
        : 'Une valeur unique existe déjà pour ce produit';
      return res.status(400).json({ message });
    }

    res.status(400).json({ message: error.message });

  } finally {
    endOptionalSession(session);
  }
};

// ===== PUT /api/products/:id =====
exports.update = async (req, res) => {
  const session = await startOptionalSession();
  
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validation de l'ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID produit invalide' });
    }

    // Récupérer le produit
    const product = await withOptionalSession(Product.findById(id), session);
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    const oldCategory = product.category;
    const oldSupplierId = product.supplierId.toString();
    const oldStock = product.stock;

    // Mettre à jour les champs
    const updatedFields = {};

    if (updates.name && updates.name !== product.name) {
      // Vérifier l'unicité du nom
      const existing = await withOptionalSession(Product.findOne({
        name: { $regex: new RegExp(`^${updates.name}$`, 'i') },
        supplierId: product.supplierId,
        _id: { $ne: id }
      }), session);
      
      if (existing) {
        throw new Error('Un produit avec ce nom existe déjà pour ce fournisseur');
      }
      
      product.name = updates.name.trim();
      updatedFields.name = true;
    }

    if (updates.sku !== undefined) {
      const nextSku = typeof updates.sku === 'string' ? updates.sku.trim().toUpperCase() : '';
      if (!nextSku) {
        throw new Error('La clé unique du produit est requise');
      }

      const currentSku = product.sku || '';
      if (nextSku !== currentSku) {
        const existingSku = await withOptionalSession(Product.findOne({
          sku: { $regex: new RegExp(`^${escapeRegex(nextSku)}$`, 'i') },
          _id: { $ne: id }
        }), session);

        if (existingSku) {
          throw new Error('Un produit avec cette clé unique existe déjà');
        }
      }

      product.sku = nextSku;
      updatedFields.sku = true;
    }

    if (updates.price !== undefined) {
      product.price = parseFloat(updates.price) || 0;
      updatedFields.price = true;
    }

    // Gestion du stock
    if (updates.stock !== undefined) {
      const newStock = parseInt(updates.stock) || 0;
      const difference = newStock - product.stock;
      
      if (difference !== 0) {
        // Créer un mouvement pour l'ajustement
        const movement = new StockMovement({
          productId: product._id,
          product: product.name,
          type: difference > 0 ? 'entrée' : 'sortie',
          quantity: Math.abs(difference),
          user: req.user?.email || 'system',
          note: updates.note || 'Ajustement manuel',
          reason: 'adjustment',
          createdBy: req.user?._id
        });
        await movement.save(getSessionOptions(session));
      }
      
      product.stock = newStock;
      updatedFields.stock = true;
    }

    if (updates.minStock !== undefined) {
      product.minStock = parseInt(updates.minStock) || 5;
      updatedFields.minStock = true;
    }

    // Gestion du changement de catégorie
    if (updates.category && updates.category !== product.category) {
      const nextCategoryName = updates.category.trim();
      const newCat = await withOptionalSession(Category.findOne({ name: nextCategoryName }), session);
      if (!newCat) {
        throw new Error('Catégorie non trouvée. Créez-la d\'abord avec sa clé unique');
      }

      product.category = nextCategoryName;
      updatedFields.category = true;

      // Mettre à jour l'ancienne catégorie
      const oldCat = await withOptionalSession(Category.findOne({ name: oldCategory }), session);
      if (oldCat) {
        oldCat.productCount = Math.max(0, (oldCat.productCount || 0) - 1);
        await oldCat.save(getSessionOptions(session));
      }

      // Mettre à jour la nouvelle catégorie
      newCat.productCount = (newCat.productCount || 0) + 1;
      await newCat.save(getSessionOptions(session));
    }

    // Gestion du changement de fournisseur
    if (updates.supplierId && updates.supplierId !== oldSupplierId) {
      // Vérifier le nouveau fournisseur
      const newSupplier = await withOptionalSession(Supplier.findById(updates.supplierId), session);
      if (!newSupplier) {
        throw new Error('Nouveau fournisseur non trouvé');
      }

      product.supplierId = updates.supplierId;
      updatedFields.supplierId = true;

      // Mettre à jour l'ancien fournisseur
      const oldSupp = await withOptionalSession(Supplier.findById(oldSupplierId), session);
      if (oldSupp) {
        oldSupp.products = Math.max(0, (oldSupp.products || 0) - 1);
        await oldSupp.save(getSessionOptions(session));
      }

      // Mettre à jour le nouveau fournisseur
      newSupplier.products = (newSupplier.products || 0) + 1;
      await newSupplier.save(getSessionOptions(session));
    }

    product.updatedAt = Date.now();
    product.updatedBy = req.user?._id;
    await product.save(getSessionOptions(session));

    await commitOptionalTransaction(session);

    // Récupérer le produit mis à jour
    const updatedProduct = await Product.findById(id)
      .populate('supplierId', 'name code email phone rating')
      .lean();

    res.json({
      ...formatProduct(updatedProduct),
      updated: Object.keys(updatedFields)
    });
    
  } catch (error) {
    await abortOptionalTransaction(session);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Erreur de validation', 
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];
      const message = duplicateField === 'sku'
        ? 'Un produit avec cette clé unique existe déjà'
        : 'Une valeur unique existe déjà pour ce produit';
      return res.status(400).json({ message });
    }
    
    res.status(400).json({ message: error.message });
    
  } finally {
    endOptionalSession(session);
  }
};

// ===== DELETE /api/products/:id =====
exports.delete = async (req, res) => {
  const session = await startOptionalSession();
  
  try {
    const { id } = req.params;

    // Validation de l'ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID produit invalide' });
    }

    const product = await withOptionalSession(Product.findById(id), session);
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    // Vérifier s'il y a des mouvements récents (moins de 24h)
    const recentMovements = await withOptionalSession(StockMovement.findOne({
      productId: id,
      date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }), session);

    if (recentMovements) {
      return res.status(400).json({ 
        message: 'Impossible de supprimer un produit avec des mouvements récents' 
      });
    }

    // Mettre à jour la catégorie
    const category = await withOptionalSession(Category.findOne({ name: product.category }), session);
    if (category) {
      category.productCount = Math.max(0, (category.productCount || 0) - 1);
      await category.save(getSessionOptions(session));
    }

    // Mettre à jour le fournisseur
    const supplier = await withOptionalSession(Supplier.findById(product.supplierId), session);
    if (supplier) {
      supplier.products = Math.max(0, (supplier.products || 0) - 1);
      await supplier.save(getSessionOptions(session));
    }

    // Archiver les mouvements au lieu de les supprimer
    await StockMovement.updateMany(
      { productId: id },
      { 
        $set: { 
          archived: true,
          archivedAt: new Date(),
          archivedBy: req.user?._id
        }
      },
      getSessionOptions(session)
    );

    // Soft delete du produit
    product.deletedAt = new Date();
    product.deletedBy = req.user?._id;
    product.status = 'deleted';
    await product.save(getSessionOptions(session));

    await commitOptionalTransaction(session);

    res.json({ 
      message: 'Produit supprimé avec succès',
      id: product._id
    });
    
  } catch (error) {
    await abortOptionalTransaction(session);
    handleError(error, res, 'Erreur lors de la suppression du produit');
    
  } finally {
    endOptionalSession(session);
  }
};

// ===== GET /api/products/stock/alert =====
exports.getLowStock = async (req, res) => {
  try {
    const { threshold } = req.query;
    
    // Filtrer les produits en dessous du seuil
    const filter = {
      $expr: { $lte: ['$stock', { $ifNull: ['$minStock', threshold || 10] }] },
      deletedAt: null // Exclure les produits supprimés
    };

    const products = await Product.find(filter)
      .populate('supplierId', 'name email phone')
      .sort('stock')
      .lean();

    // Statistiques globales
    const stats = {
      total: products.length,
      critical: products.filter(p => p.stock === 0).length,
      warning: products.filter(p => p.stock > 0 && p.stock < (p.minStock || 10)).length,
      totalValue: products.reduce((sum, p) => sum + (p.price * p.stock), 0)
    };

    res.json({
      alerts: products.map(p => ({
        id: p._id,
        name: p.name,
        stock: p.stock,
        minStock: p.minStock || 10,
        supplier: p.supplierId?.name,
        supplierContact: p.supplierId?.email,
        status: p.stock === 0 ? 'rupture' : 'stock faible',
        value: p.price * p.stock
      })),
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des alertes');
  }
};

// ===== PATCH /api/products/:id/stock =====
exports.updateStock = async (req, res) => {
  const session = await startOptionalSession();
  
  try {
    const { id } = req.params;
    const { quantity, reason = 'adjustment', note } = req.body;

    if (!quantity || quantity === 0) {
      return res.status(400).json({ message: 'Quantité requise' });
    }

    const product = await withOptionalSession(Product.findById(id), session);
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    const newStock = product.stock + quantity;
    if (newStock < 0) {
      return res.status(400).json({ 
        message: 'Stock insuffisant',
        currentStock: product.stock,
        requested: quantity
      });
    }

    // Créer le mouvement
    const movement = new StockMovement({
      productId: product._id,
      product: product.name,
      type: quantity > 0 ? 'entrée' : 'sortie',
      quantity: Math.abs(quantity),
      user: req.user?.email || 'system',
      note: note || `Ajustement de stock (${reason})`,
      reason,
      createdBy: req.user?._id
    });
    await movement.save(getSessionOptions(session));

    // Mettre à jour le stock
    product.stock = newStock;
    product.updatedAt = Date.now();
    product.updatedBy = req.user?._id;
    await product.save(getSessionOptions(session));

    await commitOptionalTransaction(session);

    res.json({
      product: {
        id: product._id,
        name: product.name,
        stock: product.stock,
        status: product.status
      },
      movement: {
        id: movement._id,
        type: movement.type,
        quantity: movement.quantity,
        date: movement.date
      }
    });
    
  } catch (error) {
    await abortOptionalTransaction(session);
    handleError(error, res, 'Erreur lors de la mise à jour du stock');
    
  } finally {
    endOptionalSession(session);
  }
};

// ===== PUT /api/products/update-category =====
exports.updateCategory = async (req, res) => {
  const session = await startOptionalSession();
  
  try {
    const { oldName, newName } = req.body;

    if (!oldName || !newName) {
      return res.status(400).json({ 
        message: 'Ancien et nouveau nom de catégorie requis' 
      });
    }

    // Mettre à jour tous les produits
    const result = await Product.updateMany(
      { category: oldName },
      { $set: { category: newName } },
      getSessionOptions(session)
    );

    // Mettre à jour la catégorie
    let category = await withOptionalSession(Category.findOne({ name: oldName }), session);
    if (category) {
      category.name = newName;
      await category.save(getSessionOptions(session));
    }

    await commitOptionalTransaction(session);

    res.json({
      message: 'Catégories mises à jour',
      modifiedCount: result.modifiedCount,
      oldName,
      newName
    });
    
  } catch (error) {
    await abortOptionalTransaction(session);
    handleError(error, res, 'Erreur lors de la mise à jour des catégories');
    
  } finally {
    endOptionalSession(session);
  }
};

// ===== GET /api/products/stats =====
exports.getStats = async (req, res) => {
  try {
    const [totalProducts, totalValue, lowStock, outOfStock] = await Promise.all([
      Product.countDocuments({ deletedAt: null }),
      Product.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: null, total: { $sum: { $multiply: ['$price', '$stock'] } } } }
      ]),
      Product.countDocuments({ 
        stock: { $gt: 0, $lt: 10 },
        deletedAt: null 
      }),
      Product.countDocuments({ 
        stock: 0,
        deletedAt: null 
      })
    ]);

    res.json({
      totalProducts,
      totalValue: totalValue[0]?.total || 0,
      lowStock,
      outOfStock,
      healthy: totalProducts - lowStock - outOfStock,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des statistiques');
  }
};
