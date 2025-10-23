const express =require("express");
const pkg =require("pg");
const dotenv = require("dotenv");
dotenv.config();

const { Pool } = pkg;
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

const app = express();
app.use(express.json());


// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    // Check database connection
    await pool.query("SELECT 1");
    res.status(200).json({
      status: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: "connected"
    });
  } catch (err) {
    console.error("Health check failed:", err);
    res.status(503).json({
      status: "unhealthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: err.message
    });
  }
});
// Create user
app.post("/users", async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Validation
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }
    
    if (name.trim().length === 0 || email.trim().length === 0) {
      return res.status(400).json({ error: "Name and email cannot be empty" });
    }
    
    if (name.length > 50 || email.length > 50) {
      return res.status(400).json({ error: "Name and email must not exceed 50 characters" });
    }
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    
    const result = await pool.query(
      "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
      [name.trim(), email.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique violation error code
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all users
app.get("/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user
app.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;
    
    // Validation
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid user ID is required" });
    }
    
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }
    
    if (name.trim().length === 0 || email.trim().length === 0) {
      return res.status(400).json({ error: "Name and email cannot be empty" });
    }
    
    if (name.length > 50 || email.length > 50) {
      return res.status(400).json({ error: "Name and email must not exceed 50 characters" });
    }
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    
    const result = await pool.query(
      "UPDATE users SET name=$1, email=$2 WHERE id=$3 RETURNING *",
      [name.trim(), email.trim(), id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique violation error code
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete user
app.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validation
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid user ID is required" });
    }
    
    const result = await pool.query("DELETE FROM users WHERE id=$1 RETURNING id", [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    return res.status(200).json({ message: "deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
