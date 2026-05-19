-- Seed documentation for KrabiClaw platform
-- Run with: yarn wrangler d1 execute REVIEWS_DB --local --file=scripts/seed-docs.sql
-- For production: yarn wrangler d1 execute REVIEWS_DB --remote --file=scripts/seed-docs.sql

-- Insert Getting Started docs
INSERT INTO platform_docs (id, title, slug, body, excerpt, category, author_id, seo_description, seo_keywords, difficulty_level, sort_order, status, published_at, created_at, updated_at)
VALUES (
  'doc-001',
  'Creating Your First Restaurant Website',
  'creating-your-first-restaurant-website',
  '# Creating Your First Restaurant Website

Welcome to KrabiClaw! This guide will help you create your restaurant website in just a few minutes. No technical skills needed.

## What You''ll Need

- Your restaurant name and address
- Phone number and email
- A few photos of your food (optional but recommended)
- About 15-20 minutes

## Step 1: Sign Up

1. Go to KrabiClaw.com and click "Get Started"
2. Sign in with Google
3. Enter your restaurant name
4. Choose your website address (like "myrestaurant.krabiclaw.com")

## Step 2: Add Your Restaurant Details

Fill in your basic information:

- **Address**: Your restaurant location
- **Phone**: For customers to call
- **Hours**: When you''re open
- **Description**: A short paragraph about your restaurant

## Step 3: Upload Your Logo

Add your restaurant logo to make your site look professional. If you don''t have one, you can skip this step and add it later.

## Step 4: Add Your Menu

Add your menu items with prices. You can always add more items later.

## Step 5: Preview and Publish

Take a look at how your site looks, then click "Publish" to go live!

## Need Help?

If you get stuck, click the Help button in the dashboard or email support@krabiclaw.com',
  'Create your restaurant website in minutes with KrabiClaw. Simple step-by-step guide for restaurant owners.',
  'Getting Started',
  NULL,
  'Create your restaurant website with KrabiClaw. Simple guide covering sign-up, adding restaurant details, uploading logo, adding menu, and publishing. Perfect for busy restaurant owners.',
  'restaurant website, create restaurant site, easy website builder, restaurant online presence',
  'Beginner',
  1,
  'published',
  datetime('now'),
  datetime('now'),
  datetime('now')
);

INSERT INTO platform_docs (id, title, slug, body, excerpt, category, author_id, seo_description, seo_keywords, difficulty_level, sort_order, status, published_at, created_at, updated_at)
VALUES (
  'doc-002',
  'Setting Up Your Business Profile',
  'setting-up-your-business-profile',
  '# Setting Up Your Business Profile

Your business profile is the foundation of your KrabiClaw site. It contains essential information that appears across your website and helps customers find and contact you.

## Why Your Business Profile Matters

A complete business profile:
- Improves your local SEO rankings
- Helps customers find you on Google Maps
- Builds trust with potential diners
- Ensures consistent information across all platforms

## Step 1: Access Your Profile Settings

1. Log in to your KrabiClaw dashboard
2. Navigate to **Settings** in the left sidebar
3. Click on **Business Profile**

## Step 2: Basic Information

### Restaurant Name
- Use your official business name exactly as it appears on Google
- Avoid special characters or emojis
- Example: "Siam Kitchen" not "Siam Kitchen 🍜"

### Description
Write a compelling 2-3 sentence description:

**Good example:**
> "Authentic Thai cuisine in the heart of downtown since 2015. Family recipes passed down through three generations, featuring fresh ingredients imported directly from Thailand."

**What to include:**
- Cuisine type
- Years in business
- What makes you unique
- Any special certifications (halal, organic, etc.)

### Contact Information

**Email:**
- Use a professional email (e.g., `info@yourrestaurant.com`)
- Avoid personal emails (e.g., `gmail.com`)
- Set up email forwarding if needed

**Phone Number:**
- Use your business line
- Format: + country code (e.g., +1 555-123-4567)
- Ensure someone monitors this line

## Step 3: Location Details

### Address
- Enter your complete street address
- Include suite/unit numbers
- Double-check against Google Maps

### Operating Hours
Be specific and accurate:

```
Monday - Thursday: 11:00 AM - 10:00 PM
Friday - Saturday: 11:00 AM - 11:00 PM
Sunday: 12:00 PM - 9:00 PM
```

**Tips:**
- Update hours immediately for holidays
- Note special hours (e.g., "Closed for lunch on Tuesdays")
- Include time zone if you serve tourists

## Step 4: Brand Assets

### Logo
- **Format**: PNG with transparent background
- **Size**: 500x500px (square)
- **File size**: Under 2MB
- **Tips**: Keep it simple, ensure readability at small sizes

### Cover Image
- **Format**: JPG or PNG
- **Size**: 1920x1080px (16:9 aspect ratio)
- **Content**: High-quality photo of your restaurant, food, or ambiance
- **Tips**: Good lighting, avoid clutter, showcase your best angle

## Step 5: Social Media Links

Add your social media profiles to help customers connect:

- **Instagram**: Your business handle (e.g., `@yourrestaurant`)
- **Facebook**: Your Facebook page URL
- **TikTok**: Optional, for restaurants with video content

## Step 6: Additional Details

### Cuisine Type
Select all that apply:
- Thai, Japanese, Italian, etc.
- Specific styles (e.g., "Northern Thai", "Sushi")
- Dietary focuses (vegetarian, vegan, halal)

### Price Range
- `$` - Budget-friendly (under $15 per person)
- `$$` - Moderate ($15-$30 per person)
- `$$$` - Upscale ($30-$60 per person)
- `$$$$` - Fine dining ($60+ per person)

### Special Features
Check any that apply:
- Outdoor seating
- Delivery available
- Takeout available
- Reservations recommended
- Parking available
- Wheelchair accessible
- Good for groups
- Good for kids

## Step 7: Save and Verify

1. Click **"Save Changes"**
2. Review your profile in **Preview** mode
3. Check that all information displays correctly
4. Click **"Publish"** to make changes live

## Best Practices

- **Keep it updated**: Change hours, menu, and contact info immediately
- **Be accurate**: Misleading information frustrates customers
- **Be specific**: "Downtown" is less helpful than "123 Main Street, Downtown"
- **Use photos**: High-quality images increase engagement by 40%

## Troubleshooting

**My address isn''t showing on the map**
- Ensure the address is complete and accurate
- Try adding the city and postal code
- Contact support if the issue persists

**Images appear distorted**
- Use recommended dimensions
- Check file size (under 5MB)
- Re-upload with correct dimensions

**Hours aren''t displaying**
- Use the 12-hour format (AM/PM)
- Ensure no typos in the time format
- Check that days are spelled correctly

## Next Steps

- [Connect your Google Business Profile](/docs/connecting-your-google-business-profile)
- [Add your menu items](/docs/adding-your-first-menu-items)
- [Customize your theme](/docs/customizing-the-saya-theme)',
  'Complete guide to setting up your restaurant business profile on KrabiClaw. Learn how to add contact info, location details, brand assets, and optimize for local SEO.',
  'Getting Started',
  'system',
  'Set up your restaurant business profile on KrabiClaw. Complete guide covering basic information, location details, operating hours, brand assets, social media links, and best practices for local SEO.',
  'restaurant business profile, restaurant contact information, local SEO for restaurants, Google My Business setup, restaurant directory listing',
  'Beginner',
  2,
  'published',
  datetime('now'),
  datetime('now'),
  datetime('now')
);

