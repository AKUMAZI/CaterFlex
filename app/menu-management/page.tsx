'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { ChevronDown, Loader2, Plus, UtensilsCrossed } from 'lucide-react'
import { DashboardLayout } from '@/app/dashboard-layout'
import { createDish, updateDish } from '@/app/actions/inventory-actions'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

type MenuItem = { MenuItemID: number; ItemName: string; Category: string; Price: number; PrepTimeDays: number; Description: string | null; Availability: boolean | null }
type Ingredient = { IngredientID: number; IngredientName: string; UnitOfMeasure: string; CurrentStock: number | null }
type DishIngredient = { MenuItemID: number; IngredientID: number; QuantityRequiredPerServing: number }
type FormIngredient = { ingredientId: number; quantity: string }
const categories = ['mains', 'appetizers', 'sides', 'desserts', 'beverages']

function money(value: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value) }

export default function MenuManagementPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [relations, setRelations] = useState<DishIngredient[]>([])
  const [openId, setOpenId] = useState<number | null>(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', category: 'mains', price: '', prepTimeDays: '1', availability: true })
  const [formIngredients, setFormIngredients] = useState<FormIngredient[]>([])

  const load = async () => {
    setLoading(true); setError('')
    const [menu, stock, recipe] = await Promise.all([
      supabase.from('MENU_ITEM').select('MenuItemID, ItemName, Category, Price, PrepTimeDays, Description, Availability').order('ItemName'),
      supabase.from('INGREDIENT').select('IngredientID, IngredientName, UnitOfMeasure, CurrentStock').order('IngredientName'),
      supabase.from('DISH_INGREDIENT').select('MenuItemID, IngredientID, QuantityRequiredPerServing'),
    ])
    const failure = menu.error || stock.error || recipe.error
    if (failure) setError(failure.message)
    setItems((menu.data ?? []).map((item) => ({ ...item, MenuItemID: Number(item.MenuItemID), Price: Number(item.Price), PrepTimeDays: Number(item.PrepTimeDays), Availability: item.Availability !== false })))
    setIngredients((stock.data ?? []).map((item) => ({ ...item, IngredientID: Number(item.IngredientID), CurrentStock: item.CurrentStock == null ? null : Number(item.CurrentStock) })))
    setRelations((recipe.data ?? []).map((item) => ({ ...item, MenuItemID: Number(item.MenuItemID), IngredientID: Number(item.IngredientID), QuantityRequiredPerServing: Number(item.QuantityRequiredPerServing) })))
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const ingredientMap = useMemo(() => new Map(ingredients.map((item) => [item.IngredientID, item])), [ingredients])
  const itemIngredients = (id: number) => relations.filter((row) => row.MenuItemID === id).map((row) => ({ ...row, ingredient: ingredientMap.get(row.IngredientID) })).filter((row) => row.ingredient)
  const visible = filter === 'all' ? items : items.filter((item) => item.Category.toLowerCase() === filter)
  const status = (item: MenuItem) => item.Availability === false ? 'Unavailable' : itemIngredients(item.MenuItemID).every((row) => (row.ingredient?.CurrentStock ?? 0) >= row.QuantityRequiredPerServing) ? 'Available' : 'Insufficient stock'

  const openForm = (item?: MenuItem) => {
    setEditing(item ?? null)
    setForm(item ? { name: item.ItemName, description: item.Description ?? '', category: item.Category.toLowerCase(), price: String(item.Price), prepTimeDays: String(item.PrepTimeDays), availability: item.Availability !== false } : { name: '', description: '', category: 'mains', price: '', prepTimeDays: '1', availability: true })
    setFormIngredients(item ? itemIngredients(item.MenuItemID).map((row) => ({ ingredientId: row.IngredientID, quantity: String(row.QuantityRequiredPerServing) })) : [])
    setFormOpen(true); setError('')
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError('')
    const input = { name: form.name, description: form.description, category: form.category, price: Number(form.price), prepTimeDays: Number(form.prepTimeDays), availability: form.availability }
    const result = editing ? await updateDish(editing.MenuItemID, input) : await createDish({ ...input, ingredients: formIngredients.filter((row) => Number(row.quantity) > 0).map((row) => ({ ingredientId: row.ingredientId, quantity: Number(row.quantity) })) })
    if (!result.ok) setError(result.error)
    else { setFormOpen(false); await load() }
    setSaving(false)
  }

  return <DashboardLayout><div className="mx-auto flex max-w-7xl flex-col gap-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-muted-foreground">Owner workspace</p><h1 className="text-3xl font-semibold tracking-tight">Menu Management</h1><p className="mt-1 text-muted-foreground">Keep dish descriptions, pricing, ingredients, and availability in sync.</p></div><Button onClick={() => openForm()}><Plus data-icon="inline-start" />Add menu item</Button></header>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{[['all', 'All Dishes'], ...categories.map((category) => [category, category[0].toUpperCase() + category.slice(1)])].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-2xl border-2 p-5 text-left transition-colors ${filter === value ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40'}`}><span className="text-sm font-medium">{label}</span><span className="mt-3 block text-4xl font-bold">{value === 'all' ? items.length : items.filter((item) => item.Category.toLowerCase() === value).length}</span></button>)}</div>
    {formOpen && <Card><CardHeader><CardTitle>{editing ? 'Edit menu item' : 'Add menu item'}</CardTitle><CardDescription>All fields are saved to the MENU_ITEM table.</CardDescription></CardHeader><CardContent><form onSubmit={save} className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label className="grid gap-2 text-sm font-medium">Category<select className="h-10 rounded-md border bg-background px-3" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Price<input required min="0" step="0.01" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label><label className="grid gap-2 text-sm font-medium">Prep time in days<input required min="0" step="1" type="number" value={form.prepTimeDays} onChange={(e) => setForm({ ...form, prepTimeDays: e.target.value })} /></label><label className="grid gap-2 text-sm font-medium md:col-span-2">Description<Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe this dish for customers" /></label><div className="grid gap-3 md:col-span-2"><p className="text-sm font-medium">Ingredients per serving</p>{formIngredients.map((row, index) => <div className="flex gap-2" key={`${row.ingredientId}-${index}`}><select className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3" value={row.ingredientId} onChange={(e) => setFormIngredients(formIngredients.map((entry, i) => i === index ? { ...entry, ingredientId: Number(e.target.value) } : entry))}>{ingredients.map((ingredient) => <option key={ingredient.IngredientID} value={ingredient.IngredientID}>{ingredient.IngredientName} ({ingredient.UnitOfMeasure})</option>)}</select><input className="w-32" type="number" min="0" step="0.01" value={row.quantity} onChange={(e) => setFormIngredients(formIngredients.map((entry, i) => i === index ? { ...entry, quantity: e.target.value } : entry))} /><Button type="button" variant="outline" onClick={() => setFormIngredients(formIngredients.filter((_, i) => i !== index))}>Remove</Button></div>)}<Button type="button" variant="outline" onClick={() => ingredients[0] && setFormIngredients([...formIngredients, { ingredientId: ingredients[0].IngredientID, quantity: '1' }])}>Add ingredient</Button></div><label className="flex items-center gap-3 text-sm font-medium md:col-span-2"><select aria-label="Availability" className="h-10 rounded-md border bg-background px-3" value={form.availability ? 'available' : 'unavailable'} onChange={(e) => setForm({ ...form, availability: e.target.value === 'available' })}><option value="available">Available</option><option value="unavailable">Unavailable</option></select>Availability</label><div className="flex gap-2 md:col-span-2"><Button type="submit" disabled={saving}>{saving && <Loader2 data-icon="inline-start" className="animate-spin" />}Save menu item</Button><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button></div></form></CardContent></Card>}
    <Card><CardHeader><CardTitle>Menu items</CardTitle><CardDescription>Click a dish to expand its description and ingredient requirements.</CardDescription></CardHeader><CardContent className="p-0">{loading ? <div className="flex justify-center gap-2 p-12 text-muted-foreground"><Loader2 className="animate-spin" />Loading menu data...</div> : error && !formOpen ? <p className="p-6 text-destructive">{error}</p> : <div className="divide-y">{visible.map((item) => { const expanded = openId === item.MenuItemID; return <div key={item.MenuItemID}><button type="button" className="flex w-full items-center gap-4 px-6 py-4 text-left hover:bg-muted/30" onClick={() => setOpenId(expanded ? null : item.MenuItemID)}><ChevronDown className={`transition-transform ${expanded ? 'rotate-180' : ''}`} /><span className="min-w-0 flex-1 font-medium">{item.ItemName}</span><span className="hidden capitalize text-muted-foreground sm:inline">{item.Category}</span><span>{money(item.Price)}</span><Badge variant={status(item) === 'Available' ? 'secondary' : status(item) === 'Unavailable' ? 'outline' : 'destructive'}>{status(item)}</Badge></button>{expanded && <div className="grid gap-5 bg-muted/20 px-6 py-5 md:grid-cols-[1fr_auto]"><div><p className="mb-2 text-sm leading-6 text-muted-foreground">{item.Description || 'No description recorded for this dish.'}</p><div className="flex flex-wrap gap-2">{itemIngredients(item.MenuItemID).map((row) => <Badge variant="outline" key={row.IngredientID}>{row.ingredient?.IngredientName}: {row.QuantityRequiredPerServing} {row.ingredient?.UnitOfMeasure}</Badge>)}</div></div><Button variant="outline" onClick={() => openForm(item)}>Edit</Button></div>}</div>})}</div>}</CardContent></Card>
  </div></DashboardLayout>
}
