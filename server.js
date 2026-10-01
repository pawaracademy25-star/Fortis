import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, initializeDatabase } from './src/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || crypto.randomBytes(24).toString('hex');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
initializeDatabase();

// --- PUBLIC REST API ENDPOINTS ---

// 1. Get schedule / classes with optional filters
app.get('/api/classes', (req, res) => {
  try {
    const { day, category, intensity } = req.query;
    let query = 'SELECT * FROM classes WHERE 1=1';
    const params = [];

    if (day && day !== 'All') {
      query += ' AND day_of_week = ?';
      params.push(day);
    }
    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }
    if (intensity && intensity !== 'All') {
      query += ' AND intensity = ?';
      params.push(intensity);
    }

    query += " ORDER BY CASE day_of_week WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 WHEN 'Sunday' THEN 7 END, time_slot ASC";

    const classes = db.prepare(query).all(...params);
    res.json({ success: true, count: classes.length, data: classes });
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ success: false, message: 'Unable to retrieve class schedule.' });
  }
});

// 2. Get single class details
app.get('/api/classes/:id', (req, res) => {
  try {
    const classId = parseInt(req.params.id, 10);
    const item = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error retrieving class' });
  }
});

// 3. Get trainers roster
app.get('/api/trainers', (req, res) => {
  try {
    const trainers = db.prepare('SELECT * FROM trainers ORDER BY id ASC').all();
    res.json({ success: true, count: trainers.length, data: trainers });
  } catch (error) {
    console.error('Error fetching trainers:', error);
    res.status(500).json({ success: false, message: 'Unable to retrieve trainers.' });
  }
});

// 4. Get membership plans
app.get('/api/plans', (req, res) => {
  try {
    const plans = db.prepare('SELECT * FROM membership_plans ORDER BY monthly_price ASC').all();
    const formatted = plans.map(p => ({
      ...p,
      features: JSON.parse(p.features)
    }));
    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ success: false, message: 'Unable to retrieve plans.' });
  }
});

// 5. Book a free 1-Day Trial Pass
app.post('/api/trials', (req, res) => {
  try {
    const { fullName, email, phone, preferredDate, fitnessGoal } = req.body;

    if (!fullName || !email || !phone || !preferredDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name, email, phone number, and preferred date.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    // Generate unique pass code
    const passCode = `FTS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const stmt = db.prepare(`
      INSERT INTO trial_passes (pass_code, full_name, email, phone, preferred_date, fitness_goal, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
    `);

    stmt.run(passCode, fullName.trim(), email.trim(), phone.trim(), preferredDate, fitnessGoal || 'General Strength & Conditioning');

    res.status(201).json({
      success: true,
      message: 'Your 1-Day VIP Trial Pass has been generated.',
      pass: {
        passCode,
        fullName: fullName.trim(),
        preferredDate,
        status: 'ACTIVE',
        validFor: '24 Hours from activation date',
        facility: 'Fortis Athletic Club - Flagship Sanctuary'
      }
    });
  } catch (error) {
    console.error('Error generating trial pass:', error);
    res.status(500).json({ success: false, message: 'Failed to create trial pass. Please try again.' });
  }
});

// 6. Reserve a spot in a class
app.post('/api/bookings', (req, res) => {
  try {
    const { classId, fullName, email, phone, bookingDate } = req.body;

    if (!classId || !fullName || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide class selection, full name, email, and phone number.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    // Check class capacity
    const selectedClass = db.prepare('SELECT * FROM classes WHERE id = ?').get(parseInt(classId, 10));
    if (!selectedClass) {
      return res.status(404).json({ success: false, message: 'Selected class does not exist.' });
    }

    if (selectedClass.booked_count >= selectedClass.capacity) {
      return res.status(400).json({
        success: false,
        message: 'This session is currently at full capacity. Please select another slot or day.'
      });
    }

    // Atomic increment and booking
    const bookingRef = `BK-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const dateToBook = bookingDate || selectedClass.day_of_week;

    const insertBooking = db.prepare(`
      INSERT INTO class_bookings (booking_ref, class_id, full_name, email, phone, booking_date, status)
      VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED')
    `);
    const updateCount = db.prepare(`
      UPDATE classes SET booked_count = booked_count + 1 WHERE id = ?
    `);

    insertBooking.run(bookingRef, selectedClass.id, fullName.trim(), email.trim(), phone.trim(), dateToBook);
    updateCount.run(selectedClass.id);

    res.status(201).json({
      success: true,
      message: 'Spot reserved successfully!',
      booking: {
        bookingRef,
        className: selectedClass.name,
        category: selectedClass.category,
        instructor: selectedClass.instructor,
        timeSlot: selectedClass.time_slot,
        dayOfWeek: selectedClass.day_of_week,
        fullName: fullName.trim(),
        remainingSpots: selectedClass.capacity - (selectedClass.booked_count + 1)
      }
    });
  } catch (error) {
    console.error('Error reserving class spot:', error);
    res.status(500).json({ success: false, message: 'Reservation failed. Please try again.' });
  }
});

// 7. General inquiries / Private consultation request
app.post('/api/inquiries', (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }

    const stmt = db.prepare(`
      INSERT INTO inquiries (name, email, phone, subject, message)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(name.trim(), email.trim(), (phone || '').trim(), (subject || 'General Inquiry').trim(), message.trim());

    res.status(201).json({
      success: true,
      message: 'Inquiry received. Our concierge team will review and reply within 24 hours.'
    });
  } catch (error) {
    console.error('Error submitting inquiry:', error);
    res.status(500).json({ success: false, message: 'Submission failed. Please try again later.' });
  }
});

// 8. Newsletter subscription
app.post('/api/newsletter', (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }

    try {
      const stmt = db.prepare('INSERT INTO newsletter_subscribers (email) VALUES (?)');
      stmt.run(email.trim().toLowerCase());
    } catch (e) {
      // If already registered, still return friendly success without exposing DB error
    }

    res.status(201).json({
      success: true,
      message: 'You have been enrolled in the Fortis Journal.'
    });
  } catch (error) {
    console.error('Error with newsletter subscription:', error);
    res.status(500).json({ success: false, message: 'Subscription failed.' });
  }
});

// --- STRICT ROLE ISOLATION / NO ADMIN EXPOSURE ---
// Strict rule: No admin UI or controls are ever exposed to visitors or customers.
// Any internal diagnostic endpoint strictly requires the private server environment key
// and returns 404 to all regular traffic so its presence is not revealed.
app.all('/api/internal*', (req, res) => {
  const authHeader = req.headers['x-admin-key'];
  if (!authHeader || authHeader !== ADMIN_SECRET_KEY) {
    // Return standard 404 so nothing is exposed to clients
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Fallback to index.html for client-side navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Fortis Athletic Club server running at http://localhost:${PORT}`);
});