INSERT INTO platform_docs (id, title, slug, body, excerpt, category, author_id, seo_description, seo_keywords, difficulty_level, sort_order, status, published_at, created_at, updated_at)
VALUES (
  'doc-003',
  'Connecting Your Google Business Profile',
  'connecting-your-google-business-profile',
  '# Connecting Your Google Business Profile

Connecting your Google Business Profile (formerly Google My Business) to KrabiClaw enables automatic synchronization of your restaurant information, photos, and reviews. This saves time and ensures consistency across platforms.

## Benefits of Google Business Integration

- **Automatic sync**: Location info, hours, and photos update automatically
- **Review display**: Show your Google ratings on your website
- **SEO boost**: Improved local search rankings
- **Time savings**: No manual updates needed
- **Photo gallery**: Auto-import your Google photos

## Prerequisites

Before connecting, ensure you have:
- A verified Google Business Profile for your restaurant
- Owner or manager access to the profile
- Admin permissions on your KrabiClaw account

## Step 1: Access the Integration Settings

1. Log in to your KrabiClaw dashboard
2. Navigate to **Integrations** in the left sidebar
3. Find **Google Business Profile** and click **"Connect"**

## Step 2: Authorize Google Access

1. You''ll be redirected to Google''s authorization page
2. Sign in with your Google account (the one managing your Business Profile)
3. Review the permissions requested:
   - View your business information
   - Manage your business locations
   - Access your photos and reviews
4. Click **"Allow"** to grant access

## Step 3: Select Your Location

If you manage multiple locations on Google:

1. A list of your verified locations will appear
2. Select the location you want to connect
3. Click **"Connect Location"**

If you have only one location, it will be selected automatically.

## Step 4: Configure Sync Settings

Choose what to synchronize:

### Basic Information (Recommended)
- Business name
- Address
- Phone number
- Website URL
- Operating hours

### Photos (Recommended)
- Exterior photos
- Interior photos
- Food photos
- Team photos

### Reviews (Recommended)
- Star rating
- Review count
- Recent reviews (last 10)

### Menu Items (Optional)
- If you have menu items on Google, they can be imported

**Sync Frequency**: Choose how often to sync:
- **Real-time**: Updates immediately (recommended)
- **Daily**: Syncs once per day
- **Weekly**: Syncs once per week

## Step 5: Complete the Connection

1. Review your sync settings
2. Click **"Start Sync"**
3. Wait for the initial sync to complete (usually 1-2 minutes)
4. You''ll see a success message when done

## Step 6: Verify the Sync

1. Navigate to your **Locations** page
2. Check that your location information matches Google
3. Visit your **Media Gallery** to see imported photos
4. Check your **Reviews** section for imported ratings

## Managing Your Connection

### View Sync Status
- Go to **Integrations** → **Google Business Profile**
- View last sync time and status
- See any sync errors or warnings

### Manually Trigger Sync
- Click **"Sync Now"** to force an immediate update
- Useful after making changes on Google

### Disconnect Your Profile
- Click **"Disconnect"** in the integration settings
- Note: This won''t delete your data from KrabiClaw
- You can reconnect at any time

## Troubleshooting

**"Location not found" error**
- Ensure your Google Business Profile is verified
- Check that you''re using the correct Google account
- Try re-authorizing the connection

**Sync isn''t working**
- Check your internet connection
- Verify your Google Business Profile is active
- Try manually triggering a sync
- Contact support if issues persist

**Photos aren''t importing**
- Ensure photos are public on Google
- Check that you have photo permissions
- Verify sync settings include photos

**Reviews aren''t displaying**
- Ensure you have reviews on Google
- Check that review sync is enabled
- Verify your location is correctly connected

**"Permission denied" error**
- Ensure you have owner or manager access on Google
- Re-authorize with the correct account
- Contact your Google Business admin if needed

## Best Practices

- **Keep both updated**: Make changes on Google for automatic sync
- **Monitor regularly**: Check sync status weekly
- **Use high-quality photos**: Google photos appear on your site
- **Respond to reviews**: Engage with customers on Google
- **Verify accuracy**: Ensure Google info is correct before syncing

## Privacy and Security

- KrabiClaw only accesses data you authorize
- Your Google credentials are never stored
- You can revoke access at any time
- Data is encrypted during transfer

## Next Steps

- [Import your menu from Google](/docs/importing-menus-from-google-business)
- [Set up review management](/docs/managing-reviews-and-ratings)
- [Connect Instagram](/docs/instagram-integration)',
  'Learn how to connect your Google Business Profile to KrabiClaw for automatic synchronization of location info, photos, and reviews. Step-by-step integration guide.',
  'Getting Started',
  'system',
  'Connect your Google Business Profile to KrabiClaw for automatic sync of location info, photos, and reviews. Step-by-step guide covering authorization, location selection, sync settings, and troubleshooting.',
  'Google Business Profile integration, Google My Business sync, restaurant Google Maps, local SEO automation, Google Business API',
  'Intermediate',
  3,
  'published',
  datetime('now'),
  datetime('now'),
  datetime('now')
);

