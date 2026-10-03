'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, UtensilsCrossed } from 'lucide-react'
import { DashboardLayout } from '@/app/dashboard-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

type MenuItem = {
  MenuItemID: number
  ItemName: string
  Category: string
  Price: number
  PrepTimeDays: number
  Description: string | null
  Availability?: boolean
}

type Ingredient = {
  IngredientID: number
  IngredientName: string
  UnitOfMeasure: string
  CurrentStock: number | null
  MaxStorageCapacity: number
}

type DishIngredient = {
  DishIngredientID: number
  MenuItemID: number
  IngredientID: number
  QuantityRequiredPerServing: number
}

type IngredientRow = DishIngredient & Ingredient

type MenuStatus = 'available' | 'insufficient' | 'unavailable'

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function getStatus(ingredients: IngredientRow[]): MenuStatus {
  return ingredients.every((ingredient) => (ingredient.CurrentStock ?? 0) >= ingredient.QuantityRequiredPerServing)
    ? 'available'
    : 'insufficient'
}

function StatusBadge({ status }: { status: MenuStatus }) {
  if (status === 'unavailable') return <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200">Unavailable</Badge>
  return status === 'available' ? (
  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Available</Badge>
  ) : (
  <Badge variant="destructive">Insufficient Stock</Badge>
  )
  }

