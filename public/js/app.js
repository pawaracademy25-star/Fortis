// ==========================================================================
// FORTIS ATHLETIC CLUB - CLIENT INTERACTIVITY ENGINE
// Strictly customer & visitor facing: No admin controls or data exposure.
// ==========================================================================

// Global state
let currentDay = 'Monday';
let currentCategory = 'All';
let isAnnualBilling = true;
let activeClassForBooking = null;

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initSchedule();
  initTrialForm();
  initMembershipConfigurator();
  initBiometricsCalculator();
  initFacilitiesShowcase();
  initTrainers();
  initContactForm();
  initNewsletterForm();
  initModalListeners();
});

// Toast Notification Manager
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span style="color: ${type === 'success' ? 'var(--accent-volt)' : '#ff5e1a'}">●</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// 1. Navigation & Scroll Effect
function initNavbar() {
  const header = document.querySelector('.header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  const mobileToggle = document.querySelector('.mobile-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      const isVisible = navLinks.style.display === 'flex';
      navLinks.style.display = isVisible ? 'none' : 'flex';
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '80px';
      navLinks.style.left = '0';
      navLinks.style.width = '100%';
      navLinks.style.background = '#090a0c';
      navLinks.style.padding = '1.5rem';
      navLinks.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
    });
  }
}

// 2. Class Schedule & Live Spot Reservation
async function initSchedule() {
  const dayTabs = document.querySelectorAll('.day-tab');
  const filterChips = document.querySelectorAll('.filter-chip');

  dayTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      dayTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentDay = tab.dataset.day;
      fetchAndRenderSchedule();
    });
  });

  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.category;
      fetchAndRenderSchedule();
    });
  });

  await fetchAndRenderSchedule();
}

