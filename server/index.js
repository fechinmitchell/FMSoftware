const express = require('express');
const cors = require('cors');
const { router: adminRouter } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Admin auth + internal tools (login, /me, /draft)
app.use('/api/admin', adminRouter);

// Contact form endpoint
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'Please fill in all fields.' });
  }
  console.log('New project enquiry:');
  console.log(`  Name: ${name}`);
  console.log(`  Email: ${email}`);
  console.log(`  Message: ${message}`);
  res.json({ success: true, message: 'Thanks! Your message has been received.' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`FM Software server running on http://localhost:${PORT}`);
});