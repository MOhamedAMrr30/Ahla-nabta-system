import { useState, useMemo, useEffect } from "react";
import { useProducts, usePricingSettings, useUpdatePricingSettings, useUpdateProductPricing, useProductMargins, useClients, useUpsertClientPricing } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Save, Calculator, ArrowRight, Users, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

function calcSuggestedPrice(cost: number, overheadPct: number, laborPct: number, profitPct: number): number {
    return cost * (1 + overheadPct / 100 + laborPct / 100 + profitPct / 100);
}

const PriceCalculator = () => {
    const { data: products, isLoading: productsLoading } = useProducts();
    const { data: settings, isLoading: settingsLoading } = usePricingSettings();
    const { data: savedMargins } = useProductMargins();
    const { data: clients } = useClients();
    const updateSettings = useUpdatePricingSettings();
    const updateProductPricing = useUpdateProductPricing();
    const upsertClientPricing = useUpsertClientPricing();

    const [overheadPct, setOverheadPct] = useState("");
    const [laborPct, setLaborPct] = useState("");
    const [productMargins, setProductMargins] = useState<Record<string, string>>({});
    const [applyOpen, setApplyOpen] = useState(false);
    const [applyClientId, setApplyClientId] = useState("");

    // Sync from DB on load
    useEffect(() => {
        if (settings) {
            setOverheadPct(String(settings.overhead_pct ?? 0));
            setLaborPct(String(settings.labor_pct ?? 0));
        }
    }, [settings]);

    // Sync margins from localStorage on load
    useEffect(() => {
        if (products && savedMargins) {
            const map: Record<string, string> = {};
            products.forEach((p) => {
                map[p.id] = String(savedMargins[p.id] ?? 0);
            });
            setProductMargins(map);
        }
    }, [products, savedMargins]);

    const oh = parseFloat(overheadPct) || 0;
    const lb = parseFloat(laborPct) || 0;

    const suggestedPrices = useMemo(() => {
        if (!products) return {};
        const map: Record<string, number> = {};
        products.forEach((p) => {
            const pm = parseFloat(productMargins[p.id] || "0") || 0;
            map[p.id] = calcSuggestedPrice(p.cost_per_unit, oh, lb, pm);
        });
        return map;
    }, [products, oh, lb, productMargins]);

    const handleSaveGlobal = () => {
        updateSettings.mutate(
            { overhead_pct: oh, labor_pct: lb },
            { onSuccess: () => toast({ title: "Global settings saved" }) }
        );
    };

    const handleSaveMargin = (productId: string) => {
        const pm = parseFloat(productMargins[productId] || "0") || 0;
        updateProductPricing.mutate(
            { id: productId, profit_margin_pct: pm },
            { onSuccess: () => toast({ title: "Profit margin saved" }) }
        );
    };

    const handleSaveAllMargins = () => {
        if (!products) return;
        const promises = products.map((p) => {
            const pm = parseFloat(productMargins[p.id] || "0") || 0;
            return updateProductPricing.mutateAsync({ id: p.id, profit_margin_pct: pm });
        });
        Promise.all(promises).then(() => {
            handleSaveGlobal();
            toast({ title: "All pricing saved" });
        });
    };

    const handleApplyToClient = () => {
        if (!applyClientId || !products) {
            toast({ title: "Select a client", variant: "destructive" });
            return;
        }
        const promises = products.map((p) => {
            const price = suggestedPrices[p.id] || 0;
            return upsertClientPricing.mutateAsync({
                client_id: applyClientId,
                product_id: p.id,
                selling_price: Math.round(price * 100) / 100,
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
            const pm = parseFloat(productMargins[p.id] || "0") || 0;
            const suggested = suggestedPrices[p.id] || 0;
            const overheadAmount = p.cost_per_unit * (oh / 100);
            const laborAmount = p.cost_per_unit * (lb / 100);
            const profitAmount = p.cost_per_unit * (pm / 100);
            return {
                "Product": p.name,
                "Product (AR)": p.name_ar || "",
                "Unit": p.unit,
                "Base Cost": Number(p.cost_per_unit.toFixed(2)),
                "Overhead %": oh,
                "Overhead Amount": Number(overheadAmount.toFixed(2)),
                "Labor %": lb,
                "Labor Amount": Number(laborAmount.toFixed(2)),
                "Profit Margin %": pm,
                "Profit Amount": Number(profitAmount.toFixed(2)),
                "Suggested Price": Number(suggested.toFixed(2)),
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        // Auto-size columns
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
                        <Calculator className="h-6 w-6" />
                        Price Calculator
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Base Cost × (1 + Overhead% + Labor% + Profit%) = Selling Price
                    </p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <Users className="mr-2 h-4 w-4" />Apply to Client
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Apply Suggested Prices to Client</DialogTitle></DialogHeader>
                            <p className="text-sm text-muted-foreground">
                                This will set all suggested prices as the selling prices for the selected client.
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
                            <Button variant="outline">
                                <Download className="mr-2 h-4 w-4" />Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                                Export as Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport("csv")}>
                                Export as CSV (.csv)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={handleSaveAllMargins}>
                        <Save className="mr-2 h-4 w-4" />Save All
                    </Button>
                </div>
            </div>

            {/* Global Settings Card */}
            <Card className="mb-6 border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Global Cost Settings (applies to all products)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Overhead %</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.1"
                                value={overheadPct}
                                onChange={(e) => setOverheadPct(e.target.value)}
                                placeholder="e.g. 10"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Rent, utilities, equipment, etc.</p>
                        </div>
                        <div>
                            <Label>Labor %</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.1"
                                value={laborPct}
                                onChange={(e) => setLaborPct(e.target.value)}
                                placeholder="e.g. 15"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Staff wages, salaries, etc.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Product Pricing Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Unit</TableHead>
                                <TableHead>Base Cost</TableHead>
                                <TableHead>Overhead ({oh}%)</TableHead>
                                <TableHead>Labor ({lb}%)</TableHead>
                                <TableHead>Profit Margin %</TableHead>
                                <TableHead className="text-right">Suggested Price</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!products?.length ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                                        No products yet. Add products first.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                products.map((p) => {
                                    const pm = parseFloat(productMargins[p.id] || "0") || 0;
                                    const suggested = suggestedPrices[p.id] || 0;
                                    const overheadAmount = p.cost_per_unit * (oh / 100);
                                    const laborAmount = p.cost_per_unit * (lb / 100);
                                    return (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-medium">
                                                <div>{p.name}</div>
                                                {p.name_ar && <div className="text-xs text-muted-foreground" dir="rtl">{p.name_ar}</div>}
                                            </TableCell>
                                            <TableCell>{p.unit}</TableCell>
                                            <TableCell className="font-mono">{p.cost_per_unit.toFixed(2)}</TableCell>
                                            <TableCell className="text-muted-foreground font-mono">+{overheadAmount.toFixed(2)}</TableCell>
                                            <TableCell className="text-muted-foreground font-mono">+{laborAmount.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.5"
                                                    className="w-20"
                                                    value={productMargins[p.id] || "0"}
                                                    onChange={(e) =>
                                                        setProductMargins({ ...productMargins, [p.id]: e.target.value })
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="text-lg font-bold text-primary">
                                                    {suggested.toFixed(2)}
                                                </span>
                                                <span className="text-xs text-muted-foreground ml-1">/{p.unit}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => handleSaveMargin(p.id)} title="Save this product's margin">
                                                    <Save className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Formula Explanation */}
            {products && products.length > 0 && (
                <Card className="mt-6 bg-muted/30">
                    <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">
                            <strong>Formula:</strong> Selling Price = Base Cost × (1 + {oh}% + {lb}% + Profit%)
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Example: {products[0].name} → {products[0].cost_per_unit.toFixed(2)} × (1 + {(oh / 100).toFixed(2)} + {(lb / 100).toFixed(2)} + {((parseFloat(productMargins[products[0].id] || "0") || 0) / 100).toFixed(2)}) = <strong>{(suggestedPrices[products[0].id] || 0).toFixed(2)}</strong>
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default PriceCalculator;
