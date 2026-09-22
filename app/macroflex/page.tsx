import { DashboardLayout } from '@/app/dashboard-layout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  PackageOpen,
  Sparkles,
  Utensils,
} from 'lucide-react'
import {
  demoMacroFlexData,
  findOverstock,
  getDisplayCheck,
  getDisplaySuggestions,
  isSupabaseConfigured,
  loadMacroFlexData,
  type MacroFlexMenuItem,
} from '@/lib/macroflex'

export const metadata = {
  title: 'MacroFlex | CaterFlex',
  description: 'Inventory sufficiency, over-purchase, and scrap-based menu suggestions.',
}

function formatAmount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function MenuItemCard({ item, data }: { item: MacroFlexMenuItem; data: Awaited<ReturnType<typeof loadMacroFlexData>> }) {
  const check = getDisplayCheck(item.MenuItemID, data)
  const suggestions = check.sufficient ? [] : getDisplaySuggestions(item.MenuItemID, data)

  return (
    <Card className="border-[#d8c9b7] bg-card shadow-sm">
      <CardHeader className="gap-3 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f1dfcf] text-primary">
              <Utensils aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{item.Category}</p>
              <CardTitle className="mt-1 text-lg">{item.ItemName}</CardTitle>
            </div>
          </div>
          <Badge variant={check.sufficient ? 'secondary' : 'destructive'} className="shrink-0 gap-1.5 rounded-full px-3 py-1">
            {check.sufficient ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
            {check.sufficient ? 'Available' : 'Insufficient Stock'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {check.sufficient ? (
          <p className="text-sm text-muted-foreground">All ingredients meet the per-serving requirement.</p>
        ) : (
          <div className="rounded-xl bg-[#fff0eb] p-4">
            <p className="mb-2 text-sm font-semibold text-[#963c31]">Shortfall details</p>
            <ul className="flex flex-col gap-2 text-sm text-[#70433c]">
              {check.shortfalls.map((shortfall) => (
                <li key={shortfall.ingredientName} className="flex items-center justify-between gap-3">
                  <span>{shortfall.ingredientName}</span>
                  <span className="font-medium">Need {formatAmount(shortfall.shortBy)} {shortfall.unit} more</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!check.sufficient && (
          <div className="border-t border-border pt-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="text-primary" aria-hidden="true" /> Suggested alternates
            </div>
            {suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <Badge key={suggestion.MenuItemID} variant="outline" className="gap-1.5 rounded-full px-3 py-1.5">
                    {suggestion.ItemName}<ArrowRight aria-hidden="true" />
                  </Badge>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No complete alternate can be prepared from current stock.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default async function MacroFlexPage() {
  let data = demoMacroFlexData
  let usingDemoData = true
  if (isSupabaseConfigured()) {
    try {
      data = await loadMacroFlexData()
      usingDemoData = false
    } catch {
      data = demoMacroFlexData
    }
  }
  const overstock = findOverstock(data.ingredients)
  const checks = data.menuItems.map((item) => getDisplayCheck(item.MenuItemID, data))
  const availableCount = checks.filter((check) => check.sufficient).length

  return (
    <DashboardLayout>
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Inventory intelligence</p>
            <h1 className="font-heading mt-2 text-4xl font-bold tracking-tight text-foreground">MacroFlex</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">Know what can be prepared today, catch over-purchases early, and turn tira-tira into useful alternatives.</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[#d8c9b7] bg-card px-4 py-3 text-sm shadow-sm">
            <PackageOpen className="text-primary" aria-hidden="true" />
            <span><strong className="text-foreground">{availableCount}</strong> of {data.menuItems.length} menu items ready</span>
          </div>
        </header>

        {overstock.length > 0 && (
          <section aria-labelledby="overstock-title">
            <div className="rounded-2xl border border-[#e6bd82] bg-[#fff5df] p-5 text-[#704b27] shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-[#c77b24]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h2 id="overstock-title" className="font-semibold text-[#704b27]">Over-purchased ingredients</h2>
                  <p className="mt-1 text-sm text-[#8a6337]">These supplies exceed their maximum storage capacity.</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {overstock.map(({ ingredient, exceedsBy }) => (
                      <div key={ingredient.IngredientID} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-sm">
                        <span className="font-medium">{ingredient.IngredientName}</span>
                        <span>+{formatAmount(exceedsBy)} {ingredient.UnitOfMeasure}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <section aria-labelledby="menu-readiness-title" className="flex flex-col gap-4">
          <div>
            <h2 id="menu-readiness-title" className="text-2xl font-semibold text-foreground">Menu readiness</h2>
            <p className="mt-1 text-sm text-muted-foreground">One serving per item. Shortfalls list every ingredient that prevents preparation.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {data.menuItems.map((item) => <MenuItemCard key={item.MenuItemID} item={item} data={data} />)}
          </div>
        </section>

        {usingDemoData && <p className="text-xs text-muted-foreground">Showing demo data until the existing inventory tables are available.</p>}
      </div>
    </DashboardLayout>
  )
}
