'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Reveal } from '@/components/landing/Reveal'
import { Button } from '@/components/ui/button'
import { useAppState } from '@/lib/state'

const photos = [
  { src: '/landing/1-salad-rice-bites.webp', alt: 'Party trays of fruit salad, garlic rice and carrot canapés' },
  { src: '/landing/2-crispy-pork-mains.webp', alt: 'Crispy pork mains served with colorful sides' },
  { src: '/landing/3-meal-prep-boxes.webp', alt: 'Freshly prepared meal-prep boxes arranged for the week' },
  { src: '/landing/4-sisig-shrimp-pasta.webp', alt: 'Sisig and shrimp pasta dishes ready to serve' },
  { src: '/landing/5-tray-assortment.webp', alt: 'An assortment of catered trays for sharing' },
  { src: '/landing/6-rice-meal-boxes.webp', alt: 'Rice meal boxes packed for easy weekly meals' },
]

const features = [
  { title: 'Book with confidence', text: 'Send event or meal-prep requests in one place and avoid scheduling conflicts.' },
  { title: 'Menus that fit you', text: 'Browse dishes with dietary and allergen details so every guest can enjoy the meal.' },
  { title: 'Smarter meal planning', text: 'Get thoughtful dish suggestions shaped around your preferences and nutrition goals.' },
]

function PhotoCard({ photo, duplicate = false, index }: { photo: typeof photos[number]; duplicate?: boolean; index: number }) {
  return <div className="shrink-0 overflow-hidden rounded-2xl shadow-xl" style={{ transform: `rotate(${index % 2 ? 2 : -2}deg)` }} aria-hidden={duplicate}>
    <Image src={photo.src} alt={duplicate ? '' : photo.alt} width={1000} height={1333} sizes="(min-width: 1024px) 18vw, 70vw" priority={!duplicate && index < 2} loading={!duplicate && index < 2 ? undefined : 'lazy'} className="h-[220px] w-[165px] object-cover lg:h-[300px] lg:w-[225px]" />
  </div>
}

function Marquee() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => { if (ref.current) ref.current.style.transform = `translateY(${window.scrollY * 0.1}px)` })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll) }
  }, [])
  const secondColumn = [...photos.slice(3), ...photos.slice(0, 3)]
  return <div ref={ref} className="w-full transition-transform duration-100 ease-out">
    <div className="hidden h-[640px] gap-4 overflow-hidden lg:flex marquee-viewport">
      <div className="marquee-up flex min-w-0 flex-1 flex-col gap-4">{[...photos, ...photos].map((photo, i) => <PhotoCard key={`a-${i}`} photo={photo} duplicate={i >= photos.length} index={i} />)}</div>
      <div className="marquee-down flex min-w-0 flex-1 flex-col gap-4">{[...secondColumn, ...secondColumn].map((photo, i) => <PhotoCard key={`b-${i}`} photo={photo} duplicate={i >= photos.length} index={i} />)}</div>
    </div>
    <div className="marquee-row-viewport flex h-[220px] gap-4 overflow-hidden lg:hidden">
      <div className="marquee-left flex shrink-0 gap-4">{[...photos, ...photos].map((photo, i) => <PhotoCard key={`mobile-${i}`} photo={photo} duplicate={i >= photos.length} index={i} />)}</div>
    </div>
    <div className="hidden grid-cols-2 gap-4 motion-reduce:grid">{photos.slice(0, 4).map((photo, i) => <PhotoCard key={photo.src} photo={photo} index={i} />)}</div>
  </div>
}

