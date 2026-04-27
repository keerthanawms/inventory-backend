/**
 * Stock-Out Request Controller
 * Handles creation, approval, and rejection of stock‑out requests.
 * Only warehouse staff can create; only warehouse managers can approve/reject.
 */

const db = require('../config/db');

/**
 * Get all stock‑out requests with product name and creator/reviewer details (name + role).
 * Sorted newest first.
 */
exports.getAll = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT r.*, 
                   p.name as product_name,
                   creator.name as creator_name,
                   creator.role as creator_role,
                   reviewer.name as reviewer_name,
                   reviewer.role as reviewer_role
            FROM stock_out_requests r
            JOIN products p ON r.product_id = p.product_id
            LEFT JOIN users creator ON r.created_by = creator.user_id
            LEFT JOIN users reviewer ON r.reviewed_by = reviewer.user_id
            ORDER BY r.timestamp DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Create a new stock‑out request (pending).
 * Only accessible by warehouse staff or admin.
 */
exports.create = async (req, res) => {
    const { product_id, quantity } = req.body;
    const created_by = req.user.user_id;
    try {
        const [result] = await db.query(
            'INSERT INTO stock_out_requests (product_id, quantity, created_by) VALUES (?, ?, ?)',
            [product_id, quantity, created_by]
        );
        res.status(201).json({ request_id: result.insertId });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Approve a pending stock‑out request.
 * Checks sufficient inventory, then deducts quantity.
 * Only warehouse manager or admin.
 * Uses a transaction.
 */
exports.approve = async (req, res) => {
    const { id } = req.params;
    const reviewed_by = req.user.user_id;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [reqRows] = await connection.query('SELECT * FROM stock_out_requests WHERE request_id = ?', [id]);
        if (reqRows.length === 0) throw new Error('Request not found');
        const request = reqRows[0];
        if (request.status !== 'pending') throw new Error('Request already processed');

        // Check sufficient stock
        const [invRows] = await connection.query('SELECT * FROM inventory WHERE product_id = ?', [request.product_id]);
        if (invRows.length === 0 || invRows[0].quantity < request.quantity) {
            throw new Error('Insufficient stock');
        }

        await connection.query(
            'UPDATE stock_out_requests SET status = "approved", reviewed_by = ? WHERE request_id = ?',
            [reviewed_by, id]
        );

        await connection.query(
            'UPDATE inventory SET quantity = quantity - ? WHERE product_id = ?',
            [request.quantity, request.product_id]
        );

        await connection.commit();
        res.json({ message: 'Stock-out approved' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
};

/**
 * Reject a pending stock‑out request with a reason.
 * Only warehouse manager or admin.
 */
exports.reject = async (req, res) => {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const reviewed_by = req.user.user_id;
    try {
        await db.query(
            'UPDATE stock_out_requests SET status = "rejected", reviewed_by = ?, rejection_reason = ? WHERE request_id = ?',
            [reviewed_by, rejection_reason, id]
        );
        res.json({ message: 'Request rejected' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};