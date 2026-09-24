'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { DashboardLayout } from '@/app/dashboard-layout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  IngredientShortfall,
  OverPurchasedIngredient,
  ScrapSuggestion,
  SufficiencyCheckResult,
} from '@/lib/macroflex'

interface MenuItemWithStatus {
  menuItemId: number
  itemName: string
  category: string
  price: number
  status: 'available' | 'insufficient'
  shortfalls: IngredientShortfall[]
  suggestions: ScrapSuggestion[]
  loadingDetails?: boolean
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export default function MacroFlexPage() {
  const [menuItems, setMenuItems] = useState<MenuItemWithStatus[]>([])
  const [overPurchased, setOverPurchased] = useState<OverPurchasedIngredient[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadMacroFlexData() {
      setLoading(true)
      setErrorMessage('')

      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
        setErrorMessage('Supabase is not configured. Add the project connection in Vercel.')
        setLoading(false)
        return
      }

      try {
        // Fetch all menu items
        const { supabase } = await import('@/lib/supabase')
        const { data: menuData, error: menuError } = await supabase
          .from('MENU_ITEM')
          .select('MenuItemID, ItemName, Category, Price')
          .order('ItemName')

        if (menuError) throw menuError

        // Check over-purchased ingredients
        const overPurchaseRes = await fetch('/api/macroflex/overstock')
        if (!overPurchaseRes.ok) throw new Error('Failed to fetch over-purchase data')
        const { overPurchased: overPurchasedData } = await overPurchaseRes.json()
        setOverPurchased(overPurchasedData)

        // For each menu item, check sufficiency and get suggestions if insufficient
        const itemsWithStatus: MenuItemWithStatus[] = []

        if (menuData) {
          for (const item of menuData) {
            const sufficiencyRes = await fetch(
              `/api/macroflex/check/${item.MenuItemID}`
            )
            if (!sufficiencyRes.ok) throw new Error('Failed to check sufficiency')
            const sufficiencyData: SufficiencyCheckResult = await sufficiencyRes.json()

            let suggestions: ScrapSuggestion[] = []
            if (!sufficiencyData.sufficient && !sufficiencyData.hasNoIngredients) {
              const suggestionsRes = await fetch(
                `/api/macroflex/suggestions/${item.MenuItemID}`
              )
              if (suggestionsRes.ok) {
                const { alternatives } = await suggestionsRes.json()
                suggestions = alternatives
              }
            }

            itemsWithStatus.push({
              menuItemId: item.MenuItemID,
              itemName: item.ItemName,
              category: item.Category,
              price: item.Price,
              status: sufficiencyData.sufficient ? 'available' : 'insufficient',
              shortfalls: sufficiencyData.shortfalls,
              suggestions,
            })
          }
        }

        setMenuItems(itemsWithStatus)
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load MacroFlex data')
      } finally {
        setLoading(false)
      }
    }

    void loadMacroFlexData()
  }, [])

  const availableCount = menuItems.filter((m) => m.status === 'available').length
  const insufficientCount = menuItems.filter((m) => m.status === 'insufficient').length

  return (
    <DashboardLayout>
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">MacroFlex</h1>
          <p className="text-muted-foreground">
            Real-time menu sufficiency analysis against current ingredient inventory.
          </p>
        </div>

        {errorMessage && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="pt-6 text-sm text-destructive">{errorMessage}</CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-12 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading MacroFlex data...
          </div>
        ) : (
          <>
            {/* Menu Availability Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Menu Availability</CardTitle>
                <CardDescription>
                  Real-time status of all menu items based on current ingredient stock.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {menuItems.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">No menu items found.</div>
                ) : (
                  <div className="space-y-4">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Total Items</p>
                        <p className="text-2xl font-semibold">{menuItems.length}</p>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-sm text-emerald-700">Available Now</p>
                        <p className="text-2xl font-semibold text-emerald-900">{availableCount}</p>
                      </div>
                      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                        <p className="text-sm text-destructive">Insufficient</p>
                        <p className="text-2xl font-semibold text-destructive">
                          {insufficientCount}
                        </p>
                      </div>
                    </div>

                    {/* Menu Items Grid */}
                    <div className="mt-6 space-y-3">
                      {menuItems.map((item) => (
                        <div
                          key={item.menuItemId}
                          className="rounded-lg border p-4 hover:bg-muted/30"
                        >
                          <div className="flex items-start justify-between gap-4 sm:items-center">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="font-medium">{item.itemName}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {item.category} · {formatPrice(item.price)}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <Badge
                              className={
                                item.status === 'available'
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                                  : 'bg-red-100 text-red-800 hover:bg-red-100'
                              }
                            >
                              {item.status === 'available' ? (
                                <>
                                  <CheckCircle2 className="mr-1 size-3" />
                                  Available
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="mr-1 size-3" />
                                  Insufficient
                                </>
                              )}
                            </Badge>
                          </div>

                          {/* Shortfalls */}
                          {item.shortfalls.length > 0 && (
                            <div className="mt-4 space-y-2 border-t pt-4">
                              <p className="text-xs font-semibold text-destructive">Missing Ingredients:</p>
                              <div className="space-y-2">
                                {item.shortfalls.map((shortfall, idx) => (
                                  <div
                                    key={idx}
                                    className="rounded-sm border border-destructive/20 bg-destructive/5 p-3 text-sm"
                                  >
                                    <p className="font-medium text-destructive">
                                      {shortfall.ingredientName}
                                    </p>
                                    <p className="text-xs text-destructive/80">
                                      Required: {formatNumber(shortfall.required)} {shortfall.unitOfMeasure} | Available:{' '}
                                      {formatNumber(shortfall.available)} {shortfall.unitOfMeasure} | Short by:{' '}
                                      <span className="font-semibold">
                                        {formatNumber(shortfall.shortBy)} {shortfall.unitOfMeasure}
                                      </span>
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Suggestions */}
                          {item.suggestions.length > 0 && (
                            <div className="mt-4 space-y-2 border-t pt-4">
                              <p className="text-xs font-semibold text-emerald-700">
                                Suggested Alternatives (can prepare now):
                              </p>
                              <div className="space-y-2">
                                {item.suggestions.map((suggestion) => (
                                  <div
                                    key={suggestion.menuItemId}
                                    className="flex items-center justify-between rounded-sm border border-emerald-200 bg-emerald-50 p-3 text-sm"
                                  >
                                    <div>
                                      <p className="font-medium text-emerald-900">
                                        {suggestion.itemName}
                                      </p>
                                      <p className="text-xs text-emerald-700">
                                        {suggestion.category} · {formatPrice(suggestion.price)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Over-Purchased Ingredients */}
            {overPurchased.length > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="text-amber-900">Over-Purchased Ingredients</CardTitle>
                  <CardDescription className="text-amber-800">
                    Ingredients exceeding storage capacity.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {overPurchased.map((ingredient, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-amber-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-amber-900">{ingredient.ingredientName}</p>
                            <p className="text-sm text-amber-800">
                              Current: {formatNumber(ingredient.currentStock)} {ingredient.unitOfMeasure} | Capacity:{' '}
                              {formatNumber(ingredient.maxCapacity)} {ingredient.unitOfMeasure}
                            </p>
                          </div>
                          <Badge variant="destructive" className="whitespace-nowrap">
                            +{formatNumber(ingredient.exceededBy)} over
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
