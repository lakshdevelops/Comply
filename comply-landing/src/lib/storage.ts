import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import app from "./firebase";
import { db } from "./firestore";

const storage = getStorage(app);

export async function uploadWorkspaceDocument(
  workspaceId: string,
  file: File,
  uploadedBy: string,
  onProgress?: (pct: number) => void
): Promise<{ downloadURL: string; storagePath: string; docId: string }> {
  const timestamp = Date.now();
  const storagePath = `workspaces/${workspaceId}/documents/${timestamp}_${file.name}`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      "state_changed",
      (snap) => {
        const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
        onProgress?.(pct);
      },
      reject,
      async () => {
        const downloadURL = await getDownloadURL(task.snapshot.ref);
        const docRef = doc(db, "workspaces", workspaceId, "documents", `${timestamp}`);
        await setDoc(docRef, {
          name: file.name,
          storagePath,
          downloadURL,
          size: file.size,
          contentType: file.type,
          uploadedBy,
          uploadedAt: new Date().toISOString(),
        });
        resolve({ downloadURL, storagePath, docId: docRef.id });
      }
    );
  });
}

export async function deleteStorageFile(storagePath: string): Promise<void> {
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);
}
