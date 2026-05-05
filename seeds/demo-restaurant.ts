// Demo seed data for OUR RESTAURANT restaurant
// This file contains demo/seed data for the OUR RESTAURANT restaurant
// It should only be imported explicitly when seeding demo data, not at runtime

export const demoRestaurantData = {
  // Organization data
  organization: {
    name: 'Your Restaurant',
    description: 'Authentic cuisine restaurant in your city, Your Country'
  },

  // Site data
  site: {
    name: 'Your Restaurant',
    subdomain: 'restaurant',
    theme: 'saya',
    status: 'active',
    brand_name: 'Your Restaurant',
    brand_description: 'Authentic Dining in your city, Your Country',
    contact_email: 'info@your-restaurant.com'
  },

  // Location data
  locations: [
    {
      title: 'Your Restaurant',
      slug: 'krabi',
      address: {
        addressLines: ['117, Nong Thale'],
        locality: 'your city',
        administrativeArea: 'your city',
        postalCode: '81000',
        country: 'Your Country'
      },
      phone: '+66 81 154 3606',
      website: 'https://www.your-restaurant.com',
      maps_url: 'https://maps.app.goo.gl/2KJfCAfH1idnRBqz6',
      latitude: 8.0328,
      longitude: 98.8285,
      is_primary: true,
      status: 'active'
    }
  ],

  // Menu data
  menu: {
    name: 'Main Menu',
    description: 'Authentic cuisine and dining menu',
    items: [
      {
        section: 'Appetizers',
        name: 'Edamame',
        description: 'Steamed soybeans with sea salt',
        price: '120 THB',
        available: true,
        sort_order: 1
      },
      {
        section: 'Appetizers',
        name: 'Gyoza',
        description: 'Pan-fried dumplings with dipping sauce',
        price: '180 THB',
        available: true,
        sort_order: 2
      },
      {
        section: 'Authentic',
        name: 'Chicken Skewers',
        description: 'Grilled chicken thigh with house sauce',
        price: '220 THB',
        available: true,
        sort_order: 1
      },
      {
        section: 'Authentic',
        name: 'Salmon Teriyaki',
        description: 'Grilled salmon with teriyaki glaze',
        price: '380 THB',
        available: true,
        sort_order: 2
      },
      {
        section: 'Sushi',
        name: 'Tuna Nigiri',
        description: 'Fresh tuna over seasoned rice',
        price: '150 THB',
        available: true,
        sort_order: 1
      },
      {
        section: 'Sushi',
        name: 'Salmon Roll',
        description: 'Salmon and avocado roll',
        price: '280 THB',
        available: true,
        sort_order: 2
      }
    ]
  },

  // Site content data
  siteContent: {
    home: {
      'hero.title': 'Your Restaurant',
      'hero.subtitle': 'Authentic Dining Experience in your city',
      'hero.description': 'Experience the art of traditional authentic authentic cuisine in the heart of your city, Your Country.',
      'seo.title': 'Your Restaurant | authentic Dining in your city',
      'seo.description': 'Authentic cuisine dining in your city, Your Country.'
    },
    about: {
      'hero.title': 'About OUR RESTAURANT',
      'hero.subtitle': 'Our Story and Philosophy',
      'body': '<p>Our Restaurant brings authentic authentic authentic cuisine to your city, combining traditional techniques with the finest ingredients.</p>'
    },
    contact: {
      'hero.title': 'Contact Us',
      'hero.subtitle': 'Get in Touch',
      'intro.body': '<p>For an unparalleled authentic culinary experience in your city, Our Restaurant beckons you to savor the exquisite reality.</p>',
      'social.facebook': 'https://www.facebook.com/your-restaurant',
      'social.instagram': 'https://www.instagram.com/your-restaurant',
      'contact.phone': '+66 81 154 3606',
      'contact.email': 'info@your-restaurant.com'
    },
    location: {
      'hero.title': 'Location & Hours',
      'hero.subtitle': 'Find Us in your city',
      'parking.info': 'Free parking available on-site',
      'extra.notes': 'Reservations recommended for dinner'
    }
  },

  // Google Business data (simulated)
  googleBusiness: {
    title: 'Your Restaurant',
    phoneNumbers: [{ phoneNumber: '+66 81 154 3606' }],
    regularHours: [
      { openDay: 'MONDAY', openTime: '17:00', closeTime: '22:00' },
      { openDay: 'TUESDAY', openTime: '17:00', closeTime: '22:00' },
      { openDay: 'WEDNESDAY', openTime: '17:00', closeTime: '22:00' },
      { openDay: 'THURSDAY', openTime: '17:00', closeTime: '22:00' },
      { openDay: 'FRIDAY', openTime: '17:00', closeTime: '23:00' },
      { openDay: 'SATURDAY', openTime: '17:00', closeTime: '23:00' },
      { openDay: 'SUNDAY', openTime: '17:00', closeTime: '22:00' }
    ]
  }
}

// Usage example:
// import { demoRestaurantData } from '~/seeds/demo-restaurant'
// await seedDemoData(demoRestaurantData)
