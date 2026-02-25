import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDashboardMetrics } from "@/hooks/use-data";
import { MarginBadge, getMarginZone } from "@/components/MarginBadge";
import { DollarSign, TrendingUp, Trash2, Truck, CreditCard, Users, Package, ShoppingBasket, Layers, Plus, Wallet, ArrowUpCircle, ArrowDownCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// Capital ledger stored in localStorage
const CAPITAL_KEY = "ahla_capital_ledger";

interface CapitalEntry {
  id: string;
  date: string;
  type: "deposit" | "withdrawal" | "initial";
  amount: number;
  description: string;
}

function loadCapitalLedger(): CapitalEntry[] {
  try { return JSON.parse(localStorage.getItem(CAPITAL_KEY) || "[]"); } catch { return []; }
}

function saveCapitalLedger(entries: CapitalEntry[]) {
  localStorage.setItem(CAPITAL_KEY, JSON.stringify(entries));
}

const Dashboard = () => {
  const { data: m, isLoading } = useDashboardMetrics();
  const [capitalEntries, setCapitalEntries] = useState<CapitalEntry[]>(loadCapitalLedger());
  const [capitalOpen, setCapitalOpen] = useState(false);
  const [txForm, setTxForm] = useState({ type: "deposit" as "deposit" | "withdrawal" | "initial", amount: "", description: "" });
  const [showLedger, setShowLedger] = useState(false);

  const metrics = m || {
    revenue: 0, profit: 0, avgMargin: 0, wastePct: 0,
    wasteValue: 0, transportPct: 0, outstanding: 0, topClientPct: 0,
    baseCost: 0, transportCost: 0, packagingCost: 0, totalCost: 0, totalCollected: 0, baseCostCollected: 0,
  };

  // Calculate capital
  const capitalCalc = useMemo(() => {
    const manualCash = capitalEntries.reduce((s, e) => {
      if (e.type === "deposit" || e.type === "initial") return s + e.amount;
      if (e.type === "withdrawal") return s - e.amount;
      return s;
    }, 0);
    const collected = metrics.totalCollected; // paid invoices
    const cashInHand = manualCash + collected;
    const expectedIn = metrics.outstanding; // money clients still owe us
    const farmerOwed = metrics.baseCost; // what we owe to farmer (weekly)
    const projected = cashInHand + expectedIn - farmerOwed;
    return { manualCash, collected, cashInHand, expectedIn, farmerOwed, projected };
  }, [capitalEntries, metrics]);

  const handleAddTransaction = () => {
    const amt = parseFloat(txForm.amount);
    if (!amt || amt <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!txForm.description.trim()) {
      toast({ title: "Enter a description", variant: "destructive" });
      return;
    }
    const entry: CapitalEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString().split("T")[0],
      type: txForm.type,
      amount: amt,
      description: txForm.description.trim(),
    };
    const updated = [entry, ...capitalEntries];
    setCapitalEntries(updated);
    saveCapitalLedger(updated);
    setCapitalOpen(false);
    setTxForm({ type: "deposit", amount: "", description: "" });
    toast({ title: `${txForm.type === "withdrawal" ? "Payment" : "Deposit"} recorded` });
  };

  const deleteEntry = (id: string) => {
    const updated = capitalEntries.filter((e) => e.id !== id);
    setCapitalEntries(updated);
    saveCapitalLedger(updated);
    toast({ title: "Entry removed" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const zone = getMarginZone(metrics.avgMargin);

  const cards = [
    { title: "Weekly Revenue", value: `${metrics.revenue.toFixed(2)}`, icon: DollarSign, color: "text-primary" },
    { title: "Weekly Net Profit", value: `${metrics.profit.toFixed(2)}`, icon: TrendingUp, color: metrics.profit >= 0 ? "text-margin-green" : "text-margin-red" },
    { title: "Average Margin", value: <MarginBadge margin={metrics.avgMargin} />, icon: TrendingUp, color: zone === "green" ? "text-margin-green" : zone === "yellow" ? "text-margin-yellow" : "text-margin-red" },
    { title: "Outstanding Receivables", value: `${metrics.outstanding.toFixed(2)}`, icon: CreditCard, color: metrics.outstanding > 0 ? "text-margin-yellow" : "text-margin-green" },
  ];

  const costCards = [
    { title: "Base Cost (Farmer)", value: `${metrics.baseCost.toFixed(2)}`, icon: ShoppingBasket, color: "text-orange-600", subtitle: `${metrics.revenue > 0 ? ((metrics.baseCost / metrics.revenue) * 100).toFixed(1) : "0"}% of revenue` },
    { title: "Transport Cost", value: `${metrics.transportCost.toFixed(2)}`, icon: Truck, color: "text-blue-600", subtitle: `${metrics.transportPct.toFixed(1)}% of revenue` },
    { title: "Packaging Cost", value: `${metrics.packagingCost.toFixed(2)}`, icon: Package, color: "text-purple-600", subtitle: `${metrics.revenue > 0 ? ((metrics.packagingCost / metrics.revenue) * 100).toFixed(1) : "0"}% of revenue` },
    { title: "Total Cost", value: `${metrics.totalCost.toFixed(2)}`, icon: Layers, color: "text-red-600", subtitle: `${metrics.revenue > 0 ? ((metrics.totalCost / metrics.revenue) * 100).toFixed(1) : "0"}% of revenue` },
  ];

  const otherCards = [
    { title: "Waste %", value: `${metrics.wastePct.toFixed(1)}%`, subtitle: `Cost: ${metrics.wasteValue.toFixed(2)}`, icon: Trash2, color: metrics.wastePct > 10 ? "text-margin-red" : "text-muted-foreground" },
    { title: "Top Client Contribution", value: `${metrics.topClientPct.toFixed(1)}%`, icon: Users, color: metrics.topClientPct > 50 ? "text-margin-red" : "text-muted-foreground" },
  ];

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Dashboard</h1>

      {/* Capital Section */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
          <h2 className="text-lg font-semibold text-muted-foreground">Capital Overview</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowLedger(!showLedger)}>
              {showLedger ? "Hide" : "Show"} Ledger
            </Button>
            <Dialog open={capitalOpen} onOpenChange={setCapitalOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3 w-3" />Add Transaction</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Type</Label>
                    <Select value={txForm.type} onValueChange={(v: "deposit" | "withdrawal" | "initial") => setTxForm({ ...txForm, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="initial">Set Initial Capital</SelectItem>
                        <SelectItem value="deposit">Money In (Deposit / Payment Received)</SelectItem>
                        <SelectItem value="withdrawal">Money Out (Paid Farmer / Expense)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Amount (EGP)</Label>
                    <Input type="number" min="0.01" step="0.01" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} placeholder="e.g. 5000" />
                  </div>
                  <div><Label>Description</Label>
                    <Input value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} placeholder="e.g. Paid farmer for broccoli" />
                  </div>
                  <Button onClick={handleAddTransaction} className="w-full">Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Manual Capital</CardTitle>
              <Wallet className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{capitalCalc.manualCash.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Initial + deposits − withdrawals</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Collected from Clients</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{capitalCalc.collected.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Invoices marked as paid</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Farmer Cost (Paid Orders)</CardTitle>
              <Package className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{metrics.baseCostCollected.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Base cost of orders you collected for</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-green-500/30 bg-green-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cash in Hand</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{capitalCalc.cashInHand.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Manual capital + collected</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Still Owed by Clients</CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">+ {capitalCalc.expectedIn.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Unpaid invoices</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Owed to Farmer</CardTitle>
              <ArrowDownCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">- {capitalCalc.farmerOwed.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Weekly base product costs</p>
            </CardContent>
          </Card>
          <Card className={cn("border-2", capitalCalc.projected >= 0 ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Projected Balance</CardTitle>
              <DollarSign className={cn("h-4 w-4", capitalCalc.projected >= 0 ? "text-green-600" : "text-red-600")} />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", capitalCalc.projected >= 0 ? "text-green-600" : "text-red-600")}>
                {capitalCalc.projected.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Cash + Receivables − Farmer costs</p>
            </CardContent>
          </Card>
        </div>

        {/* Ledger table */}
        {showLedger && (
          <Card className="mb-4">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capitalEntries.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No transactions yet. Add your initial capital to get started.</TableCell></TableRow>
                    ) : (
                      capitalEntries.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{e.date}</TableCell>
                          <TableCell>
                            <span className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded-full",
                              e.type === "deposit" || e.type === "initial" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            )}>
                              {e.type === "initial" ? "Initial" : e.type === "deposit" ? "In" : "Out"}
                            </span>
                          </TableCell>
                          <TableCell>{e.description}</TableCell>
                          <TableCell className={cn("font-medium", e.type === "withdrawal" ? "text-red-600" : "text-green-600")}>
                            {e.type === "withdrawal" ? "-" : "+"}{e.amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteEntry(e.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Key metrics */}
      <p className="text-muted-foreground mb-4 text-sm">Weekly performance summary</p>
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className={cn("h-4 w-4", c.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cost Breakdown */}
      <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Cost Breakdown (Weekly)</h2>
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {costCards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className={cn("h-4 w-4", c.color)} />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", c.color)}>{c.value}</div>
              {c.subtitle && <p className="text-xs text-muted-foreground mt-1">{c.subtitle}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Other metrics */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {otherCards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className={cn("h-4 w-4", c.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
              {c.subtitle && <p className="text-xs text-muted-foreground mt-1">{c.subtitle}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
