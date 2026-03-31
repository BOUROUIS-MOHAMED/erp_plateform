const { body, param, validationResult } = require('express-validator');

exports.validateCreateCategory = [
  body('name')
    .notEmpty().withMessage('Le nom est requis')
    .isLength({ min: 2, max: 100 }).withMessage('Le nom doit contenir entre 2 et 100 caractères')
    .trim()
    .escape(),
  
  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('La description ne peut pas dépasser 500 caractères')
    .trim()
    .escape()
];

exports.validateUpdateCategory = [
  param('id').isMongoId().withMessage('ID de catégorie invalide'),
  
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 }).withMessage('Le nom doit contenir entre 2 et 100 caractères')
    .trim()
    .escape(),
  
  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('La description ne peut pas dépasser 500 caractères')
    .trim()
    .escape(),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive']).withMessage('Le statut doit être active ou inactive')
];

exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};