async function fetchAndRenderSchedule() {
  const grid = document.getElementById('scheduleGrid');
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted); font-family: var(--font-mono);">
      Syncing live session availability...
    </div>
  `;

  try {
    const params = new URLSearchParams();
    if (currentDay && currentDay !== 'All') params.append('day', currentDay);
    if (currentCategory && currentCategory !== 'All') params.append('category', currentCategory);

    const res = await fetch(`/api/classes?${params.toString()}`);
    const json = await res.json();

    if (!json.success || !json.data || json.data.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
          <p style="font-family: var(--font-heading); font-size: 1.25rem; color: var(--text-primary); margin-bottom: 0.5rem;">No Sessions Found</p>
          <p style="color: var(--text-muted); font-size: 0.9rem;">There are no ${currentCategory !== 'All' ? currentCategory : ''} classes scheduled on ${currentDay}. Please select another filter or day.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    json.data.forEach(item => {
      const remaining = item.capacity - item.booked_count;
      const isFull = remaining <= 0;
      const intensityClass = `intensity-${item.intensity.toLowerCase()}`;

      const card = document.createElement('div');
      card.className = 'class-card';
      card.innerHTML = `
        <div>
          <div class="class-header">
            <span class="class-time">${item.time_slot}</span>
            <span class="class-intensity ${intensityClass}">${item.intensity} Intensity</span>
          </div>
          <h3 class="class-title">${item.name}</h3>
          <div class="class-instructor">
            <span>Coach:</span> <strong style="color: var(--text-primary);">${item.instructor}</strong> • <span>${item.duration_mins} mins</span>
          </div>
          <p class="class-desc">${item.description}</p>
        </div>
        <div class="class-footer">
          <div class="spots-status">
            <span class="spots-label">Availability</span>
            <span class="spots-count ${isFull ? 'spots-full' : ''}">
              ${isFull ? 'SESSION FULL' : `${remaining} SPOTS LEFT`}
            </span>
          </div>
          <button 
            class="btn btn-sm ${isFull ? 'btn-secondary' : 'btn-primary'}" 
            ${isFull ? 'disabled' : ''} 
            data-id="${item.id}"
            data-name="${encodeURIComponent(item.name)}"
            data-time="${item.time_slot}"
            data-instructor="${item.instructor}"
            data-day="${item.day_of_week}"
          >
            ${isFull ? 'Waitlist Only' : 'Reserve Spot'}
          </button>
        </div>
      `;

      const reserveBtn = card.querySelector('button');
      if (!isFull) {
        reserveBtn.addEventListener('click', () => {
          openBookingModal(item);
        });
      }

      grid.appendChild(card);
    });
  } catch (error) {
    console.error('Schedule fetch error:', error);
    grid.innerHTML = `<div style="grid-column: 1/-1; color: #ff5e1a; padding: 2rem; text-align: center;">Unable to load schedule. Please refresh.</div>`;
  }
}

// Spot Booking Modal
function openBookingModal(classItem) {
  activeClassForBooking = classItem;
  const modal = document.getElementById('bookingModal');
  const detailsEl = document.getElementById('modalClassDetails');
  
  if (detailsEl) {
    detailsEl.innerHTML = `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); padding: 1rem; border-radius: var(--radius-sm); margin-bottom: 1.5rem;">
        <div style="font-family: var(--font-heading); font-size: 1.2rem; color: var(--accent-volt);">${classItem.name}</div>
        <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
          ${classItem.day_of_week} • ${classItem.time_slot} • Coach ${classItem.instructor}
        </div>
      </div>
    `;
  }

  // Pre-fill date input
  const bookingDateInput = document.getElementById('bookingDate');
  if (bookingDateInput) {
    const today = new Date().toISOString().split('T')[0];
    bookingDateInput.value = today;
  }

  modal.classList.add('active');
}

// 3. 1-Day VIP Trial Pass Generation
function initTrialForm() {
  const form = document.getElementById('trialPassForm');
  if (!form) return;

  // Set default preferred date to tomorrow
  const dateInput = document.getElementById('trialDate');
  if (dateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.value = tomorrow.toISOString().split('T')[0];
    dateInput.min = new Date().toISOString().split('T')[0];
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Generating Pass...';
    submitBtn.disabled = true;

    const payload = {
      fullName: document.getElementById('trialFullName').value,
      email: document.getElementById('trialEmail').value,
      phone: document.getElementById('trialPhone').value,
      preferredDate: document.getElementById('trialDate').value,
      fitnessGoal: document.getElementById('trialGoal').value
    };

    try {
      const res = await fetch('/api/trials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        renderDigitalPass(data.pass);
        showToast('VIP Pass Generated! Show this ticket at concierge entrance.');
        form.reset();
        // Reset date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateInput.value = tomorrow.toISOString().split('T')[0];
      } else {
        showToast(data.message || 'Error creating pass', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error generating pass.', 'error');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}

function renderDigitalPass(pass) {
  const container = document.getElementById('passCardPreview');
  if (!container) return;

  container.innerHTML = `
    <div class="vip-pass-card" style="animation: slideInToast 0.5s ease forwards;">
      <div class="pass-watermark">FORTIS</div>
      <div class="pass-card-top">
        <div class="pass-logo"><span class="logo-symbol" style="width:18px;height:18px;"></span> FORTIS</div>
        <div class="pass-type-badge">1-DAY VIP ACCESS</div>
      </div>
      <div class="pass-details">
        <div>
          <div class="pass-field-label">Guest Athlete</div>
          <div class="pass-field-value">${escapeHTML(pass.fullName)}</div>
        </div>
        <div style="display:flex; justify-content: space-between;">
          <div>
            <div class="pass-field-label">Activation Date</div>
            <div class="pass-field-value font-mono">${pass.preferredDate}</div>
          </div>
          <div>
            <div class="pass-field-label">Access Status</div>
            <div class="pass-field-value font-mono" style="color: var(--accent-volt);">● ACTIVE</div>
          </div>
        </div>
        <div>
          <div class="pass-field-label">Location Access</div>
          <div class="pass-field-value" style="font-size: 0.85rem; color: var(--text-secondary);">${pass.facility}</div>
        </div>
      </div>
      <div class="pass-code-display">
        <div class="pass-field-label" style="margin-bottom: 0.25rem;">Concierge Authentication Code</div>
        <div class="pass-code-val">${pass.passCode}</div>
        <div class="pass-barcode">
          <span class="barcode-line" style="width: 2px;"></span>
          <span class="barcode-line" style="width: 5px;"></span>
          <span class="barcode-line" style="width: 1px;"></span>
          <span class="barcode-line" style="width: 4px;"></span>
          <span class="barcode-line" style="width: 2px;"></span>
          <span class="barcode-line" style="width: 6px;"></span>
          <span class="barcode-line" style="width: 1px;"></span>
          <span class="barcode-line" style="width: 3px;"></span>
          <span class="barcode-line" style="width: 5px;"></span>
          <span class="barcode-line" style="width: 2px;"></span>
          <span class="barcode-line" style="width: 4px;"></span>
          <span class="barcode-line" style="width: 1px;"></span>
          <span class="barcode-line" style="width: 3px;"></span>
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-secondary btn-sm btn-block" onclick="window.print()">
          Print / Save Pass
        </button>
      </div>
    </div>
  `;
}

// 4. Membership Plans Configurator
async function initMembershipConfigurator() {
  const billingCheckbox = document.getElementById('billingToggle');
  const monthlyLabel = document.getElementById('billingMonthlyLabel');
  const annualLabel = document.getElementById('billingAnnualLabel');

  if (billingCheckbox) {
    billingCheckbox.addEventListener('change', () => {
      isAnnualBilling = billingCheckbox.checked;
      if (isAnnualBilling) {
        annualLabel.classList.add('active');
        monthlyLabel.classList.remove('active');
      } else {
        monthlyLabel.classList.add('active');
        annualLabel.classList.remove('active');
      }
      renderPlans();
    });
  }

  await renderPlans();
}

async function renderPlans() {
  const container = document.getElementById('pricingGrid');
  if (!container) return;

  try {
    const res = await fetch('/api/plans');
    const json = await res.json();
    if (!json.success || !json.data) return;

    container.innerHTML = '';
    json.data.forEach(plan => {
      const price = isAnnualBilling ? plan.annual_price : plan.monthly_price;
      const isFeatured = plan.popular === 1;

      const card = document.createElement('div');
      card.className = `plan-card ${isFeatured ? 'featured' : ''}`;
      
      const featuresHTML = plan.features
        .map(f => `
          <li class="plan-feature-item">
            <span class="feature-check">✓</span>
            <span>${f}</span>
          </li>
        `)
        .join('');

      card.innerHTML = `
        ${isFeatured ? '<span class="featured-pill">Most Popular</span>' : ''}
        <h3 class="plan-name">${plan.name}</h3>
        <p class="plan-tagline">${plan.tagline}</p>
        <div class="plan-price-wrap">
          <span class="currency">$</span>
          <span class="price-val">${price}</span>
          <span class="price-period">/ month</span>
        </div>
        <ul class="plan-features-list">
          ${featuresHTML}
        </ul>
        <button class="btn ${isFeatured ? 'btn-primary' : 'btn-secondary'} btn-block plan-select-btn" data-plan="${plan.name}" data-price="${price}">
          Select Membership
        </button>
      `;

      const selectBtn = card.querySelector('.plan-select-btn');
      selectBtn.addEventListener('click', () => {
        openPlanModal(plan.name, price, isAnnualBilling ? 'Annual (Billed yearly)' : 'Monthly');
      });

      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error fetching plans:', err);
  }
}

function openPlanModal(planName, price, billingCycle) {
  const modal = document.getElementById('planModal');
  const detailsEl = document.getElementById('modalPlanDetails');
  
  if (detailsEl) {
    detailsEl.innerHTML = `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); padding: 1.25rem; border-radius: var(--radius-sm); margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h4 style="font-family: var(--font-heading); font-size: 1.2rem; color: var(--text-primary);">${planName}</h4>
          <span style="font-family: var(--font-heading); font-size: 1.5rem; color: var(--accent-volt); font-weight: 800;">$${price}<span style="font-size: 0.8rem; color: var(--text-muted);">/mo</span></span>
        </div>
        <p style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">Billing: ${billingCycle}</p>
      </div>
    `;
  }

  modal.classList.add('active');
}

// 5. Interactive Biometrics & Caloric Calculator
function initBiometricsCalculator() {
  const weightSlider = document.getElementById('calcWeight');
  const heightSlider = document.getElementById('calcHeight');
  const ageSlider = document.getElementById('calcAge');
  const goalSelect = document.getElementById('calcGoal');
  const activitySelect = document.getElementById('calcActivity');

  if (!weightSlider || !heightSlider || !ageSlider) return;

  const updateCalculations = () => {
    const weightKg = parseFloat(weightSlider.value);
    const heightCm = parseFloat(heightSlider.value);
    const age = parseFloat(ageSlider.value);
    const goal = goalSelect.value;
    const activityMult = parseFloat(activitySelect.value);

    // Update labels
    document.getElementById('calcWeightVal').textContent = `${weightKg} kg`;
    document.getElementById('calcHeightVal').textContent = `${heightCm} cm`;
    document.getElementById('calcAgeVal').textContent = `${age} yrs`;

    // 1. BMI calculation: weight / (height/100)^2
    const heightM = heightCm / 100;
    const bmi = (weightKg / (heightM * heightM)).toFixed(1);

    // 2. Basal Metabolic Rate (Mifflin-St Jeor formula for general athletic estimate)
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    let tdee = Math.round(bmr * activityMult);

    let targetCalories = tdee;
    let proteinTarget = Math.round(weightKg * 2.0); // 2.0g per kg for athletes
    let recommendation = '';

    if (goal === 'hypertrophy') {
      targetCalories = tdee + 350;
      proteinTarget = Math.round(weightKg * 2.2);
      recommendation = 'Focus on our <strong>Hypertrophy Protocol</strong> and <strong>Olympic Barbell Lab</strong>. Maintain a slight caloric surplus (+350 kcal) to maximize myofibrillar protein synthesis.';
    } else if (goal === 'fatloss') {
      targetCalories = tdee - 450;
      proteinTarget = Math.round(weightKg * 2.3);
      recommendation = 'Pair <strong>Iron Conditioning HIIT</strong> and <strong>Combat & Heavy Bag</strong> with a controlled caloric deficit (-450 kcal). Prioritize high protein to preserve lean muscle.';
    } else {
      // performance
      targetCalories = tdee;
      proteinTarget = Math.round(weightKg * 2.0);
      recommendation = 'Incorporate <strong>Athletic MetCon</strong> and weekly <strong>Breathwork & Cryo Immersion</strong>. Focus on nutrient timing around training windows for peak ATP regeneration.';
    }

    // Update DOM
    document.getElementById('resBmi').textContent = bmi;
    document.getElementById('resCalories').textContent = `${targetCalories}`;
    document.getElementById('resProtein').textContent = `${proteinTarget}g`;
    document.getElementById('resRecommendation').innerHTML = recommendation;
  };

  weightSlider.addEventListener('input', updateCalculations);
  heightSlider.addEventListener('input', updateCalculations);
  ageSlider.addEventListener('input', updateCalculations);
  goalSelect.addEventListener('change', updateCalculations);
  activitySelect.addEventListener('change', updateCalculations);

  updateCalculations();
}

// 6. Facilities & Architecture Interactive Showcase
function initFacilitiesShowcase() {
  const facilityData = {
    strength: {
      img: '/assets/strength-zone.jpg',
      tag: '8 Calibrated Eleiko Platforms • Rogue Monster Racks • Ivanko Cast Iron',
      title: 'The Iron Hall: Olympic & Biomechanical Strength',
      desc: 'Engineered specifically for heavy barbell work, deficit hinges, and explosive triple extensions with competition-spec platform dampening.'
    },
    recovery: {
      img: '/assets/recovery-spa.jpg',
      tag: 'Finnish Cedar 90°C Dry Sauna • 3°C Cryo Plunge • Normatec Decompression',
      title: 'Contrast Therapy & Parasympathetic Lounge',
      desc: 'Scientific rapid-recovery suite combining thermal vasodilation and extreme cold vasoconstriction to eliminate systemic inflammation.'
    },
    combat: {
      img: '/assets/combat-hiit.jpg',
      tag: 'Water-Filled Heavy Bags • 30m Sled Turf • Technogym Skillmills',
      title: 'Combat Arena & High-Cadence MetCon',
      desc: 'Multi-discipline tactical striking circuit coupled with Concept2 rowers and skiergs for maximal metabolic threshold training.'
    },
    cardio: {
      img: '/assets/hero-gym.jpg',
      tag: 'Technogym Artis Live • Woodway Curve • Real-Time Heart Rate Telemetry',
      title: 'Cardio Mezzanine & Endurance Engine',
      desc: 'Spacious upper deck overlooking the sanctuary floor with curved non-motorized treadmills, power watt bikes, and panoramic floor-to-ceiling glass.'
    }
  };

  const buttons = document.querySelectorAll('.facility-tab-btn');
  const previewImg = document.getElementById('facilityPreviewImg');
  const specTag = document.getElementById('facilitySpecTag');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const key = btn.dataset.facility;
      const data = facilityData[key];
      if (!data) return;

      previewImg.style.opacity = '0.3';
      setTimeout(() => {
        previewImg.src = data.img;
        specTag.textContent = data.tag;
        previewImg.style.opacity = '1';
      }, 150);
    });
  });
}

// 7. Trainers Roster
async function initTrainers() {
  const grid = document.getElementById('trainersGrid');
  if (!grid) return;

  try {
    const res = await fetch('/api/trainers');
    const json = await res.json();
    if (!json.success || !json.data) return;

    grid.innerHTML = '';
    json.data.forEach(trainer => {
      const card = document.createElement('div');
      card.className = 'trainer-card';
      card.innerHTML = `
        <div class="trainer-img-wrap">
          <img src="${trainer.image_url}" alt="${trainer.name}" class="trainer-img" loading="lazy">
        </div>
        <div class="trainer-info">
          <h4 class="trainer-name">${trainer.name}</h4>
          <div class="trainer-role">${trainer.role}</div>
          <div class="trainer-specialty">${trainer.specialties}</div>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Error fetching trainers:', err);
  }
}

