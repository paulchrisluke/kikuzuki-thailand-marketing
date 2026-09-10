<template>
  <div
    class="relative flex min-h-0 flex-col border-r border-default bg-default"
    :data-onboarding-hydrated="onboardingHydrated ? 'true' : 'false'"
  >

    <!-- Welcome screen -->
    <div v-if="step === 'welcome'" class="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto p-6 pb-4">
      <div class="flex size-16 items-center justify-center rounded-[18px] bg-primary/10 text-primary">
        <UIcon name="i-lucide-sparkles" class="size-8" />
      </div>
      <div>
        <p class="mb-1 text-[11px] font-bold uppercase tracking-[0.28em] text-primary">{{ isAddingLocation ? "Let's add a location" : "Let's build your site" }}</p>
        <h1 class="text-3xl font-extrabold leading-tight tracking-tight text-highlighted">
          {{ isAddingLocation ? "Tell me about this location." : "Tell me about your business." }}
        </h1>
      </div>
      <p class="text-[14.5px] leading-relaxed text-muted">
        {{ isAddingLocation
          ? "Answer a few questions and this location is added to your site — you decide what to keep."
          : "Answer a few questions and your site preview builds as you answer — you decide what to keep." }}
      </p>
      <div class="flex flex-col gap-2.5">
        <div
          v-for="[icon, text] in WELCOME_POINTS"
          :key="text"
          class="flex items-center gap-3 text-sm text-highlighted"
        >
          <div class="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] border border-default bg-elevated text-primary">
            <UIcon :name="icon" class="size-3.5" />
          </div>
          {{ text }}
        </div>
      </div>
      <UButton
        color="primary"
        size="md"
        icon="i-lucide-sparkles"
        class="self-start"
        @click="advance(skipVertical ? 'source' : 'vertical')"
      >
        Start building
      </UButton>
    </div>

    <!-- Chat transcript -->
    <div v-else class="flex min-h-0 flex-1 flex-col">
      <div class="flex shrink-0 items-center gap-3 border-b border-default bg-default px-3 py-2">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          :disabled="!canGoBack"
          aria-label="Back"
          @click="goBack"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-semibold text-highlighted">{{ progressLabel }}</p>
          <div class="mt-1 flex gap-1">
            <span
            v-for="index in totalProgressSteps"
            :key="index"
              class="h-1.5 flex-1 rounded-full transition-colors duration-300 ease-out"
              :class="index <= progressStep ? 'bg-primary' : 'bg-muted'"
            />
          </div>
        </div>
        <UButton
          v-if="draftPreviewPayload"
          icon="i-lucide-eye"
          color="neutral"
          variant="soft"
          size="sm"
          square
          aria-label="Preview draft"
          @click="requestPreview"
        />
      </div>

      <ConversationShell
        v-model:input="textInput"
        :messages="conversationMessages"
        :placeholder="inputPlaceholder"
        :disabled="!awaitingInput"
        :show-empty-state="false"
        :render-markdown="renderMarkdown"
        :quick-replies="replies"
        :show-prompt="showComposer"
        :show-assistant-avatar="false"
        @submit="handleTextSubmit"
        @quick-reply="handleReply"
      >
      <template #message="{ index }">
        <div
          v-if="isWidgetMessage(messages[index])"
          class="onboarding-transcript-item px-4 py-2"
          :style="messageMotionStyle(index)"
        >
          <div v-if="messages[index]?.text" class="mb-2 max-w-[30rem] rounded-xl bg-elevated px-4 py-3 text-[14px] leading-relaxed text-highlighted">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="prose prose-sm dark:prose-invert max-w-none" v-html="renderMarkdown(messages[index]!.text!)" />
          </div>
          <div class="space-y-2">
              <div
                v-if="messages[index]?.placePreview"
                class="overflow-hidden rounded-xl border border-default bg-elevated"
              >
                <div class="flex h-24 items-center justify-center border-b border-default bg-muted text-muted">
                  <div class="flex items-center gap-2 text-xs font-medium">
                    <UIcon name="i-lucide-map" class="size-4" />
                    Map preview
                  </div>
                </div>
                <div class="flex items-start gap-3 px-4 py-3">
                  <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <UIcon name="i-lucide-map-pin" class="size-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-[13px] font-semibold text-highlighted">{{ messages[index]?.placePreview?.name }}</p>
                    <p class="mt-0.5 text-[12px] leading-relaxed text-muted">{{ messages[index]?.placePreview?.address }}</p>
                    <p v-if="messages[index]?.placePreview?.phone" class="mt-0.5 text-[12px] text-muted">{{ messages[index]?.placePreview?.phone }}</p>
                    <a
                      v-if="messages[index]?.placePreview?.mapsUrl"
                      :href="messages[index]?.placePreview?.mapsUrl ?? undefined"
                      target="_blank"
                      rel="noopener"
                      class="mt-1 inline-flex items-center gap-1 text-[11.5px] text-primary hover:underline"
                    >
                      <UIcon name="i-lucide-external-link" class="size-3" />
                      View on Google Maps
                    </a>
                  </div>
                </div>
              </div>
              <div v-if="messages[index]?.choiceCard" class="grid gap-2">
                <UButton
                  v-for="choice in messages[index]?.choiceCard?.choices"
                  :key="choice.action"
                  block
                  :color="choiceColor(messages[index]!, choice)"
                  :variant="choiceVariant(messages[index]!, choice)"
                  :aria-pressed="isSelectedChoice(messages[index]!, choice)"
                  :disabled="importing || Boolean(selectedChoiceAction)"
                  @click="selectChoice(choice, index)"
                >
                  <UIcon :name="choice.icon || 'i-lucide-circle'" class="size-4" />
                  <span class="min-w-0 flex-1">
                    <span class="block text-[13px] font-semibold leading-5 text-highlighted">{{ choice.label }}</span>
                    <span v-if="choice.sub" class="mt-0.5 block text-[12px] leading-5 text-muted">{{ choice.sub }}</span>
                  </span>
                  <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed" />
                </UButton>
              </div>
              <div v-if="messages[index]?.detailsCard || messages[index]?.hoursCard || messages[index]?.brandDraftCard" class="onboarding-step-widget">
                <IntakeDetailsCard
                  v-if="messages[index]?.detailsCard"
                  v-model:form="detailsForm"
                  :action-label="activeActionLabel(messages[index]!)"
                  :require-location-basics="messages[index]!.detailsCard!.requireLocationBasics"
                  :section="messages[index]!.detailsCard!.section"
                  :loading="importing"
                  :disabled="!isActiveStepMessage(messages[index]!)"
                  @submit="submitDetailsCard(messages[index]!.detailsCard!.section)"
                />
                <HoursTimezoneCard
                  v-if="messages[index]?.hoursCard"
                  v-model:form="hoursForm"
                  :action-label="activeActionLabel(messages[index]!)"
                  :loading="importing"
                  :disabled="!isActiveStepMessage(messages[index]!)"
                  @submit="submitHoursCard"
                />
                <DraftBrandCard
                  v-if="messages[index]?.brandDraftCard"
                  v-model:form="brandDraftForm"
                  :action-label="activeActionLabel(messages[index]!)"
                  :section="messages[index]!.brandDraftCard!.section"
                  :draft-id="onboardingDraftId"
                  :loading="importing"
                  :disabled="!isActiveStepMessage(messages[index]!)"
                  @submit="submitBrandDraftCard"
                  @brand-color-change="queueBrandColorSave"
                />
              </div>
              <UButton
                v-if="messages[index]?.draftReadyCard"
                block
                color="neutral"
                variant="outline"
                @click="requestPreview"
              >
                <div
                  class="relative flex h-36 items-center justify-center overflow-hidden bg-muted text-muted"
                  :style="draftReadyBackground"
                >
                  <UBadge class="absolute right-3 top-3" color="success" variant="soft" label="Ready" />
                  <img
                    v-if="draftReadyThumbnailUrl"
                    :src="draftReadyThumbnailUrl"
                    alt=""
                    class="h-full w-full object-cover"
                  >
                  <div v-else class="flex size-16 items-center justify-center rounded-2xl bg-default/85 text-xl font-extrabold text-highlighted shadow-sm">
                    {{ draftReadyInitials }}
                  </div>
                </div>
                <div class="flex items-center gap-3 px-4 py-3">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-[14px] font-bold text-highlighted">{{ draftReadyDomain }}</p>
                    <p class="mt-0.5 text-[12px] text-muted">Tap to preview your site</p>
                  </div>
                  <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-muted" />
                </div>
              </UButton>
          </div>
        </div>
        <UChatMessage
          v-else
          class="onboarding-transcript-item"
          :style="messageMotionStyle(index)"
          :id="String(index)"
          :role="messages[index]?.from === 'user' ? 'user' : 'assistant'"
          :parts="[{ type: 'text', text: messages[index]?.text ?? '' }]"
          :side="messages[index]?.from === 'user' ? 'right' : 'left'"
          :variant="messages[index]?.from === 'user' ? 'solid' : 'subtle'"
          :ui="messages[index]?.from === 'user' ? { content: 'bg-primary text-(--primary-foreground,#fff)' } : {}"
        >
          <template #content>
            <div v-if="messages[index]?.from === 'bot'" class="space-y-2">
              <div v-if="messages[index]?.tools?.length" class="flex flex-col gap-1">
                <UChatTool
                  v-for="(tool, toolIndex) in messages[index]?.tools"
                  :key="tool.label + index + toolIndex"
                  :text="tool.label"
                  :loading="!tool.done"
                />
              </div>
              <!-- eslint-disable vue/no-v-html -->
              <div
                v-if="messages[index]?.text"
                class="prose prose-sm dark:prose-invert max-w-none"
                v-html="renderMarkdown(messages[index]!.text!)"
              />
              <!-- eslint-enable vue/no-v-html -->
            </div>
            <div v-else class="prose prose-sm dark:prose-invert max-w-none text-(--primary-foreground,#fff)">
              {{ messages[index]?.text ?? '' }}
            </div>
          </template>
        </UChatMessage>
      </template>
      <template #prompt-before>
        <!-- Error banner -->
        <div
          v-if="importError"
          data-testid="wizard-error-banner"
          class="mb-3 flex items-center gap-2 rounded-lg border border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-950 px-3 py-2 text-xs text-error-600 dark:text-error-400"
        >
          <UIcon name="i-lucide-triangle-alert" class="size-3.5 shrink-0" />
          <span>{{ importError }}</span>
          <UButton v-if="canRetryFailedStep" size="xs" variant="link" color="error" @click="retryFailedStep">Try again</UButton>
        </div>
      </template>
      </ConversationShell>
    </div>
  </div>
