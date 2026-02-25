import { useMemo } from "react";
import { useAnalyticsData, useProducts, usePricingSettings, useProductMargins, useProductWeightVariants } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Lightbulb, Users, Package, Weight, AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductStats {
    productId: string;
    name: string;
    unit: string;
    baseCost: number;
    totalQty: number;
    totalRevenue: number;
    totalCost: number;
    orderCount: number;
    avgSellingPrice: number;
    minSellingPrice: number;
    maxSellingPrice: number;
    margin: number;
    // Trend data
    recentRevenue: number;
    previousRevenue: number;
    trendPct: number;
}

interface ClientStats {
    clientName: string;
    totalRevenue: number;
    totalOrders: number;
    totalQty: number;
}

interface StockRecommendation {
    product: string;
    type: "increase" | "decrease" | "stable";
    message: string;
    velocity: number; // units per day
}

const Analytics = () => {
    const { data: analyticsData, isLoading } = useAnalyticsData();
    const { data: products } = useProducts();
    const { data: pricingSettings } = usePricingSettings();
    const { data: savedMargins } = useProductMargins();
    const { data: weightVariants } = useProductWeightVariants();

    const productStats = useMemo(() => {
        if (!analyticsData?.items || !products) return [];
        const map: Record<string, ProductStats> = {};

        // Calculate date boundaries for trend analysis
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const fourteenDaysAgo = new Date(now);
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        analyticsData.items.forEach((item: any) => {
            const pid = item.product_id;
            const prod = item.products;
            if (!prod) return;

            if (!map[pid]) {
                map[pid] = {
                    productId: pid,
                    name: prod.name,
                    unit: prod.unit,
                    baseCost: prod.cost_per_unit,
                    totalQty: 0,
                    totalRevenue: 0,
                    totalCost: 0,
                    orderCount: 0,
                    avgSellingPrice: 0,
                    minSellingPrice: Infinity,
                    maxSellingPrice: 0,
                    margin: 0,
                    recentRevenue: 0,
                    previousRevenue: 0,
                    trendPct: 0,
                };
            }
            map[pid].totalQty += item.quantity;
            map[pid].totalRevenue += Number(item.total_revenue);
            map[pid].totalCost += Number(item.total_cost);
            map[pid].orderCount += 1;
            const sp = Number(item.selling_price_used);
            if (sp < map[pid].minSellingPrice) map[pid].minSellingPrice = sp;
            if (sp > map[pid].maxSellingPrice) map[pid].maxSellingPrice = sp;

            // Trend tracking
            const orderDate = new Date(item.orders?.order_date || "");
            if (orderDate >= sevenDaysAgo) {
                map[pid].recentRevenue += Number(item.total_revenue);
            } else if (orderDate >= fourteenDaysAgo) {
                map[pid].previousRevenue += Number(item.total_revenue);
            }
        });

        return Object.values(map).map((s) => {
            s.avgSellingPrice = s.totalQty > 0 ? s.totalRevenue / s.totalQty : 0;
            s.margin = s.totalRevenue > 0 ? ((s.totalRevenue - s.totalCost) / s.totalRevenue) * 100 : 0;
            if (s.minSellingPrice === Infinity) s.minSellingPrice = 0;
            // Calculate trend percentage
            s.trendPct = s.previousRevenue > 0
                ? ((s.recentRevenue - s.previousRevenue) / s.previousRevenue) * 100
                : s.recentRevenue > 0 ? 100 : 0;
            return s;
        }).sort((a, b) => b.totalRevenue - a.totalRevenue);
    }, [analyticsData, products]);

    const clientStats = useMemo(() => {
        if (!analyticsData?.items) return [];
        const map: Record<string, ClientStats> = {};

        analyticsData.items.forEach((item: any) => {
            const clientName = item.orders?.clients?.name || "Unknown";
            const clientId = item.orders?.client_id || "unknown";

            if (!map[clientId]) {
                map[clientId] = { clientName, totalRevenue: 0, totalOrders: 0, totalQty: 0 };
            }
            map[clientId].totalRevenue += Number(item.total_revenue);
            map[clientId].totalQty += item.quantity;
        });

        // Count unique orders per client
        analyticsData.orders?.forEach((o: any) => {
            const clientId = o.client_id;
            if (map[clientId]) {
                map[clientId].totalOrders += 1;
            }
        });

        return Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue);
    }, [analyticsData]);

    const totalRevenue = productStats.reduce((s, p) => s + p.totalRevenue, 0);

    // ─── Stock Recommendations ──────────────────────────────────────────
    const stockRecommendations = useMemo((): StockRecommendation[] => {
        if (!productStats.length || !analyticsData?.orders?.length) return [];
        const recs: StockRecommendation[] = [];

        // Calculate the date range of orders
        const dates = analyticsData.orders.map((o: any) => new Date(o.order_date).getTime());
        const daySpan = Math.max(1, (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24));

        productStats.forEach((p) => {
            const velocity = p.totalQty / daySpan; // units per day

            if (p.orderCount >= 3 && velocity > 2) {
                recs.push({
                    product: p.name,
                    type: "increase",
                    message: `High demand — ${velocity.toFixed(1)} ${p.unit}/day avg across ${p.orderCount} orders. Consider increasing stock.`,
                    velocity,
                });
            } else if (p.orderCount <= 1 && velocity < 0.5) {
                recs.push({
                    product: p.name,
                    type: "decrease",
                    message: `Low movement — only ${p.totalQty.toFixed(1)} ${p.unit} sold in ${p.orderCount} order(s). Consider reducing stock to avoid waste.`,
                    velocity,
                });
            } else {
                recs.push({
                    product: p.name,
                    type: "stable",
                    message: `Steady demand — ${velocity.toFixed(1)} ${p.unit}/day. Stock levels are appropriate.`,
                    velocity,
                });
            }
        });

        return recs.sort((a, b) => {
            const order = { increase: 0, decrease: 1, stable: 2 };
            return order[a.type] - order[b.type];
        });
    }, [productStats, analyticsData]);

    // ─── Weight Variant Sales Summary ────────────────────────────────────
    const weightVariantSummary = useMemo(() => {
        if (!weightVariants || !productStats.length) return [];
        return productStats
            .filter((p) => weightVariants[p.productId]?.length > 0)
            .map((p) => ({
                name: p.name,
                unit: p.unit,
                variants: weightVariants[p.productId],
                totalRevenue: p.totalRevenue,
                avgPrice: p.avgSellingPrice,
            }))
            .slice(0, 6);
    }, [weightVariants, productStats]);

    const suggestions = useMemo(() => {
        if (!productStats.length) return [];
        const oh = pricingSettings?.overhead_pct || 0;
        const lb = pricingSettings?.labor_pct || 0;
        const tips: { product: string; type: "increase" | "decrease" | "info"; message: string }[] = [];

        productStats.forEach((p) => {
            const pm = savedMargins?.[p.productId] || 0;
            const suggestedPrice = p.baseCost * (1 + oh / 100 + lb / 100 + pm / 100);

            // High volume but low margin → suggest price increase
            if (p.orderCount >= 3 && p.margin < 25) {
                tips.push({
                    product: p.name,
                    type: "increase",
                    message: `High demand (${p.orderCount} orders) but low margin (${p.margin.toFixed(1)}%). Consider raising price from avg ${p.avgSellingPrice.toFixed(2)} → ${(p.avgSellingPrice * 1.1).toFixed(2)}`,
                });
            }
            // Low volume with high margin → suggest price decrease
            else if (p.orderCount <= 1 && p.margin > 40) {
                tips.push({
                    product: p.name,
                    type: "decrease",
                    message: `Low demand (${p.orderCount} orders) with high margin (${p.margin.toFixed(1)}%). Consider lowering price to boost sales.`,
                });
            }
            // Big price spread across clients
            if (p.maxSellingPrice > 0 && p.minSellingPrice > 0) {
                const spread = ((p.maxSellingPrice - p.minSellingPrice) / p.minSellingPrice) * 100;
                if (spread > 20) {
                    tips.push({
                        product: p.name,
                        type: "info",
                        message: `Price varies ${spread.toFixed(0)}% across clients (${p.minSellingPrice.toFixed(2)} → ${p.maxSellingPrice.toFixed(2)}). Consider standardizing.`,
                    });
                }
            }
            // Avg selling price below suggested
            if (suggestedPrice > 0 && p.avgSellingPrice > 0 && p.avgSellingPrice < suggestedPrice * 0.9) {
                tips.push({
                    product: p.name,
                    type: "increase",
                    message: `Avg selling price (${p.avgSellingPrice.toFixed(2)}) is below suggested (${suggestedPrice.toFixed(2)}). You may be underpricing.`,
                });
            }
        });

        return tips;
    }, [productStats, pricingSettings, savedMargins]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading analytics...</p>
            </div>
        );
    }

    const hasData = productStats.length > 0;

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <BarChart3 className="h-6 w-6" />Analytics
                </h1>
                <p className="text-sm text-muted-foreground mt-1">Sales performance, pricing analysis, stock recommendations, and actionable insights</p>
            </div>

            {!hasData ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <BarChart3 className="mx-auto h-12 w-12 mb-4 opacity-30" />
                        <p className="text-lg font-medium">No order data yet</p>
                        <p className="text-sm">Create some orders first, then come back for analytics.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/60 dark:to-blue-800/30 border-blue-300 dark:border-blue-500/40">
                            <CardContent className="pt-4">
                                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Total Revenue</p>
                                <p className="text-2xl font-bold text-blue-900 dark:text-white">{totalRevenue.toFixed(2)}</p>
                                <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">EGP</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/60 dark:to-purple-800/30 border-purple-300 dark:border-purple-500/40">
                            <CardContent className="pt-4">
                                <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">Total Orders</p>
                                <p className="text-2xl font-bold text-purple-900 dark:text-white">{analyticsData?.orders?.length || 0}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/60 dark:to-emerald-800/30 border-emerald-300 dark:border-emerald-500/40">
                            <CardContent className="pt-4">
                                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Products Sold</p>
                                <p className="text-2xl font-bold text-emerald-900 dark:text-white">{productStats.length}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/60 dark:to-amber-800/30 border-amber-300 dark:border-amber-500/40">
                            <CardContent className="pt-4">
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Active Clients</p>
                                <p className="text-2xl font-bold text-amber-900 dark:text-white">{clientStats.length}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Stock Recommendations */}
                    {stockRecommendations.length > 0 && (
                        <Card className="border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/20">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Package className="h-5 w-5 text-sky-600 dark:text-sky-300" />Stock Recommendations
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {stockRecommendations.filter(r => r.type !== "stable").map((rec, i) => (
                                        <div key={i} className={cn(
                                            "rounded-lg p-3 border text-sm",
                                            rec.type === "increase" ? "bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-500/40" :
                                                rec.type === "decrease" ? "bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-500/40" :
                                                    "bg-muted/30 border-border/40"
                                        )}>
                                            <div className="flex items-center gap-2 mb-1">
                                                {rec.type === "increase" ? (
                                                    <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-300" />
                                                ) : rec.type === "decrease" ? (
                                                    <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-300" />
                                                ) : (
                                                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                                                )}
                                                <span className="font-medium text-foreground">{rec.product}</span>
                                            </div>
                                            <p className="text-xs text-gray-700 dark:text-gray-200">{rec.message}</p>
                                        </div>
                                    ))}
                                </div>
                                {stockRecommendations.filter(r => r.type === "stable").length > 0 && (
                                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-3 flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        {stockRecommendations.filter(r => r.type === "stable").length} products with stable stock levels
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Price Suggestions */}
                    {suggestions.length > 0 && (
                        <Card className="border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />Price Suggestions
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {suggestions.map((s, i) => (
                                        <div key={i} className="flex items-start gap-3 text-sm">
                                            {s.type === "increase" ? (
                                                <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                            ) : s.type === "decrease" ? (
                                                <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                            ) : (
                                                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                            )}
                                            <div>
                                                <span className="font-medium text-foreground">{s.product}: </span>
                                                <span className="text-gray-700 dark:text-gray-200">{s.message}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Weight Variant Pricing Overview */}
                    {weightVariantSummary.length > 0 && (
                        <Card className="border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Weight className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />Weight Variant Pricing
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {weightVariantSummary.map((item, i) => (
                                        <div key={i} className="rounded-lg p-3 bg-white dark:bg-background/50 border border-emerald-200 dark:border-border/40">
                                            <p className="font-medium text-sm mb-2 text-foreground">{item.name}</p>
                                            <div className="space-y-1">
                                                {item.variants.map((v, vi) => (
                                                    <div key={vi} className="flex justify-between items-center text-xs">
                                                        <span className="text-gray-600 dark:text-gray-300">{v.weight} {item.unit}</span>
                                                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-200">{v.price.toFixed(2)} EGP</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-border/40">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-600 dark:text-gray-300">Avg selling price</span>
                                                    <span className="font-mono text-foreground font-medium">{item.avgPrice.toFixed(2)} EGP/{item.unit}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Product Sales Volume */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Package className="h-5 w-5" />Product Sales Performance
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Orders</TableHead>
                                        <TableHead>Total Qty</TableHead>
                                        <TableHead>Avg Price</TableHead>
                                        <TableHead>Min / Max</TableHead>
                                        <TableHead>Revenue</TableHead>
                                        <TableHead>Share</TableHead>
                                        <TableHead>Margin</TableHead>
                                        <TableHead>Trend</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {productStats.map((p) => (
                                        <TableRow key={p.productId}>
                                            <TableCell className="font-medium">{p.name}</TableCell>
                                            <TableCell>{p.orderCount}</TableCell>
                                            <TableCell>{p.totalQty.toFixed(1)} {p.unit}</TableCell>
                                            <TableCell className="font-mono">{p.avgSellingPrice.toFixed(2)}</TableCell>
                                            <TableCell className="text-xs text-gray-600 dark:text-gray-300 font-mono">
                                                {p.minSellingPrice.toFixed(2)} / {p.maxSellingPrice.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="font-bold">{p.totalRevenue.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 bg-muted rounded-full h-2.5 overflow-hidden">
                                                        <div
                                                            className={cn(
                                                                "h-full rounded-full transition-all",
                                                                (p.totalRevenue / totalRevenue) * 100 > 15
                                                                    ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                                                                    : (p.totalRevenue / totalRevenue) * 100 > 5
                                                                        ? "bg-gradient-to-r from-blue-500 to-blue-400"
                                                                        : "bg-gradient-to-r from-slate-500 to-slate-400"
                                                            )}
                                                            style={{ width: `${totalRevenue > 0 ? (p.totalRevenue / totalRevenue) * 100 : 0}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-foreground">{totalRevenue > 0 ? ((p.totalRevenue / totalRevenue) * 100).toFixed(1) : 0}%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "font-medium",
                                                    p.margin >= 30 ? "text-green-700 dark:text-green-400" : p.margin >= 15 ? "text-yellow-700 dark:text-yellow-400" : "text-red-600 dark:text-red-400"
                                                )}>
                                                    {p.margin.toFixed(1)}%
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {p.trendPct !== 0 ? (
                                                    <div className={cn(
                                                        "inline-flex items-center gap-0.5 text-xs font-medium rounded-full px-2 py-0.5",
                                                        p.trendPct > 0
                                                            ? "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                                                            : "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                                                    )}>
                                                        {p.trendPct > 0 ? (
                                                            <TrendingUp className="h-3 w-3" />
                                                        ) : (
                                                            <TrendingDown className="h-3 w-3" />
                                                        )}
                                                        {Math.abs(p.trendPct).toFixed(0)}%
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">—</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Top Clients */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Users className="h-5 w-5" />Top Clients
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Client</TableHead>
                                        <TableHead>Orders</TableHead>
                                        <TableHead>Total Qty</TableHead>
                                        <TableHead>Total Revenue</TableHead>
                                        <TableHead>Share</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {clientStats.map((c) => (
                                        <TableRow key={c.clientName}>
                                            <TableCell className="font-medium">{c.clientName}</TableCell>
                                            <TableCell>{c.totalOrders}</TableCell>
                                            <TableCell>{c.totalQty.toFixed(1)}</TableCell>
                                            <TableCell className="font-bold">{c.totalRevenue.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 bg-muted rounded-full h-2.5 overflow-hidden">
                                                        <div
                                                            className="bg-gradient-to-r from-primary to-primary/70 h-full rounded-full"
                                                            style={{ width: `${totalRevenue > 0 ? (c.totalRevenue / totalRevenue) * 100 : 0}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-foreground">{totalRevenue > 0 ? ((c.totalRevenue / totalRevenue) * 100).toFixed(1) : 0}%</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Current Client Pricing Overview */}
                    {analyticsData?.pricing && analyticsData.pricing.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5" />Current Client Prices
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Client</TableHead>
                                            <TableHead>Product</TableHead>
                                            <TableHead>Selling Price</TableHead>
                                            <TableHead>Base Cost</TableHead>
                                            <TableHead>Margin</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {analyticsData.pricing.map((p: any) => {
                                            const cost = p.products?.cost_per_unit || 0;
                                            const sp = Number(p.selling_price);
                                            const mg = sp > 0 ? ((sp - cost) / sp) * 100 : 0;
                                            return (
                                                <TableRow key={p.id}>
                                                    <TableCell>{p.clients?.name}</TableCell>
                                                    <TableCell>{p.products?.name} ({p.products?.unit})</TableCell>
                                                    <TableCell className="font-mono">{sp.toFixed(2)}</TableCell>
                                                    <TableCell className="text-orange-600 dark:text-orange-400 font-mono">{cost.toFixed(2)}</TableCell>
                                                    <TableCell>
                                                        <span className={cn(
                                                            "font-medium",
                                                            mg >= 30 ? "text-green-700 dark:text-green-400" : mg >= 15 ? "text-yellow-700 dark:text-yellow-400" : "text-red-600 dark:text-red-400"
                                                        )}>{mg.toFixed(1)}%</span>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
};

export default Analytics;
