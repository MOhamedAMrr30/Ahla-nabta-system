import { useState, useCallback } from "react";
import {
  useProducts, useUpsertProduct, useDeleteProduct, usePricingSettings,
  useProductMargins, useProductWeightVariants, useUpdateProductWeightVariants,
  useAutoSave, type WeightVariant, type SaveStatus,
} from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronRight, Zap, Weight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const DEFAULT_WEIGHTS = [0.1, 0.25, 0.5, 1.0];

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving") return <span className="inline-flex items-center gap-1 text-xs text-amber-500"><Loader2 className="h-3 w-3 animate-spin" />Saving…</span>;
  if (status === "saved") return <span className="inline-flex items-center gap-1 text-xs text-green-500"><CheckCircle2 className="h-3 w-3" />Saved</span>;
  if (status === "error") return <span className="text-xs text-red-500">Error saving</span>;
  return null;
}

// Sub-component for Weight Variants
function WeightVariantsPanel({
  productId,
  costPerUnit,
  unit,
}: {
  productId: string;
  costPerUnit: number;
  unit: string;
}) {
  const { data: allVariants } = useProductWeightVariants();
  const updateVariants = useUpdateProductWeightVariants();
  const variants: WeightVariant[] = allVariants?.[productId] || [];

  const [localVariants, setLocalVariants] = useState<WeightVariant[]>(variants);

  // Sync from storage on first load
  useState(() => {
    if (variants.length > 0) setLocalVariants(variants);
  });

  const handleSave = useCallback(async (val: WeightVariant[]) => {
    await updateVariants.mutateAsync({ productId, variants: val });
  }, [productId, updateVariants]);

  const saveStatus = useAutoSave(localVariants, handleSave, 800, localVariants.length > 0);

  const addVariant = () => {
    const next = [...localVariants, { weight: 0.1, price: Math.round(costPerUnit * 0.1 * 100) / 100 }];
    setLocalVariants(next);
  };

  const generateDefaults = () => {
    const generated = DEFAULT_WEIGHTS.map((w) => ({
      weight: w,
      price: Math.round(costPerUnit * w * 100) / 100,
    }));
    setLocalVariants(generated);
  };

  const updateVariant = (idx: number, key: keyof WeightVariant, val: number) => {
    const next = localVariants.map((v, i) => i === idx ? { ...v, [key]: val } : v);
    setLocalVariants(next);
  };

  const removeVariant = (idx: number) => {
    setLocalVariants(localVariants.filter((_, i) => i !== idx));
  };

  return (
    <div className="py-3 px-4 bg-gradient-to-r from-emerald-950/20 to-teal-950/10 border-t border-emerald-900/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Weight className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-emerald-300">Weight Variants</span>
          <SaveIndicator status={saveStatus} />
        </div>
        <div className="flex gap-2">
          {localVariants.length === 0 && (
            <Button variant="outline" size="sm" onClick={generateDefaults} className="h-7 text-xs border-emerald-700 text-emerald-300 hover:bg-emerald-900/30">
              <Zap className="mr-1 h-3 w-3" />Generate Defaults
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={addVariant} className="h-7 text-xs border-emerald-700 text-emerald-300 hover:bg-emerald-900/30">
            <Plus className="mr-1 h-3 w-3" />Add Variant
          </Button>
        </div>
      </div>

      {localVariants.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No weight variants yet. Click "Generate Defaults" or "Add Variant" to create pricing tiers.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {localVariants.map((v, i) => (
            <div key={i} className="flex items-center gap-2 bg-background/40 rounded-lg px-3 py-2 border border-border/30">
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-1">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.1"
                    className="h-7 w-20 text-xs"
                    value={v.weight}
                    onChange={(e) => updateVariant(i, "weight", parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-xs text-muted-foreground">{unit}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    className="h-7 w-20 text-xs"
                    value={v.price}
                    onChange={(e) => updateVariant(i, "price", parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-xs text-muted-foreground">EGP</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeVariant(i)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Products = () => {
  const { data: products, isLoading } = useProducts();
  const upsert = useUpsertProduct();
  const remove = useDeleteProduct();
  const { data: settings } = usePricingSettings();
  const { data: savedMargins } = useProductMargins();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", name_ar: "", unit: "kg", cost_per_unit: "", shelf_life_days: "7" });

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", name_ar: "", unit: "", cost_per_unit: "", shelf_life_days: "" });

  // Expanded weight variants
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSave = () => {
    if (!form.name || !form.cost_per_unit) {
      toast({ title: "Error", description: "Name and cost are required", variant: "destructive" });
      return;
    }
    upsert.mutate(
      { name: form.name, name_ar: form.name_ar || null, unit: form.unit, cost_per_unit: parseFloat(form.cost_per_unit), shelf_life_days: parseInt(form.shelf_life_days) || 7 },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ name: "", name_ar: "", unit: "kg", cost_per_unit: "", shelf_life_days: "7" });
          toast({ title: "Product saved" });
        },
      }
    );
  };

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      name_ar: p.name_ar || "",
      unit: p.unit,
      cost_per_unit: String(p.cost_per_unit),
      shelf_life_days: String(p.shelf_life_days),
    });
  };

  const saveEdit = (id: string) => {
    if (!editForm.name || !editForm.cost_per_unit) {
      toast({ title: "Name and cost required", variant: "destructive" });
      return;
    }
    upsert.mutate(
      { id, name: editForm.name, name_ar: editForm.name_ar || null, unit: editForm.unit, cost_per_unit: parseFloat(editForm.cost_per_unit), shelf_life_days: parseInt(editForm.shelf_life_days) || 7 },
      {
        onSuccess: () => {
          setEditingId(null);
          toast({ title: "Product updated" });
        },
      }
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between mb-4 sm:mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Products</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Product</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name (EN)</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Name (AR)</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} dir="rtl" /></div>
              <div><Label>Unit</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="kg">kg</SelectItem><SelectItem value="pc">pc</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Cost per Unit</Label><Input type="number" min="0" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} /></div>
              <div><Label>Shelf Life (days)</Label><Input type="number" min="1" value={form.shelf_life_days} onChange={(e) => setForm({ ...form, shelf_life_days: e.target.value })} /></div>
              <Button onClick={handleSave} className="w-full" disabled={upsert.isPending}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Arabic</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Cost/Unit</TableHead>
                <TableHead>Profit %</TableHead>
                <TableHead>Suggested Price</TableHead>
                <TableHead>Shelf Life</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : !products?.length ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No products yet</TableCell></TableRow>
              ) : (
                products.map((p) => {
                  const oh = settings?.overhead_pct || 0;
                  const lb = settings?.labor_pct || 0;
                  const pm = savedMargins?.[p.id] || 0;
                  const suggested = p.cost_per_unit * (1 + oh / 100 + lb / 100 + pm / 100);
                  const isEditing = editingId === p.id;
                  const isExpanded = expandedId === p.id;

                  if (isEditing) {
                    return (
                      <TableRow key={p.id} className="bg-muted/30">
                        <TableCell></TableCell>
                        <TableCell><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="h-8 w-32" /></TableCell>
                        <TableCell><Input value={editForm.name_ar} onChange={(e) => setEditForm({ ...editForm, name_ar: e.target.value })} dir="rtl" className="h-8 w-24" /></TableCell>
                        <TableCell>
                          <Select value={editForm.unit} onValueChange={(v) => setEditForm({ ...editForm, unit: v })}>
                            <SelectTrigger className="h-8 w-16"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="kg">kg</SelectItem><SelectItem value="pc">pc</SelectItem></SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Input type="number" min="0" value={editForm.cost_per_unit} onChange={(e) => setEditForm({ ...editForm, cost_per_unit: e.target.value })} className="h-8 w-20" /></TableCell>
                        <TableCell>{pm}%</TableCell>
                        <TableCell className="font-bold text-primary">{suggested.toFixed(2)}</TableCell>
                        <TableCell><Input type="number" min="1" value={editForm.shelf_life_days} onChange={(e) => setEditForm({ ...editForm, shelf_life_days: e.target.value })} className="h-8 w-16" /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEdit(p.id)}>
                              <Check className="h-3 w-3 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                              <X className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return (
                    <>
                      <TableRow key={p.id} className={isExpanded ? "bg-emerald-950/10 border-b-0" : ""}>
                        <TableCell className="w-8 pr-0">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(p.id)}>
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-emerald-400" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell dir="rtl">{p.name_ar || "—"}</TableCell>
                        <TableCell>{p.unit}</TableCell>
                        <TableCell>{p.cost_per_unit}</TableCell>
                        <TableCell>{pm}%</TableCell>
                        <TableCell className="font-bold text-primary">{suggested.toFixed(2)}</TableCell>
                        <TableCell>{p.shelf_life_days} days</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(p)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutate(p.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${p.id}-variants`} className="hover:bg-transparent">
                          <TableCell colSpan={9} className="p-0">
                            <WeightVariantsPanel productId={p.id} costPerUnit={p.cost_per_unit} unit={p.unit} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Products;
