<template>
    <article>
      <div class="bg-black text-white w-full py-10 sm:py-20 px-4 sm:px-8">
        <div class="mx-auto prose lg:prose-xl max-w-7xl">
          <div class="flex flex-col lg:flex-row items-start">
            <div class="flex-1 lg:pr-8 w-full lg:w-2/3">
              <h1 class="text-white text-3xl sm:text-4xl lg:text-5xl mb-6">Bred to Rise</h1>

              <p class="text-white text-base sm:text-lg"> <strong class="text-white"> Bred to Rise</strong> is a non-profit intiative rooted in Sand-O's mission to uplift communities 
                  through mental wellness, nutrition, and personal development. In 2024, we will reward 
                  resilience—supporting those overcoming mental health challenges, pursuing fitness goals, 
                  and rebuilding their lives.
              </p>
              <p class="text-white text-base sm:text-lg">  Our goal is to create meaningful moments of progress by providing tools, meals, and support that 
                  help individuals rise to their full potential. Just like bread, people rise best with the right care and attention.
              </p>
            </div>
            <div class="flex-shrink-0 mt-8 lg:mt-0 lg:ml-12 w-full lg:w-1/3">
              <img src="~/assets/images/bread-min.png" alt="Bread" class="w-full h-auto object-contain" />
            </div>
          </div>
        </div>
      </div>

      <div class="mx-auto prose lg:prose-xl px-4 sm:px-8 py-10 sm:py-20 max-w-7xl">
        <h2 class="text-2xl sm:text-3xl lg:text-4xl mb-6">Breaking Bread: Where Community and Change Meet</h2>
        <div class="flex flex-col lg:flex-row items-start">
          <div class="flex-1 lg:pr-8 w-full lg:w-2/3">
            <p class="text-base sm:text-lg"> We believe that true transformation begins with connection. Just like the act of <i>breaking bread</i> brings people together,
               our programs foster unity and mutual support. Whether you're sharing a meal, participating in a fitness class, or attending a wellness workshop, every interaction strengthens the fabric of our community. At Sand-o we partner with Bred to Rise, and aim to uplift individuals facing challenges such as mental health struggles, addiction recovery, or life after incarceration.</p>
            <p class="text-base sm:text-lg">Our community partners— including gyms, bakeries, schools, and wellness centers—play a vital role 
              in delivering our programs. Together, we build environments where people can rise stronger, one step at a time. 
              To connect with a Bred to Rise program or explore ways to support our efforts, please click below.</p> 
            <div class="mt-8 mb-8 lg:mb-0">
              <button class="bg-black text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-bold hover:bg-gray-800 transition duration-300">
                Inquire
              </button>
            </div>
          </div>
          <div class="flex-shrink-0 mt-8 lg:mt-0 lg:ml-12 w-full lg:w-1/3">
            <img src="~/assets/images/initiative-min.png" alt="Initiative" class="w-full h-auto object-contain" />
          </div>
        </div>
      </div>
    </article>
</template>

<script setup>
useSeoMeta({
  title: 'Bred to Rise - Community Initiative | Take Me Away by KIKUZUKI',
  description: 'Bred to Rise is a non-profit initiative supporting mental wellness, nutrition, and personal development in Thailand. Learn about our community programs and how we help individuals rise to their full potential.',
  ogTitle: 'Bred to Rise - Community Initiative | Take Me Away by KIKUZUKI',
  ogDescription: 'Supporting communities through mental wellness, nutrition, and personal development programs in southern Thailand.',
  ogImage: '/og-image.jpg',
  ogUrl: 'https://www.kikuzuki-thailand.com/about',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Bred to Rise - Community Initiative',
  twitterDescription: 'Non-profit initiative supporting mental wellness and personal development in Thailand.',
  twitterImage: '/og-image.jpg'
})
</script>