import { useState } from "react";
import { useProducts, useUpsertProduct, useDeleteProduct, usePricingSettings, useProductMargins } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
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
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
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
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : !products?.length ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No products yet</TableCell></TableRow>
              ) : (
                products.map((p) => {
                  const oh = settings?.overhead_pct || 0;
                  const lb = settings?.labor_pct || 0;
                  const pm = savedMargins?.[p.id] || 0;
                  const suggested = p.cost_per_unit * (1 + oh / 100 + lb / 100 + pm / 100);
                  const isEditing = editingId === p.id;

                  if (isEditing) {
                    return (
                      <TableRow key={p.id} className="bg-muted/30">
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
                    <TableRow key={p.id}>
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