</template>

<script setup lang="ts">
import { parseOpeningHours, parseSpecialHours, type OpeningHours } from '~/shared/reservation-hours'
import type { HoursTimezoneForm } from './HoursTimezoneCard.vue'
import { marked } from 'marked'
import { getPhoneCountry, parsePhone } from '~/utils/phone'
import { singleTimezoneForCountry } from '~/utils/timezone'
import type { CurrencyCode } from '~/shared/currencies'
import ConversationShell from '~/components/conversation/ConversationShell.vue'
import { loadDomPurify } from '~/utils/dom-purify-loader'
import type { DraftBrandForm } from '~/lib/components/workspace/onboarding/DraftBrandCard.vue'
import type { SiteVertical } from '~/utils/vertical-copy'

interface WizardMessage {
  id: string
  from: 'bot' | 'user'
  step?: WizardStep
  text?: string
  tools?: { label: string; done: boolean }[]
  draftReadyCard?: boolean
  // `chosen` is the action the owner picked from this card; unset until they do.
  choiceCard?: { choices: QuickReply[]; chosen?: string }
  placePreview?: { name: string; address: string; phone?: string | null; mapsUrl?: string | null }
  hoursCard?: {
    actionLabel?: string
  }
  brandDraftCard?: {
    actionLabel?: string
    section: 'brand' | 'hero'
  }
  detailsCard?: {
    actionLabel?: string
    requireLocationBasics: boolean
    section: 'location' | 'contact' | 'currency'
  }
}

interface QuickReply {
  label: string
  sub?: string
  icon?: string
  primary?: boolean
  ghost?: boolean
  action?: string
}

interface DraftSavedPayload {
  draftId: string
  siteId: string
  previewToken: string
  draftName: string
  subdomainCandidate: string
}

type WizardStep = 'welcome' | 'vertical' | 'source' | 'awaiting_url' | 'awaiting_manual_name' | 'confirm' | 'location' | 'contact' | 'currency' | 'hours' | 'brand' | 'hero' | 'draft_ready' | 'create' | 'imported'
type DetailsSource = 'imported' | 'manual'
type DraftSourceType = 'manual' | 'google_places'

