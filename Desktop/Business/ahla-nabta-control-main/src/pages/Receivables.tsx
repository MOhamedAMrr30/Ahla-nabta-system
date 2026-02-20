import { useState } from "react";
import { usePayments, useMarkPaid, useDeletePayment, useUpdatePaymentAmount } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Trash2, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const Receivables = () => {
  const { data: payments, isLoading } = usePayments();
  const markPaid = useMarkPaid();
  const deletePayment = useDeletePayment();
  const updateAmount = useUpdatePaymentAmount();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

  const unpaid = payments?.filter((p) => p.status !== "paid") || [];
  const paid = payments?.filter((p) => p.status === "paid") || [];
  const outstanding = unpaid.reduce((s, p) => s + Number(p.amount), 0);
  const totalCollected = paid.reduce((s, p) => s + Number(p.amount), 0);

  const getDaysInfo = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const days = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setEditAmount(String(p.amount));
  };

  const saveEdit = (id: string) => {
    const amt = parseFloat(editAmount);
    if (!amt || amt < 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    updateAmount.mutate({ id, amount: amt }, {
      onSuccess: () => {
        setEditingId(null);
        toast({ title: "Amount updated" });
      },
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Receivables</h1>
        <div className="flex gap-3">
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="py-2 px-4">
              <p className="text-xs text-muted-foreground">Total Collected</p>
              <p className="text-xl font-bold text-emerald-600">{totalCollected.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="border-margin-yellow/30 bg-margin-yellow/5">
            <CardContent className="py-2 px-4">
              <p className="text-xs text-muted-foreground">Total Outstanding</p>
              <p className="text-xl font-bold">{outstanding.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Invoice Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Days</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : !payments?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No payments yet</TableCell></TableRow>
              ) : (
                payments.map((p: any) => {
                  const days = getDaysInfo(p.due_date);
                  const isOverdue = p.status !== "paid" && days > 0;
                  const isEditing = editingId === p.id;

                  return (
                    <TableRow key={p.id} className={cn(isOverdue && "bg-margin-red/5")}>
                      <TableCell className="font-medium">{p.orders?.clients?.name || "—"}</TableCell>
                      <TableCell>{p.invoice_date}</TableCell>
                      <TableCell>{p.due_date}</TableCell>
                      <TableCell>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="h-8 w-28"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(p.id);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                            />
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEdit(p.id)}>
                              <Check className="h-3 w-3 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                              <X className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          Number(p.amount).toFixed(2)
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === "paid" ? "default" : isOverdue ? "destructive" : "secondary"}>
                          {isOverdue ? "overdue" : p.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {p.status !== "paid" ? (days > 0 ? `${days}d overdue` : `${Math.abs(days)}d left`) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!isEditing && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(p)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                          {p.status !== "paid" && (
                            <Button size="sm" variant="outline" onClick={() => markPaid.mutate(p.id)} disabled={markPaid.isPending}>
                              <CheckCircle className="mr-1 h-3 w-3" />Paid
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            if (confirm("Delete this payment record?")) deletePayment.mutate(p.id);
                          }}>
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

export default Receivables;
