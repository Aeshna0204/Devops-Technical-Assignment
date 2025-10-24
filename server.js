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

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50),
        email VARCHAR(50) UNIQUE
      );
    `);
    console.log("✅ Users table is ready");
  } catch (err) {
    console.error("❌ Error creating users table:", err);
  }
}
initializeDatabase();


// ====== PROMETHEUS METRICS SETUP ======
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: "node_app_" });

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 2, 3, 5] // time buckets in seconds
});

// Middleware to measure response time
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    end({ method: req.method, route: req.route ? req.route.path : req.path, status_code: res.statusCode });
  });
  next();
});

// Metrics endpoint
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});
// =======================================




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
