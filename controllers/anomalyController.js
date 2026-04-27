/**
 * Anomaly Detection Controller
 * Uses rule-based statistical analysis to detect unusual patterns in inventory data.
 * Checks for: low stock alerts, sudden large stock-out spikes, repeated rejections,
 * overstock situations, and high-velocity stock movement.
 */

const db = require('../config/db');

/**
 * Analyse inventory data and return a list of detected anomalies.
 * Each anomaly has: type, severity (low/medium/high), product_name, message.
 */
exports.getAnomalies = async (req, res) => {
    try {
        const anomalies = [];

        // ── 1. LOW STOCK ALERT ──────────────────────────────────────────────
        // Flag products whose approved quantity has dropped below 10 units.
        const [lowStock] = await db.query(`
            SELECT p.name AS product_name, i.quantity
            FROM inventory i
            JOIN products p ON i.product_id = p.product_id
            WHERE i.quantity < 10
        `);
        lowStock.forEach(row => {
            anomalies.push({
                type: 'Low Stock',
                severity: row.quantity === 0 ? 'high' : 'medium',
                product_name: row.product_name,
                message: row.quantity === 0
                    ? `${row.product_name} is OUT OF STOCK.`
                    : `${row.product_name} has only ${row.quantity} units remaining.`
            });
        });

        // ── 2. SUDDEN LARGE STOCK-OUT SPIKE ─────────────────────────────────
        // Flag approved stock-out requests where quantity > 2× the product's avg approved qty.
        const [spikes] = await db.query(`
            SELECT p.name AS product_name, r.quantity, avg_data.avg_qty
            FROM stock_out_requests r
            JOIN products p ON r.product_id = p.product_id
            JOIN (
                SELECT product_id, AVG(quantity) AS avg_qty
                FROM stock_out_requests
                WHERE status = 'approved'
                GROUP BY product_id
                HAVING COUNT(*) >= 2
            ) avg_data ON r.product_id = avg_data.product_id
            WHERE r.status = 'approved'
              AND r.quantity > (avg_data.avg_qty * 2)
            ORDER BY r.timestamp DESC
            LIMIT 10
        `);
        spikes.forEach(row => {
            anomalies.push({
                type: 'Stock-Out Spike',
                severity: 'high',
                product_name: row.product_name,
                message: `Unusually large stock-out of ${row.quantity} units for ${row.product_name} (avg: ${Math.round(row.avg_qty)} units).`
            });
        });

        // ── 3. REPEATED REJECTIONS ────────────────────────────────────────────
        // Products with 2+ rejected stock-in requests may indicate a process issue.
        const [rejections] = await db.query(`
            SELECT p.name AS product_name, COUNT(*) AS reject_count
            FROM stock_in_requests r
            JOIN products p ON r.product_id = p.product_id
            WHERE r.status = 'rejected'
            GROUP BY r.product_id
            HAVING reject_count >= 2
        `);
        rejections.forEach(row => {
            anomalies.push({
                type: 'Repeated Rejections',
                severity: 'medium',
                product_name: row.product_name,
                message: `${row.product_name} has had ${row.reject_count} rejected stock-in requests. Review supply chain.`
            });
        });

        // ── 4. OVERSTOCK ALERT ────────────────────────────────────────────────
        // Flag products with inventory > 500 units as potentially overstocked.
        const [overstock] = await db.query(`
            SELECT p.name AS product_name, i.quantity
            FROM inventory i
            JOIN products p ON i.product_id = p.product_id
            WHERE i.quantity > 500
        `);
        overstock.forEach(row => {
            anomalies.push({
                type: 'Overstock',
                severity: 'low',
                product_name: row.product_name,
                message: `${row.product_name} has ${row.quantity} units — possible overstock situation.`
            });
        });

        // ── 5. HIGH PENDING REQUESTS ─────────────────────────────────────────
        // More than 5 pending requests for one product suggests approval bottleneck.
        const [pending] = await db.query(`
            SELECT p.name AS product_name, COUNT(*) AS pending_count
            FROM stock_in_requests r
            JOIN products p ON r.product_id = p.product_id
            WHERE r.status = 'pending'
            GROUP BY r.product_id
            HAVING pending_count >= 3
        `);
        pending.forEach(row => {
            anomalies.push({
                type: 'Approval Bottleneck',
                severity: 'medium',
                product_name: row.product_name,
                message: `${row.product_name} has ${row.pending_count} pending stock-in requests awaiting approval.`
            });
        });

        res.json({ anomalies, scanned_at: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