INSERT INTO platform_docs (id, title, slug, body, excerpt, category, author_id, seo_description, seo_keywords, difficulty_level, sort_order, status, published_at, created_at, updated_at)
VALUES (
  'doc-004',
  'Understanding the Dashboard',
  'understanding-the-dashboard',
  '# Understanding the Dashboard

The KrabiClaw dashboard is your command center for managing your restaurant website. This guide explains each section and how to use it effectively.

## Dashboard Overview

When you log in, you''ll see the main dashboard with:
- **Site overview** at the top
- **Quick stats** (visitors, reservations, reviews)
- **Recent activity** feed
- **Quick actions** for common tasks

## Navigation Menu

### Home
Your main dashboard view showing:
- Site status (published/draft)
- Visitor statistics (last 7 days)
- Recent reservations
- Latest reviews
- Quick actions to create content

### Sites
Manage your restaurant websites:
- **View all sites**: See all your restaurant locations
- **Create new site**: Add additional locations
- **Site settings**: Configure each site individually
- **Publish/Unpublish**: Control site visibility

### Locations
Manage your business locations:
- **Add location**: Create new restaurant locations
- **Edit location**: Update address, hours, contact info
- **Primary location**: Set your main location
- **Location status**: Active/inactive/sync error

### Menus
Create and manage your menus:
- **Create menu**: Start a new menu
- **Edit menu**: Modify existing menus
- **Menu items**: Add, edit, delete items
- **Menu sections**: Organize by category (appetizers, mains, etc.)
- **Import**: Import from Google Business Profile

### Content
Manage your website content:
- **Pages**: Edit page content (Home, About, Contact)
- **Posts**: Create blog posts and updates
- **Media**: Manage images and videos
- **Drafts**: View unpublished content

### Theme
Customize your website appearance:
- **Theme selection**: Choose from available themes
- **Colors**: Set brand colors
- **Fonts**: Select typography
- **Logo**: Upload your restaurant logo
- **Hero images**: Set main page images

### Integrations
Connect third-party services:
- **Google Business Profile**: Sync location data
- **Instagram**: Display Instagram feed
- **WhatsApp**: Enable AI assistant
- **Custom domain**: Set up branded URL

### Reservations
Manage reservation settings:
- **Reservation form**: Configure form fields
- **Availability**: Set booking rules
- **Submissions**: View and manage requests
- **Settings**: Time slots, party size limits

### Reviews
Manage customer reviews:
- **Google reviews**: Imported from Google Business
- **Direct reviews**: Submitted through your site
- **Respond**: Reply to reviews
- **Display settings**: Control review visibility

### Posts
Create and manage content posts:
- **Create post**: Write new blog posts
- **Edit post**: Modify existing posts
- **Schedule**: Set publish date/time
- **Publish to**: Choose channels (site, Google, Instagram)

### Settings
Configure your account:
- **Business profile**: Basic restaurant information
- **Team members**: Add staff with permissions
- **Billing**: View invoices and plan details
- **Notifications**: Configure email alerts

### ChowBot
AI-powered assistant:
- **Conversations**: Chat with AI assistant
- **History**: View past conversations
- **WhatsApp**: Configure WhatsApp integration

## Quick Actions

The dashboard includes quick action buttons for common tasks:

- **Add menu item**: Quickly add to your menu
- **Create post**: Start a new blog post
- **Upload media**: Add images/videos
- **View site**: Preview your website
- **Publish**: Make changes live

## Statistics and Analytics

### Visitor Stats
- **Unique visitors**: Number of individual visitors
- **Page views**: Total pages viewed
- **Average session**: Time spent on site
- **Bounce rate**: Percentage that leave immediately

### Reservation Stats
- **Total reservations**: All-time bookings
- **This week**: Reservations in last 7 days
- **Conversion rate**: Visitors who book
- **No-show rate**: Missed reservations

### Review Stats
- **Average rating**: Overall star rating
- **Total reviews**: Number of reviews
- **Response rate**: Reviews you''ve replied to
- **Recent activity**: Latest reviews

## Activity Feed

The activity feed shows recent actions:
- Content published
- Menu updates
- New reservations
- New reviews
- Team member activity

## Tips for Efficient Dashboard Use

### Keyboard Shortcuts
- `Cmd/Ctrl + K`: Quick search
- `Cmd/Ctrl + N`: New item (context-dependent)
- `Cmd/Ctrl + /`: Open keyboard shortcuts

### Customizing Your View
- **Pin sections**: Keep important info at top
- **Collapse sections**: Hide less-used areas
- **Dark mode**: Switch to dark theme

### Managing Multiple Sites
- Use the site switcher in the header
- Each site has independent settings
- Share content across sites when needed

## Mobile Dashboard

Access your dashboard on mobile:
- Responsive design for all screen sizes
- Essential features available on-the-go
- Quick actions for common tasks
- Push notifications for important updates

## Troubleshooting

**Dashboard not loading**
- Check your internet connection
- Clear browser cache
- Try a different browser
- Contact support if issue persists

**Stats not updating**
- Stats update every 24 hours
- Check your site is published
- Verify tracking is enabled
- Wait for next update cycle

**Can''t find a section**
- Use the search bar (`Cmd/Ctrl + K`)
- Check your user permissions
- Some features require specific plans

**Actions not working**
- Ensure you have permission
- Check if content is locked by another user
- Try refreshing the page
- Contact support if needed

## Getting Help

- **Help center**: Click the `?` icon in the header
- **Documentation**: Browse our guides
- **Support chat**: Available in the dashboard
- **Email**: support@krabiclaw.com

## Next Steps

- [Create your first menu](/docs/adding-your-first-menu-items)
- [Customize your theme](/docs/customizing-the-saya-theme)
- [Set up integrations](/docs/google-business-profile-sync)',
  'Complete guide to the KrabiClaw dashboard. Learn to navigate all sections, manage your restaurant website, and use analytics effectively.',
  'Getting Started',
  'system',
  'Master the KrabiClaw dashboard with this comprehensive guide. Learn navigation, manage sites, locations, menus, content, theme, integrations, reservations, reviews, and use analytics effectively.',
  'restaurant dashboard tutorial, website admin panel, restaurant management system, KrabiClaw dashboard guide, restaurant website admin',
  'Beginner',
  4,
  'published',
  datetime('now'),
  datetime('now'),
  datetime('now')
);

