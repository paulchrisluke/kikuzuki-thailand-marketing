export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  priceCurrency: string
  image: string
  available: boolean
}

export interface MenuSection {
  id: string
  name: string
  description?: string
  items: MenuItem[]
}

export interface MenuData {
  categories: MenuSection[]
}

export const menuData: MenuData = {
  categories: [
    {
      id: 'appetizers',
      name: 'Appetizers',
      description: 'PLACEHOLDER_SECTION_DESCRIPTION',
      items: [
        {
          id: 'app-1',
          name: 'PLACEHOLDER_APPETIZER_NAME_1',
          description: 'PLACEHOLDER_APPETIZER_DESCRIPTION_1',
          price: 0,
          priceCurrency: 'THB',
          image: '/images/menu/PLACEHOLDER_APPETIZER_1.png',
          available: true
        },
        {
          id: 'app-2',
          name: 'PLACEHOLDER_APPETIZER_NAME_2',
          description: 'PLACEHOLDER_APPETIZER_DESCRIPTION_2',
          price: 0,
          priceCurrency: 'THB',
          image: '/images/menu/PLACEHOLDER_APPETIZER_2.png',
          available: true
        },
        {
          id: 'app-3',
          name: 'PLACEHOLDER_APPETIZER_NAME_3',
          description: 'PLACEHOLDER_APPETIZER_DESCRIPTION_3',
          price: 0,
          priceCurrency: 'THB',
          image: '/images/menu/PLACEHOLDER_APPETIZER_3.png',
          available: true
        }
      ]
    },
    {
      id: 'robatayaki-mains',
      name: 'Robatayaki Mains',
      description: 'PLACEHOLDER_SECTION_DESCRIPTION',
      items: [
        {
          id: 'rob-1',
          name: 'PLACEHOLDER_ROBATAYAKI_NAME_1',
          description: 'PLACEHOLDER_ROBATAYAKI_DESCRIPTION_1',
          price: 0,
          priceCurrency: 'THB',
          image: '/images/menu/PLACEHOLDER_ROBATAYAKI_1.png',
          available: true
        },
        {
          id: 'rob-2',
          name: 'PLACEHOLDER_ROBATAYAKI_NAME_2',
          description: 'PLACEHOLDER_ROBATAYAKI_DESCRIPTION_2',
          price: 0,
          priceCurrency: 'THB',
          image: '/images/menu/PLACEHOLDER_ROBATAYAKI_2.png',
          available: true
        },
        {
          id: 'rob-3',
          name: 'PLACEHOLDER_ROBATAYAKI_NAME_3',
          description: 'PLACEHOLDER_ROBATAYAKI_DESCRIPTION_3',
          price: 0,
          priceCurrency: 'THB',
          image: '/images/menu/PLACEHOLDER_ROBATAYAKI_3.png',
          available: true
        }
      ]
    },
    {
      id: 'drinks',
      name: 'Drinks',
      description: 'PLACEHOLDER_SECTION_DESCRIPTION',
      items: [
        {
          id: 'drink-1',
          name: 'PLACEHOLDER_DRINK_NAME_1',
          description: 'PLACEHOLDER_DRINK_DESCRIPTION_1',
          price: 0,
          priceCurrency: 'THB',
          image: '/images/menu/PLACEHOLDER_DRINK_1.png',
          available: true
        },
        {
          id: 'drink-2',
          name: 'PLACEHOLDER_DRINK_NAME_2',
          description: 'PLACEHOLDER_DRINK_DESCRIPTION_2',
          price: 0,
          priceCurrency: 'THB',
          image: '/images/menu/PLACEHOLDER_DRINK_2.png',
          available: true
        },
        {
          id: 'drink-3',
          name: 'PLACEHOLDER_DRINK_NAME_3',
          description: 'PLACEHOLDER_DRINK_DESCRIPTION_3',
          price: 0,
          priceCurrency: 'THB',
          image: '/images/menu/PLACEHOLDER_DRINK_3.png',
          available: true
        }
      ]
    }
  ]
}
