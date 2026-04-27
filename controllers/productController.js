/**
 * Product Controller
 * Handles CRUD operations for products and automatically creates a pending stock‑in request.
 */

const db = require('../config/db');

/**
 * Get all products with current approved stock quantity and creator info (name + role).
 */
exports.getAllProducts = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, 
                   COALESCE(i.quantity, 0) as quantity,
                   u.name as created_by_name,
                   u.role as created_by_role
            FROM products p
            LEFT JOIN inventory i ON p.product_id = i.product_id
            LEFT JOIN users u ON p.created_by = u.user_id
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Create a new product with initial quantity.
 * Automatically creates a pending stock‑in request.
 * Uses a transaction to ensure both inserts succeed or rollback.
 * Only accessible by inventory manager or admin.
 */
exports.createProduct = async (req, res) => {
    const { name, description, category, initial_quantity } = req.body;
    const created_by = req.user.user_id;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [prodResult] = await connection.query(
            'INSERT INTO products (name, description, category, created_by) VALUES (?, ?, ?, ?)',
            [name, description, category, created_by]
        );
        const product_id = prodResult.insertId;
        await connection.query(
            'INSERT INTO stock_in_requests (product_id, requested_quantity, status, created_by) VALUES (?, ?, "pending", ?)',
            [product_id, initial_quantity, created_by]
        );
        await connection.commit();
        res.status(201).json({ product_id, message: 'Product created, pending approval' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
};

/**
 * Update product details (name, description, category).
 */
exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, description, category } = req.body;
    try {
        await db.query(
            'UPDATE products SET name = ?, description = ?, category = ? WHERE product_id = ?',
            [name, description, category, id]
        );
        res.json({ message: 'Product updated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Delete a product (cascade will remove related inventory, requests, and location mappings).
 */
exports.deleteProduct = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM products WHERE product_id = ?', [id]);
        res.json({ message: 'Product deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};