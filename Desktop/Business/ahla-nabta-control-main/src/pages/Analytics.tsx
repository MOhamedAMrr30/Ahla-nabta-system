import { useMemo } from "react";
import { useAnalyticsData, useProducts, usePricingSettings, useProductMargins } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Lightbulb, Users, Package } from "lucide-react";
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
}

interface ClientStats {
    clientName: string;
    totalRevenue: number;
    totalOrders: number;
    totalQty: number;
}

const Analytics = () => {
    const { data: analyticsData, isLoading } = useAnalyticsData();
    const { data: products } = useProducts();
    const { data: pricingSettings } = usePricingSettings();
    const { data: savedMargins } = useProductMargins();

    const productStats = useMemo(() => {
        if (!analyticsData?.items || !products) return [];
        const map: Record<string, ProductStats> = {};

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
                };
            }
            map[pid].totalQty += item.quantity;
            map[pid].totalRevenue += Number(item.total_revenue);
            map[pid].totalCost += Number(item.total_cost);
            map[pid].orderCount += 1;
            const sp = Number(item.selling_price_used);
            if (sp < map[pid].minSellingPrice) map[pid].minSellingPrice = sp;
            if (sp > map[pid].maxSellingPrice) map[pid].maxSellingPrice = sp;
        });

        return Object.values(map).map((s) => {
            s.avgSellingPrice = s.totalQty > 0 ? s.totalRevenue / s.totalQty : 0;
            s.margin = s.totalRevenue > 0 ? ((s.totalRevenue - s.totalCost) / s.totalRevenue) * 100 : 0;
            if (s.minSellingPrice === Infinity) s.minSellingPrice = 0;
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
                <p className="text-sm text-muted-foreground mt-1">Sales performance, pricing analysis, and suggestions</p>
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
                        <Card>
                            <CardContent className="pt-4">
                                <p className="text-xs text-muted-foreground">Total Revenue</p>
                                <p className="text-2xl font-bold">{totalRevenue.toFixed(2)}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <p className="text-xs text-muted-foreground">Total Orders</p>
                                <p className="text-2xl font-bold">{analyticsData?.orders?.length || 0}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <p className="text-xs text-muted-foreground">Products Sold</p>
                                <p className="text-2xl font-bold">{productStats.length}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <p className="text-xs text-muted-foreground">Active Clients</p>
                                <p className="text-2xl font-bold">{clientStats.length}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Price Suggestions */}
                    {suggestions.length > 0 && (
                        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Lightbulb className="h-5 w-5 text-amber-500" />Price Suggestions
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {suggestions.map((s, i) => (
                                        <div key={i} className="flex items-start gap-3 text-sm">
                                            {s.type === "increase" ? (
                                                <ArrowUpRight className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                            ) : s.type === "decrease" ? (
                                                <ArrowDownRight className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                            ) : (
                                                <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                            )}
                                            <div>
                                                <span className="font-medium">{s.product}: </span>
                                                <span className="text-muted-foreground">{s.message}</span>
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
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {productStats.map((p) => (
                                        <TableRow key={p.productId}>
                                            <TableCell className="font-medium">{p.name}</TableCell>
                                            <TableCell>{p.orderCount}</TableCell>
                                            <TableCell>{p.totalQty.toFixed(1)} {p.unit}</TableCell>
                                            <TableCell className="font-mono">{p.avgSellingPrice.toFixed(2)}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground font-mono">
                                                {p.minSellingPrice.toFixed(2)} / {p.maxSellingPrice.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="font-bold">{p.totalRevenue.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 bg-muted rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className="bg-primary h-full rounded-full"
                                                            style={{ width: `${totalRevenue > 0 ? (p.totalRevenue / totalRevenue) * 100 : 0}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs">{totalRevenue > 0 ? ((p.totalRevenue / totalRevenue) * 100).toFixed(1) : 0}%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "font-medium",
                                                    p.margin >= 30 ? "text-green-600" : p.margin >= 15 ? "text-yellow-600" : "text-red-500"
                                                )}>
                                                    {p.margin.toFixed(1)}%
                                                </span>
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
                                                    <div className="w-16 bg-muted rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className="bg-primary h-full rounded-full"
                                                            style={{ width: `${totalRevenue > 0 ? (c.totalRevenue / totalRevenue) * 100 : 0}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs">{totalRevenue > 0 ? ((c.totalRevenue / totalRevenue) * 100).toFixed(1) : 0}%</span>
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
                                                    <TableCell className="text-orange-600 font-mono">{cost.toFixed(2)}</TableCell>
                                                    <TableCell>
                                                        <span className={cn(
                                                            "font-medium",
                                                            mg >= 30 ? "text-green-600" : mg >= 15 ? "text-yellow-600" : "text-red-500"
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