-- Insert Menu Management docs
INSERT INTO platform_docs (id, title, slug, body, excerpt, category, author_id, seo_description, seo_keywords, difficulty_level, sort_order, status, published_at, created_at, updated_at)
VALUES (
  'doc-005',
  'Adding Your First Menu Items',
  'adding-your-first-menu-items',
  '# Adding Your First Menu Items

Your menu is the heart of your restaurant website. This guide walks you through adding menu items with descriptions, prices, images, and dietary information.

## Before You Begin

Gather the following information:
- Menu item names
- Descriptions (2-3 sentences each)
- Prices
- High-quality food photos (recommended)
- Dietary information (vegetarian, gluten-free, etc.)
- Preparation time (if applicable)

## Step 1: Access the Menu Section

1. Log in to your KrabiClaw dashboard
2. Navigate to **Menus** in the left sidebar
3. Click **"Create Menu"** if you don''t have one yet
4. Enter a menu name (e.g., "Lunch Menu", "Dinner Menu")
5. Click **"Save"**

## Step 2: Add a Menu Section

Organize your menu into sections for better navigation:

1. Click **"Add Section"**
2. Enter a section name:
   - Appetizers
   - Mains
   - Desserts
   - Beverages
   - Specials
3. Click **"Save Section"**

Repeat for each section you need.

## Step 3: Add Your First Menu Item

1. Click **"Add Item"** within a section
2. Fill in the item details:

### Item Name
- Use clear, descriptive names
- Include key ingredients when helpful
- Example: "Pad Thai with Shrimp" not just "Pad Thai"

### Description
Write appetizing 2-3 sentence descriptions:

**Good example:**
> "Stir-fried rice noodles with fresh shrimp, bean sprouts, tofu, and crushed peanuts. Tossed in our signature tamarind sauce and served with lime wedges."

**Tips:**
- Highlight unique ingredients
- Mention preparation style
- Keep it under 150 characters
- Avoid generic phrases like "delicious" or "tasty"

### Price
- Use your local currency format
- Example: "$12.99" or "฿180"
- Include portion size if helpful: "$12.99 (large)"

### Image (Recommended)
- **Format**: JPG or PNG
- **Size**: 800x600px (4:3 aspect ratio)
- **File size**: Under 2MB
- **Tips**: Good lighting, clean background, garnish for appeal

### Dietary Information
Check all that apply:
- Vegetarian
- Vegan
- Gluten-free
- Dairy-free
- Nut-free
- Halal
- Kosher
- Spicy (indicate level: mild, medium, hot)

### Availability
- **Available**: Item is currently on the menu
- **Sold out**: Temporarily unavailable
- **Seasonal**: Only available certain times

### Sort Order
- Set the order items appear (lower numbers first)
- Use increments of 10 for easy reordering (10, 20, 30...)

3. Click **"Save Item"**

## Step 4: Add More Items

Repeat Step 3 for each menu item. Tips for efficiency:

- **Batch similar items**: Add all appetizers at once
- **Copy items**: Duplicate items and modify (great for similar dishes)
- **Use templates**: Save common descriptions as notes
- **Bulk upload**: Use CSV import for large menus (see Import guide)

## Step 5: Organize and Reorder

1. Drag and drop items to reorder
2. Move items between sections if needed
3. Click **"Save Order"** when satisfied

## Step 6: Preview Your Menu

1. Click **"Preview"** in the top right
2. Review how your menu displays on:
   - Desktop
   - Tablet
   - Mobile
3. Check for:
   - Spelling errors
   - Price accuracy
   - Image quality
   - Dietary flags

## Step 7: Publish Your Menu

1. Click **"Publish"** to make your menu live
2. Your menu is now visible on your website
3. Changes update immediately

## Best Practices

### Writing Descriptions
- **Be specific**: "Grilled salmon" not "Fish"
- **Include cooking method**: "Pan-seared," "Slow-roasted"
- **Mention key ingredients**: "With garlic butter sauce"
- **Keep it concise**: 2-3 sentences maximum
- **Avoid jargon**: Use terms customers understand

### Pricing
- **Be consistent**: Use same format throughout
- **Include extras**: Note if sides cost extra
- **Update regularly**: Change prices immediately
- **Consider bundles**: Create combo deals

### Images
- **Use natural light**: Avoid flash
- **Show portion size**: Include utensils for scale
- **Keep it clean**: No clutter or mess
- **Be honest**: Represent actual dish appearance

### Dietary Information
- **Be accurate**: Mislabeling can cause issues
- **Be specific**: "Contains nuts" not "May contain nuts"
- **Update regularly**: Change recipes as needed
- **Train staff**: Ensure kitchen follows labels

## Advanced Features

### Modifiers
Add customization options:
- "Extra cheese (+$2)"
- "Substitute rice (+$1)"
- "Spice level: Mild, Medium, Hot"

### Preparation Notes
Add special instructions:
- "Allow 20 minutes for preparation"
- "Contains raw egg"
- "Best served hot"

### Serving Suggestions
Add pairing recommendations:
- "Pairs well with our house wine"
- "Recommended sharing size: 2-3 people"

## Troubleshooting

**Image not uploading**
- Check file size (under 2MB)
- Ensure correct format (JPG/PNG)
- Try a different browser
- Compress image if needed

**Price not displaying**
- Ensure currency format is correct
- Check for special characters
- Try re-entering the price

**Description too long**
- Keep under 150 characters
- Focus on key details
- Remove filler words
- Use bullet points if needed

**Items not in order**
- Check sort order numbers
- Use increments of 10
- Click "Save Order" after rearranging

**Dietary flags not showing**
- Ensure flags are checked
- Publish menu after changes
- Check theme supports dietary flags

## Next Steps

- [Organize menu sections](/docs/organizing-menu-sections)
- [Import from Google Business](/docs/importing-menus-from-google-business)
- [Manage dietary flags](/docs/managing-dietary-flags-and-allergens)',
  'Learn how to add menu items to your KrabiClaw restaurant website. Step-by-step guide for creating appetizing menu descriptions, adding prices, images, and dietary information.',
  'Menu Management',
  'system',
  'Add menu items to your KrabiClaw restaurant website with this step-by-step guide. Learn to write appetizing descriptions, set prices, upload food photos, add dietary information, and organize your menu effectively.',
  'restaurant menu items, add menu items online, digital menu creation, restaurant menu descriptions, food menu management',
  'Beginner',
  5,
  'published',
  datetime('now'),
  datetime('now'),
  datetime('now')
);

