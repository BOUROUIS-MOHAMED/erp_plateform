# Finance Module Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Budget page with new fields, add Targets and Money Flow pages with full backend/frontend, rename `Account.inBudget` → `inMoneyFlow`, and auto-sync MoneyFlow entries to Budget/Target records.

**Architecture:** Two new Mongoose models (Target, MoneyFlow) with full REST controllers + routes. Budget model loses `month/actual/variance` and gains `usedAmount/startDate/endDate`. A shared sync helper in moneyFlowController recalculates `Budget.usedAmount` (from expenses) and `Target.realisedAmount` (from revenues) after every MoneyFlow create/update/delete. Frontend adds two new tabs (Targets, Money Flow) and redesigns the Budget tab inside FinanceAdmin.jsx.

**Tech Stack:** Node.js/Express + Mongoose, React 19 + Vite, existing `protect`/`authorize` middleware, existing patterns from `budgetController.js` and `budgetRoutes.js`.

**Spec:** `docs/superpowers/specs/2026-04-01-finance-budget-targets-moneyflow-design.md`

---

## File Map

### Backend — create
- `erp-backend/src/models/Target.js`
- `erp-backend/src/models/MoneyFlow.js`
- `erp-backend/src/controllers/targetController.js`
- `erp-backend/src/controllers/moneyFlowController.js`
- `erp-backend/src/routes/targetRoutes.js`
- `erp-backend/src/routes/moneyFlowRoutes.js`

### Backend — modify
- `erp-backend/src/models/Budget.js` — swap old fields for usedAmount/startDate/endDate, new status enum
- `erp-backend/src/models/Account.js` — rename `inBudget` → `inMoneyFlow`
- `erp-backend/src/controllers/budgetController.js` — update create/update/formatBudget
- `erp-backend/src/controllers/accountController.js` — rename inBudget → inMoneyFlow
- `erp-backend/src/routes/budgetRoutes.js` — add PATCH /:id/used, remove POST /:id/actual
- `erp-backend/src/app.js` — register `/api/targets` and `/api/money-flow`

### Frontend — create
- `Front/src/services/targetService.js`
- `Front/src/services/moneyFlowService.js`

### Frontend — modify
- `Front/src/utils/frontendApiAdapters.js` — add mapTargetToUi/mapMoneyFlowToUi, update mapBudgetToUi/mapAccountToUi
- `Front/src/services/budgetService.js` — update create/update params
- `Front/src/services/accountService.js` — inBudget → inMoneyFlow
- `Front/src/pages/finance/FinanceAdmin.jsx` — Budget redesign + 2 new tabs

---

## Task 1: Update Account model — rename inBudget → inMoneyFlow

**Files:**
- Modify: `erp-backend/src/models/Account.js`

- [ ] **Step 1: Find and replace `inBudget` in the Account schema**

  Open `erp-backend/src/models/Account.js`. Find the line:
  ```js
  inBudget: { type: Boolean, default: false, index: true },
  ```
  Replace with:
  ```js
  inMoneyFlow: { type: Boolean, default: false, index: true },
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add erp-backend/src/models/Account.js
  git commit -m "feat: rename Account.inBudget to inMoneyFlow"
  ```

---

## Task 2: Update Account controller — inBudget → inMoneyFlow

**Files:**
- Modify: `erp-backend/src/controllers/accountController.js`

- [ ] **Step 1: Update `formatAccount`**

  Find `inBudget: Boolean(account.inBudget)` in `formatAccount` and replace with:
  ```js
  inMoneyFlow: Boolean(account.inMoneyFlow ?? account.inBudget),
  ```
  *(fallback reads old field for safety during migration)*

- [ ] **Step 2: Update `create` handler**

  Find `inBudget: Boolean(req.body.inBudget)` and replace with:
  ```js
  inMoneyFlow: Boolean(req.body.inMoneyFlow ?? req.body.inBudget),
  ```

- [ ] **Step 3: Update `update` handler**

  Find the `inBudget` block (around line 361):
  ```js
  if (updates.inBudget !== undefined) {
    account.inBudget = Boolean(updates.inBudget);
  ```
  Replace with:
  ```js
  if (updates.inMoneyFlow !== undefined || updates.inBudget !== undefined) {
    account.inMoneyFlow = Boolean(updates.inMoneyFlow ?? updates.inBudget);
  ```

- [ ] **Step 4: Update `getAll` filter**

  In `exports.getAll`, find any filter using `inBudget` and add:
  ```js
  if (req.query.inMoneyFlow !== undefined) {
    filter.inMoneyFlow = req.query.inMoneyFlow === 'true';
  }
  ```

- [ ] **Step 5: Commit**
  ```bash
  git add erp-backend/src/controllers/accountController.js
  git commit -m "feat: update accountController for inMoneyFlow rename"
  ```

---

## Task 3: Rewrite Budget model

**Files:**
- Modify: `erp-backend/src/models/Budget.js`

- [ ] **Step 1: Replace the entire Budget schema**

  Replace the contents of `erp-backend/src/models/Budget.js` with:

  ```js
  // models/Budget.js
  const mongoose = require('mongoose');

  const budgetSchema = new mongoose.Schema({
    category: {
      type: String,
      required: [true, 'La catégorie est requise'],
      trim: true,
      set: v => String(v).toLowerCase().trim(),
      index: true
    },
    budget: {
      type: Number,
      required: [true, 'Le montant du budget est requis'],
      min: [0, 'Le budget ne peut pas être négatif'],
      set: v => Math.round(v * 100) / 100
    },
    usedAmount: {
      type: Number,
      default: 0,
      min: [0, 'Le montant utilisé ne peut pas être négatif'],
      set: v => Math.round(v * 100) / 100
    },
    startDate: {
      type: Date,
      required: [true, 'La date de début est requise']
    },
    endDate: {
      type: Date,
      required: [true, 'La date de fin est requise']
    },
    status: {
      type: String,
      enum: ['desactivated', 'respected', 'passed'],
      default: 'respected'
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Les notes ne peuvent pas dépasser 500 caractères']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }, { timestamps: true });

  // Auto-calculate status on every save (skip if desactivated)
  budgetSchema.pre('save', function () {
    if (this.status !== 'desactivated') {
      this.status = this.usedAmount > this.budget ? 'passed' : 'respected';
    }
  });

  module.exports = mongoose.model('Budget', budgetSchema);
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add erp-backend/src/models/Budget.js
  git commit -m "feat: redesign Budget model (usedAmount, startDate, endDate, new status enum)"
  ```

---

## Task 4: Create Target model

**Files:**
- Create: `erp-backend/src/models/Target.js`

- [ ] **Step 1: Create the file**

  ```js
  // models/Target.js
  const mongoose = require('mongoose');

  const targetSchema = new mongoose.Schema({
    category: {
      type: String,
      required: [true, 'La catégorie est requise'],
      trim: true,
      set: v => String(v).toLowerCase().trim(),
      index: true
    },
    amount: {
      type: Number,
      required: [true, "L'objectif est requis"],
      min: [0, "L'objectif ne peut pas être négatif"],
      set: v => Math.round(v * 100) / 100
    },
    realisedAmount: {
      type: Number,
      default: 0,
      min: [0, 'Le réalisé ne peut pas être négatif'],
      set: v => Math.round(v * 100) / 100
    },
    status: {
      type: String,
      enum: ['desactivated', 'in_progress', 'reached', 'failed'],
      default: 'in_progress'
    },
    startDate: {
      type: Date,
      required: [true, 'La date de début est requise']
    },
    endDate: {
      type: Date,
      required: [true, 'La date de fin est requise']
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Les notes ne peuvent pas dépasser 500 caractères']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }, { timestamps: true });

  // Auto-calculate status on every save (skip if desactivated)
  targetSchema.pre('save', function () {
    if (this.status === 'desactivated') return;
    if (this.realisedAmount >= this.amount) {
      this.status = 'reached';
    } else if (this.endDate < new Date()) {
      this.status = 'failed';
    } else {
      this.status = 'in_progress';
    }
  });

  // Virtual: progression percentage (0-100)
  targetSchema.virtual('progression').get(function () {
    if (!this.amount) return 0;
    return Math.min((this.realisedAmount / this.amount) * 100, 100);
  });

  targetSchema.set('toJSON', { virtuals: true });
  targetSchema.set('toObject', { virtuals: true });

  module.exports = mongoose.model('Target', targetSchema);
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add erp-backend/src/models/Target.js
  git commit -m "feat: add Target model"
  ```

---

