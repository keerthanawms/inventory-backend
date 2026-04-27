/**
 * Location Controller
 * Handles CRUD operations for warehouse locations (zones, sections, racks).
 */

const db = require('../config/db');

/**
 * Get all warehouse locations.
 */
exports.getAll = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM locations');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Create a new location (zone, section, rack).
 * Only accessible by warehouse manager or admin.
 */
exports.create = async (req, res) => {
    const { zone, section, rack } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO locations (zone, section, rack) VALUES (?, ?, ?)',
            [zone, section, rack]
        );
        res.status(201).json({ location_id: result.insertId, zone, section, rack });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Delete a location (cascade removes product-location mappings if foreign key is set).
 */
exports.delete = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM locations WHERE location_id = ?', [id]);
        res.json({ message: 'Location deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};