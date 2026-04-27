/**
 * Inventory Routes
 * Provides read‑only access to current inventory (approved stock).
 */

const express = require('express');
const { getAll } = require('../controllers/inventoryController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Get all inventory items with product names – requires authentication
router.get('/', authMiddleware, getAll);

module.exports = router;