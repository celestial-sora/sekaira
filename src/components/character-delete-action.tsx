"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Bootstrap } from "@/lib/types";
import { api } from "./shared";

export default function CharacterDeleteAction() {
  const pathname = usePathname();
  const router = useRouter();
  const match = pathname.match(/^\/characters\/([^/]+)$/);
  const id = match?.[1];
  const [owned, setOwned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setOwned(false);
    setError("");
    if (!id) return () => { active = false; };
    api<Bootstrap>("bootstrap")
      .then((data) => {
        const character = data.characters.find((item) => item.id === id);
        if (active) setOwned(Boolean(data.user && character?.owner_id === data.user.id));
      })
      .catch(() => { if (active) setOwned(false); });
    return () => { active = false; };
  }, [id]);

  if (!id || !owned) return null;

  async function remove() {
    if (!confirm("Delete this character permanently? This removes it from Community for everyone.")) return;
    setBusy(true);
    setError("");
    try {
      await api(`characters/${id}`, "DELETE");
      router.replace("/characters");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete this character.");
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", right: 20, bottom: 24, zIndex: 1000, display: "grid", gap: 8, justifyItems: "end" }}>
      {error && <span className="error-note" role="alert">{error}</span>}
      <button className="button danger" disabled={busy} onClick={() => void remove()}>
        <Trash2 size={16} />
        {busy ? "Deleting…" : "Delete character"}
      </button>
    </div>
  );
}
