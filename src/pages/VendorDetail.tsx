import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useDeleteVendor, useUpdateVendor, useVendors } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ExpenseCategory } from "@/lib/types";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function VendorDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: vendors = [] } = useVendors();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCat, setEditCat] = useState<ExpenseCategory>("materials");

  const vendor = useMemo(() => vendors.find((v) => v.id === id) ?? null, [vendors, id]);

  useEffect(() => {
    if (vendor) {
      setEditName(vendor.name);
      setEditCat((vendor.default_category ?? "materials") as ExpenseCategory);
    }
  }, [vendor]);

  if (!vendor) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <div className="text-sm text-muted-foreground">Loading vendor…</div>
        <Link to="/vendors" className="text-primary underline text-sm">Back to vendors</Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => nav(-1)}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-primary">Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete vendor?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the vendor. Existing expenses keep their vendor text.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    if (!vendor) return;
                    await deleteVendor.mutateAsync(vendor.id);
                    nav("/vendors");
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" onClick={() => nav(`/transactions?q=${encodeURIComponent(vendor.name)}`)}>
          <ArrowUpRight className="w-4 h-4" /> View transactions
          </Button>
        </div>
      </div>

      <div className="stat-card p-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Vendor</div>
        <div className="font-display font-bold text-3xl mt-1">{vendor.name}</div>
        <div className="text-sm text-muted-foreground mt-2">
          Default category: <span className="font-semibold text-foreground">{vendor.default_category ?? "—"}</span>
        </div>
      </div>

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
              className="bg-gradient-primary shadow-red w-full h-11 rounded-2xl"
              onClick={async () => {
                if (!vendor) return;
                await updateVendor.mutateAsync({ id: vendor.id, name: editName.trim(), default_category: editCat } as any);
                setEditOpen(false);
              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
