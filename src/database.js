import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'gym.sqlite');

export const db = new DatabaseSync(DB_PATH);

// Initialize schema and seed data
export function initializeDatabase() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      instructor TEXT NOT NULL,
      level TEXT NOT NULL,
      day_of_week TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      duration_mins INTEGER NOT NULL,
      capacity INTEGER NOT NULL,
      booked_count INTEGER DEFAULT 0,
      description TEXT NOT NULL,
      intensity TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trainers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      specialties TEXT NOT NULL,
      experience_years INTEGER NOT NULL,
      bio TEXT NOT NULL,
      image_url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS membership_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      monthly_price INTEGER NOT NULL,
      annual_price INTEGER NOT NULL,
      tagline TEXT NOT NULL,
      popular INTEGER DEFAULT 0,
      features TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trial_passes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pass_code TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      preferred_date TEXT NOT NULL,
      fitness_goal TEXT NOT NULL,
      status TEXT DEFAULT 'CONFIRMED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS class_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_ref TEXT UNIQUE NOT NULL,
      class_id INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      booking_date TEXT NOT NULL,
      status TEXT DEFAULT 'CONFIRMED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );

    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed classes if empty
  const classCount = db.prepare('SELECT COUNT(*) as count FROM classes').get();
  if (classCount.count === 0) {
    const insertClass = db.prepare(`
      INSERT INTO classes (name, category, instructor, level, day_of_week, time_slot, duration_mins, capacity, booked_count, description, intensity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const initialClasses = [
      ['Hypertrophy Protocol', 'Strength', 'Marcus Vance', 'Advanced', 'Monday', '06:30 AM', 60, 16, 11, 'Scientific progressive overload targeting upper-body compound mechanics and myofibrillar stimulus.', 'Maximum'],
      ['Iron Conditioning', 'HIIT', 'Elena Rostova', 'All Levels', 'Monday', '08:00 AM', 50, 20, 15, 'High-velocity kettlebell complexes combined with sled sprints and heart-rate zone intervals.', 'High'],
      ['Combat & Heavy Bag', 'Boxing', 'Darius Stone', 'Intermediate', 'Monday', '05:30 PM', 55, 14, 10, 'Technical orthodox combinations, kinetic footwork drills, and intensive core conditioning rounds.', 'High'],
      ['Olympic Barbell Lab', 'Strength', 'Marcus Vance', 'Advanced', 'Tuesday', '07:00 AM', 75, 12, 9, 'Snatch and clean & jerk biomechanics breakdown with velocity-based barbell tracking.', 'Maximum'],
      ['Athletic MetCon', 'HIIT', 'Elena Rostova', 'All Levels', 'Tuesday', '12:00 PM', 45, 18, 12, 'Metabolic conditioning engine work integrating skiergs, echo bikes, and plyometrics.', 'High'],
      ['Mobility & Thermal Flow', 'Recovery', 'Kaelen Mori', 'All Levels', 'Tuesday', '06:30 PM', 50, 16, 7, 'Loaded joint mobility, thoracic decompression, paired with post-session contrast therapy.', 'Moderate'],
      ['Deadlift & Posterior Chain', 'Strength', 'Marcus Vance', 'All Levels', 'Wednesday', '06:30 AM', 60, 14, 12, 'Hinge mastery, deficit pulls, and hamstring/glute torque engineering.', 'Maximum'],
      ['Strike Circuit', 'Boxing', 'Darius Stone', 'All Levels', 'Wednesday', '05:30 PM', 50, 16, 14, 'Rapid-fire mitt work, reactive head movement, and anaerobic conditioning.', 'High'],
      ['Breathwork & Cold Immersion', 'Recovery', 'Kaelen Mori', 'All Levels', 'Thursday', '07:00 AM', 45, 12, 8, 'Down-regulation pranayama coupled with coached 3°C cryo-plunge therapy.', 'Low'],
      ['Power Cleans & Core', 'Strength', 'Marcus Vance', 'Intermediate', 'Thursday', '06:00 PM', 60, 14, 11, 'Explosive triple extension power development coupled with anti-rotational core stability.', 'High'],
      ['Full Body Forge', 'HIIT', 'Elena Rostova', 'All Levels', 'Friday', '07:30 AM', 50, 20, 16, 'High-cadence team workout testing VO2 max and muscular stamina before the weekend.', 'Maximum'],
      ['Golden Hour Restorative', 'Recovery', 'Kaelen Mori', 'All Levels', 'Friday', '05:30 PM', 55, 15, 6, 'Myofascial foam release, passive hanging, and nervous system recalibration.', 'Low'],
      ['The Saturday Crucible', 'Strength', 'Marcus Vance', 'All Levels', 'Saturday', '09:00 AM', 75, 24, 21, 'Club flagship Saturday team training session: functional carry, sandbag over shoulder, and barbell complexes.', 'Maximum'],
      ['Cardio Endurance Matrix', 'HIIT', 'Elena Rostova', 'All Levels', 'Saturday', '11:00 AM', 50, 18, 13, 'Aerobic threshold pacing and cadence management across concept2 ergometers.', 'High'],
      ['Regenerative Mobility', 'Recovery', 'Kaelen Mori', 'All Levels', 'Sunday', '10:00 AM', 60, 16, 9, 'Full body biomechanical reset preparing athletes for the training week ahead.', 'Low']
    ];

    for (const item of initialClasses) {
      insertClass.run(...item);
    }
  }

  // Seed trainers if empty
  const trainerCount = db.prepare('SELECT COUNT(*) as count FROM trainers').get();
  if (trainerCount.count === 0) {
    const insertTrainer = db.prepare(`
      INSERT INTO trainers (name, role, specialties, experience_years, bio, image_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const initialTrainers = [
      [
        'Marcus Vance',
        'Head of Strength & Biomechanics',
        'Olympic Weightlifting, Hypertrophy, Velocity Based Training',
        12,
        'Former competitive Olympic weightlifting coach with Master of Science in Exercise Physiology. Specializes in biomechanical efficiency and maximal strength adaptation.',
        '/assets/strength-zone.jpg'
      ],
      [
        'Elena Rostova',
        'Director of High-Performance Conditioning',
        'Metabolic Conditioning, VO2 Max Optimization, Kettlebells',
        9,
        'Ex-collegiate decathlete and master kettlebell practitioner. Designs metabolic conditioning protocols that build unmatched cardiovascular endurance.',
        '/assets/combat-hiit.jpg'
      ],
      [
        'Darius Stone',
        'Striking & Tactical Conditioning Coach',
        'Boxing Biomechanics, Rotational Power, Reflex Conditioning',
        11,
        'Professional striking coach known for developing lightning-fast hand speed, kinetic ground transfer, and high-density sparring stamina.',
        '/assets/combat-hiit.jpg'
      ],
      [
        'Kaelen Mori',
        'Head of Recovery & Physiology',
        'Myofascial Decompression, Contrast Cryotherapy, Breathwork',
        8,
        'Licensed physical physiologist specialized in parasympathetic nervous system recovery, joint mobility, and cryo-thermal restoration.',
        '/assets/recovery-spa.jpg'
      ]
    ];

    for (const item of initialTrainers) {
      insertTrainer.run(...item);
    }
  }

  // Seed membership plans if empty
  const planCount = db.prepare('SELECT COUNT(*) as count FROM membership_plans').get();
  if (planCount.count === 0) {
    const insertPlan = db.prepare(`
      INSERT INTO membership_plans (id, name, monthly_price, annual_price, tagline, popular, features)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const initialPlans = [
      [
        'essential',
        'Essential Athletic',
        89,
        72,
        'Complete facility access for dedicated individuals focused on autonomous training.',
        0,
        JSON.stringify([
          'Full access to all Strength & Olympic platforms',
          'Access to Cardio Mezzanine & Concept2 suites',
          'Luxury locker rooms with rainfall showers & amenities',
          'Fortis Athletic mobile companion & keyless entry',
          'Complimentary towel service & filtered hydration bar'
        ])
      ],
      [
        'performance',
        'Black Iron Club',
        149,
        119,
        'The definitive choice: unlimited boutique classes, priority spots, and full recovery access.',
        1,
        JSON.stringify([
          'Everything in Essential Athletic',
          'Unlimited access to all 50+ weekly coach-led classes',
          'Full access to Hydro-Recovery Sauna & 3°C Cold Plunge pool',
          '7-day advance priority class reservation window',
          'Monthly 3D InBody body composition & mobility scan',
          '2 Guest passes per month for training partners'
        ])
      ],
      [
        'elite',
        'Sanctuary Elite',
        249,
        199,
        'Bespoke performance tier with private 1-on-1 coaching sessions and recovery concierge.',
        0,
        JSON.stringify([
          'Everything in Black Iron Club',
          'Two 1-on-1 private coaching sessions each month',
          'Dedicated private laundry locker & personalized kit storage',
          'Custom nutritional macro blueprint & monthly review',
          'Unlimited guests (up to 1 companion per visit)',
          'Exclusive access to private Executive Lounge'
        ])
      ]
    ];

    for (const item of initialPlans) {
      insertPlan.run(...item);
    }
  }

  console.log('Database initialized and verified successfully.');
}
