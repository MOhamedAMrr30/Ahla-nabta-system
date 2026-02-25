import { useState, useMemo, useEffect, useCallback } from "react";
import {
    useProducts, usePricingSettings, useUpdatePricingSettings,
    useClients, useUpsertClientPricing,
    useProductWeightVariants, useUpdateProductWeightVariants,
    useAutoSave, type SaveStatus, type WeightVariant,
} from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Save, Calculator, ArrowRight, Users, Download, CheckCircle2, Loader2, Scale } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

function GlobalSaveIndicator({ status }: { status: SaveStatus }) {
    if (status === "saving") return <span className="inline-flex items-center gap-1.5 text-sm text-amber-400"><Loader2 className="h-4 w-4 animate-spin" />Saving…</span>;
    if (status === "saved") return <span className="inline-flex items-center gap-1.5 text-sm text-green-400"><CheckCircle2 className="h-4 w-4" />All changes saved</span>;
    if (status === "error") return <span className="text-sm text-red-500">Error saving</span>;
    return <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 opacity-40" />Up to date</span>;
}

interface ProductPricingRow {
    packSize: string;
    packPrice: string;
    profitMargin: string;
}

const PriceCalculator = () => {
    const { data: products, isLoading: productsLoading } = useProducts();
    const { data: settings, isLoading: settingsLoading } = usePricingSettings();
    const { data: clients } = useClients();
    const { data: weightVariants } = useProductWeightVariants();
    const updateSettings = useUpdatePricingSettings();
    const updateWeightVariants = useUpdateProductWeightVariants();
    const upsertClientPricing = useUpsertClientPricing();

    const [overheadPct, setOverheadPct] = useState("");
    const [laborPct, setLaborPct] = useState("");
    const [pricing, setPricing] = useState<Record<string, ProductPricingRow>>({});
    const [applyOpen, setApplyOpen] = useState(false);
    const [applyClientId, setApplyClientId] = useState("");
    const [initialized, setInitialized] = useState(false);

    const oh = parseFloat(overheadPct) || 0;
    const lb = parseFloat(laborPct) || 0;

    useEffect(() => {
        if (settings) {
            setOverheadPct(String(settings.overhead_pct ?? 0));
            setLaborPct(String(settings.labor_pct ?? 0));
        }
    }, [settings]);

    // Calculate total cost/pack = base_cost × pack_size × (1 + oh% + lb%)
    const getTotalCostPack = (costPerUnit: number, packSize: number) => {
        return costPerUnit * packSize * (1 + oh / 100 + lb / 100);
    };

    // Init pricing rows from saved weight variants
    useEffect(() => {
        if (products && weightVariants) {
            const map: Record<string, ProductPricingRow> = {};
            products.forEach((p) => {
                const variants = weightVariants[p.id];
                if (variants && variants.length > 0) {
                    const v = variants[0];
                    const totalCost = getTotalCostPack(p.cost_per_unit, v.weight);
                    const margin = totalCost > 0
                        ? ((v.price - totalCost) / totalCost) * 100
                        : 0;
                    map[p.id] = {
                        packSize: String(v.weight),
                        packPrice: String(v.price),
                        profitMargin: margin.toFixed(1),
                    };
                } else {
                    const totalCost = getTotalCostPack(p.cost_per_unit, 1);
                    map[p.id] = {
                        packSize: "1",
                        packPrice: totalCost.toFixed(2),
                        profitMargin: "0",
                    };
                }
            });
            setPricing(map);
            setInitialized(true);
        }
    }, [products, weightVariants, oh, lb]);

    // ─── Auto-save global settings ──────────────────────────────────
    const globalVal = useMemo(() => ({ overhead_pct: oh, labor_pct: lb }), [oh, lb]);
    const handleSaveGlobal = useCallback(async (val: { overhead_pct: number; labor_pct: number }) => {
        await updateSettings.mutateAsync(val);
    }, [updateSettings]);
    const globalSaveStatus = useAutoSave(globalVal, handleSaveGlobal, 800, initialized);

    // ─── Auto-save weight variants ──────────────────────────────────
    const pricingForSave = useMemo(() => {
        if (!products) return {};
        const map: Record<string, WeightVariant[]> = {};
        products.forEach((p) => {
            const row = pricing[p.id];
            if (row) {
                const size = parseFloat(row.packSize) || 0;
                const price = parseFloat(row.packPrice) || 0;
                if (size > 0 && price > 0) {
                    map[p.id] = [{ weight: size, price }];
                }
            }
        });
        return map;
    }, [products, pricing]);

    const handleSavePricing = useCallback(async (val: Record<string, WeightVariant[]>) => {
        const promises = Object.entries(val).map(([pid, variants]) =>
            updateWeightVariants.mutateAsync({ productId: pid, variants })
        );
        await Promise.all(promises);
    }, [updateWeightVariants]);
    const pricingSaveStatus = useAutoSave(pricingForSave, handleSavePricing, 1000, initialized);

    const combinedStatus: SaveStatus =
        globalSaveStatus === "saving" || pricingSaveStatus === "saving" ? "saving"
            : globalSaveStatus === "error" || pricingSaveStatus === "error" ? "error"
                : globalSaveStatus === "saved" || pricingSaveStatus === "saved" ? "saved"
                    : "idle";

    // ─── Bidirectional: pack price → recalc margin (based on total cost incl OH+LB) ──
    const handlePackPriceChange = (productId: string, newPrice: string) => {
        const p = products?.find((x) => x.id === productId);
        if (!p) return;
        const row = pricing[productId] || { packSize: "1", packPrice: "0", profitMargin: "0" };
        const size = parseFloat(row.packSize) || 1;
        const price = parseFloat(newPrice) || 0;
        const totalCost = getTotalCostPack(p.cost_per_unit, size);
        const margin = totalCost > 0 ? ((price - totalCost) / totalCost) * 100 : 0;
        setPricing({
            ...pricing,
            [productId]: { ...row, packPrice: newPrice, profitMargin: margin.toFixed(1) },
        });
    };

    // ─── Bidirectional: margin → recalc pack price (based on total cost incl OH+LB) ──
    const handleMarginChange = (productId: string, newMargin: string) => {
        const p = products?.find((x) => x.id === productId);
        if (!p) return;
        const row = pricing[productId] || { packSize: "1", packPrice: "0", profitMargin: "0" };
        const size = parseFloat(row.packSize) || 1;
        const margin = parseFloat(newMargin) || 0;
        const totalCost = getTotalCostPack(p.cost_per_unit, size);
        const price = totalCost * (1 + margin / 100);
        setPricing({
            ...pricing,
            [productId]: { ...row, profitMargin: newMargin, packPrice: price.toFixed(2) },
        });
    };

    // ─── Pack size change → recalc price from current margin ──────
    const handlePackSizeChange = (productId: string, newSize: string) => {
        const p = products?.find((x) => x.id === productId);
        if (!p) return;
        const row = pricing[productId] || { packSize: "1", packPrice: "0", profitMargin: "0" };
        const size = parseFloat(newSize) || 1;
        const margin = parseFloat(row.profitMargin) || 0;
        const totalCost = getTotalCostPack(p.cost_per_unit, size);
        const price = totalCost * (1 + margin / 100);
        setPricing({
            ...pricing,
            [productId]: { packSize: newSize, profitMargin: row.profitMargin, packPrice: price.toFixed(2) },
        });
    };

    // ─── OH/LB change → recalc all pack prices from current margins ──
    const handleOverheadChange = (val: string) => {
        setOverheadPct(val);
        recalcAllPrices(parseFloat(val) || 0, lb);
    };

    const handleLaborChange = (val: string) => {
        setLaborPct(val);
        recalcAllPrices(oh, parseFloat(val) || 0);
    };

    const recalcAllPrices = (newOh: number, newLb: number) => {
        if (!products) return;
        const next = { ...pricing };
        products.forEach((p) => {
            const row = next[p.id];
            if (row) {
                const size = parseFloat(row.packSize) || 1;
                const margin = parseFloat(row.profitMargin) || 0;
                const totalCost = p.cost_per_unit * size * (1 + newOh / 100 + newLb / 100);
                const price = totalCost * (1 + margin / 100);
                next[p.id] = { ...row, packPrice: price.toFixed(2) };
            }
        });
        setPricing(next);
    };

    const calcPricePerKg = (row: ProductPricingRow | undefined) => {
        if (!row) return 0;
        const size = parseFloat(row.packSize) || 0;
        const price = parseFloat(row.packPrice) || 0;
        return size > 0 ? price / size : 0;
    };

    const handleSaveAll = () => {
        updateSettings.mutate({ overhead_pct: oh, labor_pct: lb });
        if (products) {
            products.forEach((p) => {
                const row = pricing[p.id];
                if (row) {
                    const size = parseFloat(row.packSize) || 0;
                    const price = parseFloat(row.packPrice) || 0;
                    if (size > 0 && price > 0) {
                        updateWeightVariants.mutate({ productId: p.id, variants: [{ weight: size, price }] });
                    }
                }
            });
        }
        toast({ title: "All pricing saved" });
    };

    const handleApplyToClient = () => {
        if (!applyClientId || !products) {
            toast({ title: "Select a client", variant: "destructive" });
            return;
        }
        const promises = products.map((p) => {
            const pricePerKg = calcPricePerKg(pricing[p.id]);
            return upsertClientPricing.mutateAsync({
                client_id: applyClientId,
                product_id: p.id,
                selling_price: Math.round(pricePerKg * 100) / 100,
            });
        });
        Promise.all(promises).then(() => {
            setApplyOpen(false);
            setApplyClientId("");
            toast({ title: "Prices applied to client" });
        });
    };

    const handleExport = (format: "xlsx" | "csv") => {
        if (!products || !products.length) {
            toast({ title: "No data to export", variant: "destructive" });
            return;
        }
        const rows = products.map((p) => {
            const row = pricing[p.id];
            const packSize = parseFloat(row?.packSize || "1") || 1;
            const packPrice = parseFloat(row?.packPrice || "0") || 0;
            const margin = parseFloat(row?.profitMargin || "0") || 0;
            const rawCost = p.cost_per_unit * packSize;
            const totalCost = getTotalCostPack(p.cost_per_unit, packSize);
            const pricePerKg = packSize > 0 ? packPrice / packSize : 0;
            return {
                "Product": p.name,
                "Product (AR)": p.name_ar || "",
                "Base Cost/kg": Number(p.cost_per_unit.toFixed(2)),
                "Pack Size (kg)": packSize,
                "Raw Cost/Pack": Number(rawCost.toFixed(2)),
                "Overhead %": oh,
                "Labor %": lb,
                "Total Cost/Pack": Number(totalCost.toFixed(2)),
                "Profit Margin %": margin,
                "Pack Price (EGP)": packPrice,
                "Price/KG": Number(pricePerKg.toFixed(2)),
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const colWidths = Object.keys(rows[0]).map((key) => ({
            wch: Math.max(key.length, ...rows.map((r) => String((r as any)[key]).length)) + 2,
        }));
        ws["!cols"] = colWidths;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Price List");
        const dateStr = new Date().toISOString().split("T")[0];
        const filename = `Ahla_Nabta_Prices_${dateStr}.${format}`;
        XLSX.writeFile(wb, filename, { bookType: format });
        toast({ title: `Exported as ${format.toUpperCase()}`, description: filename });
    };

    const isLoading = productsLoading || settingsLoading;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading pricing data...</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Calculator className="h-6 w-6" />Price Calculator
                    </h1>
                    <div className="flex items-center gap-3 mt-1">
                        <p className="text-sm text-muted-foreground">
                            Overhead + Labor included in cost → then set price or profit margin
                        </p>
                        <GlobalSaveIndicator status={combinedStatus} />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline"><Users className="mr-2 h-4 w-4" />Apply to Client</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Apply Selling Prices to Client</DialogTitle></DialogHeader>
                            <p className="text-sm text-muted-foreground">
                                Sets the Price/KG as the selling price for the selected client.
                            </p>
                            <div>
                                <Label>Client</Label>
                                <Select value={applyClientId} onValueChange={setApplyClientId}>
                                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                                    <SelectContent>
                                        {clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleApplyToClient} className="w-full">
                                <ArrowRight className="mr-2 h-4 w-4" />Apply All Prices
                            </Button>
                        </DialogContent>
                    </Dialog>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline"><Download className="mr-2 h-4 w-4" />Export</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExport("xlsx")}>Export as Excel (.xlsx)</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport("csv")}>Export as CSV (.csv)</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={handleSaveAll}>
                        <Save className="mr-2 h-4 w-4" />Save All
                    </Button>
                </div>
            </div>

            {/* Global Settings */}
            <Card className="mb-6 border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Global Cost Settings (included in Total Cost)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Overhead %</Label>
                            <Input type="number" min="0" step="0.1" value={overheadPct} onChange={(e) => handleOverheadChange(e.target.value)} placeholder="e.g. 10" />
                            <p className="text-xs text-muted-foreground mt-1">Rent, utilities, equipment — added to cost before profit</p>
                        </div>
                        <div>
                            <Label>Labor %</Label>
                            <Input type="number" min="0" step="0.1" value={laborPct} onChange={(e) => handleLaborChange(e.target.value)} placeholder="e.g. 15" />
                            <p className="text-xs text-muted-foreground mt-1">Staff wages, salaries — added to cost before profit</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Pricing Table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Scale className="h-4 w-4" />Size-Based Pricing
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                        Total Cost = Base × Size × (1 + {oh}% + {lb}%). Then set <strong>Pack Price</strong> or <strong>Profit %</strong> — they auto-calculate each other.
                    </p>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Base Cost/kg</TableHead>
                                <TableHead className="text-center bg-emerald-950/20">Pack Size</TableHead>
                                <TableHead className="text-center bg-orange-950/20">
                                    Total Cost/Pack
                                    <div className="text-[10px] font-normal opacity-60">incl. OH {oh}% + LB {lb}%</div>
                                </TableHead>
                                <TableHead className="text-center bg-amber-950/20">Profit %</TableHead>
                                <TableHead className="text-center bg-emerald-950/20">Pack Price</TableHead>
                                <TableHead className="text-right bg-blue-950/20">Price / KG</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!products?.length ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                                        No products yet. Add products first.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                products.map((p) => {
                                    const row = pricing[p.id] || { packSize: "1", packPrice: String(p.cost_per_unit), profitMargin: "0" };
                                    const size = parseFloat(row.packSize) || 1;
                                    const totalCost = getTotalCostPack(p.cost_per_unit, size);
                                    const pricePerKg = calcPricePerKg(row);
                                    const margin = parseFloat(row.profitMargin) || 0;

                                    return (
                                        <TableRow key={p.id}>
                                            <TableCell>
                                                <div className="font-medium">{p.name}</div>
                                                {p.name_ar && <div className="text-xs text-muted-foreground" dir="rtl">{p.name_ar}</div>}
                                            </TableCell>
                                            <TableCell className="font-mono text-muted-foreground">
                                                {p.cost_per_unit.toFixed(2)}
                                            </TableCell>
                                            {/* Pack Size */}
                                            <TableCell className="bg-emerald-950/5">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Input
                                                        type="number" min="0.01" step="0.05"
                                                        className="w-20 text-center"
                                                        value={row.packSize}
                                                        onChange={(e) => handlePackSizeChange(p.id, e.target.value)}
                                                    />
                                                    <span className="text-xs text-muted-foreground">kg</span>
                                                </div>
                                            </TableCell>
                                            {/* Total Cost/Pack (incl OH+LB) — read-only */}
                                            <TableCell className="text-center bg-orange-950/5">
                                                <span className="font-mono font-medium text-orange-400">
                                                    {totalCost.toFixed(2)}
                                                </span>
                                            </TableCell>
                                            {/* Profit Margin % — editable → recalcs Pack Price */}
                                            <TableCell className="bg-amber-950/5">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Input
                                                        type="number" min="-100" step="1"
                                                        className="w-20 text-center"
                                                        value={row.profitMargin}
                                                        onChange={(e) => handleMarginChange(p.id, e.target.value)}
                                                    />
                                                    <span className="text-xs text-muted-foreground">%</span>
                                                </div>
                                            </TableCell>
                                            {/* Pack Price — editable → recalcs Profit % */}
                                            <TableCell className="bg-emerald-950/5">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Input
                                                        type="number" min="0" step="0.5"
                                                        className="w-24 text-center"
                                                        value={row.packPrice}
                                                        onChange={(e) => handlePackPriceChange(p.id, e.target.value)}
                                                    />
                                                    <span className="text-xs text-muted-foreground">EGP</span>
                                                </div>
                                            </TableCell>
                                            {/* Price per KG */}
                                            <TableCell className="text-right bg-blue-950/5">
                                                <span className="text-lg font-bold text-blue-400">
                                                    {pricePerKg.toFixed(2)}
                                                </span>
                                                <span className="text-xs text-muted-foreground ml-1">/kg</span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* How it works */}
            {products && products.length > 0 && (() => {
                const exP = products[0];
                const exRow = pricing[exP.id];
                const exSize = parseFloat(exRow?.packSize || "1") || 1;
                const exRawCost = exP.cost_per_unit * exSize;
                const exTotalCost = getTotalCostPack(exP.cost_per_unit, exSize);
                const exPrice = parseFloat(exRow?.packPrice || "0") || 0;
                const exMargin = parseFloat(exRow?.profitMargin || "0") || 0;
                const exPriceKg = exSize > 0 ? exPrice / exSize : 0;
                return (
                    <Card className="mt-6 bg-muted/30">
                        <CardContent className="pt-4">
                            <p className="text-sm font-medium mb-2">How it works (example: {exP.name}, {exSize} kg pack)</p>
                            <div className="space-y-1.5 text-sm text-muted-foreground">
                                <p><strong>1.</strong> Raw Cost = {exP.cost_per_unit.toFixed(2)} × {exSize} kg = <strong>{exRawCost.toFixed(2)}</strong> EGP</p>
                                <p><strong>2.</strong> + Overhead ({oh}%) + Labor ({lb}%) → <strong className="text-orange-400">Total Cost = {exTotalCost.toFixed(2)}</strong> EGP</p>
                                <p><strong>3.</strong> + Profit ({exMargin}%) → <strong className="text-emerald-400">Pack Price = {exPrice}</strong> EGP</p>
                                <p><strong>4.</strong> Price/KG = {exPrice} ÷ {exSize} = <strong className="text-blue-400">{exPriceKg.toFixed(2)}</strong> EGP/kg</p>
                                <p className="mt-2 text-xs italic">💡 Change Pack Price → margin recalculates. Change Profit % → price recalculates.</p>
                            </div>
                        </CardContent>
                    </Card>
                );
            })()}
        </div>
    );
};

export default PriceCalculator;