export default function Page() {
  const router = useRouter()
  const { setCurrentRole } = useAppState()
  const enterAsCustomer = () => { setCurrentRole('customer'); router.push('/login') }

  return <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
    <section className="relative flex min-h-[min(760px,92vh)] flex-col overflow-hidden bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/background.webp')" }}>
      <div className="absolute inset-0 bg-brand/65" aria-hidden="true" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-5 lg:px-10 lg:py-7">
        <header className="flex items-center justify-between"><img src="/logo.png" alt="CaterFlex" className="h-20 w-20 object-contain sm:h-24 sm:w-24" /><div className="flex items-center gap-3"><Button variant="outline" onClick={() => router.push('/login')} className="border-on-dark/50 bg-card/90 text-card-foreground hover:bg-card">Sign in</Button><Button onClick={() => router.push('/signup')} className="bg-primary text-primary-foreground hover:bg-primary/90">Sign up</Button></div></header>
        <div className="flex flex-1 items-center py-12 lg:py-20"><div className="grid w-full items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-20"><div className="max-w-2xl"><p className="mb-5 font-mono text-xs uppercase tracking-[0.28em] text-on-dark-muted">Catering and meal-prep, made personal</p><h1 className="font-heading text-5xl leading-[1.04] tracking-tight text-foreground sm:text-6xl lg:text-8xl">Good food starts with a better plan.</h1><p className="mt-7 max-w-xl text-base leading-7 text-on-dark-muted sm:text-lg">CaterFlex helps you discover menus, plan memorable gatherings, and order meals that match your needs—all with a simple, organized experience.</p><div className="mt-9 flex flex-wrap items-center gap-4"><Button onClick={enterAsCustomer} className="h-12 bg-primary px-7 text-primary-foreground hover:bg-primary/90">Plan your meal</Button><a href="#how-it-works" className="text-sm font-semibold text-on-dark underline decoration-on-dark/40 underline-offset-4 hover:text-foreground">See how it works</a></div></div><Marquee /></div></div>
      </div>
    </section>
    <section className="tone-dark bg-brand"><div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24"><Reveal><p className="font-mono text-xs uppercase tracking-[0.28em] text-primary-foreground/70">Good food, thoughtfully planned</p></Reveal><Reveal delay={100}><h2 className="mt-4 max-w-3xl font-heading text-4xl leading-tight sm:text-6xl">A taste of what we serve.</h2></Reveal><Reveal delay={200}><p className="mt-5 max-w-xl text-base leading-7 text-on-dark-muted">Flexible catering and meal-prep for the way you gather, eat, and live.</p></Reveal><div className="mt-14 grid gap-8 border-t border-on-dark/20 pt-8 sm:grid-cols-3">{['Event catering', 'Weekly meal-prep', 'MacroFlex nutrition matching'].map((item, i) => <Reveal key={item} delay={i * 120} variant="fade"><p className="font-heading text-xl">{item}</p></Reveal>)}</div></div></section>
    <section id="how-it-works" className="bg-card text-card-foreground"><div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28"><div className="max-w-2xl"><Reveal><p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">One place for every occasion</p></Reveal><Reveal delay={100}><h2 className="mt-4 font-heading text-4xl leading-tight sm:text-5xl">From first idea to final plate.</h2></Reveal><Reveal delay={200}><p className="mt-5 text-base leading-7 text-muted-foreground">Whether you are arranging a celebration or planning balanced meals for the week, CaterFlex keeps the details clear and the food at the center.</p></Reveal></div><div className="mt-14 grid gap-6 md:grid-cols-3">{features.map((feature, i) => <Reveal key={feature.title} delay={i * 150} variant="scale"><article className="border-t-2 border-primary pt-5"><h3 className="font-heading text-xl">{feature.title}</h3><p className="mt-3 leading-7 text-muted-foreground">{feature.text}</p></article></Reveal>)}</div></div></section>
    <section className="border-t border-border bg-card text-card-foreground"><div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-16 lg:flex-row lg:items-center lg:justify-between lg:px-10"><Reveal><div><p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Ready when you are</p><h2 className="mt-3 font-heading text-3xl sm:text-4xl">Let&apos;s plan something delicious.</h2></div></Reveal><Button onClick={enterAsCustomer} className="h-12 w-fit bg-primary px-7 text-primary-foreground hover:bg-primary/90">Get started</Button></div></section>
  </main>
}
