import jwt from 'jsonwebtoken';
import express from 'express';
import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';
import authenticateToken from '../middleware/authenticateToken.js';

dotenv.config();

const router = express.Router();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const jwtSecret = process.env.JWT_SECRET;

// Utility function for querying the database
export const query = (text, params) => pool.query(text, params);

// Utility function to get user by ID
async function getUserById(userId) {
    const queryResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    return queryResult.rows.length > 0 ? queryResult.rows[0] : null; // Returns the first user matching the ID or null if no user found
}

// Authentication Routes
router.post('/register', async (req, res) => {
    const { firstName, lastName, email, password, username } = req.body;
    try {
        const emailExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (emailExists.rows.length > 0) {
            return res.status(400).json({ message: "User already exists with that email." });
        }

        const usernameExists = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (usernameExists.rows.length > 0) {
            return res.status(400).json({ message: "User already exists with that username." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await pool.query("INSERT INTO users (firstName, lastName, email, password, username) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [firstName, lastName, email, hashedPassword, username]
        );

        res.status(201).json({ user: newUser.rows[0] });
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ message: 'Error registering user' });
    }
});

router.post('/login',  async (req, res) => {
    console.log("Attempting to log in", req.body);

    const { email, password } = req.body;
    try {
        const userQuery = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userQuery.rows.length === 0) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const user = userQuery.rows[0];
        const isValidPassword = await bcrypt.compare(String(password), user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '1 day' });
        res.cookie('token', token, {
            httpOnly: true,
            path: '/',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            secure: process.env.NODE_ENV === 'production', // Adjust for local testing if necessary
            sameSite: 'Lax',
          });   
            res.status(200).json({ message: "Login successful", user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, username: user.username } });
          console.log(token)
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: 'An error occurred during login.' });
    }
});


router.post('/logout', (req, res) => {
    res.cookie('token', '', { httpOnly: true, path: '/', expires: new Date(0) });
    res.status(200).json({ message: 'Logged out successfully' });
});

// Session Validation
router.get('/validate', async (req, res) => {
    const token = req.cookies.token;
    console.log('Cookies:', token);
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        const user = await getUserById(decoded.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const { password, ...userDetails } = user;
        res.status(200).json({ message: 'Session is valid', user: userDetails });
    } catch (error) {
        console.error("Validation error:", error);
        res.status(401).json({ message: 'Session validation failed' });
    }
});

export default router;