export default function MenuManagementPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [dishIngredients, setDishIngredients] = useState<DishIngredient[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('mains')
  const [editAvailable, setEditAvailable] = useState(true)
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    async function loadMenu() {
      setLoading(true)
      setErrorMessage('')

      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
        setErrorMessage('Supabase is not configured for this environment. Add the project connection in Vercel to load live menu and ingredient data.')
        setLoading(false)
        return
      }

      try {
        const [menuResult, ingredientResult, dishResult] = await Promise.all([
          supabase.from('MENU_ITEM').select('MenuItemID, ItemName, Category, Price, PrepTimeDays, Description, Availability').order('ItemName'),
          supabase.from('INGREDIENT').select('IngredientID, IngredientName, UnitOfMeasure, CurrentStock, MaxStorageCapacity').order('IngredientName'),
          supabase.from('DISH_INGREDIENT').select('DishIngredientID, MenuItemID, IngredientID, QuantityRequiredPerServing').order('DishIngredientID'),
        ])
        const failure = menuResult.error || ingredientResult.error || dishResult.error
        if (failure) {
          throw failure
        }
        // PostgREST can return numeric columns as strings depending on the
        // database schema and client settings. Normalize IDs before joining
        // the three live tables so the ingredient relation is not dropped by
        // strict equality checks.
        setMenuItems((menuResult.data ?? []).map((item) => ({
          ...(item as MenuItem),
          MenuItemID: Number(item.MenuItemID),
          Price: Number(item.Price),
          PrepTimeDays: Number(item.PrepTimeDays),
        })))
        setIngredients((ingredientResult.data ?? []).map((ingredient) => ({
          ...(ingredient as Ingredient),
          IngredientID: Number(ingredient.IngredientID),
          CurrentStock: ingredient.CurrentStock == null ? null : Number(ingredient.CurrentStock),
          MaxStorageCapacity: Number(ingredient.MaxStorageCapacity),
        })))
        setDishIngredients((dishResult.data ?? []).map((relation) => ({
          ...(relation as DishIngredient),
          DishIngredientID: Number(relation.DishIngredientID),
          MenuItemID: Number(relation.MenuItemID),
          IngredientID: Number(relation.IngredientID),
          QuantityRequiredPerServing: Number(relation.QuantityRequiredPerServing),
        })))
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load menu data from Supabase.')
      } finally {
        setLoading(false)
      }
    }
    void loadMenu()
  }, [])

  const rowsByMenuItem = useMemo(() => {
    const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient.IngredientID, ingredient]))
    return new Map(menuItems.map((item) => [
      item.MenuItemID,
      dishIngredients
        .filter((relation) => relation.MenuItemID === item.MenuItemID)
        .flatMap((relation) => {
          const ingredient = ingredientMap.get(relation.IngredientID)
          return ingredient ? [{ ...relation, ...ingredient }] : []
        }),
    ]))
  }, [dishIngredients, ingredients, menuItems])

  const categoryOptions = [
    ['all', 'All Dishes'],
    ['mains', 'Mains'],
    ['appetizers', 'Appetizers'],
    ['sides', 'Sides'],
    ['desserts', 'Desserts'],
    ['beverages', 'Beverages'],
  ] as const
  const visibleMenuItems = categoryFilter === 'all'
    ? menuItems
    : menuItems.filter((item) => item.Category.toLowerCase() === categoryFilter)

  const selectedItem = menuItems.find((item) => item.MenuItemID === selectedId) ?? null
  const selectedRows = selectedItem ? rowsByMenuItem.get((selectedItem as MenuItem).MenuItemID) ?? [] : []
  const selectedStatus = getStatus(selectedRows)
  const missingNames = selectedRows.filter((row) => (row.CurrentStock ?? 0) < row.QuantityRequiredPerServing).map((row) => row.IngredientName)

  const beginEdit = (item: MenuItem) => {
    setEditingId(item.MenuItemID)
    setEditName(item.ItemName)
    setEditCategory(item.Category.toLowerCase())
    setEditAvailable(item.Availability !== false)
  }

  const saveEdit = async (item: MenuItem) => {
    setSavingEdit(true)
    setErrorMessage('')

    const nextName = editName.trim()
    const { error } = await supabase
      .from('MENU_ITEM')
      .update({
        ItemName: nextName,
        Category: editCategory,
        Availability: editAvailable,
      })
      .eq('MenuItemID', item.MenuItemID)

    if (error) {
      setErrorMessage(error.message)
    } else {
      setMenuItems((current) => current.map((entry) => entry.MenuItemID === item.MenuItemID
        ? { ...entry, ItemName: nextName, Category: editCategory, Availability: editAvailable }
        : entry
      ))
      setEditingId(null)
    }

    setSavingEdit(false)
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Owner workspace</p>
            <h1 className="text-3xl font-semibold tracking-tight">Menu Management</h1>
            <p className="mt-1 text-muted-foreground">Review menu availability against current ingredient stock.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><UtensilsCrossed className="size-4" />{menuItems.length} menu items</div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {categoryOptions.map(([value, label]) => (
            <button key={value} type="button" onClick={() => setCategoryFilter(value)} className={`rounded-2xl border-2 p-5 text-left transition-colors ${categoryFilter === value ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40'}`}>
              <span className="text-sm font-medium">{label}</span>
              <span className="mt-3 block text-4xl font-bold">{value === 'all' ? menuItems.length : menuItems.filter((item) => item.Category.toLowerCase() === value).length}</span>
            </button>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle>Menu items</CardTitle><CardDescription>Select an item to inspect its per-serving ingredient requirements.</CardDescription></CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading menu data...</div> : errorMessage ? <div className="p-6 text-sm text-destructive">{errorMessage}</div> : menuItems.length === 0 ? <div className="p-12 text-center text-muted-foreground">No menu items found.</div> : (
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-y bg-muted/40 text-left text-muted-foreground"><tr><th className="px-6 py-3 font-medium">Item</th><th className="px-4 py-3 font-medium">Category</th><th className="px-4 py-3 font-medium">Price</th><th className="px-4 py-3 font-medium">Prep time</th><th className="px-4 py-3 font-medium">Status</th><th className="px-6 py-3" /></tr></thead><tbody>{visibleMenuItems.map((item) => { const status = item.Availability === false ? 'unavailable' : getStatus(rowsByMenuItem.get(item.MenuItemID) ?? []); return (<Fragment key={item.MenuItemID}><tr className="border-b last:border-0 hover:bg-muted/30"><td className="px-6 py-4 font-medium">{item.ItemName}</td><td className="px-4 py-4 capitalize text-muted-foreground">{item.Category}</td><td className="px-4 py-4">{formatPrice(item.Price)}</td><td className="px-4 py-4 text-muted-foreground">{item.PrepTimeDays} {item.PrepTimeDays === 1 ? 'day' : 'days'}</td><td className="px-4 py-4"><StatusBadge status={status} /></td><td className="px-6 py-4 text-right"><Button variant="ghost" size="sm" aria-expanded={selectedId === item.MenuItemID} onClick={() => setSelectedId((current) => current === item.MenuItemID ? null : item.MenuItemID)}>View details<ChevronRight data-icon="inline-end" className={selectedId === item.MenuItemID ? 'rotate-90 transition-transform' : 'transition-transform'} /></Button></td></tr>{selectedId === item.MenuItemID && <tr><td colSpan={6} className="bg-muted/20 px-6 py-5"><div className="flex flex-col gap-4"><div className="flex items-center justify-between"><div><p className="font-semibold">{item.ItemName} details</p><p className="text-sm text-muted-foreground">Ingredients required per serving</p></div><Button variant="outline" size="sm" onClick={() => beginEdit(item)}>Edit</Button></div>{editingId === item.MenuItemID ? <div className="grid gap-3 rounded-lg border border-[#d8c8b5] bg-[#fffaf3] p-4 text-slate-900 md:grid-cols-4"><label className="flex flex-col gap-1 text-sm font-medium">Dish name<input value={editName} onChange={(event) => setEditName(event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-[#c96f4a] focus:ring-2 focus:ring-[#c96f4a]/20" /></label><label className="flex flex-col gap-1 text-sm font-medium">Category<select value={editCategory} onChange={(event) => setEditCategory(event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-[#c96f4a] focus:ring-2 focus:ring-[#c96f4a]/20"><option value="mains">Main</option><option value="appetizers">Appetizers</option><option value="sides">Sides</option><option value="desserts">Dessert</option><option value="beverages">Beverages</option></select></label><label className="flex items-center gap-2 pt-6 text-sm font-medium"><input type="checkbox" checked={editAvailable} onChange={(event) => setEditAvailable(event.target.checked)} /> Available</label><div className="flex items-end gap-2"><Button size="sm" disabled={savingEdit || !editName.trim()} onClick={() => void saveEdit(item)}>{savingEdit ? 'Saving...' : 'Save'}</Button><Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button></div></div> : <div className="overflow-x-auto rounded-md border"><table className="w-full text-sm"><thead className="bg-muted/40 text-left"><tr><th className="px-4 py-2">Ingredient</th><th className="px-4 py-2">Required</th><th className="px-4 py-2">Unit</th><th className="px-4 py-2">Stock</th></tr></thead><tbody>{(rowsByMenuItem.get(item.MenuItemID) ?? []).map((row) => <tr key={row.DishIngredientID} className="border-t"><td className="px-4 py-2">{row.IngredientName}</td><td className="px-4 py-2">{formatNumber(row.QuantityRequiredPerServing)}</td><td className="px-4 py-2">{row.UnitOfMeasure}</td><td className="px-4 py-2">{formatNumber(row.CurrentStock ?? 0)}</td></tr>)}</tbody></table></div>}</div></td></tr>}</Fragment>) })}</tbody></table></div>
            )}
          </CardContent>
        </Card>

        {false && selectedItem && <Card className="scroll-mt-6" id="menu-item-detail"><CardHeader className="border-b"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{(selectedItem as MenuItem).ItemName}</CardTitle><CardDescription className="mt-2 capitalize">{(selectedItem as MenuItem).Category} · {formatPrice((selectedItem as MenuItem).Price)} · {(selectedItem as MenuItem).PrepTimeDays} prep {(selectedItem as MenuItem).PrepTimeDays === 1 ? 'day' : 'days'}</CardDescription></div><Button variant="outline" size="sm" onClick={() => setSelectedId(null)}>Close</Button></div><div className={selectedStatus === 'available' ? 'flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800' : 'flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive'}>{selectedStatus === 'available' ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}<span className="font-medium">{selectedStatus === 'available' ? 'Available' : `Insufficient Stock — missing: ${missingNames.join(', ')}`}</span></div></CardHeader><CardContent className="flex flex-col gap-6 pt-6"><div><p className="mb-1 text-sm font-medium">Description</p><p className="text-sm leading-6 text-muted-foreground">{(selectedItem as MenuItem).Description || 'No description recorded for this item.'}</p></div><div><h3 className="mb-3 text-base font-semibold">Ingredients Required (per serving)</h3>{selectedRows.length === 0 ? <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No ingredients recorded for this item.</div> : <div className="overflow-x-auto rounded-md border"><table className="w-full text-sm"><thead className="bg-muted/40 text-left text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Ingredient Name</th><th className="px-4 py-3 font-medium">Quantity Required</th><th className="px-4 py-3 font-medium">Unit</th><th className="px-4 py-3 font-medium">Current Stock</th><th className="px-4 py-3 font-medium">Status</th></tr></thead><tbody>{selectedRows.map((row) => { const stock = row.CurrentStock ?? 0; const sufficient = stock >= row.QuantityRequiredPerServing; return <tr key={row.DishIngredientID} className="border-t"><td className="px-4 py-3 font-medium">{row.IngredientName}</td><td className="px-4 py-3">{formatNumber(row.QuantityRequiredPerServing)}</td><td className="px-4 py-3 text-muted-foreground">{row.UnitOfMeasure}</td><td className="px-4 py-3">{formatNumber(stock)}</td><td className="px-4 py-3">{sufficient ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Sufficient</Badge> : <Badge variant="destructive">Insufficient · short {formatNumber(row.QuantityRequiredPerServing - stock)} {row.UnitOfMeasure}</Badge>}</td></tr> })}</tbody></table></div>}</div></CardContent></Card>}
      </div>
    </DashboardLayout>
  )
}