INSERT INTO platform_docs (id, title, slug, body, excerpt, category, author_id, seo_description, seo_keywords, difficulty_level, sort_order, status, published_at, created_at, updated_at)
VALUES (
  'doc-006',
  'Organizing Menu Sections',
  'organizing-menu-sections',
  '# Organizing Menu Sections

Well-organized menu sections help customers find what they''re looking for quickly and improve their overall dining experience. This guide shows you how to structure your menu for maximum clarity and appeal.

## Why Menu Organization Matters

- **Better UX**: Customers find items faster
- **Higher conversions**: Clear structure leads to more orders
- **Professional appearance**: Shows attention to detail
- **Mobile-friendly**: Easier to navigate on phones

## Standard Menu Sections

### Appetizers & Starters
- Small plates to begin the meal
- Soups, salads, finger foods
- Price range: $5-$15

### Mains & Entrées
- Primary dishes
- Categorized by protein or cooking style
- Price range: $15-$35

### Sides & Accompaniments
- Additional items to complement mains
- Rice, vegetables, bread
- Price range: $3-$10

### Desserts
- Sweet endings
- Cakes, ice cream, specialty items
- Price range: $6-$15

### Beverages
- Non-alcoholic drinks
- Soft drinks, juices, tea, coffee
- Price range: $2-$8

### Alcohol (if applicable)
- Beer, wine, cocktails
- Organize by type
- Price range: $5-$20+

## Step 1: Plan Your Menu Structure

Before creating sections, consider:

### Your Cuisine Type
Different cuisines have traditional structures:

**Thai Restaurant:**
- Appetizers (Starters)
- Soups & Salads
- Curries
- Stir-fries
- Noodles & Rice
- Desserts

**Italian Restaurant:**
- Antipasti (Appetizers)
- Primi (First courses - pasta)
- Secondi (Main courses)
- Contorni (Sides)
- Dolci (Desserts)

**American Restaurant:**
- Starters
- Salads
- Sandwiches & Burgers
- Main Courses
- Sides
- Desserts

### Your Menu Size
- **Small menu (under 30 items)**: 3-5 sections
- **Medium menu (30-60 items)**: 5-7 sections
- **Large menu (60+ items)**: 7-10 sections

### Customer Flow
Think about how customers order:
1. Start with appetizers
2. Move to mains
3. Consider sides
4. End with desserts

## Step 2: Create Your Sections

1. Navigate to **Menus** in your dashboard
2. Select your menu
3. Click **"Add Section"**
4. Enter section name
5. Set sort order (lower numbers appear first)
6. Click **"Save Section"**

### Naming Your Sections
- **Use clear, standard names**: "Appetizers" not "Beginnings"
- **Be consistent**: Don''t mix "Starters" and "Appetizers"
- **Include cuisine context**: "Thai Curries" not just "Curries"
- **Keep it short**: 1-3 words maximum

## Step 3: Organize Items Within Sections

### Sort Order Strategies

**By Price** (Low to High)
- Helps customers budget
- Common for appetizers and sides

**By Popularity**
- Best-sellers first
- Encourages tried-and-true orders

**By Category**
- Group similar items together
- Example: All chicken dishes together

**By Course**
- Traditional dining progression
- Appetizers → Mains → Desserts

### Visual Organization
- **Group similar items**: All pasta together
- **Use dividers**: Separate distinct categories
- **Highlight specials**: Mark chef''s recommendations
- **Add descriptions**: Keep descriptions consistent length

## Step 4: Add Section Descriptions

Add brief descriptions to help customers:

**Good examples:**
- **Appetizers**: "Start your meal with our signature small plates"
- **Curries**: "Authentic Thai curries made with fresh coconut milk"
- **Desserts**: "Sweet endings to complete your dining experience"

**Tips:**
- Keep under 50 characters
- Focus on what makes the section unique
- Use consistent tone throughout

## Step 5: Set Section Visibility

Control which sections appear:

- **Always visible**: Core sections (appetizers, mains)
- **Conditional**: Show based on time of day
- **Seasonal**: Holiday specials
- **Hidden**: Coming soon items

## Advanced Organization Techniques

### Subsections
For large menus, create subsections:

**Mains**
- Seafood
  - Grilled
  - Fried
- Meat
  - Beef
  - Pork
  - Chicken
- Vegetarian

### Cross-References
Link related items:
- "See our wine list for pairing suggestions"
- "Complements our signature curry"

### Dietary Sections
Create dedicated sections for special diets:
- Vegetarian Options
- Gluten-Free Menu
- Vegan Selections

### Seasonal Sections
Rotate sections based on season:
- Spring Specials
- Summer Refreshments
- Fall Comfort Foods
- Winter Warmers

## Best Practices

### Keep It Simple
- **Limit sections**: 5-8 maximum for most restaurants
- **Avoid over-categorizing**: Don''t create sections with 1-2 items
- **Use standard names**: Customers expect "Appetizers" not "Beginnings"

### Think Mobile
- **Test on phone**: Ensure sections are tap-friendly
- **Collapse long sections**: Use accordions for large lists
- **Prioritize**: Put most important sections first

### Update Regularly
- **Remove sold-out items**: Don''t clutter with unavailable items
- **Add new items**: Highlight additions
- **Seasonal changes**: Update sections quarterly

### Use Data
- **Track popular sections**: Know what customers order most
- **A/B test layouts**: Try different organizations
- **Monitor analytics**: See which sections get most clicks

## Troubleshooting

**Too many sections**
- Combine similar sections
- Use subsections instead
- Remove sections with few items

**Sections are confusing**
- Use standard naming conventions
- Add section descriptions
- Test with real customers

**Items in wrong section**
- Review item categorization
- Create clear section definitions
- Train staff on organization

**Mobile display issues**
- Reduce number of sections
- Use collapsible sections
- Test on multiple devices

## Examples

### Simple Menu Structure
```
1. Appetizers
2. Mains
3. Sides
4. Desserts
5. Beverages
```

### Medium Menu Structure
```
1. Starters
2. Soups & Salads
3. Pasta & Rice
4. Mains
5. Sides
6. Desserts
7. Drinks
```

### Complex Menu Structure
```
1. Appetizers
2. Soups
3. Salads
4. From the Grill
5. Seafood
6. Pasta
7. Vegetarian
8. Sides
9. Desserts
10. Beverages
11. Wine List
```

## Next Steps

- [Add menu items](/docs/adding-your-first-menu-items)
- [Import from Google Business](/docs/importing-menus-from-google-business)
- [Set up dietary flags](/docs/managing-dietary-flags-and-allergens)',
  'Learn how to organize your restaurant menu sections for better customer experience. Best practices for menu structure, categorization, and navigation.',
  'Menu Management',
  'system',
  'Organize your restaurant menu sections effectively with this guide. Learn standard section structures, sorting strategies, advanced organization techniques, and best practices for mobile-friendly menus.',
  'restaurant menu organization, menu categories, menu structure best practices, digital menu layout, restaurant menu design',
  'Intermediate',
  6,
  'published',
  datetime('now'),
  datetime('now'),
  datetime('now')
);