type WizardMode = 'new-site' | 'add-location'

const props = defineProps<{
  mode: WizardMode
  existingOrgSlug?: string | null
  existingSiteSlug?: string | null
}>()

const emit = defineEmits<{
  'site-created': [created: { orgSlug: string | null; siteSlug: string | null; locationSlug: string | null }]
  'draft-saved': [draft: DraftSavedPayload]
  'preview-requested': []
  'draft-cleared': []
  'vertical-selected': [vertical: SiteVertical]
  'step-changed': [step: WizardStep]
}>()

const router = useRouter()
const config = useRuntimeConfig()
const { trackSiteCreated, trackOnboardingCompleted } = useAnalytics()

const DRAFT_READY_REPLIES: QuickReply[] = [
  { label: 'Create site', icon: 'i-lucide-rocket', primary: true, action: 'commit_draft' },
  { label: 'Edit details', icon: 'i-lucide-pencil', action: 'edit_draft' },
]

const isAddingLocation = computed(() => props.mode === 'add-location')
const skipVertical = computed(() => props.mode === 'add-location')
const lookupEndpoint = computed(() => isAddingLocation.value
  ? '/api/dashboard/locations/add'
  : '/api/dashboard/onboarding/places-preview')
const addLocationEndpoint = '/api/dashboard/locations/add'

const WELCOME_POINTS: [string, string][] = isAddingLocation.value
  ? [
      ['i-lucide-globe', 'Pulls the address, hours & reviews Google already lists'],
      ['i-lucide-sparkles', 'Keeps only what you confirm — nothing is filled in for you'],
      ['i-lucide-map-pin', 'Goes live on your site as soon as you save it'],
    ]
  : [
      ['i-lucide-globe', 'Pulls the address, hours & reviews Google already lists'],
      ['i-lucide-sparkles', 'Builds a homepage preview as you answer'],
      ['i-lucide-rocket', 'Launches on your included site address when you are ready'],
    ]

// ─── State ───────────────────────────────────────────────────────────────────

const step = ref<WizardStep>('welcome')
const onboardingHydrated = ref(false)
const messages = ref<WizardMessage[]>([])
const conversationMessages = computed(() => messages.value.map(msg => ({
  role: msg.from === 'user' ? 'user' as const : 'assistant' as const,
  content: msg.text ?? '',
  toolCalls: msg.tools?.map(tool => ({
    name: tool.label,
    status: tool.done ? 'completed' : 'running',
  })),
})))
const replies = ref<QuickReply[]>([])
const awaitingInput = ref(false)
const textInput = ref('')
const selectedChoiceAction = ref<string | null>(null)
const importError = ref<string | null>(null)
const importing = ref(false)
const pendingMapsUrl = ref('')
const pendingPreview = ref<{
  placeId: string
  name: string
  address: string
  city?: string | null
  phone?: string | null
  mapsUrl?: string | null
  timezone?: string | null; openingHours?: OpeningHours
} | null>(null)
const detailsSource = ref<DetailsSource>('imported')
const selectedVertical = ref<SiteVertical>('restaurant')
const detailsForm = reactive({
  name: '',
  city: '',
  streetAddress: '',
  addressLine2: '',
  region: '',
  postalCode: '',
  // United States is the product default (as USD is for currency); the owner
  // confirms or changes it on the Location step.
  country: 'US',
  phone: '',
  // USD is the product default; the currency step shows it selected and the owner
  // confirms or changes it before the draft can be created.
  currency: 'USD' as CurrencyCode | undefined,
})
const hoursForm = reactive<HoursTimezoneForm>({ timezone: '', hours: null, specialHours: null })
const brandDraftForm = reactive({
  brandColor: '',
  logoNote: '',
  logoPreviewUrl: '',
  logoImage: null as DraftBrandForm['logoImage'],
  heroPhotoNote: '',
  heroPreviewUrl: '',
  heroImage: null as DraftBrandForm['heroImage'],
  heroHeadline: '',
  heroDescription: '',
})

const inputPlaceholder = computed(() => {
  if (step.value === 'awaiting_manual_name') return 'Your business name…'
  return 'Paste your Google Maps link…'
})
const showComposer = computed(() => Boolean(importError.value || awaitingInput.value || replies.value.length))
const totalProgressSteps = 12
const progressStep = computed(() => {
  if (step.value === 'vertical') return 1
  if (step.value === 'source') return 2
  if (step.value === 'awaiting_url' || step.value === 'awaiting_manual_name') return 3
  if (step.value === 'confirm') return 4
  if (step.value === 'location') return 5
  if (step.value === 'contact') return 6
  if (step.value === 'currency') return 7
  if (step.value === 'hours') return 8
  if (step.value === 'brand') return 9
  if (step.value === 'hero') return 10
  if (step.value === 'draft_ready') return 11
  if (step.value === 'create') return 12
  if (step.value === 'imported') return 12
  return 1
})
const progressLabel = computed(() => {
  if (step.value === 'vertical') return 'Choose business type'
  if (step.value === 'source') return 'Choose source'
  if (step.value === 'awaiting_url') return 'Add Maps link'
  if (step.value === 'awaiting_manual_name') return 'Add business name'
  if (step.value === 'confirm') return 'Confirm listing'
  if (step.value === 'location') return 'Location'
  if (step.value === 'contact') return 'Contact'
  if (step.value === 'currency') return 'Currency'
  if (step.value === 'hours') return 'Hours'
  if (step.value === 'brand') return 'Brand'
  if (step.value === 'hero') return 'Homepage hero'
  if (step.value === 'draft_ready') return 'Draft ready'
  if (step.value === 'create') return 'Create site'
  if (step.value === 'imported') return 'Next steps'
  return 'Onboarding'
})
const canGoBack = computed(() => !importing.value && !['welcome', 'create', 'imported'].includes(step.value))
const isPastMessage = (index: number) => index < messages.value.length - 1
const isActiveStepMessage = (message: WizardMessage) => message.step === step.value && !importing.value
const messageMotionStyle = (index: number) => ({
  '--message-delay': `${Math.min(index, 6) * 26}ms`,
})
const detailsCardDescription = computed(() => detailsSource.value === 'manual'
  ? 'Add the details guests will see first.'
  : 'Check what Google found.'
)
const detailsRequireBasics = computed(() => detailsSource.value === 'manual')

