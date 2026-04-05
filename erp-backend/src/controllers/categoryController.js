const mongoose = require('mongoose');
const Category = require('../models/Category');
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
 * Formatter une catégorie pour le frontend
 */
const formatCategory = (category) => ({
  id: category._id,
  name: category.name,
  code: category.code || '',
  description: category.description || '',
  productCount: category.productCount || 0
});

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

// ===== GET /api/categories =====
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    
    // Construire le filtre
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Exécuter en parallèle
    const [categories, total] = await Promise.all([
      Category.find(filter)
        .sort('name')
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Category.countDocuments(filter)
    ]);
    
    res.json({
      categories: categories.map(formatCategory),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des catégories');
  }
};

// ===== GET /api/categories/:id =====
exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validation ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID catégorie invalide' });
    }

    const category = await Category.findById(id).lean();
    if (!category) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    
    // Récupérer les produits de cette catégorie
    const products = await Product.find({ category: category.name })
      .populate('supplierId', 'name email phone')
      .sort('-createdAt')
      .limit(100)
      .lean();
    
    // Statistiques des produits
    const productStats = {
      total: products.length,
      inStock: products.filter(p => p.stock > 0).length,
      outOfStock: products.filter(p => p.stock === 0).length,
      totalValue: products.reduce((sum, p) => sum + (p.price * p.stock), 0)
    };
    
    res.json({
      ...formatCategory(category),
      products: products.map(p => ({
        id: p._id,
        name: p.name,
        sku: p.sku || '',
        stock: p.stock,
        price: p.price,
        status: p.status,
        supplier: p.supplierId ? {
          id: p.supplierId._id,
          name: p.supplierId.name
        } : null
      })),
      stats: productStats
    });
    
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération de la catégorie');
  }
};

// ===== POST /api/categories =====
exports.create = async (req, res) => {
  try {
    const { name, description, code } = req.body;
    const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    if (!normalizedCode) {
      return res.status(400).json({ message: 'La clé unique de la catégorie est requise' });
    }

    // Validation
    if (!name) {
      return res.status(400).json({ message: 'Le nom de la catégorie est requis' });
    }

    // Vérifier si la catégorie existe déjà
    const existing = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });
    const existingCode = await Category.findOne({
      code: { $regex: new RegExp(`^${escapeRegex(normalizedCode)}$`, 'i') }
    });
    
    if (existing) {
      return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà' });
    }

    if (existingCode) {
      return res.status(400).json({ message: 'Une catégorie avec cette clé unique existe déjà' });
    }

    const category = new Category({
      name: name.trim(),
      code: normalizedCode,
      description: description?.trim() || '',
      productCount: 0
    });
    
    await category.save();
    
    res.status(201).json(formatCategory(category));
    
  } catch (error) {
    // Gérer les erreurs de validation MongoDB
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Erreur de validation', 
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    if (error.code === 11000) { // Duplicate key
      return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà' });
    }
    handleError(error, res, 'Erreur lors de la création de la catégorie');
  }
};

// ===== PUT /api/categories/:id =====
exports.update = async (req, res) => {
  const session = await startOptionalSession();
  
  try {
    const { id } = req.params;
    const { name, description, code } = req.body;

    // Validation ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID catégorie invalide' });
    }

    const category = await withOptionalSession(Category.findById(id), session);
    if (!category) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    
    const oldName = category.name;
    
    // Vérifier l'unicité du nouveau nom
    if (name && name !== oldName) {
      const existing = await withOptionalSession(Category.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: id }
      }), session);
      
      if (existing) {
        await abortOptionalTransaction(session);
        return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà' });
      }
      
      category.name = name.trim();
      
      // Mettre à jour tous les produits avec cette catégorie
      await Product.updateMany(
        { category: oldName },
        { $set: { category: name.trim() } },
        getSessionOptions(session)
      );
    }

    if (code !== undefined) {
      const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
      if (!normalizedCode) {
        await abortOptionalTransaction(session);
        return res.status(400).json({ message: 'La clé unique de la catégorie est requise' });
      }

      if (normalizedCode !== (category.code || '')) {
        const existingCode = await withOptionalSession(Category.findOne({
          code: { $regex: new RegExp(`^${escapeRegex(normalizedCode)}$`, 'i') },
          _id: { $ne: id }
        }), session);

        if (existingCode) {
          await abortOptionalTransaction(session);
          return res.status(400).json({ message: 'Une catégorie avec cette clé unique existe déjà' });
        }
      }

      category.code = normalizedCode;
    }
    
    if (description !== undefined) {
      category.description = description?.trim() || '';
    }
    
    category.updatedAt = Date.now();
    await category.save(getSessionOptions(session));
    
    await commitOptionalTransaction(session);
    
    // Récupérer la catégorie mise à jour
    const updatedCategory = await Category.findById(id).lean();
    res.json(formatCategory(updatedCategory));
    
  } catch (error) {
    await abortOptionalTransaction(session);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Erreur de validation', 
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    handleError(error, res, 'Erreur lors de la modification de la catégorie');
    
  } finally {
    endOptionalSession(session);
  }
};

// ===== DELETE /api/categories/:id =====
exports.delete = async (req, res) => {
  const session = await startOptionalSession();
  
  try {
    const { id } = req.params;

    // Validation ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID catégorie invalide' });
    }

    const category = await withOptionalSession(Category.findById(id), session);
    if (!category) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    
    if (category.productCount > 0) {
      // Option 1: Empêcher la suppression
      return res.status(400).json({ 
        message: 'Impossible de supprimer une catégorie qui contient des produits',
        productCount: category.productCount
      });
      
      // Option 2: Décommenter pour déplacer les produits vers "Non catégorisé"
      // await Product.updateMany(
      //   { category: category.name },
      //   { $set: { category: 'Non catégorisé' } },
      //   { session }
      // );
    }
    
    // Vérifier si la catégorie est utilisée dans des produits archivés
    const archivedProducts = await withOptionalSession(Product.countDocuments({
      category: category.name,
      deletedAt: { $ne: null }
    }), session);
    
    if (archivedProducts > 0) {
      console.log(`ℹ️ ${archivedProducts} produits archivés utilisent cette catégorie`);
    }
    
    await category.deleteOne(getSessionOptions(session));
    
    await commitOptionalTransaction(session);
    
    res.json({ 
      message: 'Catégorie supprimée avec succès',
      id: category._id,
      name: category.name
    });
    
  } catch (error) {
    await abortOptionalTransaction(session);
    handleError(error, res, 'Erreur lors de la suppression de la catégorie');
    
  } finally {
    endOptionalSession(session);
  }
};

// ===== GET /api/categories/stats =====
exports.getStats = async (req, res) => {
  try {
    const stats = await Category.aggregate([
      {
        $group: {
          _id: null,
          totalCategories: { $sum: 1 },
          totalProducts: { $sum: '$productCount' },
          avgProductsPerCategory: { $avg: '$productCount' },
          maxProducts: { $max: '$productCount' },
          emptyCategories: { $sum: { $cond: [{ $eq: ['$productCount', 0] }, 1, 0] } }
        }
      }
    ]);

    const topCategories = await Category.find()
      .sort('-productCount')
      .limit(5)
      .lean();

    res.json({
      global: stats[0] || {
        totalCategories: 0,
        totalProducts: 0,
        avgProductsPerCategory: 0,
        maxProducts: 0,
        emptyCategories: 0
      },
      topCategories: topCategories.map(formatCategory)
    });
    
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des statistiques');
  }
};
