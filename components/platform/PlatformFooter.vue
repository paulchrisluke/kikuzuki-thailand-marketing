<template>
  <UFooter class="bg-stone-50 border-t border-stone-200">
    <template #top>
      <UContainer class="py-20">
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12">
          <div class="col-span-2 lg:col-span-2">
            <NuxtLink to="/" class="flex items-center gap-2 mb-6 group">
              <div class="w-8 h-8 bg-black rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform">
                <span class="text-white font-bold italic text-lg">K</span>
              </div>
              <span class="text-xl font-bold tracking-tight text-stone-900">KrabiClaw</span>
            </NuxtLink>
            <p class="text-stone-500 max-w-xs mb-8">
              The AI-powered restaurant platform. Build, grow, and manage your restaurant's digital presence in minutes.
            </p>
          </div>

          <div>
            <h4 class="font-bold text-stone-900 mb-4 uppercase tracking-widest text-xs">Product</h4>
            <ul class="space-y-2">
              <li><NuxtLink to="/#features" class="text-stone-500 hover:text-black transition-colors text-sm">Features</NuxtLink></li>
              <li><NuxtLink to="/pricing" class="text-stone-500 hover:text-black transition-colors text-sm">Pricing</NuxtLink></li>
              <li><NuxtLink to="/templates" class="text-stone-500 hover:text-black transition-colors text-sm">Templates</NuxtLink></li>
            </ul>
          </div>

          <div>
            <h4 class="font-bold text-stone-900 mb-4 uppercase tracking-widest text-xs">Company</h4>
            <ul class="space-y-2">
              <li><NuxtLink to="/about" class="text-stone-500 hover:text-black transition-colors text-sm">About Us</NuxtLink></li>
              <li><NuxtLink to="/blog" class="text-stone-500 hover:text-black transition-colors text-sm">Blog</NuxtLink></li>
              <li><NuxtLink to="/contact" class="text-stone-500 hover:text-black transition-colors text-sm">Contact</NuxtLink></li>
            </ul>
          </div>

          <div>
            <h4 class="font-bold text-stone-900 mb-4 uppercase tracking-widest text-xs">Legal</h4>
            <ul class="space-y-2">
              <li><NuxtLink to="/privacy-policy" class="text-stone-500 hover:text-black transition-colors text-sm">Privacy Policy</NuxtLink></li>
              <li><NuxtLink to="/terms-and-conditions" class="text-stone-500 hover:text-black transition-colors text-sm">Terms of Service</NuxtLink></li>
            </ul>
          </div>
        </div>
      </UContainer>
    </template>
    
    <template #bottom>
      <UContainer class="py-8 border-t border-stone-200">
        <div class="flex flex-col md:flex-row justify-between items-center gap-4">
          <p class="text-stone-400 text-sm">
            &copy; {{ new Date().getFullYear() }} KrabiClaw. All rights reserved.
          </p>
          <div class="flex items-center gap-6">
            <UButton variant="ghost" color="neutral" size="sm" square>
              <Icon name="i-simple-icons-twitter" />
            </UButton>
            <UButton variant="ghost" color="neutral" size="sm" square>
              <Icon name="i-simple-icons-instagram" />
            </UButton>
          </div>
        </div>
      </UContainer>
    </template>
  </UFooter>
</template>
