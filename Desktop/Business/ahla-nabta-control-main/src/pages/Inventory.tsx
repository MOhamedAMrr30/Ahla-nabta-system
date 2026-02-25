import { useState, useMemo } from "react";
import { useInventoryBatches, useUpsertBatch, useDeleteBatch, useProducts, useClients, useOrders, useDeductWasteFromOrder } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Store waste-order links in localStorage
const WASTE_LINKS_KEY = "ahla_waste_order_links";
function loadWasteLinks(): Record<string, { clientId: string; clientName: string; orderId: string; orderLabel: string }> {
  try { return JSON.parse(localStorage.getItem(WASTE_LINKS_KEY) || "{}"); } catch { return {}; }
}
function saveWasteLink(batchId: string, link: { clientId: string; clientName: string; orderId: string; orderLabel: string }) {
  const links = loadWasteLinks();
  links[batchId] = link;
  localStorage.setItem(WASTE_LINKS_KEY, JSON.stringify(links));
}

const Inventory = () => {
  const { data: batches, isLoading } = useInventoryBatches();
  const { data: products } = useProducts();
  const { data: clients } = useClients();
  const { data: orders } = useOrders();
  const upsert = useUpsertBatch();
  const remove = useDeleteBatch();
  const deductWaste = useDeductWasteFromOrder();
  const [open, setOpen] = useState(false);

  // Waste links from localStorage
  const wasteLinks = useMemo(() => loadWasteLinks(), [batches]);

  // Add form state
  const [form, setForm] = useState({
    product_id: "", harvest_date: new Date().toISOString().split("T")[0],
    harvested_qty: "", sold_qty: "0",
    damaged_pkg_size: "0.25", damaged_count: "0",
    expired_pkg_size: "0.25", expired_count: "0",
    client_id: "", order_id: "",
    packaging_cost: "0",
  });

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    harvested_qty: "", damaged_qty: "", expired_qty: "",
  });

  const selectedProduct = products?.find((p) => p.id === form.product_id);
  const isKg = selectedProduct?.unit === "kg";

  // Filter orders by selected client
  const clientOrders = useMemo(() => {
    if (!form.client_id || !orders) return [];
    return orders.filter((o: any) => o.client_id === form.client_id);
  }, [form.client_id, orders]);

  const computeWasteQty = (pkgSize: string, count: string, isKgProduct: boolean) => {
    if (isKgProduct) {
      return (parseFloat(pkgSize) || 0) * (parseFloat(count) || 0);
    }
    return parseFloat(count) || 0;
  };

  const handleSave = () => {
    if (!form.product_id || !form.harvested_qty) {
      toast({ title: "Product and harvested qty required", variant: "destructive" });
      return;
    }
    const h = parseFloat(form.harvested_qty);
    const d = computeWasteQty(form.damaged_pkg_size, form.damaged_count, isKg);
    const e = computeWasteQty(form.expired_pkg_size, form.expired_count, isKg);
    if (h < 0 || d < 0 || e < 0) {
      toast({ title: "No negative quantities", variant: "destructive" });
      return;
    }

    const pkgCost = parseFloat(form.packaging_cost) || 0;

    upsert.mutate(
      {
        product_id: form.product_id,
        harvest_date: form.harvest_date,
        harvested_qty: h,
        sold_qty: parseFloat(form.sold_qty) || 0,
        damaged_qty: d,
        expired_qty: e,
        packagingCostPerUnit: pkgCost,
      },
      {
        onSuccess: (_, variables) => {
          const wasteQty = d + e;
          const prodCost = selectedProduct?.cost_per_unit || 0;
          const wasteValue = wasteQty * (prodCost + pkgCost);

          // If linked to an order, deduct waste value from order and payment
          if (form.order_id && wasteValue > 0) {
            const client = clients?.find((c) => c.id === form.client_id);
            const order = clientOrders.find((o: any) => o.id === form.order_id);
            deductWaste.mutate(
              { orderId: form.order_id, wasteValue },
              {
                onSuccess: () => {
                  toast({
                    title: "Waste deducted from order",
                    description: `${wasteValue.toFixed(2)} deducted from order revenue and receivable`,
                  });
                },
              }
            );

            // Save link info for display
            // We use a temporary ID since we don't know the batch ID yet
            // We'll update it on next load
            const tempId = `${form.product_id}_${form.harvest_date}`;
            saveWasteLink(tempId, {
              clientId: form.client_id,
              clientName: client?.name || "",
              orderId: form.order_id,
              orderLabel: order ? `${order.clients?.name} - ${order.delivery_date}` : form.order_id.slice(0, 8),
            });
          }

          setOpen(false);
          setForm({
            product_id: "", harvest_date: new Date().toISOString().split("T")[0],
            harvested_qty: "", sold_qty: "0",
            damaged_pkg_size: "0.25", damaged_count: "0",
            expired_pkg_size: "0.25", expired_count: "0",
            client_id: "", order_id: "",
            packaging_cost: "0",
          });
          toast({ title: "Batch saved" });
        },
      }
    );
  };

  const startEdit = (b: any) => {
    setEditingId(b.id);
    setEditForm({
      harvested_qty: String(b.harvested_qty),
      damaged_qty: String(b.damaged_qty),
      expired_qty: String(b.expired_qty),
    });
  };

  const saveEdit = (b: any) => {
    const h = parseFloat(editForm.harvested_qty) || 0;
    const d = parseFloat(editForm.damaged_qty) || 0;
    const e = parseFloat(editForm.expired_qty) || 0;
    upsert.mutate(
      {
        id: b.id,
        product_id: b.product_id,
        harvest_date: b.harvest_date,
        harvested_qty: h,
        sold_qty: b.sold_qty || 0,
        damaged_qty: d,
        expired_qty: e,
      },
      {
        onSuccess: () => {
          setEditingId(null);
          toast({ title: "Batch updated" });
        },
      }
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between mb-4 sm:mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Inventory & Waste</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Batch</Button></DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader><DialogTitle>Add Batch</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Product</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{products?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.unit})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Harvest Date</Label><Input type="date" value={form.harvest_date} onChange={(e) => setForm({ ...form, harvest_date: e.target.value })} /></div>
              <div><Label>Harvested Qty {isKg ? "(kg)" : "(pcs)"}</Label><Input type="number" min="0" value={form.harvested_qty} onChange={(e) => setForm({ ...form, harvested_qty: e.target.value })} /></div>
              <div><Label>Packaging Cost per Unit</Label><Input type="number" min="0" step="0.01" placeholder="e.g. 2.00" value={form.packaging_cost} onChange={(e) => setForm({ ...form, packaging_cost: e.target.value })} /></div>

              {/* Link to Client & Order */}
              <div className="border rounded-md p-3 space-y-3 bg-muted/20">
                <Label className="text-blue-600 font-medium">Link to Client & Order (optional)</Label>
                <p className="text-xs text-muted-foreground">Select a client and order to deduct waste value from the order amount and receivable.</p>
                <div><Label className="text-xs">Client (Store / Restaurant)</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v, order_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>{clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {form.client_id && (
                  <div><Label className="text-xs">Order</Label>
                    <Select value={form.order_id} onValueChange={(v) => setForm({ ...form, order_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select order" /></SelectTrigger>
                      <SelectContent>
                        {clientOrders.length === 0 && <SelectItem value="none" disabled>No orders for this client</SelectItem>}
                        {clientOrders.map((o: any) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.delivery_date} — {Number(o.total_revenue).toFixed(2)} EGP
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Damaged waste */}
              <div className="border rounded-md p-3 space-y-2">
                <Label className="text-orange-600 font-medium">Damaged</Label>
                {isKg ? (
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Pkg Size (kg)</Label>
                      <Input type="number" min="0.01" step="0.01" value={form.damaged_pkg_size} onChange={(e) => setForm({ ...form, damaged_pkg_size: e.target.value })} />
                    </div>
                    <div className="w-20">
                      <Label className="text-xs">× Count</Label>
                      <Input type="number" min="0" step="1" value={form.damaged_count} onChange={(e) => setForm({ ...form, damaged_count: e.target.value })} />
                    </div>
                    <div className="text-xs text-muted-foreground self-center pt-4">
                      = {computeWasteQty(form.damaged_pkg_size, form.damaged_count, true).toFixed(2)} kg
                    </div>
                  </div>
                ) : (
                  <Input type="number" min="0" placeholder="Count" value={form.damaged_count} onChange={(e) => setForm({ ...form, damaged_count: e.target.value })} />
                )}
              </div>

              {/* Expired waste */}
              <div className="border rounded-md p-3 space-y-2">
                <Label className="text-red-600 font-medium">Expired</Label>
                {isKg ? (
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Pkg Size (kg)</Label>
                      <Input type="number" min="0.01" step="0.01" value={form.expired_pkg_size} onChange={(e) => setForm({ ...form, expired_pkg_size: e.target.value })} />
                    </div>
                    <div className="w-20">
                      <Label className="text-xs">× Count</Label>
                      <Input type="number" min="0" step="1" value={form.expired_count} onChange={(e) => setForm({ ...form, expired_count: e.target.value })} />
                    </div>
                    <div className="text-xs text-muted-foreground self-center pt-4">
                      = {computeWasteQty(form.expired_pkg_size, form.expired_count, true).toFixed(2)} kg
                    </div>
                  </div>
                ) : (
                  <Input type="number" min="0" placeholder="Count" value={form.expired_count} onChange={(e) => setForm({ ...form, expired_count: e.target.value })} />
                )}
              </div>

              {/* Waste deduction preview */}
              {form.order_id && form.product_id && (() => {
                const d = computeWasteQty(form.damaged_pkg_size, form.damaged_count, isKg);
                const e = computeWasteQty(form.expired_pkg_size, form.expired_count, isKg);
                const wasteTotal = d + e;
                const prodCost = selectedProduct?.cost_per_unit || 0;
                const pkgCost = parseFloat(form.packaging_cost) || 0;
                const totalUnitCost = prodCost + pkgCost;
                const deduction = wasteTotal * totalUnitCost;
                if (deduction <= 0) return null;
                return (
                  <div className="border border-red-300 rounded-md p-3 bg-red-50 dark:bg-red-950/20">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">
                      ⚠️ {deduction.toFixed(2)} EGP will be deducted from the selected order and receivable
                    </p>
                    <p className="text-xs text-red-500 mt-1">
                      Waste: {wasteTotal.toFixed(2)} {isKg ? "kg" : "pcs"} × ({prodCost.toFixed(2)} product + {pkgCost.toFixed(2)} packaging) = {deduction.toFixed(2)}
                    </p>
                  </div>
                );
              })()}

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
                <TableHead>Product</TableHead>
                <TableHead>Harvest Date</TableHead>
                <TableHead>Harvested</TableHead>
                <TableHead>Damaged</TableHead>
                <TableHead>Expired</TableHead>
                <TableHead>Linked To</TableHead>
                <TableHead>Waste %</TableHead>
                <TableHead>Waste Value</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : !batches?.length ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No batches yet</TableCell></TableRow>
              ) : (
                batches.map((b: any) => {
                  const isEditing = editingId === b.id;
                  const link = wasteLinks[b.id] || wasteLinks[`${b.product_id}_${b.harvest_date}`];

                  if (isEditing) {
                    return (
                      <TableRow key={b.id} className="bg-muted/30">
                        <TableCell className="font-medium">{b.products?.name}</TableCell>
                        <TableCell>{b.harvest_date}</TableCell>
                        <TableCell><Input type="number" min="0" value={editForm.harvested_qty} onChange={(e) => setEditForm({ ...editForm, harvested_qty: e.target.value })} className="h-8 w-20" /></TableCell>
                        <TableCell><Input type="number" min="0" value={editForm.damaged_qty} onChange={(e) => setEditForm({ ...editForm, damaged_qty: e.target.value })} className="h-8 w-20" /></TableCell>
                        <TableCell><Input type="number" min="0" value={editForm.expired_qty} onChange={(e) => setEditForm({ ...editForm, expired_qty: e.target.value })} className="h-8 w-20" /></TableCell>
                        <TableCell>{link ? link.clientName : "—"}</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEdit(b)}>
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
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.products?.name}</TableCell>
                      <TableCell>{b.harvest_date}</TableCell>
                      <TableCell>{b.harvested_qty}</TableCell>
                      <TableCell>{b.damaged_qty}</TableCell>
                      <TableCell>{b.expired_qty}</TableCell>
                      <TableCell>
                        {link ? (
                          <span className="text-xs text-blue-600">{link.clientName}<br />{link.orderLabel}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "font-semibold",
                          Number(b.waste_percentage) > 10 ? "text-margin-red" : Number(b.waste_percentage) > 5 ? "text-margin-yellow" : "text-margin-green"
                        )}>
                          {Number(b.waste_percentage).toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>{Number(b.waste_value).toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(b)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutate(b.id)}>
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

export default Inventory;
