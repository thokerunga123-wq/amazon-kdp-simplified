# Amazon KDP Simplified — Course Platform

A complete, responsive, modern online course website for **Thokerunga Innocent**'s flagship training: **Amazon KDP Simplified**.

Built for fast deployment on **Netlify**, powered by **Supabase** (authentication, profiles, enrollments, and progress tracking), **Wistia** for secure video hosting, and **Selar** for payment processing.

---

## 📁 Project Structure

```text
amazon-kdp-simplified/
├── index.html              # Course Portal Login Page (Public landing page is hosted on Selar)
├── course.html             # Detailed 10-lesson syllabus & Book Formatter Pro overview
├── about.html              # Instructor bio & authentic medical-to-publishing journey
├── faq.html                # Full searchable & categorized FAQ
├── contact.html            # Contact & direct WhatsApp channel
├── terms.html              # Terms of Service & legal disclaimers
├── privacy.html            # Privacy Policy & data compliance
├── login.html              # Redirects to index.html (Course Login)
├── register.html           # Student registration (with Selar matching email note)
├── forgot-password.html    # Password recovery & reset flow
├── dashboard.html          # Student learning dashboard (Progress bar, 10 lessons)
├── lesson.html             # Full-featured Course Player (Wistia video, sidebar, notes)
├── profile.html            # Student profile & password settings
├── admin.html              # Admin Portal (Student roster, Activate/Deactivate access)
├── css/
│   └── style.css           # Premium dark theme (#111111/#1C1C1C), gold accent (#F5C542)
├── js/
│   ├── config.js           # Central configuration (Supabase, Selar, Wistia IDs)
│   ├── icons.js            # Crisp inline vector SVG icons (no external font dependencies)
│   ├── auth.js             # Supabase Auth client, single-device lock, session guards
│   ├── app.js              # Global utilities, mobile nav, FAQs, toasts
│   ├── course.js           # Dashboard & Lesson Player logic, progress storage
│   └── admin.js            # Admin student management, credential generator & device reset
├── assets/
│   └── images/             # Authentic book mockups and Book Formatter Pro samples
├── supabase-schema.sql     # PostgreSQL database schema, RLS policies & seed data
├── _redirects              # Netlify clean routing rules
├── netlify.toml            # Netlify build and security headers
└── README.md               # Setup & deployment guide
```

---

## 🚀 Quick Setup & Configuration

### 1. Configure Credentials in `js/config.js`

Open `js/config.js` in your editor and update the placeholders:

```javascript
const APP_CONFIG = {
  // 1. Supabase (From your Supabase Project Settings -> API)
  SUPABASE_URL: "https://YOUR_PROJECT_ID.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_PUBLIC_KEY",

  // 2. Selar Payment Page
  SELAR_CHECKOUT_URL: "https://selar.co/m/your-course-link",

  // 3. Your WhatsApp Business number (international format without '+')
  WHATSAPP_SUPPORT_URL: "https://wa.me/256700000000?text=Hello%20Thokerunga...",

  // 4. Wistia Video Hashed IDs for the 10 Lessons
  WISTIA_VIDEOS: {
    1: "abc123defg",
    2: "hijk456lmn",
    3: "...",
    // Up to 10
  }
};
```

> **Note on Demo Mode:** Until you add your real Supabase credentials, the site automatically operates in **Demo Mode**, allowing you to test login, registration, lesson navigation, and the admin panel immediately without errors!

---

## 🧪 Testing & Demo Accounts

The project includes built-in test accounts that work immediately in Demo Mode:

### 🛡️ Instructor / Administrator Portal
* **URL:** `index.html` or `admin.html`
* **Email:** `admin@example.com`
* **Password:** `adminpassword`
* **Features:**
  * Auto-redirects to `admin.html` upon login
  * **"+ Generate Student Credentials"** modal to create student accounts for paid Selar customers
  * **"Copy WhatsApp Message"** button with pre-formatted welcome text & login details
  * **1-Device Lock Monitoring** and **"Reset Device"** button if a student gets a new laptop
  * Instant **Activate / Deactivate** toggles

### 🎓 Student Portal & Learning Dashboard
* **URL:** `index.html`
* **Email:** `student@example.com`
* **Password:** `password123`
* **Features:**
  * Auto-redirects to `dashboard.html`
  * Locks account to current device fingerprint upon first login
  * 10 video lessons & syllabus progression
  * Lesson player (`lesson.html`) with Wistia integration, lesson completion tracking, and bonus downloads

---

## ✅ Go-Live Checklist (do these in order)

Until step 3 is done the site runs in **Demo Mode** (a yellow banner shows at the top). In Demo Mode, students you create only exist in *your* browser, so they cannot log in from their own device.

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Run the database script:** Supabase → SQL Editor → New Query → paste all of `supabase-schema.sql` → Run. (Safe to run again later if you update it.)
3. **Connect the site:** Supabase → Project Settings → API → copy the *Project URL* and *anon public* key into `js/config.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).
4. **Turn OFF "Confirm email":** Supabase → Authentication → Sign In / Providers → Email → switch off *Confirm email* → Save. Otherwise the logins you generate for students won't work until they click an email link.
5. **Set the site URL for password resets:** Supabase → Authentication → URL Configuration → set *Site URL* to your Netlify address and add `https://YOUR-SITE.netlify.app/forgot-password.html` to *Redirect URLs*.
6. **Create your admin account** (see "Creating Your Admin Account" below).
7. Put your real **WhatsApp number**, **Selar link** and **Wistia video IDs** in `js/config.js`, then redeploy on Netlify.

