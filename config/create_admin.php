<?php
/**
 * Script to create the default admin user in the database.
 * Run this file in a browser (via XAMPP/WAMP) to set up the admin account.
 * Access: http://localhost/inventory/backend/config/create_admin.php
 */

// Database configuration
$host = 'localhost';
$dbname = 'inventory_db';
$db_user = 'root';      // XAMPP default username
$db_pass = '';          // XAMPP default password (empty)

try {
    // Create PDO connection
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Check if admin already exists
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute(['admin@example.com']);
    if ($stmt->fetch()) {
        echo "<h3> Admin user already exists.</h3>";
    } else {
        // Insert admin with status = 1 (active)
        $hashedPassword = password_hash('admin123', PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (name, email, password, role, status, created_at) VALUES (?, ?, ?, ?, 1, NOW())");
        $stmt->execute(['Admin', 'admin@example.com', $hashedPassword, 'admin']);
        echo "<h3> Admin user created successfully!</h3>";
        echo "<p><strong>Email:</strong> admin@example.com<br>";
        echo "<strong>Password:</strong> admin123</p>";
    }
} catch (PDOException $e) {
    // Error handling
    echo "<h3> Database error:</h3>";
    echo "<p>" . $e->getMessage() . "</p>";
    echo "<p>Please ensure the database <code>inventory_db</code> exists, the tables are created, and the <code>status</code> column exists in the <code>users</code> table.</p>";
}
?>