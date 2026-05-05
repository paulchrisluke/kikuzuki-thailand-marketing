export type FieldSource = 'manual' | 'google' | 'static' | 'computed'
export type FieldType = 'text' | 'richtext' | 'image'

export interface FieldDefinition {
  label: string
  type: FieldType
  source: FieldSource
  defaultValue?: string
  /** For google fields: dot-path into the google business object */
  googlePath?: string
  placeholder?: string
}

export interface PageDefinition {
  label: string
  path: string
  fields: Record<string, FieldDefinition>
}

export const contentRegistry: Record<string, PageDefinition> = {
  home: {
    label: 'Home',
    path: '/',
    fields: {
      'hero.title': {
        label: 'Hero Title',
        type: 'text',
        source: 'manual',
        defaultValue: 'Your Restaurant',
        placeholder: 'Enter hero title...'
      },
      'hero.subtitle': {
        label: 'Hero Subtitle',
        type: 'text',
        source: 'manual',
        defaultValue: 'Authentic Experience in your city',
        placeholder: 'Enter hero subtitle...'
      },
      'hero.video': {
        label: 'Hero Background Video URL',
        type: 'text',
        source: 'manual',
        defaultValue: '/videos/hero-video.mp4'
      },
      'cta.title': {
        label: 'CTA Heading',
        type: 'text',
        source: 'manual',
        defaultValue: 'Ready to Experience OUR RESTAURANT?'
      },
      'cta.description': {
        label: 'CTA Description',
        type: 'richtext',
        source: 'manual',
        defaultValue: "Whether you're joining us for a casual dinner or a special celebration, we look forward to serving you the finest authentic cuisine in your city."
      },
      'business.name': {
        label: 'Business Name',
        type: 'text',
        source: 'google',
        googlePath: 'title'
      },
      'business.establishment_year': {
        label: 'Establishment Year',
        type: 'text',
        source: 'google',
        googlePath: 'establishmentYear'
      },
      'business.description': {
        label: 'Business Description',
        type: 'richtext',
        source: 'google',
        googlePath: 'profile.description'
      },
      'business.address': {
        label: 'Address',
        type: 'text',
        source: 'google',
        googlePath: 'storefrontAddress'
      },
      'business.phone': {
        label: 'Phone',
        type: 'text',
        source: 'google',
        googlePath: 'phoneNumbers.0.phoneNumber'
      },
      'business.hours': {
        label: 'Opening Hours',
        type: 'text',
        source: 'google',
        googlePath: 'regularHours'
      },
      'business.photos': {
        label: 'Photos',
        type: 'image',
        source: 'google',
        googlePath: 'media'
      }
    }
  },

  about: {
    label: 'About',
    path: '/about',
    fields: {
      'hero.title': {
        label: 'Page Title',
        type: 'text',
        source: 'manual',
        defaultValue: 'About OUR RESTAURANT'
      },
      'hero.subtitle': {
        label: 'Page Subtitle',
        type: 'text',
        source: 'manual',
        defaultValue: 'Authentic Experience in your city'
      },
      'story.intro': {
        label: 'Story Introduction',
        type: 'richtext',
        source: 'manual',
        defaultValue: '<p class="text-xl font-medium text-gray-900 border-l-4 border-black pl-6 py-2">Our Restaurant authentic Restaurant, nestled in the heart of your city, is a culinary haven that specializes in the artful fusion of fine dining.</p>'
      },
      'grill.title': {
        label: 'Grill Section Title',
        type: 'text',
        source: 'manual',
        defaultValue: 'Mastery of the Grill'
      },
      'grill.description': {
        label: 'Grill Description',
        type: 'richtext',
        source: 'manual',
        defaultValue: 'Renowned for its authentic cuisine, Our Restaurant showcases a mastery of grilling techniques, presenting a delectable array of skewered delights.'
      },
      'sushi.title': {
        label: 'Sushi Section Title',
        type: 'text',
        source: 'manual',
        defaultValue: 'Artistry in Sushi'
      },
      'sushi.description': {
        label: 'Sushi Description',
        type: 'richtext',
        source: 'manual',
        defaultValue: "Complementing the authentic cuisine experience is Our Restaurant's sushi selection, where skilled chefs artfully craft a variety of sushi rolls."
      },
      'journey.title': {
        label: 'Journey Section Title',
        type: 'text',
        source: 'manual',
        defaultValue: 'Our Journey'
      },
      'journey.body': {
        label: 'Journey Body',
        type: 'richtext',
        source: 'manual',
        defaultValue: '<p>Nestled amidst the tropical allure of your city, Our Restaurant has an enchanting culinary tale.</p>'
      },
      'experience.body': {
        label: 'Experience Description',
        type: 'richtext',
        source: 'manual',
        defaultValue: '<p>Equally enticing is our sushi bar, a stage where culinary craftsmen orchestrate amazing flavors and textures.</p>'
      },
      'business.establishment_year': {
        label: 'Establishment Year',
        type: 'text',
        source: 'google',
        googlePath: 'establishmentYear'
      },
      'business.description': {
        label: 'Google Business Description',
        type: 'richtext',
        source: 'google',
        googlePath: 'profile.description'
      }
    }
  },

  contact: {
    label: 'Contact',
    path: '/contact',
    fields: {
      'hero.title': {
        label: 'Page Title',
        type: 'text',
        source: 'manual',
        defaultValue: 'Contact Us'
      },
      'hero.subtitle': {
        label: 'Page Subtitle',
        type: 'text',
        source: 'manual',
        defaultValue: 'Get in Touch with OUR RESTAURANT'
      },
      'intro.body': {
        label: 'Introduction Text',
        type: 'richtext',
        source: 'manual',
        defaultValue: '<p>For an unparalleled authentic culinary experience in your city, Our Restaurant beckons you to transcend the virtual and savor the exquisite reality.</p>'
      },
      'social.facebook': {
        label: 'Facebook URL',
        type: 'text',
        source: 'manual',
        defaultValue: 'https://www.facebook.com/your-restaurant'
      },
      'social.instagram': {
        label: 'Instagram URL',
        type: 'text',
        source: 'manual',
        defaultValue: 'https://www.instagram.com/your-restaurant'
      },
      'business.name': { label: 'Business Name', type: 'text', source: 'google', googlePath: 'title' },
      'business.establishment_year': { label: 'Establishment Year', type: 'text', source: 'google', googlePath: 'establishmentYear' },
      'business.address': { label: 'Address', type: 'text', source: 'google', googlePath: 'storefrontAddress' },
      'business.phone': { label: 'Phone', type: 'text', source: 'google', googlePath: 'phoneNumbers.0.phoneNumber' },
      'business.hours': { label: 'Hours', type: 'text', source: 'google', googlePath: 'regularHours' }
    }
  },

  location: {
    label: 'Location',
    path: '/location',
    fields: {
      'hero.title': { label: 'Page Title', type: 'text', source: 'manual', defaultValue: 'Location & Hours' },
      'hero.subtitle': { label: 'Page Subtitle', type: 'text', source: 'manual', defaultValue: 'Visit Us in your city' },
      'parking.info': {
        label: 'Parking Information',
        type: 'richtext',
        source: 'manual',
        placeholder: 'Add parking instructions for guests...'
      },
      'extra.notes': {
        label: 'Additional Notes',
        type: 'richtext',
        source: 'manual',
        placeholder: 'Any additional location notes...'
      },
      'business.name': { label: 'Business Name', type: 'text', source: 'google', googlePath: 'title' },
      'business.establishment_year': { label: 'Establishment Year', type: 'text', source: 'google', googlePath: 'establishmentYear' },
      'business.address': { label: 'Address', type: 'text', source: 'google', googlePath: 'storefrontAddress' },
      'business.phone': { label: 'Phone', type: 'text', source: 'google', googlePath: 'phoneNumbers.0.phoneNumber' },
      'business.hours': { label: 'Hours', type: 'text', source: 'google', googlePath: 'regularHours' }
    }
  },

  menu: {
    label: 'Menu',
    path: '/menu',
    fields: {
      'hero.title': { label: 'Page Title', type: 'text', source: 'manual', defaultValue: 'Our Menu' },
      'hero.subtitle': { label: 'Page Subtitle', type: 'text', source: 'manual', defaultValue: 'Authentic Dining' },
      'description': {
        label: 'Menu Introduction',
        type: 'richtext',
        source: 'manual',
        placeholder: 'Add a menu introduction or description...'
      },
      'business.products': { label: 'Google Products', type: 'text', source: 'google', googlePath: 'products' }
    }
  },

  reservations: {
    label: 'Reservations',
    path: '/reservations',
    fields: {
      'hero.title': { label: 'Page Title', type: 'text', source: 'manual', defaultValue: 'Reserve a Table at OUR RESTAURANT' },
      'hero.subtitle': { label: 'Page Subtitle', type: 'text', source: 'manual', defaultValue: 'Book Your Authentic Experience' },
      'policies.body': {
        label: 'Reservation Policies',
        type: 'richtext',
        source: 'manual',
        defaultValue: '<ul><li>Reservations are held for 15 minutes</li><li>Cancellations required 2 hours in advance</li><li>Large parties (6+ guests) may require deposit</li><li>Special dietary requests accommodated with advance notice</li></ul>'
      },
      'contact.phone': {
        label: 'Contact Phone',
        type: 'text',
        source: 'manual',
        defaultValue: '+66 81 154 3606'
      },
      'contact.email': {
        label: 'Contact Email',
        type: 'text',
        source: 'manual',
        defaultValue: 'info@your-restaurant.com'
      }
    }
  }
}

/** All editable public pages (for the page selector) */
export const editablePages: Array<{ label: string; path: string }> = Object.values(contentRegistry).map(p => ({
  label: p.label,
  path: p.path
}))

/** Get a field definition for a page+field key */
export const getFieldDef = (page: string, field: string): FieldDefinition | undefined => {
  return contentRegistry[page]?.fields[field]
}
