import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import app from "./firebase";

const db = getFirestore(app);

function normalizeData(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      result[key] = value.toDate().toISOString();
    } else {
      result[key] = value;
    }
  }
  return result;
}

export async function getUserProfile(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...normalizeData(snap.data()) };
}

export async function ensureUserDoc(uid: string, data: Record<string, unknown>) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...data, createdAt: new Date().toISOString() });
  }
  return { id: ref.id, ...(snap.exists() ? normalizeData(snap.data()) : data) };
}

export async function listWorkspaceDocuments(workspaceId: string) {
  const q = query(
    collection(db, "workspaces", workspaceId, "documents"),
    orderBy("uploadedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...normalizeData(d.data()) }));
}

export async function listWorkspaceRepos(workspaceId: string) {
  const q = query(
    collection(db, "workspaces", workspaceId, "repos"),
    orderBy("connectedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...normalizeData(d.data()) }));
}

export { db };
