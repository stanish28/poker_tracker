const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queryDatabase } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find user by username or email
    const user = await queryDatabase(
      'SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1',
      [username]
    );
    
    if (!user || user.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(password, user[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user[0].id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: { id: user[0].id, username: user[0].username, email: user[0].email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user details
    const user = await queryDatabase(
      'SELECT id, username, email FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (!user || user.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.json({
      valid: true,
      user: { id: user[0].id, username: user[0].username, email: user[0].email }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});
module.exports = router;
