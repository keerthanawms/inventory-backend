/**
 * Inventory Controller
 * Handles retrieval of current inventory (approved stock only).
 */

const db = require('../config/db');

/**
 * Get all inventory items with product names.
 * Inventory only contains approved stock (updated after stock‑in approvals).
 */
exports.getAll = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT i.*, p.name as product_name
            FROM inventory i
            JOIN products p ON i.product_id = p.product_id
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};