INSERT INTO platform_docs (id, title, slug, body, excerpt, category, author_id, seo_description, seo_keywords, difficulty_level, sort_order, status, published_at, created_at, updated_at)
VALUES (
  'doc-007',
  'Importing Menus from Google Business',
  'importing-menus-from-google-business',
  '# Importing Menus from Google Business

If you already have menu items on your Google Business Profile, you can import them directly into KrabiClaw. This saves time and ensures consistency across platforms.

## Prerequisites

Before importing, ensure you have:
- Google Business Profile connected to KrabiClaw
- Menu items added to your Google Business Profile
- Admin permissions on both accounts

## What Gets Imported

The import includes:
- **Item names**: As listed on Google
- **Descriptions**: If available on Google
- **Prices**: From your Google Business menu
- **Photos**: If attached to items on Google
- **Categories**: Section names from Google

**Note**: Some Google menu features may not transfer perfectly. Review imported items for accuracy.

## Step 1: Connect Google Business Profile

If you haven''t already:

1. Navigate to **Integrations** → **Google Business Profile**
2. Click **"Connect"**
3. Authorize Google access
4. Select your location
5. Complete the connection

See [Connecting Your Google Business Profile](/docs/connecting-your-google-business-profile) for detailed instructions.

## Step 2: Access Menu Import

1. Navigate to **Menus** in your dashboard
2. Select the menu you want to import into (or create a new one)
3. Click **"Import"** in the top right
4. Select **"From Google Business"**

## Step 3: Review Import Options

Choose what to import:

### Import Settings
- **Create new sections**: Automatically create sections based on Google categories
- **Merge with existing**: Add to current menu items
- **Replace all**: Delete existing items and replace with Google data

### Image Handling
- **Import photos**: Bring over Google images
- **Use placeholder images**: Add generic images if none on Google
- **Skip images**: Import text only

### Price Handling
- **Import prices**: Use Google prices
- **Set default price**: Apply same price to all items
- **Skip prices**: Import without prices (add later)

## Step 4: Preview Import

Before finalizing:

1. Review the preview of imported items
2. Check for:
   - Correct item names
   - Accurate prices
   - Proper categorization
   - Image quality
3. Make adjustments if needed:
   - Exclude specific items
   - Edit item names
   - Adjust categories
4. Click **"Continue"** when satisfied

## Step 5: Complete Import

1. Click **"Import Now"**
2. Wait for import to complete (usually 1-2 minutes)
3. Review success message with import summary
4. Click **"View Menu"** to see imported items

## Step 6: Review and Edit

After import, review each item:

### Check Item Details
- **Names**: Ensure they match your menu
- **Descriptions**: Add or improve descriptions
- **Prices**: Verify accuracy
- **Images**: Replace with better photos if needed

### Add Missing Information
Google may not have all details:
- **Dietary flags**: Add vegetarian, gluten-free, etc.
- **Preparation notes**: Add cooking times or special instructions
- **Serving suggestions**: Add pairing recommendations
- **Availability**: Set items as available/sold out

### Organize Sections
- **Rename sections**: Use your preferred naming
- **Reorder items**: Sort by popularity or price
- **Merge sections**: Combine similar categories
- **Delete empty sections**: Remove unused sections

## Step 7: Publish Your Menu

1. Click **"Preview"** to review the final menu
2. Check for:
   - Spelling errors
   - Price accuracy
   - Image quality
   - Section organization
3. Click **"Publish"** to make your menu live

## Managing Synced Menus

### Automatic Sync
Set up automatic updates:
1. Go to **Integrations** → **Google Business Profile**
2. Enable **"Auto-sync menu"**
3. Choose sync frequency:
   - Real-time (recommended)
   - Daily
   - Weekly
4. Click **"Save"**

### Manual Sync
Force an immediate update:
1. Go to **Menus**
2. Select your menu
3. Click **"Sync from Google"**
4. Wait for sync to complete

### Disconnect Sync
Stop automatic updates:
1. Go to **Integrations** → **Google Business Profile**
2. Disable **"Auto-sync menu"**
3. Click **"Save"**

## Best Practices

### Before Import
- **Clean up Google menu**: Remove outdated items first
- **Standardize names**: Use consistent naming on Google
- **Add descriptions**: Write descriptions on Google for better import
- **Upload photos**: Add images to Google items

### After Import
- **Review thoroughly**: Check every imported item
- **Enhance descriptions**: Improve Google descriptions if needed
- **Add dietary info**: Google doesn''t include dietary flags
- **Customize images**: Replace with higher-quality photos

### Ongoing Management
- **Update on Google**: Make changes on Google for auto-sync
- **Review regularly**: Check for sync errors weekly
- **Maintain consistency**: Keep both platforms aligned
- **Use KrabiClaw features**: Take advantage of advanced features not on Google

## Troubleshooting

**Import failed**
- Check Google Business connection
- Verify you have menu items on Google
- Ensure you have admin permissions
- Try re-authorizing the connection

**Items missing after import**
- Check import settings (may have excluded items)
- Review Google menu for missing items
- Try importing again with different settings
- Contact support if issue persists

**Prices incorrect**
- Verify prices on Google Business
- Check import settings for price handling
- Manually update prices after import
- Ensure currency format is correct

**Images not importing**
- Ensure photos are attached to Google items
- Check image handling in import settings
- Verify photos are public on Google
- Manually upload images after import

**Sections not organizing correctly**
- Review Google categories
- Manually reorganize sections after import
- Use "Create new sections" setting
- Merge sections as needed

**Sync not working**
- Check auto-sync is enabled
- Verify Google Business connection is active
- Try manual sync
- Check for sync errors in integration settings

## Limitations

- **Custom modifiers**: Google menu modifiers may not import
- **Complex pricing**: Tiered pricing may not transfer
- **Availability**: Google availability status may not sync
- **Dietary information**: Google doesn''t track dietary flags

## Next Steps

- [Add menu items manually](/docs/adding-your-first-menu-items)
- [Organize menu sections](/docs/organizing-menu-sections)
- [Manage dietary flags](/docs/managing-dietary-flags-and-allergens)',
  'Learn how to import your restaurant menu from Google Business Profile to KrabiClaw. Step-by-step guide for automatic menu synchronization.',
  'Menu Management',
  'system',
  'Import your restaurant menu from Google Business Profile to KrabiClaw with this step-by-step guide. Learn to connect Google, configure import settings, review imported items, and manage ongoing sync.',
  'Google Business menu import, sync menu from Google, restaurant menu migration, Google My Business menu, menu import automation',
  'Intermediate',
  7,
  'published',
  datetime('now'),
  datetime('now'),
  datetime('now')
);

