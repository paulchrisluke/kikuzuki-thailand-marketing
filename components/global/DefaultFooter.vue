<template>
  <footer class="bg-black text-white pt-16 pb-10 px-4 border-t border-white/5 font-poppins">
    <div class="xl:max-w-[1170px] max-w-full mx-auto w-full md:px-5 px-0">
      
      <!-- Social Links (Prominent) -->
      <div class="flex justify-center mb-16">
        <ul class="flex items-center gap-8 md:gap-12">
          <li><a href="https://www.facebook.com/kikuzuki-thailand" target="_blank" class="hover:scale-110 transition-transform block"><img class="w-12 h-12 md:w-16 md:h-16" src="~/assets/images/facebook.svg" alt="Facebook"></a></li>
          <li><a href="https://www.instagram.com/kikuzuki-thailand" target="_blank" class="hover:scale-110 transition-transform block"><img class="w-12 h-12 md:w-16 md:h-16" src="~/assets/images/insta.svg" alt="Instagram"></a></li>
          <li><a href="#" target="_blank" class="hover:scale-110 transition-transform block"><img class="w-12 h-12 md:w-16 md:h-16" src="~/assets/images/tiktok.svg" alt="TikTok"></a></li>
          <li><a href="#" target="_blank" class="hover:scale-110 transition-transform block"><img class="w-12 h-12 md:w-16 md:h-16" src="~/assets/images/youtube.svg" alt="Youtube"></a></li>
        </ul>
      </div>

      <!-- Main Footer Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12 mb-20 border-t border-white/5 pt-16">
        <!-- Brand & Address -->
        <div class="md:col-span-1">
          <NuxtLink to="/" class="inline-block mb-6">
            <img src="~/assets/images/brand.svg" alt="KIKUZUKI" class="h-8" />
          </NuxtLink>
          <p class="text-white/50 text-sm max-w-xs mb-8 leading-relaxed font-light">
            Authentic Japanese Robatayaki Experience in Krabi. 
            Crafted with passion, served with tradition.
          </p>
          <div class="space-y-4">
            <div class="flex items-start gap-3 text-sm text-white/70">
              <img src="~/assets/images/location-icon.svg" alt="Location" class="w-5 mt-0.5 opacity-50">
              <p>{{ businessAddress || 'Krabi Province, Southern Thailand 81000' }}</p>
            </div>
            <div v-if="businessPhone" class="flex items-start gap-3 text-sm text-white/70">
              <span class="w-5 text-center opacity-50">📞</span>
              <a :href="'tel:' + businessPhone" class="hover:text-white transition-colors">{{ businessPhone }}</a>
            </div>
          </div>
        </div>

        <!-- Experience Links -->
        <div class="flex flex-col">
          <h4 class="font-bold text-xs mb-8 uppercase tracking-[0.2em] text-white/30">Experience</h4>
          <ul class="space-y-4 text-sm text-white/60">
            <li><NuxtLink to="/menu" class="hover:text-white transition-colors">Menu</NuxtLink></li>
            <li><NuxtLink to="/reservations" class="hover:text-white transition-colors">Reservations</NuxtLink></li>
            <li><NuxtLink to="/photos" class="hover:text-white transition-colors">Gallery</NuxtLink></li>
            <li><NuxtLink to="/about" class="hover:text-white transition-colors">Our Story</NuxtLink></li>
          </ul>
        </div>

        <!-- Discover Links -->
        <div class="flex flex-col">
          <h4 class="font-bold text-xs mb-8 uppercase tracking-[0.2em] text-white/30">Discover</h4>
          <ul class="space-y-4 text-sm text-white/60">
            <li><NuxtLink to="/reviews" class="hover:text-white transition-colors">Reviews</NuxtLink></li>
            <li><NuxtLink to="/posts" class="hover:text-white transition-colors">Latest Updates</NuxtLink></li>
            <li><NuxtLink to="/qa" class="hover:text-white transition-colors">Q&A</NuxtLink></li>
          </ul>
        </div>

        <!-- Connect Links -->
        <div class="flex flex-col">
          <h4 class="font-bold text-xs mb-8 uppercase tracking-[0.2em] text-white/30">Connect</h4>
          <ul class="space-y-4 text-sm text-white/60">
            <li><NuxtLink to="/location" class="hover:text-white transition-colors">Find Us</NuxtLink></li>
            <li><NuxtLink to="/contact" class="hover:text-white transition-colors">Contact Us</NuxtLink></li>
            <li><a href="https://www.instagram.com/kikuzuki-thailand" target="_blank" class="hover:text-white transition-colors">Instagram</a></li>
            <li><a href="https://www.facebook.com/kikuzuki-thailand" target="_blank" class="hover:text-white transition-colors">Facebook</a></li>
          </ul>
        </div>
      </div>

      <!-- Bottom Bar -->
      <div class="flex flex-col items-center pt-8 border-t border-white/5 text-[9px] uppercase tracking-[0.25em] text-white/20 font-medium">
        <div class="flex flex-wrap justify-center gap-x-8 gap-y-4 mb-4">
          <NuxtLink to="/privacy-policy" class="hover:text-white transition-colors">Privacy Policy</NuxtLink>
          <NuxtLink to="/terms-and-conditions" class="hover:text-white transition-colors">Terms & Conditions</NuxtLink>
        </div>
        <div class="text-center opacity-60">
          © {{ new Date().getFullYear() }} Take Me Away by KIKUZUKI. ALL RIGHTS RESERVED.
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
const { data: googleBusiness } = await useFetch('/api/google-business/public', {
  default: () => ({ business: null })
})

const businessAddress = computed(() => {
  const addr = googleBusiness.value?.business?.storefrontAddress
  if (!addr) return ''
  return `${addr.addressLines?.[0] || ''}, ${addr.locality || ''}, ${addr.administrativeArea || ''} ${addr.postalCode || ''}`
})

const businessPhone = computed(() => googleBusiness.value?.business?.phoneNumbers?.[0]?.phoneNumber || '')
</script>
