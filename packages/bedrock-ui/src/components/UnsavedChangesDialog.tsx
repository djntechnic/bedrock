import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { useEditSessionStore } from "../store/editSessionStore";

export default function UnsavedChangesDialog() {
  const pendingLeave = useEditSessionStore((s) => s.pendingLeave);
  const confirmLeave = useEditSessionStore((s) => s.confirmLeave);
  const cancelLeave = useEditSessionStore((s) => s.cancelLeave);

  return (
    <AlertDialog
      open={pendingLeave !== null}
      onOpenChange={(open) => {
        if (!open) cancelLeave();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes that will be lost if you leave this page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelLeave}>Keep editing</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={confirmLeave}
          >
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