> The demo accounts (`admin@example.com` / `student@example.com`) stop working automatically once Supabase is connected.

---

## 🗄️ Setting Up Supabase Database

1. Create a free account at [Supabase.com](https://supabase.com) and create a new project.
2. In your Supabase dashboard, click **SQL Editor** on the left menu.
3. Click **New Query**, copy the entire contents of `supabase-schema.sql`, and paste it into the editor.
4. Click **Run**.
   - This automatically creates:
     - `profiles` table (linked to `auth.users`)
     - `courses` table (with seed data for Amazon KDP Simplified)
     - `lessons` table (with all 10 lessons, descriptions, notes, and durations)
     - `enrollments` table (tracking `active` / `inactive` status)
     - `progress` table (tracking completed lessons)
     - Automated signup trigger (`handle_new_user`)
     - Complete Row Level Security (RLS) policies protecting video IDs and student data.

---

## 👑 Creating Your Admin Account

1. In Supabase, go to **Authentication** -> **Users** and click **Add User** -> **Create User**.
2. Enter your email (e.g. `thokerungainoe@gmail.com`) and a secure password.
3. Once created, go back to the **SQL Editor** and run:
   ```sql
   -- Set your user as Admin and activate your enrollment
   UPDATE public.profiles 
   SET is_admin = true 
   WHERE email = 'thokerungainoe@gmail.com';

   INSERT INTO public.enrollments (user_id, course_id, status)
   SELECT id, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'active'
   FROM public.profiles
   WHERE email = 'thokerungainoe@gmail.com'
   ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active';
   ```
4. Now, when you log into `login.html` with this email, you will have access to the **Admin Dashboard** (`admin.html`) to manage students!

---

## 💳 Manual Selar Enrollment Workflow

This version is designed for simple, reliable manual payment handling through Selar:

1. **Student purchases:** Visitor clicks **"Enroll Now"** on the website and is sent to your **Selar** checkout.
2. **Student pays:** Student completes payment on Selar via Mobile Money (MTN/Airtel), Card, or Bank Transfer.
3. **Admin receives notice:** You receive an instant email and WhatsApp alert from Selar with the student's name and email.
4. **Admin generates the login:** Open `admin.html` → **Generate Student Credentials** → enter the student's name and Selar email → **Save & Generate Access**. The account is created already activated.
5. **Send the details:** Click **Copy Message** or **Send on WhatsApp** to send the student their login.
6. **Student logs in:** Their account locks to the first device they log in on. If they change laptop/browser, click **Reset Device** in the admin panel.
7. **Future Automation Ready:** The database structure is 100% compatible with an automated Selar Webhook if you decide to add Netlify Serverless functions later.

---

## 📹 Wistia Video Hosting & Domain Restrictions

1. Create a free account at [Wistia.com](https://wistia.com) (free plan covers 10 video uploads).
2. Upload the 10 course video lessons.
3. In Wistia, click each video -> **Embed & Share** -> copy the **Hashed ID** (e.g. `e1a2b3c4d5`).
4. Paste the 10 IDs into `APP_CONFIG.WISTIA_VIDEOS` inside `js/config.js` or in the Supabase `lessons` table.
5. **Lock down video security:**
   - In Wistia, go to **Account** -> **Settings** -> **Domain Restrictions**.
   - Add your Netlify URL (e.g., `your-course.netlify.app`) and your custom domain (e.g., `amazonkdpsimplified.com`).
   - This prevents anyone from copying the video embed to another website!

---

## 🌐 Deploying to Netlify

### Option A: Drag & Drop (Fastest)
1. Go to [Netlify.com](https://app.netlify.com) and log in.
2. Drag the entire `amazon-kdp-simplified` folder onto the Netlify dashboard.
3. Your website is live in seconds with an SSL certificate.

### Option B: GitHub Integration (Recommended)
1. Initialize a git repository and push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Amazon KDP Simplified"
   git remote add origin https://github.com/your-username/amazon-kdp-simplified.git
   git push -u origin main
   ```
2. In Netlify, click **Add new site** -> **Import an existing project** -> select your GitHub repository.
3. Set Publish directory to `.` (root).
4. Click **Deploy**. Any future commits will automatically update your live site!

### Adding a Custom Domain in Netlify
1. In your Netlify site dashboard, go to **Domain management**.
2. Click **Add custom domain** (e.g., `amazonkdpsimplified.com`).
3. Follow the DNS instructions to point your domain (CNAME or Netlify DNS).
4. Netlify automatically provisions a free Let's Encrypt SSL certificate.

---

## 🔒 Security Best Practices Implemented

- **No Plaintext Passwords:** Authenticated directly through Supabase Auth.
- **No Secret Keys in Frontend:** Only the public Anon Key is used; database integrity is strictly enforced via PostgreSQL Row Level Security (RLS).
- **Video ID Protection:** Video IDs stored in the Supabase `lessons` table can only be read by active students (they take priority over `js/config.js`). For best protection, put the IDs in Supabase and leave the config placeholders, and turn on Wistia domain restrictions.
- **Admin rights & device lock are server-enforced:** students cannot make themselves admin, activate themselves, or clear their own device lock — device binding runs through the `bind_device` database function.
- **Security Headers:** Frame protection, strict Referrer-Policy, and XSS protection configured in `netlify.toml`.

---

© 2026 Thokerunga Innocent. All Rights Reserved.
