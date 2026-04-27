/**
 * Stock‑In Request Routes
 * Manages creation, approval, rejection, and resubmission of stock‑in requests.
 * All routes require authentication.
 */

const express = require('express');
const {
    getAll,
    create,
    approve,
    reject,
    resubmit
} = require('../controllers/stockInController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Get all stock‑in requests (with product and user details)
router.get('/', authMiddleware, getAll);

// Create a new stock‑in request (inventory manager or admin)
router.post('/', authMiddleware, create);

// Approve a pending stock‑in request (warehouse manager or admin)
router.put('/:id/approve', authMiddleware, approve);

// Reject a pending stock‑in request with a reason (warehouse manager or admin)
router.put('/:id/reject', authMiddleware, reject);

// Resubmit a rejected stock‑in request with corrected quantity (inventory manager or admin)
router.put('/:id/resubmit', authMiddleware, resubmit);

module.exports = router;