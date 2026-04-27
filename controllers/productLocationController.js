/**
 * Product Location Controller
 * Handles assignment and removal of product‑location mappings.
 * Only warehouse manager or admin can assign/remove.
 */

const db = require('../config/db');

/**
 * Get all product‑location assignments with product names and location details.
 */
exports.getAll = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT pl.*, p.name as product_name, l.zone, l.section, l.rack
            FROM product_locations pl
            JOIN products p ON pl.product_id = p.product_id
            JOIN locations l ON pl.location_id = l.location_id
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Assign a product to a warehouse location.
 * Should only be done after the stock‑in request is approved.
 */
exports.assign = async (req, res) => {
    const { product_id, location_id } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO product_locations (product_id, location_id) VALUES (?, ?)',
            [product_id, location_id]
        );
        res.status(201).json({ id: result.insertId, product_id, location_id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Remove a product‑location assignment.
 */
exports.remove = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM product_locations WHERE id = ?', [id]);
        res.json({ message: 'Assignment removed' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};