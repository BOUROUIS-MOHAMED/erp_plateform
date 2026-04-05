const mongoose = require('mongoose');
const Supplier = require('../models/Supplier');
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
 * Formatter un fournisseur pour le frontend
 */
const formatSupplier = (supplier) => ({
  id: supplier._id,
  name: supplier.name,
  code: supplier.code || '',
  contact: supplier.contact,
  email: supplier.email,
  phone: supplier.phone,
  address: supplier.address || '',
  status: supplier.status,
  rating: supplier.rating,
  products: supplier.products || 0,
  since: supplier.since.toISOString().split('T')[0]
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

// ===== GET /api/suppliers =====
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;

    // Construire le filtre
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contact: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [suppliers, total] = await Promise.all([
      Supplier.find(filter)
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Supplier.countDocuments(filter)
    ]);

    res.json({
      suppliers: suppliers.map(formatSupplier),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des fournisseurs');
  }
};

// ===== GET /api/suppliers/:id =====
exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;

    // Validation ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID fournisseur invalide' });
    }

    const supplier = await Supplier.findById(id).lean();
    if (!supplier) {
      return res.status(404).json({ message: 'Fournisseur non trouvé' });
    }

    // Récupérer les produits de ce fournisseur
    const products = await Product.find({ supplierId: supplier._id })
      .sort('-createdAt')
      .lean();

    res.json({
      ...formatSupplier(supplier),
      products: products.map(p => ({
        id: p._id,
        name: p.name,
        sku: p.sku || '',
        category: p.category,
        stock: p.stock,
        price: p.price,
        status: p.status
      }))
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération du fournisseur');
  }
};

// ===== POST /api/suppliers =====
exports.create = async (req, res) => {
  try {
    const { name, code, contact, email, phone, address, status, rating } = req.body;
    const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';

    // Validations
    if (!normalizedCode) {
      return res.status(400).json({ message: 'La clé unique du fournisseur est requise' });
    }
    if (!name) {
      return res.status(400).json({ message: 'Le nom est requis' });
    }
    if (!contact) {
      return res.status(400).json({ message: 'Le contact est requis' });
    }
    if (!email) {
      return res.status(400).json({ message: "L'email est requis" });
    }
    if (!phone) {
      return res.status(400).json({ message: 'Le téléphone est requis' });
    }

    // Vérifier si l'email existe déjà
    const existing = await Supplier.findOne({ email });
    const existingCode = await Supplier.findOne({
      code: { $regex: new RegExp(`^${escapeRegex(normalizedCode)}$`, 'i') }
    });
    if (existing) {
      return res.status(400).json({ message: 'Un fournisseur avec cet email existe déjà' });
    }

    if (existingCode) {
      return res.status(400).json({ message: 'Un fournisseur avec cette clé unique existe déjà' });
    }

    const supplier = new Supplier({
      name: name.trim(),
      code: normalizedCode,
      contact: contact.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      address: address?.trim() || '',
      status: status || 'actif',
      rating: parseFloat(rating) || 4,
      products: 0
    });

    await supplier.save();

    res.status(201).json(formatSupplier(supplier));
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Erreur de validation',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Un fournisseur avec cet email existe déjà' });
    }
    handleError(error, res, 'Erreur lors de la création du fournisseur');
  }
};

// ===== PUT /api/suppliers/:id =====
exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    // Validation ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID fournisseur invalide' });
    }

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ message: 'Fournisseur non trouvé' });
    }

    const { name, code, contact, email, phone, address, status, rating } = req.body;

    // Vérifier l'unicité de l'email si changé
    if (email && email !== supplier.email) {
      const existing = await Supplier.findOne({ 
        email: email.toLowerCase().trim(),
        _id: { $ne: id }
      });
      if (existing) {
        return res.status(400).json({ message: 'Un fournisseur avec cet email existe déjà' });
      }
      supplier.email = email.toLowerCase().trim();
    }

    if (code !== undefined) {
      const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
      if (!normalizedCode) {
        return res.status(400).json({ message: 'La clé unique du fournisseur est requise' });
      }

      if (normalizedCode !== (supplier.code || '')) {
        const existingCode = await Supplier.findOne({
          code: { $regex: new RegExp(`^${escapeRegex(normalizedCode)}$`, 'i') },
          _id: { $ne: id }
        });
        if (existingCode) {
          return res.status(400).json({ message: 'Un fournisseur avec cette clé unique existe déjà' });
        }
      }

      supplier.code = normalizedCode;
    }

    if (name) supplier.name = name.trim();
    if (contact) supplier.contact = contact.trim();
    if (phone) supplier.phone = phone.trim();
    if (address !== undefined) supplier.address = address.trim();
    if (status) supplier.status = status;
    if (rating) supplier.rating = parseFloat(rating);

    supplier.updatedAt = Date.now();
    await supplier.save();

    res.json(formatSupplier(supplier));
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Erreur de validation',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    handleError(error, res, 'Erreur lors de la modification du fournisseur');
  }
};

// ===== DELETE /api/suppliers/:id =====
exports.delete = async (req, res) => {
  const session = await startOptionalSession();

  try {
    const { id } = req.params;

    // Validation ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID fournisseur invalide' });
    }

    const supplier = await withOptionalSession(Supplier.findById(id), session);
    if (!supplier) {
      return res.status(404).json({ message: 'Fournisseur non trouvé' });
    }

    // Vérifier les produits associés
    const productCount = await withOptionalSession(Product.countDocuments({ supplierId: id }), session);
    if (productCount > 0) {
      // Option 1: Empêcher la suppression
      return res.status(400).json({
        message: `Impossible de supprimer un fournisseur avec ${productCount} produit(s) associé(s)`,
        productCount
      });

      // Option 2: Mettre à jour les produits (décommenter si souhaité)
      // await Product.updateMany(
      //   { supplierId: id },
      //   { $set: { supplierId: null } },
      //   { session }
      // );
    }

    await supplier.deleteOne(getSessionOptions(session));
    await commitOptionalTransaction(session);

    res.json({
      message: 'Fournisseur supprimé avec succès',
      id: supplier._id,
      name: supplier.name
    });
  } catch (error) {
    await abortOptionalTransaction(session);
    handleError(error, res, 'Erreur lors de la suppression du fournisseur');
  } finally {
    endOptionalSession(session);
  }
};

// ===== GET /api/suppliers/stats =====
exports.getStats = async (req, res) => {
  try {
    const [totalSuppliers, activeSuppliers, totalProducts] = await Promise.all([
      Supplier.countDocuments(),
      Supplier.countDocuments({ status: 'actif' }),
      Product.aggregate([
        { $match: { supplierId: { $ne: null } } },
        { $group: { _id: null, total: { $sum: 1 } } }
      ])
    ]);

    const ratingStats = await Supplier.aggregate([
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          minRating: { $min: '$rating' },
          maxRating: { $max: '$rating' }
        }
      }
    ]);

    const topSuppliers = await Supplier.find()
      .sort('-products')
      .limit(5)
      .lean();

    res.json({
      global: {
        totalSuppliers,
        activeSuppliers,
        inactiveSuppliers: totalSuppliers - activeSuppliers,
        totalProducts: totalProducts[0]?.total || 0,
        avgRating: ratingStats[0]?.avgRating || 0
      },
      topSuppliers: topSuppliers.map(formatSupplier)
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des statistiques');
  }
};