## Task 5: Create MoneyFlow model

**Files:**
- Create: `erp-backend/src/models/MoneyFlow.js`

- [ ] **Step 1: Create the file**

  ```js
  // models/MoneyFlow.js
  const mongoose = require('mongoose');

  const moneyFlowSchema = new mongoose.Schema({
    category: {
      type: String,
      required: [true, 'La catégorie est requise'],
      trim: true,
      set: v => String(v).toLowerCase().trim(),
      index: true
    },
    amount: {
      type: Number,
      required: [true, 'Le montant est requis'],
      min: [0, 'Le montant ne peut pas être négatif'],
      set: v => Math.round(v * 100) / 100
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    },
    isExpense: {
      type: Boolean,
      required: [true, 'Le type (dépense/revenu) est requis']
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'La note ne peut pas dépasser 500 caractères']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }, { timestamps: true });

  module.exports = mongoose.model('MoneyFlow', moneyFlowSchema);
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add erp-backend/src/models/MoneyFlow.js
  git commit -m "feat: add MoneyFlow model"
  ```

---

## Task 6: Update Budget controller

**Files:**
- Modify: `erp-backend/src/controllers/budgetController.js`

- [ ] **Step 1: Replace `formatBudget`**

  Find and replace the `formatBudget` function:
  ```js
  const formatBudget = (budget) => ({
    id: budget._id,
    category: budget.category,
    budget: budget.budget,
    usedAmount: budget.usedAmount || 0,
    startDate: budget.startDate,
    endDate: budget.endDate,
    status: budget.status,
    notes: budget.notes,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt
  });
  ```

- [ ] **Step 2: Replace `exports.create`**

  ```js
  exports.create = async (req, res) => {
    try {
      const { category, budget, usedAmount, startDate, endDate, notes } = req.body;
      if (!category || budget === undefined || !startDate || !endDate) {
        return res.status(400).json({ message: 'Catégorie, montant, date début et date fin sont requis' });
      }
      const newBudget = new Budget({
        category,
        budget: parseFloat(budget),
        usedAmount: parseFloat(usedAmount) || 0,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        notes: notes || '',
        createdBy: req.user._id
      });
      await newBudget.save();
      await AuditLog.create({
        user: req.user._id, action: 'CREATE', entity: 'BUDGET',
        entityId: newBudget._id,
        details: { category: newBudget.category, budget: newBudget.budget },
        ipAddress: req.ip
      });
      res.status(201).json({ success: true, data: formatBudget(newBudget), message: 'Budget créé avec succès' });
    } catch (error) {
      handleError(error, res, 'Erreur lors de la création du budget');
    }
  };
  ```

- [ ] **Step 3: Replace `exports.update`**

  ```js
  exports.update = async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID invalide' });
      const budget = await Budget.findById(id);
      if (!budget) return res.status(404).json({ message: 'Budget non trouvé' });

      const { category, budget: amount, usedAmount, startDate, endDate, notes, status } = req.body;
      if (category !== undefined) budget.category = category;
      if (amount !== undefined) budget.budget = parseFloat(amount);
      if (usedAmount !== undefined) budget.usedAmount = parseFloat(usedAmount);
      if (startDate !== undefined) budget.startDate = new Date(startDate);
      if (endDate !== undefined) budget.endDate = new Date(endDate);
      if (notes !== undefined) budget.notes = notes;
      // Allow manually setting desactivated; other statuses are auto-calculated in pre-save
      if (status === 'desactivated') budget.status = 'desactivated';
      else if (budget.status === 'desactivated' && status !== undefined) budget.status = status;

      budget.updatedBy = req.user._id;
      await budget.save();
      await AuditLog.create({
        user: req.user._id, action: 'UPDATE', entity: 'BUDGET', entityId: budget._id,
        details: { category: budget.category }, ipAddress: req.ip
      });
      res.json({ success: true, data: formatBudget(budget), message: 'Budget modifié' });
    } catch (error) {
      handleError(error, res, 'Erreur lors de la modification du budget');
    }
  };
  ```

- [ ] **Step 4: Add `exports.updateUsed` (manual override endpoint)**

  Add after `exports.update`:
  ```js
  exports.updateUsed = async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID invalide' });
      const budget = await Budget.findById(id);
      if (!budget) return res.status(404).json({ message: 'Budget non trouvé' });
      const { usedAmount } = req.body;
      if (usedAmount === undefined) return res.status(400).json({ message: 'usedAmount requis' });
      budget.usedAmount = parseFloat(usedAmount);
      budget.updatedBy = req.user._id;
      await budget.save();
      res.json({ success: true, data: formatBudget(budget) });
    } catch (error) {
      handleError(error, res, 'Erreur lors de la mise à jour du montant utilisé');
    }
  };
  ```

- [ ] **Step 5: Remove or update `exports.updateActual` and `exports.getStats`/`getByMonth` to not use `month`**

  Remove `exports.updateActual` (replaced by `updateUsed`).
  Update `getAll` to filter by `startDate`/`endDate` instead of `month`. Replace the filter block:
  ```js
  const { page = 1, limit = 50, status, category, startDate, endDate } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = { $regex: category, $options: 'i' };
  if (startDate) filter.startDate = { $gte: new Date(startDate) };
  if (endDate) filter.endDate = { $lte: new Date(endDate) };
  ```

- [ ] **Step 6: Export `updateUsed` at the bottom of the file**

  Find the exports block at the bottom and add:
  ```js
  exports.updateUsed = exports.updateUsed;
  ```
  (Or just ensure the function is exported inline as shown above.)

- [ ] **Step 7: Commit**
  ```bash
  git add erp-backend/src/controllers/budgetController.js
  git commit -m "feat: update budgetController for new Budget fields"
  ```

---

## Task 7: Update Budget routes

**Files:**
- Modify: `erp-backend/src/routes/budgetRoutes.js`

- [ ] **Step 1: Replace the entire routes file**

  ```js
  // routes/budgetRoutes.js
  const express = require('express');
  const router = express.Router();
  const budgetController = require('../controllers/budgetController');
  const { protect, authorize } = require('../middleware/auth');

  router.use(protect);

  const adminOnly = authorize('admin_principal', 'admin_finance');

  router.get('/stats', budgetController.getStats);
  router.get('/', budgetController.getAll);
  router.get('/:id', budgetController.getById);
  router.post('/', adminOnly, budgetController.create);
  router.put('/:id', adminOnly, budgetController.update);
  router.patch('/:id/used', adminOnly, budgetController.updateUsed);
  router.delete('/:id', adminOnly, budgetController.delete);

  module.exports = router;
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add erp-backend/src/routes/budgetRoutes.js
  git commit -m "feat: update budgetRoutes (add PATCH /used, remove old actual route)"
  ```

---

## Task 8: Create Target controller

**Files:**
- Create: `erp-backend/src/controllers/targetController.js`

