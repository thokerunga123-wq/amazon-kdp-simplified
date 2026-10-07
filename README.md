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
4. **Student registers:** The student goes to `register.html` on your site and creates their password using the same email.
5. **Admin activates:** 
   - Open `admin.html`.
   - Search the student's email or name.
   - Click the green **"Activate"** button.
   - The student can immediately access all 10 video lessons on their dashboard!
6. **Future Automation Ready:** The database structure is 100% compatible with an automated Selar Webhook if you decide to add Netlify Serverless functions later.

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
- **Video ID Protection:** Unauthenticated or unpaid users cannot retrieve lesson video IDs from the database.
- **Security Headers:** Frame protection, strict Referrer-Policy, and XSS protection configured in `netlify.toml`.

---

© 2026 Thokerunga Innocent. All Rights Reserved.