watch(selectedVertical, vertical => emit('vertical-selected', vertical), { immediate: true })
watch(step, value => emit('step-changed', value), { immediate: true })

const importedSiteId = ref<string | null>(null)
const importedOrgSlug = ref<string | null>(null)
const importedSiteSlug = ref<string | null>(null)
const importedLocationSlug = ref<string | null>(null)
const preConfirmStep = ref<WizardStep>('awaiting_url')
const onboardingDraftId = ref<string | null>(null)
const draftPreviewPayload = ref<DraftSavedPayload | null>(null)

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _dompurify: { sanitize: (_s: string) => string } = { sanitize: (_s: string) => _s }
let _dompurifyLoaded = false
onMounted(async () => {
  onboardingHydrated.value = true
  if (import.meta.client) {
    _dompurify = await loadDomPurify()
    _dompurifyLoaded = true
  }
})

function renderMarkdown(text: string): string {
  if (!_dompurifyLoaded) {
    // Return escaped text as a safe fallback until DOMPurify loads
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
  const html = marked.parse(text, { breaks: true, gfm: true }) as string
  return _dompurify.sanitize(html)
}

function isWidgetMessage(message: WizardMessage | undefined) {
  return Boolean(
    message?.choiceCard
    || message?.placePreview
    || message?.detailsCard
    || message?.hoursCard
    || message?.brandDraftCard
    || message?.draftReadyCard
  )
}

function activeActionLabel(message: WizardMessage) {
  return message.detailsCard?.actionLabel
    ?? message.hoursCard?.actionLabel
    ?? message.brandDraftCard?.actionLabel
    ?? 'Save'
}

// Selection is what the owner clicked on this card, not the wizard's current
// state: `selectedVertical` and `detailsSource` have defaults, so deriving from
// them marked an option as chosen before anyone chose.
function isSelectedChoice(message: WizardMessage, choice: QuickReply) {
  const chosen = message.choiceCard?.chosen
  return chosen !== undefined && chosen === choice.action
}

// Before a choice: the card's suggested option is solid, the rest outline.
// After a choice: the chosen option is the only emphasized one; the rest drop to ghost.
function choiceVariant(message: WizardMessage, choice: QuickReply) {
  if (message.choiceCard?.chosen === undefined) return choice.ghost ? 'ghost' : choice.primary ? 'solid' : 'outline'
  return isSelectedChoice(message, choice) ? 'soft' : 'ghost'
}

function choiceColor(message: WizardMessage, choice: QuickReply) {
  if (message.choiceCard?.chosen === undefined) return choice.primary ? 'primary' : 'neutral'
  return isSelectedChoice(message, choice) ? 'primary' : 'neutral'
}

// Rewinding past the business name abandons the draft on the server too: the
// pending site it created holds an address derived from a name the owner has
// just replaced, so it is deleted rather than carried into the new answer.
async function clearDraftPreview() {
  const hadDraft = Boolean(onboardingDraftId.value)
  onboardingDraftId.value = null
  draftPreviewPayload.value = null
  emit('draft-cleared')
  if (!hadDraft) return
  // Awaited: the next answer saves a new draft, and a late DELETE would take
  // that one instead of the abandoned one.
  try {
    await applicationFetch<{ success?: boolean }>('/api/dashboard/onboarding/drafts/active', {
      method: 'DELETE',
      validate: (value): value is { success?: boolean } => isRecord(value),
    })
  } catch (error) {
    importError.value = error instanceof Error
      ? error.message
      : 'Could not clear your previous draft. Reload and try again.'
  }
}

async function rewindToChoiceMessage(index: number) {
  const message = messages.value[index]
  if (!message?.choiceCard || !isPastMessage(index)) return
  messages.value = messages.value.slice(0, index + 1)
  replies.value = []
  awaitingInput.value = false
  importError.value = null
  if (message.step === 'vertical' || message.step === 'source' || message.step === 'confirm') {
    await clearDraftPreview()
  }
}

const workspaceEntryPath = computed(() => {
  const slug = importedOrgSlug.value ?? props.existingOrgSlug ?? null
  const siteSlug = importedSiteSlug.value ?? props.existingSiteSlug ?? null
  if (!slug) return null
  return siteSlug ? `/dashboard/${slug}/sites/${siteSlug}` : `/dashboard/${slug}`
})

const siteHostFor = (subdomain: string) => tenantSiteOrigin({
  platformDomain: String(config.public.platformDomain),
  freeSiteDomain: String(config.public.freeSiteDomain),
  subdomain,
}).replace(/^https?:\/\//, '')
const draftReadyDomain = computed(() => {
  const candidate = draftPreviewPayload.value?.subdomainCandidate
  return candidate ? siteHostFor(candidate) : ''
})
const draftReadyThumbnailUrl = computed(() => brandDraftForm.heroPreviewUrl || brandDraftForm.logoPreviewUrl || '')
const draftReadyBackground = computed(() => draftReadyThumbnailUrl.value || !brandDraftForm.brandColor
  ? undefined
  : { background: brandDraftForm.brandColor })
const draftReadyInitials = computed(() => {
  const source = detailsForm.name || draftPreviewPayload.value?.draftName || ''
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
})

function pushUser(text: string) {
  messages.value.push({ id: crypto.randomUUID(), from: 'user', text })
}

function pushBot(text: string, extra?: {
  step?: WizardStep
  tools?: { label: string; done: boolean }[]
  draftReadyCard?: boolean
  choiceCard?: WizardMessage['choiceCard']
  placePreview?: WizardMessage['placePreview']
  hoursCard?: WizardMessage['hoursCard']
  brandDraftCard?: WizardMessage['brandDraftCard']
  detailsCard?: WizardMessage['detailsCard']
}) {
  messages.value.push({ id: crypto.randomUUID(), from: 'bot', text, step: extra?.step ?? step.value, ...extra })
}

function requestPreview() {
  if (draftPreviewPayload.value) emit('preview-requested')
}

// ─── State machine ────────────────────────────────────────────────────────────

async function advance(target: WizardStep) {
  step.value = target
  replies.value = []
  awaitingInput.value = false
  importError.value = null

  if (target === 'vertical') {
    pushBot("First — what kind of business is this?", {
      choiceCard: {
        choices: [
          { label: 'Restaurant, café or bar', icon: 'i-lucide-flame', primary: true, action: 'set_vertical_restaurant' },
          { label: 'Experience, class or activity', icon: 'i-lucide-graduation-cap', action: 'set_vertical_experience' },
          { label: 'Legal or professional services', sub: 'Law firms, consultancies, and similar practices', icon: 'i-lucide-briefcase', action: 'set_vertical_service' },
        ],
    },
    })
  }

  if (target === 'source') {
    pushBot("Got it. How would you like to add your business details?", {
      choiceCard: {
        choices: [
          { label: 'Google Maps', sub: 'Paste your Maps link', icon: 'i-lucide-globe', primary: true, action: 'ask_url' },
          { label: 'Start manually', sub: 'Type your business name', icon: 'i-lucide-pencil', action: 'ask_manual' },
        ],
      },
    })
  }

  if (target === 'awaiting_url') {
    pushBot("Paste your Google Maps link below — the full URL from your browser or a short maps.app.goo.gl link both work.")
    awaitingInput.value = true
  }

  if (target === 'awaiting_manual_name') {
    pushBot("What's the name of your business?")
    awaitingInput.value = true
  }

  if (target === 'location') {
    pushBot(detailsSource.value === 'manual' ? 'Where should guests find you?' : detailsCardDescription.value, {
      detailsCard: {
        actionLabel: 'Save location',
        requireLocationBasics: detailsRequireBasics.value,
        section: 'location',
      },
    })
  }

  if (target === 'contact') {
    pushBot('Add the number guests should use first.', {
      detailsCard: {
        actionLabel: 'Save contact',
        requireLocationBasics: detailsRequireBasics.value,
        section: 'contact',
      },
    })
  }

  if (target === 'currency') {
    pushBot('Choose how guests will see prices.', {
      detailsCard: {
        actionLabel: 'Use this currency',
        requireLocationBasics: false,
        section: 'currency',
      },
    })
  }

  if (target === 'hours') {
    // The owner named their country on the location step. When that country has
    // exactly one IANA zone, that is their timezone; when it has several, the
    // field stays empty and they search the list. Never overwrite a zone the
    // owner or the Google import already set.
    if (!hoursForm.timezone) {
      const zone = singleTimezoneForCountry(detailsForm.country)
      if (zone) hoursForm.timezone = zone
    }
    pushBot('Add your weekly hours so bookings and visit details line up.', {
      hoursCard: {
        actionLabel: 'Save hours',
      },
    })
  }

  if (target === 'brand') {
    pushBot('Choose the color and logo guests will recognize across your site.', {
      brandDraftCard: {
        actionLabel: 'Save brand',
        section: 'brand',
      },
    })
  }

  if (target === 'hero') {
    pushBot('Add the photo and opening words guests see first on the homepage.', {
      brandDraftCard: {
        actionLabel: 'Save hero',
        section: 'hero',
      },
    })
  }

  if (target === 'draft_ready') {
    pushBot("Draft ready. Tap the preview any time — it's a private working copy, so you can review before reserving a live subdomain.", {
      draftReadyCard: true,
    })
    replies.value = DRAFT_READY_REPLIES
  }

  if (target === 'create') {
    if (isAddingLocation.value) await submitDetails()
    else await commitDraft()
  }
}

async function goBack() {
  if (!canGoBack.value) return
  importError.value = null
  replies.value = []
  awaitingInput.value = false

  if (step.value === 'vertical') {
    messages.value = []
    await advance('welcome')
    return
  }
  if (step.value === 'source') {
    messages.value = []
    await advance(skipVertical.value ? 'welcome' : 'vertical')
    return
  }
  if (step.value === 'awaiting_url' || step.value === 'awaiting_manual_name') {
    await advance('source')
    return
  }
  if (step.value === 'confirm') {
    pendingPreview.value = null
    await advance(preConfirmStep.value)
    return
  }
  if (step.value === 'location') {
    if (pendingPreview.value) {
      // showConfirm re-attaches the Yes/No card to the place-preview message,
      // which must be the last one again — drop the location card after it.
      const previewIndex = messages.value.findLastIndex(message => Boolean(message.placePreview))
      if (previewIndex >= 0) messages.value = messages.value.slice(0, previewIndex + 1)
      showConfirm(pendingPreview.value, preConfirmStep.value)
    } else {
      await advance('awaiting_manual_name')
    }
    return
  }
  if (step.value === 'contact') {
    await advance('location')
    return
  }
  if (step.value === 'currency') {
    await advance('contact')
    return
  }
  if (step.value === 'hours') {
    await advance('currency')
    return
  }
  if (step.value === 'brand') {
    await advance('hours')
    return
  }
  if (step.value === 'hero') {
    await advance('brand')
    return
  }
  if (step.value === 'draft_ready') {
    await advance('hero')
    return
  }
  if (step.value === 'create') {
    await advance('draft_ready')
  }
}

async function handleReply(reply: QuickReply) {
  if (reply.action === 'set_vertical_restaurant') {
    selectedVertical.value = 'restaurant'
    pushUser(reply.label)
    await advance('source')
    return
  }

  if (reply.action === 'set_vertical_experience') {
    selectedVertical.value = 'experience'
    pushUser(reply.label)
    await advance('source')
    return
  }

  if (reply.action === 'set_vertical_service') {
    selectedVertical.value = 'service'
    pushUser(reply.label)
    await advance('source')
    return
  }

  if (reply.action === 'ask_url') {
    detailsSource.value = 'imported'
    pushUser(reply.label)
    await advance('awaiting_url')
    return
  }

  if (reply.action === 'ask_manual') {
    detailsSource.value = 'manual'
    pushUser(reply.label)
    await advance('awaiting_manual_name')
    return
  }

  if (reply.action === 'confirm_yes') {
    pushUser("Yes, that's my place")
    if (pendingPreview.value) {
      detailsSource.value = 'imported'
      seedDetailsFromPreview(pendingPreview.value)
      if (await saveActiveDraft()) await advance('location')
    }
    return
  }

  if (reply.action === 'confirm_no') {
    pushUser("That's not my place")
    pendingPreview.value = null
    await advance(preConfirmStep.value)
    return
  }

  if (reply.action === 'dashboard') {
    if (workspaceEntryPath.value) {
      if (importedSiteId.value) trackOnboardingCompleted(importedSiteId.value)
      await router.push(workspaceEntryPath.value)
    }
    return
  }

  if (reply.action === 'add_location') {
    const slug = importedOrgSlug.value ?? props.existingOrgSlug
    const siteSlugForLocation = importedSiteSlug.value ?? props.existingSiteSlug
    if (importedSiteId.value) trackOnboardingCompleted(importedSiteId.value)
    await router.push(slug && siteSlugForLocation ? `/dashboard/${slug}/sites/${siteSlugForLocation}/locations/new` : '/dashboard')
    return
  }

  if (reply.action === 'edit_draft') {
    pushUser(reply.label)
    await advance('location')
    return
  }

  if (reply.action === 'commit_draft') {
    pushUser(reply.label)
    await commitDraft()
    return
  }
}

async function selectChoice(choice: QuickReply, messageIndex?: number) {
  if (selectedChoiceAction.value || importing.value) return
  if (typeof messageIndex === 'number') {
    rewindToChoiceMessage(messageIndex)
    const card = messages.value[messageIndex]?.choiceCard
    if (card) card.chosen = choice.action
  }
  selectedChoiceAction.value = choice.action ?? choice.label
  try {
    await handleReply(choice)
  } finally {
    selectedChoiceAction.value = null
  }
}

async function handleTextSubmit() {
  const input = textInput.value.trim()
  if (!awaitingInput.value || !input) return
  textInput.value = ''
  awaitingInput.value = false
  replies.value = []
  pushUser(input)
  if (step.value === 'awaiting_url') {
    await runLookup(input)
  } else if (step.value === 'awaiting_manual_name') {
    detailsSource.value = 'manual'
    seedDetailsFromManual(input)
    if (await saveActiveDraft()) await advance('location')
  }
}

async function submitDetailsCard(section: 'location' | 'contact' | 'currency') {
  if (step.value !== section) return
  if (section === 'location') {
    await submitLocation()
    return
  }
  if (section === 'contact') {
    await submitContact()
    return
  }
  if (!detailsForm.currency) {
    importError.value = 'Choose a currency before continuing.'
    return
  }
  if (await saveActiveDraft()) await advance('hours')
}

async function submitLocation() {
  const requiredFields = detailsRequireBasics.value
    ? [detailsForm.streetAddress, detailsForm.city]
    : []
  if (!requiredFields.every(value => value.trim().length > 0)) {
    importError.value = 'Add the required details before continuing.'
    return
  }
  if (await saveActiveDraft()) await advance('contact')
}

async function submitContact() {
  if (detailsRequireBasics.value && !detailsForm.phone.trim()) {
    importError.value = 'Add the required details before continuing.'
    return
  }
  if (await saveActiveDraft()) await advance('currency')
}

async function submitHoursCard() {
  if (step.value !== 'hours') return
  if (!hoursForm.timezone.trim()) {
    importError.value = 'Choose a timezone before continuing.'
    return
  }
  parseOpeningHours(hoursForm.hours)
  parseSpecialHours(hoursForm.specialHours)
  if (await saveActiveDraft()) await advance('brand')
}

async function submitBrandDraftCard() {
  if (step.value !== 'brand' && step.value !== 'hero') return
  if (step.value === 'brand') {
    if (await saveActiveDraft()) await advance('hero')
    return
  }
  if (await saveActiveDraft()) await advance(isAddingLocation.value ? 'create' : 'draft_ready')
}

// ─── Import flow ──────────────────────────────────────────────────────────────

// Stop the tool spinner when the call fails — a permanently spinning step reads
// as still-in-progress work that is not happening.
function failTool(tools: { label: string; done: boolean }[], label: string) {
  const tool = tools[0]
  if (!tool) return
  tool.label = label
  tool.done = true
}

function showLookupTools(label: string): { label: string; done: boolean }[] {
  const tools = reactive([{ label, done: false }])
  messages.value.push({ id: crypto.randomUUID(), from: 'bot', tools })
  return tools
}

function showConfirm(preview: NonNullable<typeof pendingPreview.value>, returnStep: WizardStep) {
  preConfirmStep.value = returnStep
  pendingPreview.value = preview
  step.value = 'confirm'
  const lastMessage = messages.value[messages.value.length - 1]
  if (lastMessage?.placePreview) {
    lastMessage.step = 'confirm'
    lastMessage.choiceCard = {
      choices: [
        { label: "Yes, that's my place", icon: 'i-lucide-check', primary: true, action: 'confirm_yes' },
        { label: "That's not my place", icon: 'i-lucide-x', action: 'confirm_no' },
      ],
    }
  }
  replies.value = []
}

async function runLookup(mapsUrl: string) {
  // Loading is a flag, not a step: the progress bar keeps showing the step the
  // owner is actually on while the Google lookup runs.
  importing.value = true
  pendingMapsUrl.value = mapsUrl
  importError.value = null
  const tools = showLookupTools('Looking up your Google Maps listing…')

  try {
    const res = await applicationFetch<{
      success: boolean
      preview?: { placeId: string; name: string; address: string; city?: string | null; phone?: string | null; mapsUrl?: string | null; openingHours?: OpeningHours }
      error?: string
    }>(lookupEndpoint.value, {
      method: 'POST',
      body: { mapsUrl, previewOnly: true },
      validate: (value): value is {
        success: boolean
        preview?: { placeId: string; name: string; address: string; city?: string | null; phone?: string | null; mapsUrl?: string | null; openingHours?: OpeningHours }
        error?: string
      } => isRecord(value)
        && typeof value.success === 'boolean'
        && (value.preview === undefined || (
          isRecord(value.preview)
          && typeof value.preview.placeId === 'string'
          && typeof value.preview.name === 'string'
          && typeof value.preview.address === 'string'
        )),
    })

    if (!res.success || !res.preview) {
      throw new Error(res.error ?? 'Could not find your business. Please check the Google Maps URL and try again.')
    }

    tools[0]!.done = true
    pushBot("Found it — does this look right?", { placePreview: res.preview })
    showConfirm(res.preview, 'awaiting_url')
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
    failTool(tools, 'Google Maps lookup failed')
    awaitingInput.value = true
  } finally {
    importing.value = false
  }
}

async function saveActiveDraft(options: { silent?: boolean } = {}) {
  if (isAddingLocation.value) return true

  if (!options.silent) importing.value = true
  importError.value = null
  try {
    const sourceType: DraftSourceType = pendingPreview.value ? 'google_places' : 'manual'
    const res = await applicationFetch<{
      success: boolean
      draftId?: string
      siteId?: string
      previewToken?: string
      draftName?: string
      subdomainCandidate?: string
      error?: string
    }>('/api/dashboard/onboarding/drafts/active', {
      method: 'POST',
      body: {
        sourceType,
        placeId: pendingPreview.value?.placeId,
        name: detailsForm.name.trim(),
        vertical: selectedVertical.value,
        details: serializeDetails(),
        brandDraft: serializeBrandDraft(),
      },
      validate: (value): value is {
        success: boolean
        draftId?: string
        siteId?: string
        previewToken?: string
        draftName?: string
        subdomainCandidate?: string
        error?: string
      } => isRecord(value)
        && typeof value.success === 'boolean'
        && (value.draftId === undefined || typeof value.draftId === 'string')
        && (value.siteId === undefined || typeof value.siteId === 'string')
        && (value.previewToken === undefined || typeof value.previewToken === 'string')
        && (value.draftName === undefined || typeof value.draftName === 'string')
        && (value.subdomainCandidate === undefined || typeof value.subdomainCandidate === 'string'),
    })

    if (!res.success || !res.draftId || !res.siteId || !res.previewToken || !res.draftName || !res.subdomainCandidate) {
      throw new Error(res.error ?? 'Failed to save your preview draft. Please try again.')
    }

    onboardingDraftId.value = res.draftId
    draftPreviewPayload.value = {
      draftId: res.draftId,
      siteId: res.siteId,
      previewToken: res.previewToken,
      draftName: res.draftName,
      subdomainCandidate: res.subdomainCandidate,
    }
    emit('draft-saved', draftPreviewPayload.value)
    return true
  } catch (error) {
    importError.value = error instanceof Error ? error.message : 'Failed to save your preview draft. Please try again.'
    return false
  } finally {
    if (!options.silent) importing.value = false
  }
}

async function submitDetails() {
  const requiredFields = [hoursForm.timezone]
  if (!requiredFields.every(value => value.trim().length > 0)) {
    importError.value = 'Add the required details before continuing.'
    return
  }

  step.value = 'create'
  importing.value = true
  importError.value = null
  const tools = showLookupTools('Adding your location…')

  try {
    const endpoint = addLocationEndpoint

    const body = pendingPreview.value
      ? {
          placeId: pendingPreview.value.placeId,
          vertical: selectedVertical.value,
          details: serializeDetails(),
        }
      : {
          name: detailsForm.name.trim(),
          vertical: selectedVertical.value,
          details: serializeDetails(),
        }

    const res = await applicationFetch<{
      success: boolean
      siteId?: string | null
      orgSlug?: string | null
      siteSlug?: string | null
      locationSlug?: string | null
      error?: string
    }>(endpoint, {
      method: 'POST',
      body,
      validate: (value): value is {
        success: boolean
        siteId?: string | null
        orgSlug?: string | null
        siteSlug?: string | null
        locationSlug?: string | null
        error?: string
      } => isRecord(value)
        && typeof value.success === 'boolean'
        && (value.siteId === undefined || value.siteId === null || typeof value.siteId === 'string')
        && (value.orgSlug === undefined || value.orgSlug === null || typeof value.orgSlug === 'string')
        && (value.siteSlug === undefined || value.siteSlug === null || typeof value.siteSlug === 'string')
        && (value.locationSlug === undefined || value.locationSlug === null || typeof value.locationSlug === 'string'),
    })

    if (!res.success) {
      throw new Error(res.error ?? 'Failed to create your workspace. Please try again.')
    }

    tools[0]!.done = true
    importedSiteId.value = res.siteId ?? null
    importedOrgSlug.value = res.orgSlug ?? null
    importedSiteSlug.value = res.siteSlug ?? props.existingSiteSlug ?? null
    await finishCreation(res.orgSlug, res.siteSlug ?? importedSiteSlug.value ?? props.existingSiteSlug ?? null, res.locationSlug)
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
    failTool(tools, 'Adding your location failed')
    // Keep the approved details intact and retry from the last step the owner
    // completed — never send them back through location editing.
    step.value = 'hero'
  } finally {
    importing.value = false
  }
}

let committing = false
let brandColorSaveTimer: ReturnType<typeof setTimeout> | null = null

function queueBrandColorSave() {
  if (isAddingLocation.value || step.value !== 'brand' || !onboardingDraftId.value) return
  if (brandColorSaveTimer) clearTimeout(brandColorSaveTimer)
  brandColorSaveTimer = setTimeout(() => {
    brandColorSaveTimer = null
    void saveActiveDraft({ silent: true })
  }, 250)
}

async function commitDraft() {
  if (committing) return
  if (!onboardingDraftId.value) {
    importError.value = 'No draft is ready yet. Save the preview first.'
    return
  }

  committing = true
  replies.value = []
  step.value = 'create'
  importing.value = true
  importError.value = null
  const tools = showLookupTools('Creating your site from the approved draft…')

  try {
    const res = await applicationFetch<{
      success: boolean
      siteId?: string | null
      orgSlug?: string | null
      siteSlug?: string | null
      locationSlug?: string | null
      error?: string
    }>(`/api/dashboard/onboarding/drafts/${onboardingDraftId.value}/activate`, {
      method: 'POST',
      validate: (value): value is {
        success: boolean
        siteId?: string | null
        orgSlug?: string | null
        siteSlug?: string | null
        locationSlug?: string | null
        error?: string
      } => isRecord(value)
        && typeof value.success === 'boolean'
        && (value.siteId === undefined || value.siteId === null || typeof value.siteId === 'string')
        && (value.orgSlug === undefined || value.orgSlug === null || typeof value.orgSlug === 'string')
        && (value.siteSlug === undefined || value.siteSlug === null || typeof value.siteSlug === 'string')
        && (value.locationSlug === undefined || value.locationSlug === null || typeof value.locationSlug === 'string'),
    })

    if (!res.success) {
      throw new Error(res.error ?? 'Failed to create your workspace. Please try again.')
    }

    tools[0]!.done = true
    importedSiteId.value = res.siteId ?? null
    importedOrgSlug.value = res.orgSlug ?? null
    importedSiteSlug.value = res.siteSlug ?? props.existingSiteSlug ?? null
    await finishCreation(res.orgSlug, res.siteSlug ?? importedSiteSlug.value ?? props.existingSiteSlug ?? null, res.locationSlug)
  } catch (error) {
    importError.value = error instanceof Error ? error.message : 'Something went wrong. Please try again.'
    failTool(tools, 'Creating your site failed')
    // The approved draft is untouched — stay on draft-ready so the owner can
    // retry the create instead of being dropped back into location editing.
    step.value = 'draft_ready'
    replies.value = DRAFT_READY_REPLIES
  } finally {
    importing.value = false
    committing = false
  }
}

function serializeDetails() {
  return {
    name: detailsForm.name.trim(),
    city: detailsForm.city.trim() || null,
    address: composeAddress() || null,
    phone: detailsForm.phone.trim() || null,
    openingHours: parseOpeningHours(hoursForm.hours),
    specialHours: parseSpecialHours(hoursForm.specialHours),
    notificationPhone: detailsForm.phone.trim() || null,
    timezone: hoursForm.timezone.trim() || null,
    currency: detailsForm.currency ?? null,
  }
}

function serializeBrandDraft() {
  return {
    brandColor: brandDraftForm.brandColor.trim() || null,
    logoNote: brandDraftForm.logoNote.trim() || null,
    logoPreviewUrl: brandDraftForm.logoPreviewUrl.trim() || null,
    heroPhotoNote: brandDraftForm.heroPhotoNote.trim() || null,
    heroPreviewUrl: brandDraftForm.heroPreviewUrl.trim() || null,
    logoImage: brandDraftForm.logoImage,
    heroImage: brandDraftForm.heroImage,
    heroHeadline: brandDraftForm.heroHeadline.trim() || null,
    heroDescription: brandDraftForm.heroDescription.trim() || null,
  }
}

// detailsForm.country holds an ISO code; the address carries the country's name.
// A Google-imported street address is already the full formatted address, so a
// line whose every segment it already contains is not appended a second time.
function composeAddress() {
  const street = detailsForm.streetAddress.trim()
  const alreadyInStreet = (segment: string) => street.toLowerCase().includes(segment.toLowerCase())
  const localityParts = [detailsForm.city, detailsForm.region, detailsForm.postalCode].map(part => part.trim()).filter(Boolean)
  // Per segment, not all-or-nothing: a Google-imported street line often
  // already contains the city but not the postal code.
  const locality = localityParts.filter(part => !alreadyInStreet(part)).join(', ')
  const countryName = getPhoneCountry(detailsForm.country)?.name ?? ''
  const country = countryName && !alreadyInStreet(countryName) ? countryName : ''
  return [street, detailsForm.addressLine2, locality, country]
    .map(part => part.trim())
    .filter(Boolean)
    .join('\n')
}

function seedDetailsFromPreview(preview: NonNullable<typeof pendingPreview.value>) {
  detailsForm.name = preview.name ?? ''
  detailsForm.city = preview.city ?? ''
  detailsForm.streetAddress = preview.address ?? ''
  detailsForm.addressLine2 = ''
  detailsForm.region = ''
  detailsForm.postalCode = ''
  detailsForm.country = ''
  // Google returns the national format ("081 234 5678"), which carries no country
  // and cannot be stored at the E.164 write boundary. Seed it only when it parses
  // on its own; otherwise leave the field empty so the owner picks the country and
  // enters the number, rather than staring at a value the form has to throw away.
  detailsForm.phone = parsePhone(preview.phone ?? '').e164 ?? ''
  detailsForm.currency = 'USD'
  seedHoursFromPreview(preview.openingHours)
  hoursForm.timezone = preview.timezone ?? ''
}

function seedDetailsFromManual(name: string) {
  detailsForm.name = name
  detailsForm.city = ''
  detailsForm.streetAddress = ''
  detailsForm.addressLine2 = ''
  detailsForm.region = ''
  detailsForm.postalCode = ''
  detailsForm.country = 'US'
  detailsForm.phone = ''
  detailsForm.currency = 'USD'
  seedHoursFromPreview(null)
}

function seedHoursFromPreview(openingHours: OpeningHours | undefined) {
  hoursForm.timezone = ''
  hoursForm.hours = parseOpeningHours(openingHours ?? null)
  hoursForm.specialHours = null
}

async function finishCreation(orgSlug: string | null | undefined, siteSlug: string | null | undefined, locationSlug?: string | null) {
  emit('site-created', { orgSlug: orgSlug ?? null, siteSlug: siteSlug ?? null, locationSlug: locationSlug ?? null })
  importedLocationSlug.value = locationSlug ?? null

  if (importedSiteId.value && !isAddingLocation.value) {
    trackSiteCreated(importedSiteId.value)
  }

  const domainSlug = siteSlug ?? orgSlug
  const domainHost = domainSlug ? siteHostFor(domainSlug) : ''
  const domain = domainHost ? `**${domainHost}**` : 'your new workspace'
  pushBot(`Done. Your workspace is live at ${domain}.`)
  pushBot(
    "From here, head to your dashboard to keep building — chat with ChowBot, use the structured editor, or pick it back up in ChatGPT. Connect Facebook whenever you're ready and posts you publish there will sync to your site too.",
  )
  step.value = 'imported'
  replies.value = [
    { label: 'Open my dashboard', icon: 'i-lucide-arrow-right', primary: true, action: 'dashboard' },
  ]
}

const canRetryFailedStep = computed(() => {
  if (step.value === 'awaiting_url') return Boolean(pendingMapsUrl.value)
  if (step.value === 'draft_ready') return Boolean(onboardingDraftId.value)
  if (step.value === 'hero') return isAddingLocation.value
  return false
})

function retryFailedStep() {
  if (!canRetryFailedStep.value) return
  const failedStep = step.value
  importError.value = null
  if (failedStep === 'awaiting_url') void runLookup(pendingMapsUrl.value)
  else if (failedStep === 'draft_ready') void commitDraft()
  else if (failedStep === 'hero') void submitDetails()
}


</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.onboarding-transcript-item {
  animation: onboarding-message-in 180ms ease both;
  animation-delay: var(--message-delay, 0ms);
}

.onboarding-step-widget {
  border: 1px solid var(--ui-border);
  border-radius: 0.75rem;
  background: var(--ui-bg-elevated);
  padding: 0.875rem;
}

@keyframes onboarding-message-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .onboarding-transcript-item {
    animation: none;
  }

}
</style>