- [ ] **Step 1: Create the file**

  ```js
  // controllers/targetController.js
  const mongoose = require('mongoose');
  const Target = require('../models/Target');
  const AuditLog = require('../models/AuditLog');

  const formatTarget = (target) => ({
    id: target._id,
    category: target.category,
    amount: target.amount,
    realisedAmount: target.realisedAmount || 0,
    progression: target.amount > 0
      ? Math.min((target.realisedAmount / target.amount) * 100, 100)
      : 0,
    status: target.status,
    startDate: target.startDate,
    endDate: target.endDate,
    notes: target.notes,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt
  });

  const handleError = (error, res, msg = 'Erreur serveur') => {
    console.error(msg, error);
    res.status(500).json({ message: process.env.NODE_ENV === 'production' ? msg : error.message });
  };

  exports.getAll = async (req, res) => {
    try {
      const { page = 1, limit = 50, status, category } = req.query;
      const filter = {};
      if (status) filter.status = status;
      if (category) filter.category = { $regex: category, $options: 'i' };
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [targets, total] = await Promise.all([
        Target.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
        Target.countDocuments(filter)
      ]);
      res.json({ success: true, data: targets.map(formatTarget), pagination: { page: parseInt(page), limit: parseInt(limit), total } });
    } catch (error) {
      handleError(error, res, 'Erreur lors de la récupération des objectifs');
    }
  };

  exports.getById = async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
      const target = await Target.findById(req.params.id).lean();
      if (!target) return res.status(404).json({ message: 'Objectif non trouvé' });
      res.json({ success: true, data: formatTarget(target) });
    } catch (error) {
      handleError(error, res, 'Erreur lors de la récupération de l\'objectif');
    }
  };

  exports.create = async (req, res) => {
    try {
      const { category, amount, realisedAmount, startDate, endDate, notes } = req.body;
      if (!category || amount === undefined || !startDate || !endDate) {
        return res.status(400).json({ message: 'Catégorie, objectif, date début et date fin sont requis' });
      }
      const target = new Target({
        category,
        amount: parseFloat(amount),
        realisedAmount: parseFloat(realisedAmount) || 0,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        notes: notes || '',
        createdBy: req.user._id
      });
      await target.save();
      await AuditLog.create({ user: req.user._id, action: 'CREATE', entity: 'TARGET', entityId: target._id, details: { category: target.category }, ipAddress: req.ip });
      res.status(201).json({ success: true, data: formatTarget(target), message: 'Objectif créé' });
    } catch (error) {
      handleError(error, res, 'Erreur lors de la création de l\'objectif');
    }
  };

  exports.update = async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
      const target = await Target.findById(req.params.id);
      if (!target) return res.status(404).json({ message: 'Objectif non trouvé' });
      const { category, amount, realisedAmount, startDate, endDate, notes, status } = req.body;
      if (category !== undefined) target.category = category;
      if (amount !== undefined) target.amount = parseFloat(amount);
      if (realisedAmount !== undefined) target.realisedAmount = parseFloat(realisedAmount);
      if (startDate !== undefined) target.startDate = new Date(startDate);
      if (endDate !== undefined) target.endDate = new Date(endDate);
      if (notes !== undefined) target.notes = notes;
      if (status === 'desactivated') target.status = 'desactivated';
      else if (target.status === 'desactivated' && status !== undefined) target.status = status;
      target.updatedBy = req.user._id;
      await target.save();
      await AuditLog.create({ user: req.user._id, action: 'UPDATE', entity: 'TARGET', entityId: target._id, details: { category: target.category }, ipAddress: req.ip });
      res.json({ success: true, data: formatTarget(target), message: 'Objectif modifié' });
    } catch (error) {
      handleError(error, res, 'Erreur lors de la modification de l\'objectif');
    }
  };

  exports.updateRealised = async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
      const target = await Target.findById(req.params.id);
      if (!target) return res.status(404).json({ message: 'Objectif non trouvé' });
      const { realisedAmount } = req.body;
      if (realisedAmount === undefined) return res.status(400).json({ message: 'realisedAmount requis' });
      target.realisedAmount = parseFloat(realisedAmount);
      target.updatedBy = req.user._id;
      await target.save();
      res.json({ success: true, data: formatTarget(target) });
    } catch (error) {
      handleError(error, res, 'Erreur lors de la mise à jour du réalisé');
    }
  };

  exports.delete = async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
      const target = await Target.findById(req.params.id);
      if (!target) return res.status(404).json({ message: 'Objectif non trouvé' });
      await target.deleteOne();
      await AuditLog.create({ user: req.user._id, action: 'DELETE', entity: 'TARGET', entityId: req.params.id, details: { category: target.category }, ipAddress: req.ip });
      res.json({ success: true, message: 'Objectif supprimé' });
    } catch (error) {
      handleError(error, res, 'Erreur lors de la suppression de l\'objectif');
    }
  };
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add erp-backend/src/controllers/targetController.js
  git commit -m "feat: add targetController"
  ```

---

## Task 9: Create Target routes

**Files:**
- Create: `erp-backend/src/routes/targetRoutes.js`

- [ ] **Step 1: Create the file**

  ```js
  // routes/targetRoutes.js
  const express = require('express');
  const router = express.Router();
  const targetController = require('../controllers/targetController');
  const { protect, authorize } = require('../middleware/auth');

  router.use(protect);
  const adminOnly = authorize('admin_principal', 'admin_finance');

  router.get('/', targetController.getAll);
  router.get('/:id', targetController.getById);
  router.post('/', adminOnly, targetController.create);
  router.put('/:id', adminOnly, targetController.update);
  router.patch('/:id/realised', adminOnly, targetController.updateRealised);
  router.delete('/:id', adminOnly, targetController.delete);

  module.exports = router;
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add erp-backend/src/routes/targetRoutes.js
  git commit -m "feat: add targetRoutes"
  ```

---

## Task 10: Create MoneyFlow controller (with auto-sync)

**Files:**
- Create: `erp-backend/src/controllers/moneyFlowController.js`

- [ ] **Step 1: Create the file**

  ```js
  // controllers/moneyFlowController.js
  const mongoose = require('mongoose');
  const MoneyFlow = require('../models/MoneyFlow');
  const Budget = require('../models/Budget');
  const Target = require('../models/Target');
  const AuditLog = require('../models/AuditLog');

  const formatEntry = (entry) => ({
    id: entry._id,
    category: entry.category,
    amount: entry.amount,
    date: entry.date,
    isExpense: entry.isExpense,
    note: entry.note,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  });

  const handleError = (error, res, msg = 'Erreur serveur') => {
    console.error(msg, error);
    res.status(500).json({ message: process.env.NODE_ENV === 'production' ? msg : error.message });
  };

  // Recalculate usedAmount (budgets) and realisedAmount (targets) for a given category
  const syncCategory = async (category) => {
    const re = new RegExp('^' + category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');

    // Sync budgets — sum of expense entries
    const budgets = await Budget.find({ category: re });
    for (const budget of budgets) {
      const expenseEntries = await MoneyFlow.find({ category: re, isExpense: true });
      budget.usedAmount = expenseEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
      await budget.save();
    }

    // Sync targets — sum of revenue entries
    const targets = await Target.find({ category: re });
    for (const target of targets) {
      const revenueEntries = await MoneyFlow.find({ category: re, isExpense: false });
      target.realisedAmount = revenueEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
      await target.save();
    }
  };

  exports.getAll = async (req, res) => {
    try {
      const { page = 1, limit = 100, isExpense, category, startDate, endDate } = req.query;
      const filter = {};
      if (isExpense !== undefined) filter.isExpense = isExpense === 'true';
      if (category) filter.category = { $regex: category, $options: 'i' };
      if (startDate) filter.date = { ...filter.date, $gte: new Date(startDate) };
      if (endDate) filter.date = { ...filter.date, $lte: new Date(endDate) };
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [entries, total] = await Promise.all([
        MoneyFlow.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
        MoneyFlow.countDocuments(filter)
      ]);
      res.json({ success: true, data: entries.map(formatEntry), pagination: { page: parseInt(page), limit: parseInt(limit), total } });
    } catch (error) {
      handleError(error, res, 'Erreur lors de la récupération des flux');
    }
  };

  exports.getById = async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
      const entry = await MoneyFlow.findById(req.params.id).lean();
      if (!entry) return res.status(404).json({ message: 'Entrée non trouvée' });
      res.json({ success: true, data: formatEntry(entry) });
    } catch (error) {
      handleError(error, res, 'Erreur lors de la récupération du flux');
    }
  };

  exports.create = async (req, res) => {
    try {
      const { category, amount, date, isExpense, note } = req.body;
      if (!category || amount === undefined || isExpense === undefined) {
        return res.status(400).json({ message: 'Catégorie, montant et type (dépense/revenu) sont requis' });
      }
      const entry = new MoneyFlow({
        category,
        amount: parseFloat(amount),
        date: date ? new Date(date) : new Date(),
        isExpense: Boolean(isExpense),
        note: note || '',
        createdBy: req.user._id
      });
      await entry.save();
      await syncCategory(entry.category);
      await AuditLog.create({ user: req.user._id, action: 'CREATE', entity: 'MONEYFLOW', entityId: entry._id, details: { category: entry.category, isExpense: entry.isExpense }, ipAddress: req.ip });
      res.status(201).json({ success: true, data: formatEntry(entry), message: 'Flux créé' });
    } catch (error) {
      handleError(error, res, 'Erreur lors de la création du flux');
    }
  };

  exports.update = async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
      const existing = await MoneyFlow.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Entrée non trouvée' });
      const oldCategory = existing.category;
      const { category, amount, date, isExpense, note } = req.body;
      if (category !== undefined) existing.category = category;
      if (amount !== undefined) existing.amount = parseFloat(amount);
      if (date !== undefined) existing.date = new Date(date);
      if (isExpense !== undefined) existing.isExpense = Boolean(isExpense);
      if (note !== undefined) existing.note = note;
      existing.updatedBy = req.user._id;
      await existing.save();
      // Resync old category (may now sum to 0) and new category
      await syncCategory(oldCategory);
      if (existing.category !== oldCategory) await syncCategory(existing.category);
      await AuditLog.create({ user: req.user._id, action: 'UPDATE', entity: 'MONEYFLOW', entityId: existing._id, details: { category: existing.category }, ipAddress: req.ip });
      res.json({ success: true, data: formatEntry(existing), message: 'Flux modifié' });
    } catch (error) {
      handleError(error, res, 'Erreur lors de la modification du flux');
    }
  };

  exports.delete = async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
      const entry = await MoneyFlow.findById(req.params.id);
      if (!entry) return res.status(404).json({ message: 'Entrée non trouvée' });
      const category = entry.category;
      await entry.deleteOne();
      await syncCategory(category);
      await AuditLog.create({ user: req.user._id, action: 'DELETE', entity: 'MONEYFLOW', entityId: req.params.id, details: { category }, ipAddress: req.ip });
      res.json({ success: true, message: 'Flux supprimé' });
    } catch (error) {
      handleError(error, res, 'Erreur lors de la suppression du flux');
    }
  };
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add erp-backend/src/controllers/moneyFlowController.js
  git commit -m "feat: add moneyFlowController with auto-sync logic"
  ```