// 8. Contact & Concierge Form
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Transmitting...';
    submitBtn.disabled = true;

    const payload = {
      name: document.getElementById('contactName').value,
      email: document.getElementById('contactEmail').value,
      phone: document.getElementById('contactPhone').value,
      subject: document.getElementById('contactSubject').value,
      message: document.getElementById('contactMessage').value
    };

    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message || 'Inquiry received. Concierge will reply shortly.');
        form.reset();
      } else {
        showToast(data.message || 'Error sending message', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error submitting inquiry', 'error');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}

// 9. Newsletter Form
function initNewsletterForm() {
  const form = document.getElementById('newsletterForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('newsletterEmail');
    const email = emailInput.value;

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message || 'Enrolled in Fortis Dispatch.');
        emailInput.value = '';
      } else {
        showToast(data.message || 'Subscription failed', 'error');
      }
    } catch (err) {
      showToast('Error joining newsletter', 'error');
    }
  });
}

// 10. Modals & Spot Booking Form Handling
function initModalListeners() {
  // Close buttons
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-backdrop').forEach(modal => modal.classList.remove('active'));
    });
  });

  // Backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // Class spot reservation submit
  const bookingForm = document.getElementById('classBookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeClassForBooking) return;

      const submitBtn = bookingForm.querySelector('button[type="submit"]');
      submitBtn.textContent = 'Securing Spot...';
      submitBtn.disabled = true;

      const payload = {
        classId: activeClassForBooking.id,
        fullName: document.getElementById('bookingFullName').value,
        email: document.getElementById('bookingEmail').value,
        phone: document.getElementById('bookingPhone').value,
        bookingDate: document.getElementById('bookingDate').value
      };

      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
          document.getElementById('bookingModal').classList.remove('active');
          showToast(`Spot Confirmed! Reference: ${data.booking.bookingRef}`);
          bookingForm.reset();
          // Re-fetch schedule to reflect live spot decrease
          fetchAndRenderSchedule();
        } else {
          showToast(data.message || 'Reservation failed', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Error reserving class spot', 'error');
      } finally {
        submitBtn.textContent = 'Confirm Spot Reservation';
        submitBtn.disabled = false;
      }
    });
  }

  // Membership enrollment modal submit
  const membershipEnrollForm = document.getElementById('membershipEnrollForm');
  if (membershipEnrollForm) {
    membershipEnrollForm.addEventListener('submit', (e) => {
      e.preventDefault();
      document.getElementById('planModal').classList.remove('active');
      showToast('Membership invitation initiated! Concierge will connect with you.');
      membershipEnrollForm.reset();
    });
  }
}

// Utility
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
