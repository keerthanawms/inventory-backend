/**
 * Product Routes
 * CRUD operations for products.
 * Creating a product automatically creates a pending stock‑in request.
 * All routes require authentication.
 */

const express = require('express');
const {
    getAllProducts,
    createProduct,
    updateProduct,
    deleteProduct
} = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Get all products with current inventory and creator info
router.get('/', authMiddleware, getAllProducts);

// Create a new product (with initial quantity)
router.post('/', authMiddleware, createProduct);

// Update product details
router.put('/:id', authMiddleware, updateProduct);

// Delete a product (cascade deletes related records)
router.delete('/:id', authMiddleware, deleteProduct);

module.exports = router;