---

## Task 11: Create MoneyFlow routes

**Files:**
- Create: `erp-backend/src/routes/moneyFlowRoutes.js`

- [ ] **Step 1: Create the file**

  ```js
  // routes/moneyFlowRoutes.js
  const express = require('express');
  const router = express.Router();
  const moneyFlowController = require('../controllers/moneyFlowController');
  const { protect, authorize } = require('../middleware/auth');

  router.use(protect);
  const adminOnly = authorize('admin_principal', 'admin_finance');

  router.get('/', moneyFlowController.getAll);
  router.get('/:id', moneyFlowController.getById);
  router.post('/', adminOnly, moneyFlowController.create);
  router.put('/:id', adminOnly, moneyFlowController.update);
  router.delete('/:id', adminOnly, moneyFlowController.delete);

  module.exports = router;
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add erp-backend/src/routes/moneyFlowRoutes.js
  git commit -m "feat: add moneyFlowRoutes"
  ```

---

## Task 12: Register new routes in app.js

**Files:**
- Modify: `erp-backend/src/app.js`

- [ ] **Step 1: Add require statements**

  After the existing route requires (e.g., near `const budgetRoutes = require(...)`), add:
  ```js
  const targetRoutes = require('./routes/targetRoutes');
  const moneyFlowRoutes = require('./routes/moneyFlowRoutes');
  ```

- [ ] **Step 2: Register routes**

  After `app.use('/api/budgets', budgetRoutes);`, add:
  ```js
  app.use('/api/targets', targetRoutes);
  app.use('/api/money-flow', moneyFlowRoutes);
  ```

- [ ] **Step 3: Verify the backend starts without errors**
  ```bash
  cd erp-backend && node src/app.js
  ```
  Expected: server starts, no `Cannot find module` errors.

- [ ] **Step 4: Commit**
  ```bash
  git add erp-backend/src/app.js
  git commit -m "feat: register /api/targets and /api/money-flow routes"
  ```

---

## Task 13: Update frontendApiAdapters.js

**Files:**
- Modify: `Front/src/utils/frontendApiAdapters.js`

- [ ] **Step 1: Update `mapAccountToUi`**

  Find `inBudget: Boolean(account.inBudget)` and replace with:
  ```js
  inMoneyFlow: Boolean(account.inMoneyFlow ?? account.inBudget),
  ```
  Also update the field name from `inBudget` to `inMoneyFlow` everywhere in this function.

- [ ] **Step 2: Update `mapBudgetToUi`**

  Replace the existing function:
  ```js
  export const mapBudgetToUi = (budget = {}) => ({
    id: budget.id || budget._id,
    backendId: budget.id || budget._id,
    category: budget.category || '',
    budget: Number(budget.budget || 0),
    usedAmount: Number(budget.usedAmount || 0),
    usage: budget.budget > 0 ? Math.min((Number(budget.usedAmount || 0) / Number(budget.budget)) * 100, 100) : 0,
    startDate: budget.startDate || '',
    endDate: budget.endDate || '',
    status: budget.status || 'respected',
    notes: budget.notes || '',
    backend: budget,
  });
  ```

- [ ] **Step 3: Add `mapTargetToUi`**

  Add after `mapBudgetToUi`:
  ```js
  export const mapTargetToUi = (target = {}) => ({
    id: target.id || target._id,
    backendId: target.id || target._id,
    category: target.category || '',
    amount: Number(target.amount || 0),
    realisedAmount: Number(target.realisedAmount || 0),
    progression: target.amount > 0
      ? Math.min((Number(target.realisedAmount || 0) / Number(target.amount)) * 100, 100)
      : 0,
    startDate: target.startDate || '',
    endDate: target.endDate || '',
    status: target.status || 'in_progress',
    notes: target.notes || '',
    backend: target,
  });
  ```

- [ ] **Step 4: Add `mapMoneyFlowToUi`**

  Add after `mapTargetToUi`:
  ```js
  export const mapMoneyFlowToUi = (entry = {}) => ({
    id: entry.id || entry._id,
    backendId: entry.id || entry._id,
    category: entry.category || '',
    amount: Number(entry.amount || 0),
    date: toIsoDate(entry.date || entry.createdAt),
    isExpense: Boolean(entry.isExpense),
    note: entry.note || '',
    backend: entry,
  });
  ```

- [ ] **Step 5: Export new mappers**

  Ensure both `mapTargetToUi` and `mapMoneyFlowToUi` are exported (they already are if declared with `export const`).

- [ ] **Step 6: Commit**
  ```bash
  git add Front/src/utils/frontendApiAdapters.js
  git commit -m "feat: add mapTargetToUi, mapMoneyFlowToUi; update mapBudgetToUi and mapAccountToUi"
  ```

---

## Task 14: Update budgetService.js

**Files:**
- Modify: `Front/src/services/budgetService.js`

- [ ] **Step 1: Replace `create` method**

  ```js
  create: async (budgetData) => {
    try {
      if (!budgetData.category?.trim()) throw new Error('La catégorie est requise');
      if (!budgetData.budget) throw new Error('Le montant est requis');
      if (!budgetData.startDate) throw new Error('La date de début est requise');
      if (!budgetData.endDate) throw new Error('La date de fin est requise');
      const response = await api.post('/budgets', {
        category: budgetData.category.trim(),
        budget: Math.abs(parseFloat(budgetData.budget) || 0),
        usedAmount: parseFloat(budgetData.usedAmount) || 0,
        startDate: budgetData.startDate,
        endDate: budgetData.endDate,
        notes: budgetData.notes || ''
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur create budget:', error);
      throw error;
    }
  },
  ```

