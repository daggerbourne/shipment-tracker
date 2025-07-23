const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !email.endsWith('@lja.com')) {
      return res.status(400).json({ error: 'Only @lja.com emails are allowed.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const user = new User({
      email,
      password,
      role: 'viewer',      // Default role
      approved: false      // Admin must approve
    });

    await user.save();
    res.status(201).json({ message: 'Registration successful. Awaiting admin approval.' });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.approved) {
    return res.status(403).json({ error: 'Account pending admin approval.' });
  }

  const token = jwt.sign(
    { id: user._id, role: user.role },
    'supersecretkey', // TODO: use process.env.JWT_SECRET
    { expiresIn: '1d' }
  );

  res.json({ token });
});

module.exports = router;
