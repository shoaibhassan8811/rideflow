const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const fs = require("fs");

const app = express();

// =====================================
// Middleware
// =====================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// =====================================
// TiDB CLOUD CONNECTION
// =====================================
const db = mysql.createConnection({
  host: "gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com",
  port: 4000,
  user: "3BeVcgLp2GkV4eA.root",
  password: "4DXij2jotf9SwLhJ",
  database: "rideflow",
  ssl: {
    ca: fs.readFileSync("./isrgrootx1.pem")
  }
});

db.connect((err) => {
  if (err) {
    console.log("TiDB Connection Failed:", err);
  } else {
    console.log("TiDB Connected Successfully");
  }
});

// =====================================
// HOME / LOGIN PAGE
// =====================================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

// =====================================
// LOGIN
// =====================================
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const sql = `
    SELECT *
    FROM users
    WHERE email = ?
    AND password_hash = SHA2(?, 256)
    LIMIT 1
  `;

  db.query(sql, [email, password], (err, results) => {
    if (err) return res.send("Login Error");

    if (results.length === 0) {
      return res.send("Invalid Email or Password");
    }

    const user = results[0];

    if (user.role === "admin" || user.role === "super_admin") {
      res.redirect("/admin");
    } 
    else if (user.role === "driver") {
      res.redirect("/driver");
    } 
    else {
      res.redirect("/rider");
    }
  });
});
// =====================================
// ADMIN DASHBOARD
// =====================================
app.get("/admin", (req, res) => {
  const sql = `
    SELECT
    (SELECT COUNT(*) FROM users) AS totalUsers,
    (SELECT COUNT(*) FROM users WHERE role='rider') AS totalRiders,
    (SELECT COUNT(*) FROM users WHERE role='driver') AS totalDrivers,
    (SELECT COUNT(*) FROM users WHERE account_status='suspended') AS suspendedUsers
  `;

  db.query(sql, (err, results) => {
    if (err) return res.send("Dashboard Error");

    res.render("admin", {
      stats: results[0]
    });
  });
});

// =====================================
// USERS PAGE
// =====================================
app.get("/users", (req, res) => {
  const sql = `
    SELECT user_id, full_name, email, role, account_status
    FROM users
    ORDER BY user_id ASC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.send("Users Error");

    res.render("users", {
      users: results
    });
  });
});

// =====================================
// ADD USER
// =====================================
app.post("/add-user", (req, res) => {
  const { full_name, email, phone_number, password, role } = req.body;

  const sql = `
    INSERT INTO users
    (full_name, email, phone_number, password_hash, role, account_status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `;

  db.query(
    sql,
    [full_name, email, phone_number, password, role],
    (err) => {
      if (err) {
        console.log(err);
        return res.send("Error Adding User");
      }

      res.redirect("/users");
    }
  );
});

// =====================================
// SUSPEND USER
// =====================================
app.get("/suspend/:id", (req, res) => {
  const sql = `
    UPDATE users
    SET account_status='suspended'
    WHERE user_id=?
  `;

  db.query(sql, [req.params.id], () => {
    res.redirect("/users");
  });
});

// =====================================
// ACTIVATE USER
// =====================================
app.get("/activate/:id", (req, res) => {
  const sql = `
    UPDATE users
    SET account_status='active'
    WHERE user_id=?
  `;

  db.query(sql, [req.params.id], () => {
    res.redirect("/users");
  });
});

// =====================================
// REPORTS PAGE
// =====================================
app.get("/reports", (req, res) => {
  const sql = `
    SELECT
    (SELECT IFNULL(SUM(amount),0)
     FROM payments
     WHERE pay_status='paid') AS revenueToday,

    (SELECT COUNT(*)
     FROM rides
     WHERE ride_status='completed') AS completedRides,

    (SELECT COUNT(*)
     FROM users
     WHERE role='driver'
     AND account_status='active') AS activeDrivers,

    (SELECT COUNT(*)
     FROM payments
     WHERE pay_status='refunded') AS refunds
  `;

  db.query(sql, (err, results) => {
    if (err) return res.send("Reports Error");

    res.render("reports", {
      stats: results[0]
    });
  });
});

// =====================================
// DRIVER PAGE
// =====================================
app.get("/driver", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "driver.html"));
});

// =====================================
// RIDER PAGE
// =====================================
app.get("/rider", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "rider.html"));
});

// =====================================
// START SERVER
// =====================================
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});