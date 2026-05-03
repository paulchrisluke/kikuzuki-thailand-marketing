<template>
  <div class="overflow-hidden">
    <hero />
    <MenuSections
      :weekText="weekText"
      :title="title"
      :sections="menuSections"
    />
    <buy-on-amazon />
  </div>
</template>

<script setup>
import { filename } from 'pathe/utils'
import MenuSections from '~/components/menu/MenuSections.vue'

const glob = import.meta.glob('@/assets/images/menu/*.png', { eager: true })

const images = Object.fromEntries(
  Object.entries(glob).map(([key, value]) => [filename(key), value.default])
)

definePageMeta({
  layout: 'home'
})

// SEO Meta for home page
useSeoMeta({
  title: 'Take Me Away by KIKUZUKI | Japanese Robatayaki Izakaya in Krabi',
  description: 'Experience authentic Japanese robatayaki at Take Me Away by KIKUZUKI in Krabi, Thailand. Fresh ingredients, traditional flavors, and unforgettable dining experience in southern Thailand.',
  ogTitle: 'Take Me Away by KIKUZUKI | Japanese Robatayaki Izakaya in Krabi',
  ogDescription: 'Authentic Japanese robatayaki izakaya in Krabi, Thailand. Fresh ingredients, traditional flavors, and unforgettable dining experience.',
  ogImage: '/og-image.jpg',
  ogUrl: 'https://www.kikuzuki-thailand.com',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Take Me Away by KIKUZUKI - Japanese Robatayaki Izakaya',
  twitterDescription: 'Experience authentic Japanese robatayaki in beautiful Krabi, Thailand.',
  twitterImage: '/og-image.jpg'
})


const weekText = "Week of Dec 09-15 (rotating sandos)"
const title = "Featured Flavors"
const menuSections = [
  {
    id: "Chicken",
    title: "Chicken Katsu",
    description: "The Chicken Katsu Sand-O is a tasty chicken sandwich featuring a crispy or grilled chicken fillet on a soft bun, topped with fresh lettuce, tomatoes, and your choice of sauce. It's a satisfying option for a quick meal.",
    image: images['chicken']
  },
  {
    id: "pork",
    title: "Pork Katsu",
    description: "The Pork Katsu is a delicious Japanese-style breaded and fried pork cutlet, served with a tangy tonkatsu sauce, fresh cabbage, and steamed rice. It's a hearty and flavorful dish that's perfect for lunch or dinner.",
    image: images['pork']
  },
  {
    id: "Potato",
    title: "Potato Korokke Katsu",
    description: "Our potato sandwich is a classic comfort food made with creamy, perfectly seasoned egg salad on your choice of bread. It's topped with crisp lettuce and served with a side of pickles for a satisfying meal.",
    image: images['potato-katsu']
  },
  {
    id: "steak",
    title: "Steak Katsu",
    description: "The Steak Katsu is a premium dish featuring a tender, breaded and fried beef steak cutlet. It's served with a rich katsu sauce, a side of crisp vegetables, and your choice of steamed rice or fries for a luxurious dining experience.",
    image: images['steak']
  }
]
</script>