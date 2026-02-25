import { useState, useMemo } from "react";
import { useClients, useProducts, useClientPricing, useUpsertClientPricing, useDeleteClientPricing, usePricingHistory, usePricingSettings, useProductMargins } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, History, Lightbulb, Pencil, Check, X, Users, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const Pricing = () => {
  const { data: clients } = useClients();
  const { data: products } = useProducts();
  const { data: pricing, isLoading } = useClientPricing();
  const { data: pricingSettings } = usePricingSettings();
  const { data: savedMargins } = useProductMargins();
  const upsert = useUpsertClientPricing();
  const removePricing = useDeleteClientPricing();
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyClientId, setHistoryClientId] = useState("");
  const [historyProductId, setHistoryProductId] = useState("");
  const { data: history } = usePricingHistory(historyClientId, historyProductId);

  // Single client form
  const [form, setForm] = useState({ client_id: "", product_id: "", selling_price: "", package_size: "" });

  // Multi-client form
  const [multiOpen, setMultiOpen] = useState(false);
  const [multiForm, setMultiForm] = useState({ product_id: "", selling_price: "", package_size: "" });
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");

  // Expanded clients
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const getSelectedProduct = (pid: string) => products?.find((p) => p.id === pid);

  const computePrice = (basePrice: string, packageSize: string, product: any) => {
    return parseFloat(basePrice) || 0;
  };

  // Group pricing by client
  const groupedPricing = useMemo(() => {
    if (!pricing) return [];
    const groups: Record<string, { clientId: string; clientName: string; items: any[] }> = {};
    pricing.forEach((p: any) => {
      const cid = p.client_id;
      const cname = p.clients?.name || "Unknown";
      if (!groups[cid]) groups[cid] = { clientId: cid, clientName: cname, items: [] };
      groups[cid].items.push(p);
    });
    return Object.values(groups).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [pricing]);

  const toggleExpand = (clientId: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const handleSave = () => {
    if (!form.client_id || !form.product_id || !form.selling_price) {
      toast({ title: "All fields required", variant: "destructive" });
      return;
    }
    const prod = getSelectedProduct(form.product_id);
    const perUnitPrice = computePrice(form.selling_price, form.package_size, prod);
    upsert.mutate(
      { client_id: form.client_id, product_id: form.product_id, selling_price: perUnitPrice },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ client_id: "", product_id: "", selling_price: "", package_size: "" });
          toast({ title: "Price saved" });
        },
      }
    );
  };

  const handleMultiSave = () => {
    if (!selectedClients.length || !multiForm.product_id || !multiForm.selling_price) {
      toast({ title: "Select clients, product, and price", variant: "destructive" });
      return;
    }
    const prod = getSelectedProduct(multiForm.product_id);
    const perUnitPrice = computePrice(multiForm.selling_price, multiForm.package_size, prod);

    let completed = 0;
    selectedClients.forEach((cid) => {
      upsert.mutate(
        { client_id: cid, product_id: multiForm.product_id, selling_price: perUnitPrice },
        {
          onSuccess: () => {
            completed++;
            if (completed === selectedClients.length) {
              setMultiOpen(false);
              setSelectedClients([]);
              setMultiForm({ product_id: "", selling_price: "", package_size: "" });
              toast({ title: `Price set for ${completed} clients` });
            }
          },
        }
      );
    });
  };

  const handleInlineEdit = (id: string, clientId: string, productId: string) => {
    upsert.mutate(
      { client_id: clientId, product_id: productId, selling_price: parseFloat(editPrice) },
      {
        onSuccess: () => {
          setEditingId(null);
          toast({ title: "Price updated" });
        },
      }
    );
  };

  const showHistory = (clientId: string, productId: string) => {
    setHistoryClientId(clientId);
    setHistoryProductId(productId);
    setHistoryOpen(true);
  };

  const toggleClient = (id: string) => {
    setSelectedClients((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between mb-4 sm:mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Client Pricing</h1>
        <div className="flex flex-wrap gap-2">
          {/* Multi-client pricing button */}
          <Dialog open={multiOpen} onOpenChange={setMultiOpen}>
            <DialogTrigger asChild><Button variant="outline"><Users className="mr-2 h-4 w-4" />Set for Multiple Clients</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Set Price for Multiple Clients</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Select Clients</Label>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2 mt-1">
                    {clients?.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted p-1 rounded">
                        <Checkbox
                          checked={selectedClients.includes(c.id)}
                          onCheckedChange={() => toggleClient(c.id)}
                        />
                        <span className="text-sm">{c.name}</span>
                      </label>
                    ))}
                  </div>
                  {selectedClients.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{selectedClients.length} client(s) selected</p>
                  )}
                </div>
                <div><Label>Product</Label>
                  <Select value={multiForm.product_id} onValueChange={(v) => setMultiForm({ ...multiForm, product_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>{products?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.unit})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {multiForm.product_id && getSelectedProduct(multiForm.product_id)?.unit === "kg" && (
                  <div><Label>Package Size (kg)</Label>
                    <Input type="number" min="0.01" step="0.01" placeholder="e.g. 0.1" value={multiForm.package_size} onChange={(e) => setMultiForm({ ...multiForm, package_size: e.target.value })} />
                    <p className="text-xs text-muted-foreground mt-1">Enter the package weight. Price will be per this package.</p>
                  </div>
                )}
                <div>
                  <Label>{multiForm.package_size && getSelectedProduct(multiForm.product_id)?.unit === "kg" ? `Price per ${multiForm.package_size}kg package` : "Selling Price"}</Label>
                  <Input type="number" min="0" value={multiForm.selling_price} onChange={(e) => setMultiForm({ ...multiForm, selling_price: e.target.value })} />
                </div>
                <Button onClick={handleMultiSave} className="w-full" disabled={upsert.isPending}>Save for {selectedClients.length} Client(s)</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Single client price */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Set Price</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Set Client Price</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Client</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>{clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} {c.type === "supermarket" ? "🏪" : "🍽️"}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Product</Label>
                  <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>{products?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.unit})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {form.product_id && getSelectedProduct(form.product_id)?.unit === "kg" && (
                  <div><Label>Package Size (kg)</Label>
                    <Input type="number" min="0.01" step="0.01" placeholder="e.g. 0.1 for 100g" value={form.package_size} onChange={(e) => setForm({ ...form, package_size: e.target.value })} />
                    <p className="text-xs text-muted-foreground mt-1">Enter the weight per package. Price below is per this package.</p>
                  </div>
                )}
                <div>
                  <Label>{form.package_size && getSelectedProduct(form.product_id)?.unit === "kg" ? `Price per ${form.package_size}kg package` : "Selling Price"}</Label>
                  <div className="flex gap-2">
                    <Input type="number" min="0" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} className="flex-1" />
                    {form.product_id && (() => {
                      const prod = getSelectedProduct(form.product_id);
                      if (!prod) return null;
                      const oh = pricingSettings?.overhead_pct || 0;
                      const lb = pricingSettings?.labor_pct || 0;
                      const pm = savedMargins?.[prod.id] || 0;
                      const suggested = prod.cost_per_unit * (1 + oh / 100 + lb / 100 + pm / 100);
                      const pkgSize = form.package_size ? parseFloat(form.package_size) : 1;
                      const displayPrice = prod.unit === "kg" && pkgSize > 0 ? suggested * pkgSize : suggested;
                      return (
                        <Button type="button" variant="outline" size="sm" className="whitespace-nowrap" onClick={() => setForm({ ...form, selling_price: displayPrice.toFixed(2) })}>
                          <Lightbulb className="mr-1 h-3 w-3" />{displayPrice.toFixed(2)}
                        </Button>
                      );
                    })()}
                  </div>
                </div>
                <Button onClick={handleSave} className="w-full" disabled={upsert.isPending}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Price History</DialogTitle></DialogHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Price</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
            <TableBody>
              {history?.map((h: any) => (
                <TableRow key={h.id}>
                  <TableCell>{Number(h.selling_price).toFixed(2)}</TableCell>
                  <TableCell>{new Date(h.changed_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {!history?.length && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No history</TableCell></TableRow>}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Grouped by client */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : !groupedPricing.length ? (
        <p className="text-center text-muted-foreground py-8">No prices set yet</p>
      ) : (
        <div className="space-y-3">
          {groupedPricing.map((group) => {
            const isExpanded = expandedClients.has(group.clientId);
            return (
              <Card key={group.clientId}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors rounded-t-lg"
                  onClick={() => toggleExpand(group.clientId)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-semibold text-lg">{group.clientName}</span>
                    {(() => {
                      const cl = clients?.find((c) => c.id === group.clientId);
                      return cl?.type === "supermarket" ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Supermarket</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Restaurant</span>
                      );
                    })()}
                    <span className="text-sm text-muted-foreground">({group.items.length} products)</span>
                  </div>
                </button>
                {isExpanded && (
                  <CardContent className="p-0 border-t overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>
                            {(() => {
                              const cl = clients?.find((c) => c.id === group.clientId);
                              return cl?.type === "supermarket" ? "Price/Pack" : "Price/Unit";
                            })()}
                          </TableHead>
                          <TableHead>Last Updated</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.products?.name} ({p.products?.unit})</TableCell>
                            <TableCell>
                              {editingId === p.id ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={editPrice}
                                    onChange={(e) => setEditPrice(e.target.value)}
                                    className="w-24 h-8"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleInlineEdit(p.id, p.client_id, p.product_id);
                                      if (e.key === "Escape") setEditingId(null);
                                    }}
                                  />
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleInlineEdit(p.id, p.client_id, p.product_id)}>
                                    <Check className="h-3 w-3 text-green-600" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                                    <X className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              ) : (
                                <span
                                  className="cursor-pointer hover:underline"
                                  onClick={() => { setEditingId(p.id); setEditPrice(String(p.selling_price)); }}
                                >
                                  {Number(p.selling_price).toFixed(2)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{new Date(p.last_updated).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(p.id); setEditPrice(String(p.selling_price)); }}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => showHistory(p.client_id, p.product_id)}>
                                  <History className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePricing.mutate(p.id)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Pricing;
