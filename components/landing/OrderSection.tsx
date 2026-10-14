'use client'

import Image from 'next/image'
import { ArrowRight, ChefHat, Clock3, HeartHandshake, Leaf, Sparkles } from 'lucide-react'
import { Reveal } from '@/components/landing/Reveal'
import { Button } from '@/components/ui/button'

const foodPhotos = [
  { src: '/landing/5-tray-assortment.webp', alt: 'Colorful catered food tray', className: 'left-[2%] top-[17%] size-20 sm:left-[3%] sm:size-28' },
  { src: '/landing/2-crispy-pork-mains.webp', alt: 'Crispy pork dish with fresh sides', className: 'right-[4%] top-[8%] size-24 sm:right-[7%] sm:size-32' },
  { src: '/landing/3-meal-prep-boxes.webp', alt: 'Fresh meal prep box', className: 'bottom-[7%] left-[15%] size-24 sm:bottom-[4%] sm:left-[18%] sm:size-32' },
]

const benefits = [
  { title: 'Fresh Ingredients', description: 'Thoughtfully sourced produce and pantry staples in every order.', icon: Leaf },
  { title: 'Fast Delivery', description: 'Reliable timing from our kitchen to your event or doorstep.', icon: Clock3, featured: true },
  { title: 'Custom Orders', description: 'Flexible menus shaped around your guests, tastes, and needs.', icon: ChefHat },
]

export function OrderSection({ onOrder }: { onOrder: () => void }) {
  return (
    <section className="relative overflow-visible bg-white pb-28 text-[#2A1B1F]">
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-16 sm:pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8 lg:px-10 lg:pb-28 lg:pt-24">
        <Reveal className="relative z-20 max-w-xl">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.24em] text-[#9C6670]">Made for your table</p>
          <h2 className="max-w-lg font-heading text-4xl leading-[1.08] tracking-tight text-[#2A1B1F] sm:text-5xl lg:text-6xl">Order Your Food <span className="text-[#D13A47]">&amp;</span> Enjoy The Taste.</h2>
          <p className="mt-6 max-w-md text-base leading-7 text-[#775D63]">Browse our menus, plan your event, and have your meals prepared and delivered, all in one organized place.</p>
          <Button onClick={onOrder} className="mt-8 h-12 rounded-full bg-[#D13A47] px-7 text-white shadow-[0_10px_24px_rgba(209,58,71,0.2)] hover:bg-[#B82E3B]">Order Now <ArrowRight data-icon="inline-end" /></Button>
        </Reveal>

        <Reveal delay={140} variant="scale" className="relative mx-auto aspect-square w-full max-w-[520px]">
          <div className="absolute inset-[9%] rounded-full border border-[#D79BA3]/70" />
          <div className="absolute inset-[17%] rounded-full border border-dashed border-[#D79BA3]/40" />
          <div className="absolute inset-[14%] overflow-hidden rounded-full border-[10px] border-white bg-white shadow-[0_18px_50px_rgba(92,38,46,0.15)]">
            <Image src="/landing/1-salad-rice-bites.webp" alt="A generous plate of colorful catered food" fill sizes="(min-width: 1024px) 430px, 80vw" className="object-cover" priority />
          </div>
          {foodPhotos.map((photo) => <div key={photo.src} className={`absolute overflow-hidden rounded-full border-4 border-white bg-white shadow-[0_12px_24px_rgba(92,38,46,0.16)] ${photo.className}`}><Image src={photo.src} alt={photo.alt} fill sizes="128px" className="object-cover" /></div>)}
          <Sparkles aria-hidden="true" className="absolute left-[20%] top-[4%] size-7 rotate-12 text-[#C9808C]/70" />
          <HeartHandshake aria-hidden="true" className="absolute bottom-[19%] right-[2%] size-8 -rotate-12 text-[#C9808C]/60" />
          <div aria-hidden="true" className="absolute right-[16%] top-[19%] size-5 rounded-full border-2 border-[#C9808C]/50 after:absolute after:-right-2 after:top-1/2 after:h-px after:w-3 after:rotate-45 after:bg-[#C9808C]/50" />
          <div aria-hidden="true" className="absolute bottom-[22%] left-[5%] h-8 w-5 rounded-b-full rounded-t-md border-2 border-[#C9808C]/45" />
        </Reveal>
      </div>

      <div className="relative z-20 mx-auto -mb-44 grid max-w-6xl gap-4 px-6 sm:grid-cols-3 lg:gap-6">
        {benefits.map(({ title, description, icon: Icon, featured }, index) => <Reveal key={title} delay={index * 100} variant="scale" className="h-full"><article className={`flex h-full min-h-48 flex-col items-center justify-center rounded-2xl px-6 py-8 text-center shadow-[0_14px_35px_rgba(74,32,40,0.09)] ${featured ? 'bg-[#D13A47] text-white' : 'bg-white text-[#2A1B1F]'}`}><span className={`mb-4 grid size-11 place-items-center rounded-xl ${featured ? 'bg-white/95 text-[#D13A47]' : 'bg-[#FDE6E6] text-[#D13A47]'}`}><Icon aria-hidden="true" className="size-5" /></span><h3 className="font-heading text-base">{title}</h3><p className={`mt-2 max-w-[18rem] text-xs leading-5 ${featured ? 'text-white/85' : 'text-[#775D63]'}`}>{description}</p></article></Reveal>)}
      </div>
    </section>
  )
}
