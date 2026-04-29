import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, ArrowUpRight, Users, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { vendorsApi } from "@/lib/api";
import { useDeleteVendor, useUpdateVendor, useVendors } from "@/lib/hooks";
import type { ExpenseCategory } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Vendors() {
  const { data: vendors = [] } = useVendors();
  const qc = useQueryClient();
  const nav = useNavigate();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cat, setCat] = useState<ExpenseCategory>("materials");

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCat, setEditCat] = useState<ExpenseCategory>("materials");

  const submit = async () => {
    if (!name.trim()) return toast.error("Vendor name required");
    try {
      const created = await vendorsApi.upsert(name.trim(), cat);
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor created");
      setOpen(false);
      setName("");
      setCat("materials");
      if (created?.id) nav(`/vendors/${created.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create vendor");
    }
  };

  const openEdit = (v: { id: string; name: string; default_category: any }) => {
    setEditId(v.id);
    setEditName(v.name);
    setEditCat((v.default_category ?? "materials") as ExpenseCategory);
    setEditOpen(true);
  };

  const filtered = useMemo(() => vendors, [vendors]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Vendors</h1>
          <p className="text-muted-foreground mt-1">{vendors.length} saved</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-11 rounded-2xl"
            onClick={() => nav("/dashboard?add=quick")}
          >
            <ArrowUpRight className="w-4 h-4" /> Log expense
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary shadow-red h-11 rounded-2xl">
                <Plus className="w-4 h-4" /> New vendor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Create Vendor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Vendor Name</Label>
                  <Input className="h-11 mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home Depot" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Default Category</Label>
                  <div className="mt-1.5">
                    <Select value={cat} onValueChange={(v) => setCat(v as ExpenseCategory)}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="materials">Materials</SelectItem>
                        <SelectItem value="labor">Labor</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="subcontractor">Subcontractor</SelectItem>
                        <SelectItem value="operating">Operating</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submit} className="bg-gradient-primary shadow-red w-full h-11 rounded-2xl">
                  <Plus className="w-4 h-4" /> Create Vendor
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="stat-card p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div className="font-display font-bold text-lg mt-3">No vendors yet</div>
          <div className="text-sm text-muted-foreground mt-1">Create one so Quick Add can auto-fill and suggest categories.</div>
          <Button onClick={() => setOpen(true)} className="mt-4 bg-gradient-primary shadow-red h-11 rounded-2xl">
            <Plus className="w-4 h-4" /> Create your first vendor
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <div key={v.id} className={cn("stat-card p-4")}> 
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display font-bold truncate">{v.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Default: <span className={cn("font-semibold", v.default_category ? "text-foreground" : "text-muted-foreground")}>{v.default_category ?? "—"}</span>
                  </div>
                </div>
                <Link
                  to={`/vendors/${v.id}`}
                  className="w-9 h-9 rounded-xl bg-muted hover:bg-primary/10 flex items-center justify-center transition"
                  aria-label="Open vendor"
                >
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl"
                  onClick={() => openEdit(v as any)}
                >
                  <Pencil className="w-4 h-4" /> Edit
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl ml-auto text-primary"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete vendor?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete the vendor. Existing expenses keep their vendor text, but it will no longer appear in pickers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => deleteVendor.mutate(v.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit vendor dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Edit Vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Vendor Name</Label>
              <Input className="h-11 mt-1.5" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Default Category</Label>
              <div className="mt-1.5">
                <Select value={editCat} onValueChange={(v) => setEditCat(v as ExpenseCategory)}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="materials">Materials</SelectItem>
                    <SelectItem value="labor">Labor</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="subcontractor">Subcontractor</SelectItem>
                    <SelectItem value="operating">Operating</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!editId) return;
                if (!editName.trim()) return toast.error("Vendor name required");
                await updateVendor.mutateAsync({ id: editId, name: editName.trim(), default_category: editCat } as any);
                setEditOpen(false);
              }}
              className="bg-gradient-primary shadow-red w-full h-11 rounded-2xl"
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
