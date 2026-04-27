/**
 * Product‑Location Assignment Routes
 * Handles assigning products to warehouse locations and removing assignments.
 * All routes require authentication.
 */

const express = require('express');
const {
    getAll,
    assign,
    remove
} = require('../controllers/productLocationController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Get all product‑location assignments
router.get('/', authMiddleware, getAll);

// Assign a product to a location
router.post('/', authMiddleware, assign);

// Remove an assignment by its ID
router.delete('/:id', authMiddleware, remove);

module.exports = router;