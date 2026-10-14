'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Reveal } from '@/components/landing/Reveal'
import { Button } from '@/components/ui/button'

const photos = [
  { src: '/landing/1-salad-rice-bites.webp', alt: 'Party trays of fruit salad, garlic rice and carrot canapés' },
  { src: '/landing/2-crispy-pork-mains.webp', alt: 'Crispy pork mains served with colorful sides' },
  { src: '/landing/3-meal-prep-boxes.webp', alt: 'Freshly prepared meal-prep boxes arranged for the week' },
  { src: '/landing/4-sisig-shrimp-pasta.webp', alt: 'Sisig and shrimp pasta dishes ready to serve' },
  { src: '/landing/5-tray-assortment.webp', alt: 'An assortment of catered trays for sharing' },
  { src: '/landing/6-rice-meal-boxes.webp', alt: 'Rice meal boxes packed for easy weekly meals' },
]

const features = [
  ['Event catering', 'Book events with date, guest count and menu in one request.'],
  ['Weekly meal-prep', 'Recurring orders with availability checked against stock.'],
  ['MacroFlex nutrition matching', 'Dishes matched to your calories and macros.'],
]

function PhotoCard({ photo, duplicate = false, index, spacing = 'horizontal' }: { photo: typeof photos[number]; duplicate?: boolean; index: number; spacing?: 'vertical' | 'horizontal' }) {
  return <div className={`shrink-0 ${spacing === 'vertical' ? 'pb-4' : 'pr-4'}`} aria-hidden={duplicate}>
    <div className="overflow-hidden rounded-2xl shadow-xl">
      <Image src={photo.src} alt={duplicate ? '' : photo.alt} width={640} height={448} sizes="(min-width: 1024px) 320px, 256px" priority={!duplicate && index < 2} className="h-44 w-64 object-cover opacity-40 transition-opacity duration-500 group-hover:opacity-90 lg:h-56 lg:w-80" />
    </div>
  </div>
}

function Marquee() {
  const secondRow = [...photos.slice(3), ...photos.slice(0, 3)]
  return <div className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 space-y-4 opacity-100" aria-hidden="true">
    <div className="group marquee-row-viewport motion-reduce:hidden">
      <div className="marquee-left flex w-max">{[...photos, ...photos].map((photo, i) => <PhotoCard key={`left-${i}`} photo={photo} duplicate={i >= photos.length} index={i} />)}</div>
    </div>
    <div className="group marquee-row-viewport motion-reduce:hidden">
      <div className="marquee-right flex w-max">{[...secondRow, ...secondRow].map((photo, i) => <PhotoCard key={`right-${i}`} photo={photo} duplicate={i >= photos.length} index={i} />)}</div>
    </div>
    <div className="hidden motion-reduce:flex">
      {photos.slice(0, 3).map((photo, i) => <PhotoCard key={photo.src} photo={photo} index={i} />)}
    </div>
  </div>
}

export default function Page() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const enterAsCustomer = () => { router.push('/login') }


  return <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
    <header className="sticky top-0 z-20 border-b border-border/80 bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <a href="#top" aria-label="CaterFlex home"><img src="/logo.png" alt="CaterFlex" className="size-12 object-contain brightness-0" /></a>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">{[['Services', '#services'], ['MacroFlex', '#macroflex'], ['How it works', '#how-it-works']].map(([label, href]) => <a key={href} href={href} className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-brand-deep">{label}</a>)}</nav>
        <div className="hidden items-center gap-3 md:flex"><Button variant="ghost" onClick={() => router.push('/login')}>Log in</Button><Button onClick={() => router.push('/signup')}>Sign up</Button></div>
        <Button variant="outline" size="icon" className="md:hidden" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><span className="text-lg">{menuOpen ? '×' : '☰'}</span></Button>
      </div>
      {menuOpen && <nav className="border-t border-border bg-card px-6 py-4 md:hidden" aria-label="Mobile navigation">{[['Services', '#services'], ['MacroFlex', '#macroflex'], ['How it works', '#how-it-works']].map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)} className="block py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}</a>)}<div className="flex gap-3 border-t border-border pt-3"><Button variant="ghost" onClick={() => router.push('/login')}>Log in</Button><Button onClick={() => router.push('/signup')}>Sign up</Button></div></nav>}
    </header>
    <section id="top" className="relative isolate flex min-h-[560px] items-center overflow-hidden bg-[#FDE6E6]"><Marquee /><div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-20 lg:px-10"><Reveal><p className="mb-5 font-mono text-xs uppercase tracking-[0.28em] text-brand-deep">Catering and meal-prep, made personal</p></Reveal><Reveal delay={100}><h1 className="max-w-3xl font-heading text-4xl leading-[1.04] tracking-tight text-[#2A1B1F] sm:text-5xl lg:text-7xl">Good food starts with a better plan.</h1></Reveal><Reveal delay={200}><p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">CaterFlex helps you discover menus, plan memorable gatherings, and order meals that match your needs—all with a simple, organized experience.</p></Reveal><Reveal delay={300}><div className="mt-9 flex flex-wrap items-center gap-4"><Button onClick={enterAsCustomer} className="h-12 px-7">Plan your meal</Button><a href="#how-it-works" className="text-sm font-semibold text-brand-deep underline underline-offset-4">See how it works</a></div></Reveal></div></section>
    <section className="bg-card px-6 py-20 text-center lg:py-28"><Reveal><h2 className="mx-auto max-w-3xl font-heading text-4xl leading-tight text-brand-deep sm:text-6xl">Catering and meal-prep, planned in one place</h2></Reveal><Reveal delay={120}><p className="mx-auto mt-5 max-w-xl leading-7 text-muted-foreground">From gatherings to weekly routines, keep your menu, timing, and nutrition goals moving together.</p></Reveal></section>
    <section id="services" className="bg-background px-6 py-20 lg:py-28"><div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">{features.map(([title, text], i) => <Reveal key={title} delay={i * 120} variant="scale"><article className="group overflow-hidden rounded-2xl border border-border bg-card transition-transform hover:-translate-y-1 hover:shadow-lg"><Image src={photos[i].src} alt={photos[i].alt} width={640} height={448} className="h-56 w-full object-cover" /><div className="p-6"><h3 className="font-heading text-xl">{title}</h3><p className="mt-3 leading-7 text-muted-foreground">{text}</p></div></article></Reveal>)}</div></section>
    <section id="how-it-works" className="bg-primary-soft px-6 py-16"><div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"><Reveal><h2 className="font-heading text-3xl text-brand-deep sm:text-4xl">Let&apos;s plan something delicious.</h2></Reveal><Button onClick={enterAsCustomer} className="w-fit">Get started</Button></div></section>
    <footer className="bg-card px-6 py-10"><div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><img src="/logo.png" alt="CaterFlex" className="size-12 object-contain brightness-0" /><p>© {new Date().getFullYear()} CaterFlex. All rights reserved.</p><div className="flex gap-5"><a href="/login" className="hover:text-foreground">Log in</a><a href="/signup" className="hover:text-foreground">Sign up</a></div></div></footer>
  </main>
}
