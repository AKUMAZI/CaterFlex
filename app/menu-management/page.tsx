'use client'

import { useEffect, useMemo, useState } from 'react'
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

type MenuStatus = 'available' | 'insufficient'

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
          supabase.from('MENU_ITEM').select('MenuItemID, ItemName, Category, Price, PrepTimeDays, Description').order('ItemName'),
          supabase.from('INGREDIENT').select('IngredientID, IngredientName, UnitOfMeasure, CurrentStock, MaxStorageCapacity').order('IngredientName'),
          supabase.from('DISH_INGREDIENT').select('DishIngredientID, MenuItemID, IngredientID, QuantityRequiredPerServing').order('DishIngredientID'),
        ])
        const failure = menuResult.error || ingredientResult.error || dishResult.error
        if (failure) {
          throw failure
        }
        setMenuItems((menuResult.data ?? []) as MenuItem[])
        setIngredients((ingredientResult.data ?? []) as Ingredient[])
        setDishIngredients((dishResult.data ?? []) as DishIngredient[])
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

  const selectedItem = menuItems.find((item) => item.MenuItemID === selectedId) ?? null
  const selectedRows = selectedItem ? rowsByMenuItem.get(selectedItem.MenuItemID) ?? [] : []
  const selectedStatus = getStatus(selectedRows)
  const missingNames = selectedRows.filter((row) => (row.CurrentStock ?? 0) < row.QuantityRequiredPerServing).map((row) => row.IngredientName)

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

        <Card>
          <CardHeader><CardTitle>Menu items</CardTitle><CardDescription>Select an item to inspect its per-serving ingredient requirements.</CardDescription></CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading menu data...</div> : errorMessage ? <div className="p-6 text-sm text-destructive">{errorMessage}</div> : menuItems.length === 0 ? <div className="p-12 text-center text-muted-foreground">No menu items found.</div> : (
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-y bg-muted/40 text-left text-muted-foreground"><tr><th className="px-6 py-3 font-medium">Item</th><th className="px-4 py-3 font-medium">Category</th><th className="px-4 py-3 font-medium">Price</th><th className="px-4 py-3 font-medium">Prep time</th><th className="px-4 py-3 font-medium">Status</th><th className="px-6 py-3" /></tr></thead><tbody>{menuItems.map((item) => { const status = getStatus(rowsByMenuItem.get(item.MenuItemID) ?? []); return <tr key={item.MenuItemID} className="border-b last:border-0 hover:bg-muted/30"><td className="px-6 py-4 font-medium">{item.ItemName}</td><td className="px-4 py-4 capitalize text-muted-foreground">{item.Category}</td><td className="px-4 py-4">{formatPrice(item.Price)}</td><td className="px-4 py-4 text-muted-foreground">{item.PrepTimeDays} {item.PrepTimeDays === 1 ? 'day' : 'days'}</td><td className="px-4 py-4"><StatusBadge status={status} /></td><td className="px-6 py-4 text-right"><Button variant="ghost" size="sm" onClick={() => setSelectedId(item.MenuItemID)}>View details<ChevronRight data-icon="inline-end" /></Button></td></tr> })}</tbody></table></div>
            )}
          </CardContent>
        </Card>

        {selectedItem && <Card className="scroll-mt-6" id="menu-item-detail"><CardHeader className="border-b"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{selectedItem.ItemName}</CardTitle><CardDescription className="mt-2 capitalize">{selectedItem.Category} · {formatPrice(selectedItem.Price)} · {selectedItem.PrepTimeDays} prep {selectedItem.PrepTimeDays === 1 ? 'day' : 'days'}</CardDescription></div><Button variant="outline" size="sm" onClick={() => setSelectedId(null)}>Close</Button></div><div className={selectedStatus === 'available' ? 'flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800' : 'flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive'}>{selectedStatus === 'available' ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}<span className="font-medium">{selectedStatus === 'available' ? 'Available' : `Insufficient Stock — missing: ${missingNames.join(', ')}`}</span></div></CardHeader><CardContent className="flex flex-col gap-6 pt-6"><div><p className="mb-1 text-sm font-medium">Description</p><p className="text-sm leading-6 text-muted-foreground">{selectedItem.Description || 'No description recorded for this item.'}</p></div><div><h3 className="mb-3 text-base font-semibold">Ingredients Required (per serving)</h3>{selectedRows.length === 0 ? <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No ingredients recorded for this item.</div> : <div className="overflow-x-auto rounded-md border"><table className="w-full text-sm"><thead className="bg-muted/40 text-left text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Ingredient Name</th><th className="px-4 py-3 font-medium">Quantity Required</th><th className="px-4 py-3 font-medium">Unit</th><th className="px-4 py-3 font-medium">Current Stock</th><th className="px-4 py-3 font-medium">Status</th></tr></thead><tbody>{selectedRows.map((row) => { const stock = row.CurrentStock ?? 0; const sufficient = stock >= row.QuantityRequiredPerServing; return <tr key={row.DishIngredientID} className="border-t"><td className="px-4 py-3 font-medium">{row.IngredientName}</td><td className="px-4 py-3">{formatNumber(row.QuantityRequiredPerServing)}</td><td className="px-4 py-3 text-muted-foreground">{row.UnitOfMeasure}</td><td className="px-4 py-3">{formatNumber(stock)}</td><td className="px-4 py-3">{sufficient ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Sufficient</Badge> : <Badge variant="destructive">Insufficient · short {formatNumber(row.QuantityRequiredPerServing - stock)} {row.UnitOfMeasure}</Badge>}</td></tr> })}</tbody></table></div>}</div></CardContent></Card>}
      </div>
    </DashboardLayout>
  )
}
