/**
 * Stock‑Out Request Routes
 * Manages creation, approval, and rejection of stock‑out requests.
 * All routes require authentication.
 */

const express = require('express');
const {
    getAll,
    create,
    approve,
    reject
} = require('../controllers/stockOutController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Get all stock‑out requests (with product and user details)
router.get('/', authMiddleware, getAll);

// Create a new stock‑out request (warehouse staff or admin)
router.post('/', authMiddleware, create);

// Approve a pending stock‑out request (warehouse manager or admin)
router.put('/:id/approve', authMiddleware, approve);

// Reject a pending stock‑out request with a reason (warehouse manager or admin)
router.put('/:id/reject', authMiddleware, reject);

module.exports = router;