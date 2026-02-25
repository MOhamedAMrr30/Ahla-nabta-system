import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

// Products
export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data as Tables<"products">[];
    },
  });
}

export function useUpsertProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: TablesInsert<"products">) => {
      const { error } = await supabase.from("products").upsert(p);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

// Clients
export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data as Tables<"clients">[];
    },
  });
}

export function useUpsertClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: TablesInsert<"clients">) => {
      const { error } = await supabase.from("clients").upsert(c);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

// Client Pricing
export function useClientPricing(clientId?: string) {
  return useQuery({
    queryKey: ["client_pricing", clientId],
    queryFn: async () => {
      let q = supabase.from("client_pricing").select("*, products(name, unit), clients(name)");
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertClientPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: TablesInsert<"client_pricing">) => {
      const { error } = await supabase.from("client_pricing").upsert(p, {
        onConflict: "client_id,product_id",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_pricing"] }),
  });
}

export function useDeleteClientPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_pricing").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_pricing"] }),
  });
}

export function usePricingHistory(clientId?: string, productId?: string) {
  return useQuery({
    queryKey: ["pricing_history", clientId, productId],
    enabled: !!clientId && !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_pricing_history")
        .select("*")
        .eq("client_id", clientId!)
        .eq("product_id", productId!)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// Orders
export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, clients(name, name_ar, type)")
        .order("delivery_date", { ascending: false })
        .order("order_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useOrderWithItems(orderId: string) {
  return useQuery({
    queryKey: ["order", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const [orderRes, itemsRes] = await Promise.all([
        supabase.from("orders").select("*, clients(name, name_ar, phone, credit_days, type)").eq("id", orderId).maybeSingle(),
        supabase.from("order_items").select("*, products(name, unit)").eq("order_id", orderId),
      ]);
      if (orderRes.error) throw orderRes.error;
      if (itemsRes.error) throw itemsRes.error;
      return { order: orderRes.data, items: itemsRes.data };
    },
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      order: TablesInsert<"orders">;
      items: TablesInsert<"order_items">[];
    }) => {
      const { data: orderData, error: orderErr } = await supabase
        .from("orders")
        .insert(payload.order)
        .select()
        .single();
      if (orderErr) throw orderErr;

      const itemsWithOrderId = payload.items.map((i) => ({
        ...i,
        order_id: orderData.id,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(itemsWithOrderId);
      if (itemsErr) throw itemsErr;

      // Create payment record
      const client = await supabase.from("clients").select("credit_days").eq("id", payload.order.client_id).maybeSingle();
      const creditDays = client.data?.credit_days || 30;
      const dueDate = new Date(orderData.delivery_date);
      dueDate.setDate(dueDate.getDate() + creditDays);

      const { error: payErr } = await supabase.from("payments").insert({
        order_id: orderData.id,
        amount: orderData.total_revenue,
        due_date: dueDate.toISOString().split("T")[0],
      });
      if (payErr) throw payErr;

      return orderData;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete order items first
      const { error: itemsErr } = await supabase.from("order_items").delete().eq("order_id", id);
      if (itemsErr) throw itemsErr;
      // Delete payments
      const { error: payErr } = await supabase.from("payments").delete().eq("order_id", id);
      if (payErr) throw payErr;
      // Delete the order
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      orderId: string;
      order: Partial<TablesInsert<"orders">>;
      items: TablesInsert<"order_items">[];
    }) => {
      // Update the order
      const { error: orderErr } = await supabase
        .from("orders")
        .update(payload.order)
        .eq("id", payload.orderId);
      if (orderErr) throw orderErr;

      // Delete old items and insert new ones
      const { error: delErr } = await supabase.from("order_items").delete().eq("order_id", payload.orderId);
      if (delErr) throw delErr;

      const itemsWithOrderId = payload.items.map((i) => ({
        ...i,
        order_id: payload.orderId,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(itemsWithOrderId);
      if (itemsErr) throw itemsErr;

      // Update payment amount and due date
      const client = await supabase.from("clients").select("credit_days").eq("id", payload.order.client_id!).maybeSingle();
      const creditDays = client.data?.credit_days || 30;
      const dueDate = new Date(payload.order.delivery_date!);
      dueDate.setDate(dueDate.getDate() + creditDays);

      const { data: existingPayment } = await supabase.from("payments").select("id").eq("order_id", payload.orderId).maybeSingle();
      if (existingPayment) {
        await supabase.from("payments").update({
          amount: payload.order.total_revenue,
          due_date: dueDate.toISOString().split("T")[0],
        }).eq("id", existingPayment.id);
      }

      return payload.orderId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useInventoryBatches() {
  return useQuery({
    queryKey: ["inventory_batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_batches")
        .select("*, products(name, unit, cost_per_unit)")
        .order("harvest_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ packagingCostPerUnit, ...b }: TablesInsert<"inventory_batches"> & { packagingCostPerUnit?: number }) => {
      // Calculate waste
      const wasteQty = (b.damaged_qty || 0) + (b.expired_qty || 0);
      const harvested = b.harvested_qty || 0;
      const wastePct = harvested > 0 ? (wasteQty / harvested) * 100 : 0;

      // Get product cost
      const { data: prod } = await supabase
        .from("products")
        .select("cost_per_unit")
        .eq("id", b.product_id)
        .maybeSingle();
      const unitCost = (prod?.cost_per_unit || 0) + (packagingCostPerUnit || 0);
      const wasteVal = wasteQty * unitCost;

      const { error } = await supabase.from("inventory_batches").upsert({
        ...b,
        waste_percentage: Math.round(wastePct * 100) / 100,
        waste_value: Math.round(wasteVal * 100) / 100,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory_batches"] }),
  });
}

export function useDeleteBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_batches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory_batches"] }),
  });
}

export function useDeductWasteFromOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, wasteValue }: { orderId: string; wasteValue: number }) => {
      // Get the current order
      const { data: order, error: oErr } = await supabase
        .from("orders")
        .select("total_revenue, net_profit")
        .eq("id", orderId)
        .single();
      if (oErr) throw oErr;

      // Update order: reduce revenue and profit by waste value
      const newRevenue = Math.max(0, (order.total_revenue || 0) - wasteValue);
      const newProfit = (order.net_profit || 0) - wasteValue;
      const { error: updErr } = await supabase
        .from("orders")
        .update({ total_revenue: newRevenue, net_profit: newProfit })
        .eq("id", orderId);
      if (updErr) throw updErr;

      // Update the payment linked to this order
      const { data: payment } = await supabase
        .from("payments")
        .select("id, amount")
        .eq("order_id", orderId)
        .maybeSingle();
      if (payment) {
        const newAmount = Math.max(0, (payment.amount || 0) - wasteValue);
        await supabase.from("payments").update({ amount: newAmount }).eq("id", payment.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["inventory_batches"] });
    },
  });
}

// Payments
export function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, orders(client_id, delivery_date, total_revenue, clients(name))")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useMarkPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("payments")
        .update({ status: "paid", paid_date: new Date().toISOString().split("T")[0] })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdatePaymentAmount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { error } = await supabase
        .from("payments")
        .update({ amount })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// Pricing Settings (localStorage-based — no DB migration needed)
const PRICING_SETTINGS_KEY = "ahla_nabta_pricing_settings";
const PRODUCT_MARGINS_KEY = "ahla_nabta_product_margins";

interface PricingSettings {
  overhead_pct: number;
  labor_pct: number;
}

function loadPricingSettings(): PricingSettings {
  try {
    const raw = localStorage.getItem(PRICING_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return { overhead_pct: 15, labor_pct: 0 };
}

function savePricingSettings(s: PricingSettings) {
  localStorage.setItem(PRICING_SETTINGS_KEY, JSON.stringify(s));
}

function loadProductMargins(): Record<string, number> {
  try {
    const raw = localStorage.getItem(PRODUCT_MARGINS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return {};
}

function saveProductMargins(m: Record<string, number>) {
  localStorage.setItem(PRODUCT_MARGINS_KEY, JSON.stringify(m));
}

export function usePricingSettings() {
  return useQuery({
    queryKey: ["pricing_settings"],
    queryFn: async () => loadPricingSettings(),
  });
}

export function useUpdatePricingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: PricingSettings) => {
      savePricingSettings(settings);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing_settings"] }),
  });
}

export function useProductMargins() {
  return useQuery({
    queryKey: ["product_margins"],
    queryFn: async () => loadProductMargins(),
  });
}

export function useUpdateProductPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; profit_margin_pct: number }) => {
      const margins = loadProductMargins();
      margins[p.id] = p.profit_margin_pct;
      saveProductMargins(margins);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product_margins"] }),
  });
}


// Dashboard
export function useDashboardMetrics() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekStr = weekAgo.toISOString().split("T")[0];

      const [ordersRes, paymentsRes, batchesRes] = await Promise.all([
        supabase.from("orders").select("*, order_items(total_cost)").gte("order_date", weekStr),
        supabase.from("payments").select("*, orders(total_cost, transport_cost, packaging_cost, order_items(total_cost))"),
        supabase.from("inventory_batches").select("*"),
      ]);

      const orders = ordersRes.data || [];
      const revenue = orders.reduce((s, o) => s + Number(o.total_revenue), 0);
      const profit = orders.reduce((s, o) => s + Number(o.net_profit), 0);
      const transportCost = orders.reduce((s, o) => s + Number(o.transport_cost || 0), 0);
      const packagingCost = orders.reduce((s, o) => s + Number(o.packaging_cost || 0), 0);
      // Base cost = sum of order_items.total_cost (cost_per_unit × quantity) for each order
      const baseCost = orders.reduce((s, o: any) => {
        const items = o.order_items || [];
        return s + items.reduce((sum: number, item: any) => sum + Number(item.total_cost || 0), 0);
      }, 0);
      const totalCost = baseCost + transportCost + packagingCost;
      const avgMargin = orders.length > 0 ? orders.reduce((s, o) => s + Number(o.margin_percentage), 0) / orders.length : 0;

      const batches = batchesRes.data || [];
      const totalHarvested = batches.reduce((s, b) => s + Number(b.harvested_qty), 0);
      const totalWaste = batches.reduce((s, b) => s + Number(b.damaged_qty) + Number(b.expired_qty), 0);
      const wastePct = totalHarvested > 0 ? (totalWaste / totalHarvested) * 100 : 0;
      const wasteValue = batches.reduce((s, b) => s + Number(b.waste_value), 0);

      const allPayments = paymentsRes.data || [];
      const outstanding = allPayments.filter((p) => p.status !== "paid").reduce((s, p) => s + Number(p.amount), 0);
      const totalCollected = allPayments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
      // Base cost (farmer cost) = sum of order_items.total_cost for orders marked as paid in receivables
      const baseCostCollected = allPayments
        .filter((p: any) => p.status === "paid" && p.orders)
        .reduce((s: number, p: any) => {
          const items = p.orders.order_items || [];
          const itemsBaseCost = items.reduce((sum: number, item: any) => sum + Number(item.total_cost || 0), 0);
          return s + itemsBaseCost;
        }, 0);

      // Top client contribution
      const allOrdersRes = await supabase.from("orders").select("client_id, total_revenue");
      const allOrders = allOrdersRes.data || [];
      const byClient: Record<string, number> = {};
      allOrders.forEach((o) => {
        byClient[o.client_id] = (byClient[o.client_id] || 0) + Number(o.total_revenue);
      });
      const totalAllRev = Object.values(byClient).reduce((s, v) => s + v, 0);
      const topClientPct = totalAllRev > 0 ? (Math.max(...Object.values(byClient), 0) / totalAllRev) * 100 : 0;

      return {
        revenue,
        profit,
        avgMargin,
        baseCost,
        transportCost,
        packagingCost,
        totalCost,
        wastePct,
        wasteValue,
        transportPct: revenue > 0 ? (transportCost / revenue) * 100 : 0,
        outstanding,
        totalCollected,
        baseCostCollected,
        topClientPct,
      };
    },
  });
}