INSERT INTO platform_docs (id, title, slug, body, excerpt, category, author_id, seo_description, seo_keywords, difficulty_level, sort_order, status, published_at, created_at, updated_at)
VALUES (
  'doc-008',
  'Managing Dietary Flags and Allergens',
  'managing-dietary-flags-and-allergens',
  '# Managing Dietary Flags and Allergens

Properly managing dietary flags and allergen information is crucial for customer safety and satisfaction. This guide shows you how to add, display, and manage dietary information on your KrabiClaw menu.

## Why Dietary Information Matters

- **Customer safety**: Prevent allergic reactions and health issues
- **Legal compliance**: Many regions require allergen labeling
- **Customer trust**: Shows you care about dietary needs
- **Broader audience**: Attracts customers with dietary restrictions

## Available Dietary Flags

KrabiClaw supports the following dietary flags:

### Common Diets
- **Vegetarian**: No meat, fish, or poultry
- **Vegan**: No animal products (no dairy, eggs, honey)
- **Pescatarian**: Vegetarian plus fish/seafood

### Allergens
- **Gluten-free**: No wheat, barley, rye, or contaminated oats
- **Dairy-free**: No milk, cheese, butter, or cream
- **Nut-free**: No peanuts or tree nuts
- **Egg-free**: No eggs or egg products
- **Soy-free**: No soy products
- **Shellfish-free**: No shrimp, crab, lobster, etc.

### Religious Diets
- **Halal**: Permitted under Islamic law
- **Kosher**: Permitted under Jewish dietary laws

### Other
- **Spicy**: Indicates heat level (mild, medium, hot)
- **Sugar-free**: No added sugars
- **Low-sodium**: Reduced salt content

## Step 1: Add Dietary Flags to Menu Items

1. Navigate to **Menus** in your dashboard
2. Select your menu
3. Click on a menu item to edit
4. Scroll to **Dietary Information**
5. Check all applicable flags:
   - Vegetarian
   - Vegan
   - Gluten-free
   - Dairy-free
   - Nut-free
   - Egg-free
   - Soy-free
   - Shellfish-free
   - Halal
   - Kosher
6. For spicy items, select heat level:
   - Mild
   - Medium
   - Hot
7. Click **"Save Item"**

## Step 2: Add Allergen Warnings

For items containing common allergens, add warnings:

1. In the menu item editor
2. Scroll to **Preparation Notes**
3. Add allergen warnings:
   - "Contains: Peanuts, Dairy"
   - "May contain: Tree nuts"
   - "Made in facility that processes: Wheat"
4. Click **"Save Item"**

## Step 3: Display Dietary Information

### On Menu Items
Dietary flags appear as icons next to menu items:
- 🌱 Vegetarian
- 🥬 Vegan
- 🌾 Gluten-free
- 🥛 Dairy-free
- 🥜 Nut-free
- 🥚 Egg-free
- 🌶️ Spicy (with heat indicator)

### In Item Descriptions
Include dietary info in descriptions:
> "Spicy Thai curry with coconut milk, vegetables, and tofu. 🌱 Vegan 🌶️ Medium heat"

### Dedicated Sections
Create sections for dietary needs:
- Vegetarian Options
- Gluten-Free Menu
- Vegan Selections

## Step 4: Create Dietary-Specific Menus

For restaurants with extensive dietary options:

1. Navigate to **Menus**
2. Click **"Create Menu"**
3. Name it appropriately:
   - "Vegetarian Menu"
   - "Gluten-Free Options"
   - "Vegan Selections"
4. Add only relevant items
5. Click **"Publish"**

## Step 5: Train Your Staff

Ensure kitchen and front-of-house staff understand:

### Kitchen Staff
- **Cross-contamination prevention**: Separate prep areas
- **Ingredient awareness**: Know what contains allergens
- **Substitution options**: Offer alternatives when possible
- **Communication**: Alert servers to dietary orders

### Front-of-House Staff
- **Menu knowledge**: Know which items are dietary-friendly
- **Allergen awareness**: Understand severity of allergies
- **Communication**: Clearly convey dietary needs to kitchen
- **Upselling**: Suggest dietary-friendly items

## Best Practices

### Accuracy First
- **Be certain**: Only flag items you''re sure about
- **Verify recipes**: Check all ingredients
- **Update regularly**: Change flags when recipes change
- **When in doubt**: Don''t flag it

### Clear Communication
- **Use standard terminology**: "Gluten-free" not "No wheat"
- **Be specific**: "Contains nuts" not "May contain nuts"
- **Explain preparation**: "Made with shared equipment"
- **Offer alternatives**: Suggest similar dietary-friendly items

### Regular Updates
- **Recipe changes**: Update flags immediately
- **Supplier changes**: New ingredients may affect flags
- **Seasonal items**: Review dietary info for specials
- **Customer feedback**: Use feedback to improve accuracy

### Legal Compliance
- **Know local laws**: Research allergen labeling requirements
- **Document recipes**: Keep detailed ingredient lists
- **Train staff**: Regular training on allergens
- **Have protocols**: Emergency procedures for allergic reactions

## Advanced Features

### Custom Dietary Flags
Add custom flags for specific needs:
- **Keto-friendly**: Low-carb options
- **Paleo**: No grains, dairy, or processed foods
- **Whole30**: Compliant with Whole30 program
- **Low-FODMAP**: For digestive sensitivities

### Allergen Matrix
Create a reference document:
- List all menu items
- Mark all allergens present
- Make available to staff
- Update regularly

### Dietary Filters
Enable customers to filter by dietary needs:
- **Website filter**: Customers can filter menu online
- **QR code menus**: Scan and filter by diet
- **Printed menus**: Mark dietary options clearly

## Troubleshooting

**Flags not displaying**
- Ensure flags are checked in item settings
- Publish menu after adding flags
- Check theme supports dietary icons
- Clear browser cache

**Customer reports incorrect flag**
- Verify recipe immediately
- Update flag if incorrect
- Apologize and offer alternative
- Review other items for similar issues

**Staff confusion about flags**
- Provide regular training
- Create reference guides
- Use clear terminology
- Encourage questions

**Recipe changes affecting flags**
- Update flags immediately
- Inform staff of changes
- Update printed menus
- Notify customers of changes

## Legal Considerations

### United States
- **FDA allergen labeling**: Major allergens must be disclosed
- **State laws**: Some states have additional requirements
- **Liability**: Incorrect information can lead to legal action

### European Union
- **EU Regulation 1169/2011**: 14 allergens must be labeled
- **Consumer protection**: Strict penalties for non-compliance
- **Documentation**: Must maintain ingredient records

### Other Regions
- Research local regulations
- Consult legal counsel if unsure
- Follow strictest applicable standard
- Document all procedures

## Resources

- **FDA Food Allergens**: https://www.fda.gov/food/food-allergensgluten-free
- **EU Allergen Regulation**: https://ec.europa.eu/food/safety/labelling-nutrition/allergens_en
- **Allergy Training**: Consider certified allergy training for staff

## Next Steps

- [Add menu items](/docs/adding-your-first-menu-items)
- [Organize menu sections](/docs/organizing-menu-sections)
- [Import from Google Business](/docs/importing-menus-from-google-business)',
  'Learn how to manage dietary flags and allergen information on your restaurant menu. Essential guide for customer safety and legal compliance.',
  'Menu Management',
  'system',
  'Manage dietary flags and allergen information on your KrabiClaw menu with this comprehensive guide. Learn to add dietary flags, display allergen warnings, create dietary-specific menus, train staff, and ensure legal compliance.',
  'restaurant dietary flags, allergen management, gluten-free menu, vegetarian menu options, food allergy safety',
  'Intermediate',
  8,
  'published',
  datetime('now'),
  datetime('now'),
  datetime('now')
);
