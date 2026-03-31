// src/controllers/customerController.js
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const AuditLog = require('../models/AuditLog');

// Définir les fonctions comme des constantes
const createCustomer = async (req, res) => {
  try {
    const { email } = req.body;

    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return res.status(400).json({ 
        success: false, 
        message: 'Un client avec cet email existe déjà' 
      });
    }

    const customer = await Customer.create({
      ...req.body,
      createdBy: req.user.id
    });

    await AuditLog.create({
      user: req.user.id,
      action: 'CREATE',
      entity: 'CUSTOMER',
      entityId: customer._id,
      details: { 
        customerNumber: customer.customerNumber, 
        email: customer.email 
      },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      data: customer,
      message: 'Client créé avec succès'
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, isActive } = req.query;

    let query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }

    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('createdBy', 'firstName lastName');

    const total = await Customer.countDocuments(query);

    const customersWithStats = await Promise.all(
      customers.map(async (customer) => {
        const invoiceTotal = await Invoice.aggregate([
          { 
            $match: { 
              customer: customer._id, 
              status: 'payée' 
            } 
          },
          { 
            $group: { 
              _id: null, 
              total: { $sum: '$totalTTC' } 
            } 
          }
        ]);
        
        const invoiceCount = await Invoice.countDocuments({ 
          customer: customer._id 
        });

        return {
          ...customer.toObject(),
          totalPaid: invoiceTotal[0]?.total || 0,
          invoiceCount
        };
      })
    );

    res.json({
      success: true,
      data: customersWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');

    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client non trouvé' 
      });
    }

    const invoices = await Invoice.find({ customer: customer._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('invoiceNumber date totalTTC status');

    res.json({ 
      success: true, 
      data: {
        ...customer.toObject(),
        recentInvoices: invoices
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client non trouvé' 
      });
    }

    if (req.body.email && req.body.email !== customer.email) {
      const existingCustomer = await Customer.findOne({ 
        email: req.body.email,
        _id: { $ne: req.params.id }
      });
      if (existingCustomer) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cet email est déjà utilisé' 
        });
      }
    }

    Object.assign(customer, req.body);
    await customer.save();

    await AuditLog.create({
      user: req.user.id,
      action: 'UPDATE',
      entity: 'CUSTOMER',
      entityId: customer._id,
      details: { 
        customerNumber: customer.customerNumber,
        email: customer.email 
      },
      ipAddress: req.ip
    });

    res.json({ 
      success: true, 
      data: customer, 
      message: 'Client mis à jour avec succès' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client non trouvé' 
      });
    }

    const invoiceCount = await Invoice.countDocuments({ 
      customer: req.params.id 
    });

    if (invoiceCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Impossible de supprimer: ${invoiceCount} facture(s) associée(s)` 
      });
    }

    await customer.deleteOne();

    await AuditLog.create({
      user: req.user.id,
      action: 'DELETE',
      entity: 'CUSTOMER',
      entityId: req.params.id,
      details: { 
        customerNumber: customer.customerNumber,
        email: customer.email 
      },
      ipAddress: req.ip
    });

    res.json({ 
      success: true, 
      message: 'Client supprimé avec succès' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const toggleCustomerStatus = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client non trouvé' 
      });
    }

    customer.isActive = !customer.isActive;
    await customer.save();

    res.json({ 
      success: true, 
      message: `Client ${customer.isActive ? 'activé' : 'désactivé'}`,
      data: customer
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCustomerStats = async (req, res) => {
  try {
    const total = await Customer.countDocuments();
    const active = await Customer.countDocuments({ isActive: true });

    const topCustomers = await Invoice.aggregate([
      { $match: { status: 'payée' } },
      {
        $group: {
          _id: '$customer',
          totalSpent: { $sum: '$totalTTC' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
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
          'customer.firstName': 1,
          'customer.lastName': 1,
          'customer.email': 1,
          totalSpent: 1,
          invoiceCount: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        total,
        active,
        inactive: total - active,
        topCustomers
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ UN SEUL export à la fin avec TOUTES les fonctions
module.exports = {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  toggleCustomerStatus,
  getCustomerStats
};