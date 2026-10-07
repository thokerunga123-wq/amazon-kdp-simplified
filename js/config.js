/**
 * Amazon KDP Simplified - Global Configuration
 * Instructor: Thokerunga Innocent
 * 
 * Replace placeholders below with your actual credentials.
 * SUPABASE_URL: Your Supabase project URL (Settings -> API)
 * SUPABASE_ANON_KEY: Your Supabase Public Anon Key (Settings -> API)
 * SELAR_CHECKOUT_URL: Your Selar product checkout link
 * WHATSAPP_SUPPORT_URL: Your direct WhatsApp chat link
 */

const APP_CONFIG = {
  // Supabase Configuration (Replace with your actual Supabase credentials)
  SUPABASE_URL: "https://njfqmubgqfliijgairsj.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_5dRHSihnq1mCB4D33VHgkw_KFGb9NuI",

  // Selar Payment Link
  SELAR_CHECKOUT_URL: "https://selar.com/amazon-kdp-simplified",

  // WhatsApp Support Channel
  WHATSAPP_SUPPORT_URL: "https://wa.me/256789312286?text=Hello%20Thokerunga,%20I%20have%20a%20question%20about%20Amazon%20KDP%20Simplified",

  // Course Details
  COURSE_NAME: "Amazon KDP Simplified",
  INSTRUCTOR_NAME: "Thokerunga Innocent",
  COURSE_SLUG: "amazon-kdp-simplified",
  // Must match the course id seeded in supabase-schema.sql
  COURSE_ID: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",

  // How many devices one student account can be used on.
  // (The real limit is enforced in Supabase: v_max in public.bind_device)
  MAX_DEVICES: 3,

  // 10 Lesson Wistia Video IDs (Replace with your 10 uploaded Wistia hashed IDs)
  // Example Wistia ID: "abc123defg"
  WISTIA_VIDEOS: {
    1: "WISTIA_VIDEO_ID_1",
    2: "WISTIA_VIDEO_ID_2",
    3: "WISTIA_VIDEO_ID_3",
    4: "WISTIA_VIDEO_ID_4",
    5: "WISTIA_VIDEO_ID_5",
    6: "WISTIA_VIDEO_ID_6",
    7: "WISTIA_VIDEO_ID_7",
    8: "WISTIA_VIDEO_ID_8",
    9: "WISTIA_VIDEO_ID_9",
    10: "WISTIA_VIDEO_ID_10"
  },

  // Fallback demo lessons metadata (used if offline or seeding)
  LESSONS_DATA: [
    {
      number: 1,
      title: "Amazon KDP From Zero: How the Business Works",
      duration: "22 mins",
      description: "Understand what Amazon KDP is, how royalties work, what types of books beginners can create, and the complete process from idea to published book.",
      notes: "Key Takeaways:\n• Amazon KDP is print-on-demand: zero inventory or upfront printing risk.\n• Royalties: 70% or 35% on Kindle eBooks, 60% minus printing costs on paperbacks.\n• Viable starter genres: Cookbooks, self-help, how-to manuals, journals, planners, faith books, and children's guides.\n• Full workflow: Research -> Plan -> Draft -> Design -> Format -> Publish -> Market -> Scale.\n• Action Step: Make the firm decision to publish your first book.",
      wistiaId: "WISTIA_VIDEO_ID_1"
    },
    {
      number: 2,
      title: "Set Up Your Amazon KDP Account and Get Paid in Uganda",
      duration: "26 mins",
      description: "Learn how to set up your KDP account, complete the required information, handle tax details, and set up payment information correctly.",
      notes: "Key Takeaways:\n• Always use 100% genuine identification and contact details.\n• Setting up payment options for African and Ugandan authors (Payoneer / Wise USD bank account setup).\n• Completing the Amazon Tax Interview with zero withholding issues by submitting your local TIN.\n• Account safety: Never create multiple accounts or use fake credentials.\n• Action Step: Complete and verify your KDP account profile and payment setup.",
      wistiaId: "WISTIA_VIDEO_ID_2"
    },
    {
      number: 3,
      title: "KDP Market Research: Find Book Ideas People Already Buy",
      duration: "31 mins",
      description: "Learn how to research Amazon, study existing books, find demand, check competition, and choose topics with a real market.",
      notes: "Key Takeaways:\n• The 5-Point Validation Matrix: Demand, Competition, Buyer Intent, Content Feasibility, Profit Margin.\n• Analyzing BSR (Best Sellers Rank) to calculate real daily sales volume.\n• Reading 2-star and 3-star reviews to identify unaddressed customer pain points in top books.\n• Action Step: Score 5 potential book ideas and select your top #1 winner.",
      wistiaId: "WISTIA_VIDEO_ID_3"
    },
    {
      number: 4,
      title: "KDP Keyword Research: Find Search Terms Buyers Use",
      duration: "24 mins",
      description: "Learn how to find useful search terms, understand Amazon autocomplete, study competing books, and build a strong keyword list.",
      notes: "Key Takeaways:\n• Using Amazon Incognito autocomplete to see real customer queries.\n• Understanding the 7 backend keyword boxes (50 characters each).\n• Title and subtitle keyword placement without policy-violating keyword stuffing.\n• Action Step: Build a spreadsheet of 15-20 validated customer search terms.",
      wistiaId: "WISTIA_VIDEO_ID_4"
    },
    {
      number: 5,
      title: "Create Your Book With AI: From Idea to Complete Draft",
      duration: "38 mins",
      description: "Learn how to build an outline, create chapters with AI, improve the writing, fact-check and edit the manuscript, and prepare it for formatting.",
      notes: "Key Takeaways:\n• Building comprehensive, reader-focused chapter outlines.\n• Prompting AI iteratively chapter-by-chapter rather than asking for full books at once.\n• Eliminating fluff, passive tone, and repetitive phrasing.\n• Fact-checking and infusing personal author perspective and structured value.\n• Action Step: Complete your clean, edited manuscript in MS Word or Google Docs.",
      wistiaId: "WISTIA_VIDEO_ID_5"
    },
    {
      number: 6,
      title: "Create a Professional KDP Cover With AI",
      duration: "27 mins",
      description: "Learn how to plan a cover, choose fonts and colors, create images with AI, and prepare a cover that fits Amazon's technical requirements.",
      notes: "Key Takeaways:\n• Amazon KDP cover dimension requirements (front cover for eBook, full wrap with spine and bleed for paperback).\n• Genre typography hierarchy: title readability even at thumbnail size.\n• Generating high-res focal artwork and cleaning up layout in design tools.\n• Action Step: Export your final high-resolution print PDF full wrap and eBook JPG cover.",
      wistiaId: "WISTIA_VIDEO_ID_6"
    },
    {
      number: 7,
      title: "Format Your Book With Book Formatter Pro",
      duration: "25 mins",
      description: "Learn how to turn a raw manuscript into a clean, professional KDP interior using Book Formatter Pro.",
      notes: "Key Takeaways:\n• Standard KDP trim sizes (6x9 inches, 5.5x8.5 inches, 8.5x11 inches).\n• Setting margins, gutters, alternating headers/footers, and page numbering.\n• Clean typography, automatic Table of Contents, chapter openers, and section breaks.\n• Exporting a 100% compliant, print-ready PDF interior in minutes.\n• Action Step: Run your manuscript through Book Formatter Pro and inspect the PDF.",
      wistiaId: "WISTIA_VIDEO_ID_7"
    },
    {
      number: 8,
      title: "Publish Your eBook and Paperback on Amazon KDP",
      duration: "32 mins",
      description: "Walk through the KDP publishing process, book details, manuscript upload, cover upload, preview, pricing, territories, and publishing.",
      notes: "Key Takeaways:\n• Step 1: Paperback & eBook metadata (Title, Subtitle, Author, Description with HTML formatting).\n• Step 2: Content upload, KDP Print Previewer inspection, ISBN selection.\n• Step 3: Rights, pricing strategy ($2.99 - $9.99 for eBooks, competitive paperback pricing), and royalties.\n• Action Step: Click 'Publish Your Paperback Book' and submit for Amazon review.",
      wistiaId: "WISTIA_VIDEO_ID_8"
    },
    {
      number: 9,
      title: "Get Your First KDP Sales: Reviews, Promotion and Amazon Ads",
      duration: "28 mins",
      description: "Learn simple ways to market a new book, encourage legitimate reviews, use basic promotion methods, and understand when Amazon Ads may make sense.",
      notes: "Key Takeaways:\n• Launching with an Advance Review Team (ARC) legitimately within Amazon terms.\n• Organic sharing: leveraging social channels, community groups, and WhatsApp.\n• Amazon Ads fundamentals: Sponsored Product auto-targeting vs manual keyword targeting.\n• Managing ad spend strictly to protect profitability.\n• Action Step: Launch your first $2-5/day discovery campaign and request honest reviews.",
      wistiaId: "WISTIA_VIDEO_ID_9"
    },
    {
      number: 10,
      title: "Build Your KDP Business: More Books, Series and Long-Term Growth",
      duration: "21 mins",
      description: "Learn how to repeat the process, build related books, create series, improve old books, and build a larger KDP catalog over time.",
      notes: "Key Takeaways:\n• The compound effect: why 5-10 targeted books multiply your monthly royalties.\n• Creating thematic series to boost read-through and organic Amazon cross-recommendations.\n• Iterating existing catalog: testing new covers and optimized keyword descriptions.\n• The 90-Day Publisher Roadmap: Month 1 (Launch), Month 2 (Scale), Month 3 (Series).\n• Action Step: Plan titles 2, 3, and 4 in your author catalog.",
      wistiaId: "WISTIA_VIDEO_ID_10"
    }
  ]
};

// Check if credentials are still placeholder values
function isSupabaseConfigured() {
  return APP_CONFIG.SUPABASE_URL && 
         !APP_CONFIG.SUPABASE_URL.includes("YOUR_SUPABASE_PROJECT_ID") &&
         APP_CONFIG.SUPABASE_ANON_KEY &&
         !APP_CONFIG.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY");
}