- [ ] **Step 2: Replace `update` method**

  ```js
  update: async (id, budgetData) => {
    try {
      if (!id) throw new Error('ID requis');
      const response = await api.put(`/budgets/${id}`, {
        category: budgetData.category?.trim(),
        budget: budgetData.budget !== undefined ? Math.abs(parseFloat(budgetData.budget) || 0) : undefined,
        usedAmount: budgetData.usedAmount !== undefined ? parseFloat(budgetData.usedAmount) : undefined,
        startDate: budgetData.startDate,
        endDate: budgetData.endDate,
        notes: budgetData.notes,
        status: budgetData.status
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur update budget ${id}:`, error);
      throw error;
    }
  },
  ```

- [ ] **Step 3: Add `updateUsed` method**

  ```js
  updateUsed: async (id, usedAmount) => {
    try {
      if (!id) throw new Error('ID requis');
      const response = await api.patch(`/budgets/${id}/used`, { usedAmount });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur updateUsed budget ${id}:`, error);
      throw error;
    }
  },
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add Front/src/services/budgetService.js
  git commit -m "feat: update budgetService for new Budget fields"
  ```

---

## Task 15: Update accountService.js — inBudget → inMoneyFlow

**Files:**
- Modify: `Front/src/services/accountService.js`

- [ ] **Step 1: Update `create` payload**

  Find `inBudget: Boolean(accountData.inBudget)` and replace with:
  ```js
  inMoneyFlow: Boolean(accountData.inMoneyFlow ?? accountData.inBudget),
  ```

- [ ] **Step 2: Update `update` payload**

  Find `inBudget: ...` in the update payload and replace with:
  ```js
  inMoneyFlow: accountData.inMoneyFlow !== undefined ? Boolean(accountData.inMoneyFlow) : undefined,
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add Front/src/services/accountService.js
  git commit -m "feat: update accountService inBudget → inMoneyFlow"
  ```

---

## Task 16: Create targetService.js

**Files:**
- Create: `Front/src/services/targetService.js`

- [ ] **Step 1: Create the file**

  ```js
  // src/services/targetService.js
  import api from './api';

  export const targetService = {
    getAll: async (params = {}) => {
      try {
        const response = await api.get('/targets', { params });
        return response.data;
      } catch (error) {
        console.error('❌ Erreur getAll targets:', error);
        throw error;
      }
    },
    getById: async (id) => {
      try {
        const response = await api.get(`/targets/${id}`);
        return response.data;
      } catch (error) {
        console.error(`❌ Erreur getById target ${id}:`, error);
        throw error;
      }
    },
    create: async (data) => {
      try {
        const response = await api.post('/targets', data);
        return response.data;
      } catch (error) {
        console.error('❌ Erreur create target:', error);
        throw error;
      }
    },
    update: async (id, data) => {
      try {
        const response = await api.put(`/targets/${id}`, data);
        return response.data;
      } catch (error) {
        console.error(`❌ Erreur update target ${id}:`, error);
        throw error;
      }
    },
    updateRealised: async (id, realisedAmount) => {
      try {
        const response = await api.patch(`/targets/${id}/realised`, { realisedAmount });
        return response.data;
      } catch (error) {
        console.error(`❌ Erreur updateRealised target ${id}:`, error);
        throw error;
      }
    },
    delete: async (id) => {
      try {
        const response = await api.delete(`/targets/${id}`);
        return response.data;
      } catch (error) {
        console.error(`❌ Erreur delete target ${id}:`, error);
        throw error;
      }
    }
  };
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add Front/src/services/targetService.js
  git commit -m "feat: add targetService"
  ```

---

## Task 17: Create moneyFlowService.js

**Files:**
- Create: `Front/src/services/moneyFlowService.js`

- [ ] **Step 1: Create the file**

  ```js
  // src/services/moneyFlowService.js
  import api from './api';

  export const moneyFlowService = {
    getAll: async (params = {}) => {
      try {
        const response = await api.get('/money-flow', { params });
        return response.data;
      } catch (error) {
        console.error('❌ Erreur getAll moneyFlow:', error);
        throw error;
      }
    },
    getById: async (id) => {
      try {
        const response = await api.get(`/money-flow/${id}`);
        return response.data;
      } catch (error) {
        console.error(`❌ Erreur getById moneyFlow ${id}:`, error);
        throw error;
      }
    },
    create: async (data) => {
      try {
        const response = await api.post('/money-flow', {
          category: data.category,
          amount: Math.abs(parseFloat(data.amount) || 0),
          date: data.date,
          isExpense: Boolean(data.isExpense),
          note: data.note || ''
        });
        return response.data;
      } catch (error) {
        console.error('❌ Erreur create moneyFlow:', error);
        throw error;
      }
    },
    update: async (id, data) => {
      try {
        const response = await api.put(`/money-flow/${id}`, {
          category: data.category,
          amount: data.amount !== undefined ? Math.abs(parseFloat(data.amount) || 0) : undefined,
          date: data.date,
          isExpense: data.isExpense !== undefined ? Boolean(data.isExpense) : undefined,
          note: data.note
        });
        return response.data;
      } catch (error) {
        console.error(`❌ Erreur update moneyFlow ${id}:`, error);
        throw error;
      }
    },
    delete: async (id) => {
      try {
        const response = await api.delete(`/money-flow/${id}`);
        return response.data;
      } catch (error) {
        console.error(`❌ Erreur delete moneyFlow ${id}:`, error);
        throw error;
      }
    }
  };
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add Front/src/services/moneyFlowService.js
  git commit -m "feat: add moneyFlowService"
  ```

---

## Task 18: Update FinanceAdmin.jsx — imports, constants, state

**Files:**
- Modify: `Front/src/pages/finance/FinanceAdmin.jsx`

- [ ] **Step 1: Add new imports at the top**

  After the existing service imports, add:
  ```js
  import { targetService } from "../../services/targetService";
  import { moneyFlowService } from "../../services/moneyFlowService";
  ```

  After the existing adapter imports, add `mapTargetToUi, mapMoneyFlowToUi` to the destructured import:
  ```js
  import {
    extractApiErrorMessage,
    mapAccountToUi,
    mapBudgetToUi,
    mapMoneyFlowToUi,
    mapReportToUi,
    mapTargetToUi,
    mapTransactionToUi,
    pickList,
  } from "../../utils/frontendApiAdapters";
  ```

- [ ] **Step 2: Update `TABS` constant**

  Find `const TABS = { TRANSACTIONS: "transactions", ACCOUNTS: "accounts", BUDGETS: "budgets", REPORTS: "reports", SETTINGS: "settings" };`

  Replace with:
  ```js
  const TABS = {
    TRANSACTIONS: "transactions", ACCOUNTS: "accounts",
    BUDGETS: "budgets", TARGETS: "targets", MONEYFLOW: "moneyflow",
    REPORTS: "reports", SETTINGS: "settings"
  };
  ```

- [ ] **Step 3: Update `STATUS_CONFIG`**

  Add new status entries:
  ```js
  "in_progress": { color: "#4299e1", bg: "#bee3f8" },
  "reached":     { color: COLORS.success, bg: COLORS.successBg },
  "failed":      { color: COLORS.danger, bg: COLORS.dangerBg },
  "desactivated":{ color: COLORS.muted, bg: COLORS.mutedBg },
  "respected":   { color: COLORS.success, bg: COLORS.successBg },
  "passed":      { color: COLORS.danger, bg: COLORS.dangerBg },
  ```

- [ ] **Step 4: Update `EMPTY_FORMS`**

  Replace the `budget` entry and add `target`/`moneyFlow`:
  ```js
  budget: {
    category: "", budget: "", usedAmount: "0",
    startDate: "", endDate: "", notes: "", status: "respected"
  },
  target: {
    category: "", amount: "", realisedAmount: "0",
    startDate: "", endDate: "", notes: "", status: "in_progress"
  },
  moneyFlow: {
    category: "", amount: "", date: new Date().toISOString().split('T')[0],
    isExpense: false, note: ""
  },
  ```

- [ ] **Step 5: Add state variables**

  After `const [reports, setReports] = useState([]);`, add:
  ```js
  const [targets, setTargets] = useState([]);
  const [moneyFlows, setMoneyFlows] = useState([]);
  const [inMoneyFlowAccounts, setInMoneyFlowAccounts] = useState([]);
  ```

- [ ] **Step 6: Update `formData` initial state**

  Add `target` and `moneyFlow` to the initial `formData` state:
  ```js
  const [formData, setFormData] = useState({
    transaction: { ...EMPTY_FORMS.transaction },
    account: { ...EMPTY_FORMS.account },
    budget: { ...EMPTY_FORMS.budget },
    target: { ...EMPTY_FORMS.target },
    moneyFlow: { ...EMPTY_FORMS.moneyFlow },
    report: { ...EMPTY_FORMS.report }
  });
  ```

- [ ] **Step 7: Update `resetForm`**

  The existing `resetForm` uses `EMPTY_FORMS[type]` — it will work automatically once the new entries are in `EMPTY_FORMS`. No change needed.

- [ ] **Step 8: Commit**
  ```bash
  git add Front/src/pages/finance/FinanceAdmin.jsx
  git commit -m "feat: FinanceAdmin imports, constants, state for Targets and Money Flow"
  ```

---

## Task 19: Update FinanceAdmin.jsx — data loading and CRUD handlers

**Files:**
- Modify: `Front/src/pages/finance/FinanceAdmin.jsx`

- [ ] **Step 1: Update `loadFinanceData`**

  In the `loadFinanceData` function, add targets and moneyFlow fetches:
  ```js
  const loadFinanceData = async (fallbackRole = userRole, fallbackEmail = userEmail) => {
    const [profileResponse, transactionsResponse, accountsResponse, budgetsResponse,
           reportsResponse, targetsResponse, moneyFlowResponse, inMoneyFlowAccsResponse] = await Promise.all([
      userService.getProfile(),
      transactionService.getAll({ limit: 200 }),
      accountService.getAll({ limit: 200 }),
      budgetService.getAll({ limit: 200 }),
      reportService.getAll({ limit: 200 }),
      targetService.getAll({ limit: 200 }),
      moneyFlowService.getAll({ limit: 200 }),
      accountService.getAll({ limit: 200, inMoneyFlow: true }),
    ]);

    const profile = profileResponse?.data || profileResponse;
    applyProfileState(profile, fallbackRole, fallbackEmail);
    setTransactions(pickList(transactionsResponse, ['data']).map(mapTransactionToUi));
    setAccounts(pickList(accountsResponse, ['data']).map(mapAccountToUi));
    setBudgets(pickList(budgetsResponse, ['data']).map(mapBudgetToUi));
    setTargets(pickList(targetsResponse, ['data']).map(mapTargetToUi));
    setMoneyFlows(pickList(moneyFlowResponse, ['data']).map(mapMoneyFlowToUi));
    setInMoneyFlowAccounts(pickList(inMoneyFlowAccsResponse, ['data']).map(mapAccountToUi));
    setReports(
      pickList(reportsResponse, ['data'])
        .filter(report => {
          if (fallbackRole === 'admin_principal' || userRole === 'admin_principal') return true;
          const tags = report.tags || [];
          return tags.length === 0 || tags.includes('source:finance');
        })
        .map((report) => mapReportToUi(report, "📄"))
    );
  };
  ```

- [ ] **Step 2: Update `dataMap`**

  Find `const dataMap = { ... }` and add:
  ```js
  target: { data: targets, setter: setTargets },
  moneyFlow: { data: moneyFlows, setter: setMoneyFlows },
  ```

- [ ] **Step 3: Update `openModal` map**

  In the `openModal` function, add edit mappings:
  ```js
  target: {
    ...item,
    amount: (item.amount || 0).toString(),
    realisedAmount: (item.realisedAmount || 0).toString(),
    startDate: item.startDate ? item.startDate.split('T')[0] : '',
    endDate: item.endDate ? item.endDate.split('T')[0] : ''
  },
  moneyFlow: {
    ...item,
    amount: Math.abs(item.amount || 0).toString(),
    date: item.date ? item.date.split('T')[0] : new Date().toISOString().split('T')[0]
  },
  ```

- [ ] **Step 4: Update `handleAddRemote`**

  Add target and moneyFlow cases after the budget case:
  ```js
  } else if (modal.type === "target") {
    await targetService.create({
      ...form,
      amount: Math.abs(parseFloat(form.amount) || 0),
      realisedAmount: parseFloat(form.realisedAmount) || 0
    });
  } else if (modal.type === "moneyFlow") {
    await moneyFlowService.create(form);
  }
  ```

- [ ] **Step 5: Update `handleUpdateRemote`**

  Add target and moneyFlow cases after the budget case:
  ```js
  } else if (modal.type === "target") {
    await targetService.update(targetId, {
      ...form,
      amount: Math.abs(parseFloat(form.amount) || 0),
      realisedAmount: parseFloat(form.realisedAmount) || 0
    });
  } else if (modal.type === "moneyFlow") {
    await moneyFlowService.update(targetId, form);
  }
  ```

- [ ] **Step 6: Update `handleDeleteRemote`**

  Add target and moneyFlow cases:
  ```js
  } else if (modal.type === "target") {
    await targetService.delete(targetId);
  } else if (modal.type === "moneyFlow") {
    await moneyFlowService.delete(targetId);
  }
  ```

- [ ] **Step 7: Commit**
  ```bash
  git add Front/src/pages/finance/FinanceAdmin.jsx
  git commit -m "feat: FinanceAdmin data loading and CRUD handlers for Targets and Money Flow"
  ```

---

## Task 20: Update FinanceAdmin.jsx — Sidebar, header, filters

**Files:**
- Modify: `Front/src/pages/finance/FinanceAdmin.jsx`

- [ ] **Step 1: Update sidebar NavItems**

  After `<NavItem id={TABS.BUDGETS} ...>`, add:
  ```jsx
  <NavItem id={TABS.TARGETS} icon="🎯" label="Objectifs" count={targets.length} />
  <NavItem id={TABS.MONEYFLOW} icon="💸" label="Money Flow" count={moneyFlows.length} />
  ```

- [ ] **Step 2: Update header subtitle**

  Add cases for the new tabs in the `welcome-subtitle` paragraph:
  ```jsx
  {activeTab === TABS.TARGETS && "Suivez vos objectifs financiers"}
  {activeTab === TABS.MONEYFLOW && "Gérez votre flux de trésorerie"}
  ```

- [ ] **Step 3: Update "Nouveau" button**

  Find the button that calls `openModal`. Update its type resolution:
  ```js
  const type = activeTab === TABS.TRANSACTIONS ? "transaction"
    : activeTab === TABS.ACCOUNTS ? "account"
    : activeTab === TABS.BUDGETS ? "budget"
    : activeTab === TABS.TARGETS ? "target"
    : activeTab === TABS.MONEYFLOW ? "moneyFlow"
    : "report";
  ```
  And its label:
  ```jsx
  + {activeTab === TABS.TRANSACTIONS ? "Nouvelle transaction"
    : activeTab === TABS.ACCOUNTS ? "Nouveau compte"
    : activeTab === TABS.BUDGETS ? "Nouveau budget"
    : activeTab === TABS.TARGETS ? "Nouvel objectif"
    : activeTab === TABS.MONEYFLOW ? "Nouvelle entrée"
    : "Créer un rapport"}
  ```

- [ ] **Step 4: Update `filteredData` useMemo**

  Add targets and moneyFlows to the `dataMap` inside `filteredData`:
  ```js
  const dataMap = { transactions, accounts, budgets, targets, moneyflow: moneyFlows, reports };
  return (dataMap[activeTab] || []).filter(item => { ... });
  ```

  Add search field mappings:
  ```js
  targets: [item.category],
  moneyflow: [item.category, item.note],
  ```

- [ ] **Step 5: Commit**
  ```bash
  git add Front/src/pages/finance/FinanceAdmin.jsx
  git commit -m "feat: FinanceAdmin sidebar and header for Targets and Money Flow"
  ```

---

## Task 21: Update FinanceAdmin.jsx — Budget tab redesign

**Files:**
- Modify: `Front/src/pages/finance/FinanceAdmin.jsx`

- [ ] **Step 1: Replace the Budget table rendering**

  Find the `{activeTab === TABS.BUDGETS && ...}` block and replace the `<tbody>` rows section with:

  ```jsx
  {paginatedData.map(b => {
    const usage = b.budget > 0 ? Math.min((b.usedAmount / b.budget) * 100, 100) : 0;
    const progressColor = usage > 100 ? COLORS.danger : usage > 80 ? COLORS.warning : COLORS.success;
    return (
      <tr key={b.id}>
        <td className="budget-category">
          {b.category}
          {b.notes && <small className="notes-indicator" title={b.notes}>📝</small>}
        </td>
        <td>{formatCurrency(b.budget)}</td>
        <td>{formatCurrency(b.usedAmount)}</td>
        <td>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${Math.min(usage, 100)}%`, background: progressColor }}></div>
            <span className="progress-text">{usage.toFixed(1)}%</span>
          </div>
        </td>
        <td><StatusBadge status={b.status} /></td>
        <td>{formatDate(b.startDate)}</td>
        <td>{formatDate(b.endDate)}</td>
        <td><div className="action-buttons">
          <button className="action-btn" onClick={() => openModal("budget", "edit", b)}>✏️</button>
          <button className="action-btn delete" onClick={() => openModal("budget", "delete", b)}>🗑️</button>
        </div></td>
      </tr>
    );
  })}
  ```

- [ ] **Step 2: Update the Budget table header**

  Replace the `<thead>` row:
  ```jsx
  <thead><tr>
    <th>Catégorie</th><th>Montant</th><th>Utilisé</th>
    <th>Usage %</th><th>Statut</th><th>Début</th><th>Fin</th><th>Actions</th>
  </tr></thead>
  ```

- [ ] **Step 3: Update `BudgetSummary` component**

  Replace with:
  ```jsx
  const BudgetSummary = ({ budgets, formatCurrency }) => {
    const totalBudget = budgets.reduce((acc, b) => acc + Math.abs(b.budget || 0), 0);
    const totalUsed = budgets.reduce((acc, b) => acc + (b.usedAmount || 0), 0);
    const variance = totalBudget - totalUsed;
    const rate = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;
    return (
      <div className="budgets-summary">
        {[
          { label: "Budget total", value: formatCurrency(totalBudget) },
          { label: "Total utilisé", value: formatCurrency(totalUsed) },
          { label: "Disponible", value: formatCurrency(variance), className: variance >= 0 ? "text-success" : "text-danger" },
          { label: "Taux d'utilisation", value: `${rate.toFixed(1)}%` }
        ].map((item, i) => (
          <div key={i} className="budget-summary-card">
            <span>{item.label}</span>
            <strong className={item.className}>{item.value}</strong>
          </div>
        ))}
      </div>
    );
  };
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add Front/src/pages/finance/FinanceAdmin.jsx
  git commit -m "feat: FinanceAdmin Budget tab redesign with new fields"
  ```

---

## Task 22: Add FinanceAdmin.jsx — Targets tab

**Files:**
- Modify: `Front/src/pages/finance/FinanceAdmin.jsx`

- [ ] **Step 1: Add Targets tab JSX**

  After the closing `}` of the Budgets tab (`{activeTab === TABS.BUDGETS && ...}`), add:

  ```jsx
  {activeTab === TABS.TARGETS && (
    <div className="budgets-content">
      <div className="budgets-summary">
        {(() => {
          const total = targets.length;
          const reached = targets.filter(t => t.status === 'reached').length;
          const totalAmt = targets.reduce((a, t) => a + (t.amount || 0), 0);
          const totalRealised = targets.reduce((a, t) => a + (t.realisedAmount || 0), 0);
          return [
            { label: "Total objectifs", value: total },
            { label: "Montant total", value: formatCurrency(totalAmt) },
            { label: "Total réalisé", value: formatCurrency(totalRealised) },
            { label: "Taux de réussite", value: `${total > 0 ? ((reached / total) * 100).toFixed(1) : 0}%` }
          ].map((item, i) => (
            <div key={i} className="budget-summary-card">
              <span>{item.label}</span><strong>{item.value}</strong>
            </div>
          ));
        })()}
      </div>
      <div className="table-container">
        <table className="budgets-table">
          <thead><tr>
            <th>Catégorie</th><th>Objectif</th><th>Réalisé</th>
            <th>Progression %</th><th>Statut</th><th>Début</th><th>Fin</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {paginatedData.map(t => {
              const prog = t.amount > 0 ? Math.min((t.realisedAmount / t.amount) * 100, 100) : 0;
              const progColor = prog >= 100 ? COLORS.success : prog >= 50 ? "#4299e1" : COLORS.warning;
              return (
                <tr key={t.id}>
                  <td className="budget-category">
                    {t.category}{t.notes && <small className="notes-indicator" title={t.notes}>📝</small>}
                  </td>
                  <td>{formatCurrency(t.amount)}</td>
                  <td>{formatCurrency(t.realisedAmount)}</td>
                  <td>
                    <div className="progress-bar-container">
                      <div className="progress-bar" style={{ width: `${prog}%`, background: progColor }}></div>
                      <span className="progress-text">{prog.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td><StatusBadge status={t.status} /></td>
                  <td>{formatDate(t.startDate)}</td>
                  <td>{formatDate(t.endDate)}</td>
                  <td><div className="action-buttons">
                    <button className="action-btn" onClick={() => openModal("target", "edit", t)}>✏️</button>
                    <button className="action-btn delete" onClick={() => openModal("target", "delete", t)}>🗑️</button>
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filteredData.length && <NoResults onReset={resetFilters} />}
      </div>
      <Pagination total={filteredData.length} pagination={pagination} setPagination={setPagination} />
    </div>
  )}
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add Front/src/pages/finance/FinanceAdmin.jsx
  git commit -m "feat: FinanceAdmin Targets tab"
  ```

---

## Task 23: Add FinanceAdmin.jsx — Money Flow tab

**Files:**
- Modify: `Front/src/pages/finance/FinanceAdmin.jsx`

- [ ] **Step 1: Add Money Flow tab JSX**

  After the Targets tab block, add:

  ```jsx
  {activeTab === TABS.MONEYFLOW && (
    <div className="budgets-content">
      <div className="table-container">
        <table className="budgets-table">
          <thead><tr>
            <th>Catégorie</th><th>Montant</th><th>Date</th><th>Type</th><th>Note</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {/* Manual MoneyFlow entries */}
            {moneyFlows.map(e => (
              <tr key={e.id}>
                <td>{e.category}</td>
                <td className={e.isExpense ? "text-danger" : "text-success"}>
                  <strong>{e.isExpense ? "-" : "+"}{formatCurrency(e.amount)}</strong>
                </td>
                <td>{formatDate(e.date)}</td>
                <td>
                  <span className="status-badge" style={e.isExpense
                    ? { background: COLORS.dangerBg, color: COLORS.danger }
                    : { background: COLORS.successBg, color: COLORS.success }}>
                    {e.isExpense ? "Dépense" : "Revenu"}
                  </span>
                </td>
                <td>{e.note || <em style={{ color: "#a0aec0" }}>—</em>}</td>
                <td><div className="action-buttons">
                  <button className="action-btn" onClick={() => openModal("moneyFlow", "edit", e)}>✏️</button>
                  <button className="action-btn delete" onClick={() => openModal("moneyFlow", "delete", e)}>🗑️</button>
                </div></td>
              </tr>
            ))}
            {/* Read-only account balance rows */}
            {inMoneyFlowAccounts.map(acc => (
              <tr key={`acc-${acc.id}`} style={{ background: "#ebf8ff" }}>
                <td>🏦 {acc.name}</td>
                <td className="text-success"><strong>{formatCurrency(acc.solde)}</strong></td>
                <td>—</td>
                <td>
                  <span className="status-badge" style={{ background: "#bee3f8", color: "#2b6cb0" }}>Compte</span>
                </td>
                <td><em style={{ color: "#a0aec0" }}>Solde du compte</em></td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
        {moneyFlows.length === 0 && inMoneyFlowAccounts.length === 0 && <NoResults onReset={resetFilters} />}
      </div>

      {/* Summary bar */}
      {(() => {
        const totalRevenu = moneyFlows.filter(e => !e.isExpense).reduce((s, e) => s + e.amount, 0);
        const totalDepense = moneyFlows.filter(e => e.isExpense).reduce((s, e) => s + e.amount, 0);
        const totalComptes = inMoneyFlowAccounts.reduce((s, a) => s + (a.solde || 0), 0);
        const net = totalRevenu - totalDepense + totalComptes;
        return (
          <div className="budgets-summary" style={{ marginTop: '16px' }}>
            <div className="budget-summary-card">
              <span>Total revenus</span>
              <strong className="text-success">+{formatCurrency(totalRevenu)}</strong>
            </div>
            <div className="budget-summary-card">
              <span>Total dépenses</span>
              <strong className="text-danger">-{formatCurrency(totalDepense)}</strong>
            </div>
            <div className="budget-summary-card">
              <span>Soldes comptes</span>
              <strong>{formatCurrency(totalComptes)}</strong>
            </div>
            <div className="budget-summary-card">
              <span>NET</span>
              <strong className={net >= 0 ? "text-success" : "text-danger"}>{formatCurrency(net)}</strong>
            </div>
          </div>
        );
      })()}
    </div>
  )}
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add Front/src/pages/finance/FinanceAdmin.jsx
  git commit -m "feat: FinanceAdmin Money Flow tab with account balance rows and summary bar"
  ```

---

## Task 24: Add modal forms for Target and MoneyFlow

**Files:**
- Modify: `Front/src/pages/finance/FinanceAdmin.jsx`

- [ ] **Step 1: Add form rendering in the modal body**

  Find the modal body section with the form conditionals:
  ```jsx
  {modal.type === "transaction" && <TransactionForm .../>}
  {modal.type === "account" && <AccountForm .../>}
  {modal.type === "budget" && <BudgetForm .../>}
  {modal.type === "report" && <ReportForm .../>}
  ```

  Add:
  ```jsx
  {modal.type === "target" && <TargetForm formData={formData} setFormData={setFormData} />}
  {modal.type === "moneyFlow" && <MoneyFlowForm formData={formData} setFormData={setFormData} />}
  ```

- [ ] **Step 2: Update BudgetForm component**

  Replace the BudgetForm component at the bottom of the file:
  ```jsx
  const BudgetForm = ({ formData, setFormData }) => {
    const fd = formData.budget;
    const set = (field, value) => setFormData({ ...formData, budget: { ...fd, [field]: value } });
    return (<>
      <div className="form-group"><label>Catégorie *</label>
        <input type="text" value={fd.category} onChange={e => set('category', e.target.value)} required />
      </div>
      <div className="form-row">
        <div className="form-group"><label>Montant *</label>
          <input type="number" value={fd.budget} onChange={e => set('budget', e.target.value)} step="0.01" min="0" required />
        </div>
        <div className="form-group"><label>Montant utilisé</label>
          <input type="number" value={fd.usedAmount} onChange={e => set('usedAmount', e.target.value)} step="0.01" min="0" />
          <small style={{ color: '#718096' }}>Recalculé automatiquement par Money Flow</small>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Date début *</label>
          <input type="date" value={fd.startDate} onChange={e => set('startDate', e.target.value)} required />
        </div>
        <div className="form-group"><label>Date fin *</label>
          <input type="date" value={fd.endDate} onChange={e => set('endDate', e.target.value)} required />
        </div>
      </div>
      <div className="form-group"><label>Statut</label>
        <select value={fd.status} onChange={e => set('status', e.target.value)}>
          <option value="respected">Respecté (auto)</option>
          <option value="passed">Dépassé (auto)</option>
          <option value="desactivated">Désactivé</option>
        </select>
        <small style={{ color: '#718096' }}>Respecté/Dépassé calculés automatiquement</small>
      </div>
      <div className="form-group"><label>Notes</label>
        <textarea value={fd.notes} onChange={e => set('notes', e.target.value)} rows="2" />
      </div>
    </>);
  };
  ```

- [ ] **Step 3: Add TargetForm component**

  Add after BudgetForm:
  ```jsx
  const TargetForm = ({ formData, setFormData }) => {
    const fd = formData.target;
    const set = (field, value) => setFormData({ ...formData, target: { ...fd, [field]: value } });
    return (<>
      <div className="form-group"><label>Catégorie *</label>
        <input type="text" value={fd.category} onChange={e => set('category', e.target.value)} required />
      </div>
      <div className="form-row">
        <div className="form-group"><label>Objectif *</label>
          <input type="number" value={fd.amount} onChange={e => set('amount', e.target.value)} step="0.01" min="0" required />
        </div>
        <div className="form-group"><label>Réalisé</label>
          <input type="number" value={fd.realisedAmount} onChange={e => set('realisedAmount', e.target.value)} step="0.01" min="0" />
          <small style={{ color: '#718096' }}>Recalculé automatiquement par Money Flow</small>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Date début *</label>
          <input type="date" value={fd.startDate} onChange={e => set('startDate', e.target.value)} required />
        </div>
        <div className="form-group"><label>Date fin *</label>
          <input type="date" value={fd.endDate} onChange={e => set('endDate', e.target.value)} required />
        </div>
      </div>
      <div className="form-group"><label>Statut</label>
        <select value={fd.status} onChange={e => set('status', e.target.value)}>
          <option value="in_progress">En cours (auto)</option>
          <option value="reached">Atteint (auto)</option>
          <option value="failed">Échoué (auto)</option>
          <option value="desactivated">Désactivé</option>
        </select>
        <small style={{ color: '#718096' }}>Statut calculé automatiquement</small>
      </div>
      <div className="form-group"><label>Notes</label>
        <textarea value={fd.notes} onChange={e => set('notes', e.target.value)} rows="2" />
      </div>
    </>);
  };
  ```

- [ ] **Step 4: Add MoneyFlowForm component**

  Add after TargetForm:
  ```jsx
  const MoneyFlowForm = ({ formData, setFormData }) => {
    const fd = formData.moneyFlow;
    const set = (field, value) => setFormData({ ...formData, moneyFlow: { ...fd, [field]: value } });
    return (<>
      <div className="form-group"><label>Catégorie *</label>
        <input type="text" value={fd.category} onChange={e => set('category', e.target.value)} required
          placeholder="Ex: Marketing, Salaires, Ventes..." />
        <small style={{ color: '#718096' }}>Doit correspondre à une catégorie de budget/objectif pour la synchronisation</small>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Montant *</label>
          <input type="number" value={fd.amount} onChange={e => set('amount', Math.abs(parseFloat(e.target.value) || 0).toString())} step="0.01" min="0" required />
        </div>
        <div className="form-group"><label>Date *</label>
          <input type="date" value={fd.date} onChange={e => set('date', e.target.value)} required />
        </div>
      </div>
      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.95rem' }}>
          <input type="checkbox" checked={Boolean(fd.isExpense)} onChange={e => set('isExpense', e.target.checked)}
            style={{ width: '18px', height: '18px' }} />
          <span>Dépense {fd.isExpense ? <span style={{ color: COLORS.danger, fontWeight: 600 }}>(Dépense)</span> : <span style={{ color: COLORS.success, fontWeight: 600 }}>(Revenu)</span>}</span>
        </label>
      </div>
      <div className="form-group"><label>Note</label>
        <textarea value={fd.note} onChange={e => set('note', e.target.value)} rows="2" />
      </div>
    </>);
  };
  ```

- [ ] **Step 5: Update the Account form to use `inMoneyFlow`**

  Find the checkbox in `AccountForm` that says `"Inclure dans les budgets"` and update:
  ```jsx
  <div className="form-group">
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
      <input type="checkbox" checked={Boolean(fd.inMoneyFlow ?? fd.inBudget)}
        onChange={e => set('inMoneyFlow', e.target.checked)} style={{ width: '18px', height: '18px' }} />
      Inclure dans le flux de trésorerie
    </label>
    <small style={{ color: '#718096' }}>Ce compte apparaîtra dans la page Money Flow</small>
  </div>
  ```

- [ ] **Step 6: Commit**
  ```bash
  git add Front/src/pages/finance/FinanceAdmin.jsx
  git commit -m "feat: FinanceAdmin modal forms for Budget, Target, MoneyFlow"
  ```

---

## Task 25: Run migration script for Account.inBudget → inMoneyFlow

**Files:**
- None (run script directly against DB)

- [ ] **Step 1: Run the migration against the running MongoDB instance**

  Open a MongoDB shell (or use the backend's existing connection):
  ```js
  db.accounts.updateMany(
    { inBudget: { $exists: true } },
    [{ $set: { inMoneyFlow: "$inBudget" } }, { $unset: "inBudget" }]
  )
  ```

  Or create a one-time script `erp-backend/scripts/migrate-inBudget.js`:
  ```js
  const mongoose = require('mongoose');
  require('dotenv').config();

  async function migrate() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erp');
    const result = await mongoose.connection.collection('accounts').updateMany(
      { inBudget: { $exists: true } },
      [{ $set: { inMoneyFlow: '$inBudget' } }, { $unset: 'inBudget' }]
    );
    console.log(`Migrated ${result.modifiedCount} accounts`);
    await mongoose.disconnect();
  }

  migrate().catch(console.error);
  ```

  Run: `node erp-backend/scripts/migrate-inBudget.js`

- [ ] **Step 2: Commit migration script**
  ```bash
  git add erp-backend/scripts/migrate-inBudget.js
  git commit -m "chore: add inBudget → inMoneyFlow migration script"
  ```

---

## Task 26: End-to-end smoke test

- [ ] **Step 1: Start the backend**
  ```bash
  cd erp-backend && npm run dev
  ```
  Expected: no errors, routes `/api/targets` and `/api/money-flow` registered.

- [ ] **Step 2: Start the frontend**
  ```bash
  cd Front && npm run dev
  ```
  Expected: no import errors, app compiles.

- [ ] **Step 3: Test Budget CRUD**
  - Login as admin_finance
  - Create a budget: category="marketing", amount=5000, startDate=today, endDate=+30 days
  - Expected: budget appears in list with `respected` status, usedAmount=0

- [ ] **Step 4: Test Target CRUD**
  - Create a target: category="ventes", amount=10000, startDate=today, endDate=+90 days
  - Expected: target appears with `in_progress`, progression=0%

- [ ] **Step 5: Test MoneyFlow + auto-sync**
  - Create a money flow expense: category="marketing", amount=2000, isExpense=true
  - Expected: budget "marketing" usedAmount becomes 2000, usage=40%, status=respected
  - Create a money flow revenue: category="ventes", amount=6000, isExpense=false
  - Expected: target "ventes" realisedAmount becomes 6000, progression=60%

- [ ] **Step 6: Test Money Flow summary bar**
  - Navigate to Money Flow tab
  - Mark an account as `inMoneyFlow` via Comptes tab
  - Expected: account appears as a blue "Compte" row, its solde included in "Soldes comptes" total

- [ ] **Step 7: Commit final verification**
  ```bash
  git add .
  git commit -m "feat: Finance module redesign complete — Budget/Targets/MoneyFlow"
  ```
