<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Website Content</h1>
      <p class="text-stone-400 mt-2">Customize your website content beyond Google Business Profile.</p>
    </div>

    <!-- Home Page Hero -->
    <div class="bg-white rounded-3xl border border-stone-200 p-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="font-bold text-gray-900">Home Page Hero</h2>
          <p class="text-sm text-stone-500 mt-1">Customize your homepage hero section</p>
        </div>
        <button
          @click="editHomeHero"
          class="text-sm font-semibold bg-black text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors"
        >
          Edit
        </button>
      </div>
      <div class="p-4 border border-stone-100 rounded-lg bg-stone-50">
        <p class="text-sm text-stone-600">
          {{ homeHeroContent?.hero_title || 'Welcome to KIKUZUKI' }}
        </p>
        <p class="text-sm text-stone-500 mt-1">
          {{ homeHeroContent?.hero_subtitle || 'Authentic Japanese Experience' }}
        </p>
      </div>
    </div>

    <!-- About Page Story -->
    <div class="bg-white rounded-3xl border border-stone-200 p-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="font-bold text-gray-900">About Story</h2>
          <p class="text-sm text-stone-500 mt-1">Tell your restaurant's story</p>
        </div>
        <button
          @click="editAboutStory"
          class="text-sm font-semibold bg-black text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors"
        >
          Edit
        </button>
      </div>
      <div class="p-4 border border-stone-100 rounded-lg bg-stone-50">
        <div v-if="aboutStoryContent" v-html="aboutStoryContent.content" class="text-sm text-stone-600 prose prose-sm max-w-none"></div>
        <p v-else class="text-sm text-stone-500">Add your restaurant story...</p>
      </div>
    </div>

    <!-- Contact Page Introduction -->
    <div class="bg-white rounded-3xl border border-stone-200 p-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="font-bold text-gray-900">Contact Introduction</h2>
          <p class="text-sm text-stone-500 mt-1">Customize your contact page introduction</p>
        </div>
        <button
          @click="editContactIntro"
          class="text-sm font-semibold bg-black text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors"
        >
          Edit
        </button>
      </div>
      <div class="p-4 border border-stone-100 rounded-lg bg-stone-50">
        <div v-if="contactIntroContent" v-html="contactIntroContent.content" class="text-sm text-stone-600 prose prose-sm max-w-none"></div>
        <p v-else class="text-sm text-stone-500">Add contact introduction...</p>
      </div>
    </div>

    <!-- Staff Profiles -->
    <div class="bg-white rounded-3xl border border-stone-200 p-8">
      <div class="flex items-center justify-between mb-6">
        <h2 class="font-bold text-gray-900">Staff Profiles</h2>
        <button
          @click="showStaffEditor = true"
          class="text-sm font-semibold bg-black text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors"
        >
          Add Staff
        </button>
      </div>

      <div v-if="staff.length" class="space-y-4">
        <div
          v-for="member in staff"
          :key="member.id"
          class="flex items-center gap-4 p-4 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
        >
          <div class="w-12 h-12 rounded-full bg-stone-200 flex items-center justify-center">
            <img v-if="member.image_url" :src="member.image_url" :alt="member.name" class="w-full h-full rounded-full object-cover" />
            <span v-else class="text-stone-500 text-lg">{{ member.name.charAt(0) }}</span>
          </div>
          <div class="flex-1">
            <h3 class="font-medium text-gray-900">{{ member.name }}</h3>
            <p class="text-sm text-stone-500">{{ member.role }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="editStaff(member)"
              class="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
            >
              Edit
            </button>
            <button
              @click="deleteStaff(member.id)"
              class="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-8 text-stone-400">
        No staff profiles yet
      </div>
    </div>

    <!-- Awards & Recognition -->
    <div class="bg-white rounded-3xl border border-stone-200 p-8">
      <div class="flex items-center justify-between mb-6">
        <h2 class="font-bold text-gray-900">Awards & Recognition</h2>
        <button
          @click="showAwardEditor = true"
          class="text-sm font-semibold bg-black text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors"
        >
          Add Award
        </button>
      </div>

      <div v-if="awards.length" class="space-y-4">
        <div
          v-for="award in awards"
          :key="award.id"
          class="flex items-center gap-4 p-4 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
        >
          <div class="flex-1">
            <h3 class="font-medium text-gray-900">{{ award.title }}</h3>
            <p v-if="award.description" class="text-sm text-stone-600 mt-1">{{ award.description }}</p>
            <div class="flex items-center gap-4 mt-2">
              <span v-if="award.year" class="text-xs text-stone-500">{{ award.year }}</span>
              <span v-if="award.issuer" class="text-xs text-stone-500">{{ award.issuer }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="editAward(award)"
              class="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
            >
              Edit
            </button>
            <button
              @click="deleteAward(award.id)"
              class="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-8 text-stone-400">
        No awards yet
      </div>
    </div>

    <!-- Home Hero Editor Modal -->
    <div v-if="showHomeHeroEditor" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl p-6 max-w-lg w-full">
        <h3 class="text-xl font-bold text-gray-900 mb-4">Home Page Hero</h3>
        
        <form @submit.prevent="saveHomeHero" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Hero Title</label>
            <input
              v-model="homeHeroForm.hero_title"
              type="text"
              placeholder="Welcome to KIKUZUKI"
              class="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Hero Subtitle</label>
            <input
              v-model="homeHeroForm.hero_subtitle"
              type="text"
              placeholder="Authentic Japanese Experience"
              class="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Hero Video URL</label>
            <input
              v-model="homeHeroForm.hero_video_url"
              type="url"
              placeholder="/videos/hero-video.mp4"
              class="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div class="flex justify-end gap-3 pt-4">
            <button
              type="button"
              @click="showHomeHeroEditor = false"
              class="px-4 py-2 text-stone-600 hover:text-stone-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-black text-white rounded-lg hover:bg-stone-800 transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- About Story Editor Modal -->
    <div v-if="showAboutStoryEditor" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 class="text-xl font-bold text-gray-900 mb-4">About Story</h3>
        
        <form @submit.prevent="saveAboutStory" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Your Restaurant Story</label>
            <textarea
              v-model="aboutStoryForm.content"
              rows="8"
              placeholder="Tell your customers about your restaurant's journey, philosophy, and what makes you special..."
              class="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div class="flex justify-end gap-3 pt-4">
            <button
              type="button"
              @click="showAboutStoryEditor = false"
              class="px-4 py-2 text-stone-600 hover:text-stone-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-black text-white rounded-lg hover:bg-stone-800 transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Contact Intro Editor Modal -->
    <div v-if="showContactIntroEditor" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 class="text-xl font-bold text-gray-900 mb-4">Contact Introduction</h3>
        
        <form @submit.prevent="saveContactIntro" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Contact Page Introduction</label>
            <textarea
              v-model="contactIntroForm.content"
              rows="6"
              placeholder="Add a welcoming message for customers visiting your contact page..."
              class="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div class="flex justify-end gap-3 pt-4">
            <button
              type="button"
              @click="showContactIntroEditor = false"
              class="px-4 py-2 text-stone-600 hover:text-stone-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-black text-white rounded-lg hover:bg-stone-800 transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Staff Editor Modal -->
    <div v-if="showStaffEditor" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl p-6 max-w-lg w-full">
        <h3 class="text-xl font-bold text-gray-900 mb-4">
          {{ editingStaff ? 'Edit Staff' : 'Add Staff' }}
        </h3>
        
        <form @submit.prevent="saveStaff" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              v-model="staffForm.name"
              type="text"
              required
              class="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <input
              v-model="staffForm.role"
              type="text"
              required
              class="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea
              v-model="staffForm.bio"
              rows="4"
              class="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
            <input
              v-model="staffForm.image_url"
              type="url"
              class="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div class="flex justify-end gap-3 pt-4">
            <button
              type="button"
              @click="showStaffEditor = false"
              class="px-4 py-2 text-stone-600 hover:text-stone-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-black text-white rounded-lg hover:bg-stone-800 transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Award Editor Modal -->
    <div v-if="showAwardEditor" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl p-6 max-w-lg w-full">
        <h3 class="text-xl font-bold text-gray-900 mb-4">
          {{ editingAward ? 'Edit Award' : 'Add Award' }}
        </h3>
        
        <form @submit.prevent="saveAward" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              v-model="awardForm.title"
              type="text"
              required
              class="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              v-model="awardForm.description"
              rows="3"
              class="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <input
              v-model.number="awardForm.year"
              type="number"
              class="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Issuer</label>
            <input
              v-model="awardForm.issuer"
              type="text"
              class="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
            <input
              v-model="awardForm.image_url"
              type="url"
              class="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div class="flex justify-end gap-3 pt-4">
            <button
              type="button"
              @click="showAwardEditor = false"
              class="px-4 py-2 text-stone-600 hover:text-stone-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-black text-white rounded-lg hover:bg-stone-800 transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const content = ref([])
const staff = ref([])
const awards = ref([])

// Modal states
const showHomeHeroEditor = ref(false)
const showAboutStoryEditor = ref(false)
const showContactIntroEditor = ref(false)
const showStaffEditor = ref(false)
const showAwardEditor = ref(false)

// Computed content sections
const homeHeroContent = computed(() => 
  content.value.find(item => item.page === 'home' && item.field === 'hero')
)
const aboutStoryContent = computed(() => 
  content.value.find(item => item.page === 'about' && item.field === 'story')
)
const contactIntroContent = computed(() => 
  content.value.find(item => item.page === 'contact' && item.field === 'intro')
)

// Form data
const homeHeroForm = reactive({
  id: '',
  page: 'home',
  field: 'hero',
  hero_title: '',
  hero_subtitle: '',
  hero_video_url: ''
})

const aboutStoryForm = reactive({
  id: '',
  page: 'about',
  field: 'story',
  content: ''
})

const contactIntroForm = reactive({
  id: '',
  page: 'contact',
  field: 'intro',
  content: ''
})

const staffForm = reactive({
  id: '',
  name: '',
  role: '',
  bio: '',
  image_url: '',
  order_index: 0,
  active: true
})

const awardForm = reactive({
  id: '',
  title: '',
  description: '',
  year: null,
  issuer: '',
  image_url: '',
  order_index: 0,
  active: true
})

// Load data
const loadData = async () => {
  try {
    const [contentRes, staffRes, awardsRes] = await Promise.all([
      $fetch('/api/admin/content/pages'),
      $fetch('/api/admin/content/staff'),
      $fetch('/api/admin/content/awards')
    ])
    
    content.value = contentRes.content || []
    staff.value = staffRes.staff || []
    awards.value = awardsRes.awards || []
  } catch (error) {
    console.error('Failed to load content data:', error)
  }
}

// Content editing functions
const editHomeHero = () => {
  if (homeHeroContent.value) {
    Object.assign(homeHeroForm, homeHeroContent.value)
  }
  showHomeHeroEditor.value = true
}

const editAboutStory = () => {
  if (aboutStoryContent.value) {
    Object.assign(aboutStoryForm, aboutStoryContent.value)
  }
  showAboutStoryEditor.value = true
}

const editContactIntro = () => {
  if (contactIntroContent.value) {
    Object.assign(contactIntroForm, contactIntroContent.value)
  }
  showContactIntroEditor.value = true
}

const saveHomeHero = async () => {
  try {
    await $fetch('/api/admin/content/pages', {
      method: 'POST',
      body: homeHeroForm
    })
    
    showHomeHeroEditor.value = false
    resetHomeHeroForm()
    await loadData()
  } catch (error) {
    console.error('Failed to save home hero:', error)
  }
}

const saveAboutStory = async () => {
  try {
    await $fetch('/api/admin/content/pages', {
      method: 'POST',
      body: aboutStoryForm
    })
    
    showAboutStoryEditor.value = false
    resetAboutStoryForm()
    await loadData()
  } catch (error) {
    console.error('Failed to save about story:', error)
  }
}

const saveContactIntro = async () => {
  try {
    await $fetch('/api/admin/content/pages', {
      method: 'POST',
      body: contactIntroForm
    })
    
    showContactIntroEditor.value = false
    resetContactIntroForm()
    await loadData()
  } catch (error) {
    console.error('Failed to save contact intro:', error)
  }
}

const resetHomeHeroForm = () => {
  Object.assign(homeHeroForm, {
    id: '',
    page: 'home',
    field: 'hero',
    hero_title: '',
    hero_subtitle: '',
    hero_video_url: ''
  })
}

const resetAboutStoryForm = () => {
  Object.assign(aboutStoryForm, {
    id: '',
    page: 'about',
    field: 'story',
    content: ''
  })
}

const resetContactIntroForm = () => {
  Object.assign(contactIntroForm, {
    id: '',
    page: 'contact',
    field: 'intro',
    content: ''
  })
}

// Staff management
const editStaff = (member) => {
  editingStaff.value = member
  Object.assign(staffForm, member)
  showStaffEditor.value = true
}

const saveStaff = async () => {
  try {
    await $fetch('/api/admin/content/staff', {
      method: 'POST',
      body: staffForm
    })
    
    showStaffEditor.value = false
    editingStaff.value = null
    resetStaffForm()
    await loadData()
  } catch (error) {
    console.error('Failed to save staff:', error)
  }
}

const deleteStaff = async (id) => {
  if (!confirm('Are you sure you want to delete this staff profile?')) return
  
  try {
    await $fetch('/api/admin/content/staff', {
      method: 'POST',
      body: { action: 'delete', id }
    })
    await loadData()
  } catch (error) {
    console.error('Failed to delete staff:', error)
  }
}

const resetStaffForm = () => {
  Object.assign(staffForm, {
    id: '',
    name: '',
    role: '',
    bio: '',
    image_url: '',
    order_index: 0,
    active: true
  })
}

// Award management
const editAward = (award) => {
  editingAward.value = award
  Object.assign(awardForm, award)
  showAwardEditor.value = true
}

const saveAward = async () => {
  try {
    await $fetch('/api/admin/content/awards', {
      method: 'POST',
      body: awardForm
    })
    
    showAwardEditor.value = false
    editingAward.value = null
    resetAwardForm()
    await loadData()
  } catch (error) {
    console.error('Failed to save award:', error)
  }
}

const deleteAward = async (id) => {
  if (!confirm('Are you sure you want to delete this award?')) return
  
  try {
    await $fetch('/api/admin/content/awards', {
      method: 'POST',
      body: { action: 'delete', id }
    })
    await loadData()
  } catch (error) {
    console.error('Failed to delete award:', error)
  }
}

const resetAwardForm = () => {
  Object.assign(awardForm, {
    id: '',
    title: '',
    description: '',
    year: null,
    issuer: '',
    image_url: '',
    order_index: 0,
    active: true
  })
}

// Load data on mount
onMounted(() => {
  loadData()
  
  // Add escape key listener
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      showHomeHeroEditor.value = false
      showAboutStoryEditor.value = false
      showContactIntroEditor.value = false
      showStaffEditor.value = false
      showAwardEditor.value = false
    }
  }
  document.addEventListener('keydown', handleEscape)
  
  onUnmounted(() => {
    document.removeEventListener('keydown', handleEscape)
  })
})

useSeoMeta({
  title: 'Content Management | KIKUZUKI Admin',
  description: 'Manage website content and media.',
  robots: 'noindex, nofollow'
})
</script>