// Analytics
export function useAnalyticsData() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const [itemsRes, ordersRes, pricingRes] = await Promise.all([
        supabase.from("order_items").select("*, products(id, name, unit, cost_per_unit), orders(id, order_date, client_id, clients(name))"),
        supabase.from("orders").select("*, clients(name)").order("order_date", { ascending: false }),
        supabase.from("client_pricing").select("*, products(name, unit), clients(name)"),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (ordersRes.error) throw ordersRes.error;
      return {
        items: itemsRes.data || [],
        orders: ordersRes.data || [],
        pricing: pricingRes.data || [],
      };
    },
  });
}

// ─── Weight Variants (localStorage-based) ───────────────────────────────────
const WEIGHT_VARIANTS_KEY = "ahla_nabta_weight_variants";

export interface WeightVariant {
  weight: number; // kg
  price: number;  // EGP
}

function loadWeightVariants(): Record<string, WeightVariant[]> {
  try {
    const raw = localStorage.getItem(WEIGHT_VARIANTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return {};
}

function saveWeightVariants(data: Record<string, WeightVariant[]>) {
  localStorage.setItem(WEIGHT_VARIANTS_KEY, JSON.stringify(data));
}

export function useProductWeightVariants() {
  return useQuery({
    queryKey: ["weight_variants"],
    queryFn: async () => loadWeightVariants(),
  });
}

export function useUpdateProductWeightVariants() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, variants }: { productId: string; variants: WeightVariant[] }) => {
      const all = loadWeightVariants();
      all[productId] = variants;
      saveWeightVariants(all);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weight_variants"] }),
  });
}

// ─── Auto-Save Hook ─────────────────────────────────────────────────────────

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutoSave<T>(
  value: T,
  onSave: (val: T) => Promise<void>,
  delayMs = 800,
  enabled = true,
) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRef = useRef<T>(value);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const triggerSave = useCallback(
    (val: T) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setStatus("saving");
      timeoutRef.current = setTimeout(async () => {
        try {
          await onSave(val);
          if (mountedRef.current) setStatus("saved");
          // Reset to idle after 2s
          setTimeout(() => { if (mountedRef.current) setStatus("idle"); }, 2000);
        } catch {
          if (mountedRef.current) setStatus("error");
        }
      }, delayMs);
    },
    [onSave, delayMs],
  );

  useEffect(() => {
    if (!enabled) return;
    // Deep compare via JSON (fine for small objects)
    const prev = JSON.stringify(prevRef.current);
    const curr = JSON.stringify(value);
    if (prev !== curr) {
      prevRef.current = value;
      triggerSave(value);
    }
  }, [value, enabled, triggerSave]);

  return status;
}
