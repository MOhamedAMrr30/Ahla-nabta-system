import { useState } from "react";
import { useClients, useUpsertClient, useDeleteClient } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Clients = () => {
  const { data: clients, isLoading } = useClients();
  const upsert = useUpsertClient();
  const remove = useDeleteClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", name_ar: "", type: "restaurant", phone: "", credit_days: "30" });

  const handleSave = () => {
    if (!form.name) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    upsert.mutate(
      { name: form.name, name_ar: form.name_ar || null, type: form.type, phone: form.phone || null, credit_days: parseInt(form.credit_days) || 30 },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ name: "", name_ar: "", type: "restaurant", phone: "", credit_days: "30" });
          toast({ title: "Client saved" });
        },
      }
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between mb-4 sm:mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Clients</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Client</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name (EN)</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Name (AR)</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} dir="rtl" /></div>
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="restaurant">Restaurant</SelectItem><SelectItem value="supermarket">Supermarket</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Credit Days</Label><Input type="number" min="0" value={form.credit_days} onChange={(e) => setForm({ ...form, credit_days: e.target.value })} /></div>
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
                <TableHead>Name</TableHead>
                <TableHead>Arabic</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Credit Days</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : !clients?.length ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No clients yet</TableCell></TableRow>
              ) : (
                clients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell dir="rtl">{c.name_ar || "—"}</TableCell>
                    <TableCell className="capitalize">{c.type}</TableCell>
                    <TableCell>{c.phone || "—"}</TableCell>
                    <TableCell>{c.credit_days} days</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Clients;
