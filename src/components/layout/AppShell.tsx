"use client";

import { useState, useEffect } from "react";
import Rail from "./Rail";
import CreatePostModal from "@/components/feed/CreatePostModal";
import SearchModal from "./SearchModal";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [railOpen,    setRailOpen]    = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchOpen,  setSearchOpen]  = useState(false);

  useEffect(() => {
    const onCompose    = () => setComposeOpen(true);
    const onToggleRail = () => setRailOpen(o => !o);
    const onSearch     = () => setSearchOpen(true);
    window.addEventListener("sodev:openCompose", onCompose);
    window.addEventListener("sodev:toggleRail",  onToggleRail);
    window.addEventListener("sodev:openSearch",  onSearch);

    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("sodev:openCompose", onCompose);
      window.removeEventListener("sodev:toggleRail",  onToggleRail);
      window.removeEventListener("sodev:openSearch",  onSearch);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="h-dvh overflow-hidden flex">
      {/* Mobile Rail overlay */}
      {railOpen && (
        <div
          className="fixed inset-0 z-[65] bg-black/50 md:hidden"
          onClick={() => setRailOpen(false)}
        />
      )}

      <Rail open={railOpen} onClose={() => setRailOpen(false)} />

      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
        {children}
      </div>

      <CreatePostModal open={composeOpen} onClose={() => setComposeOpen(false)} />
      <SearchModal     open={searchOpen}  onClose={() => setSearchOpen(false)}  />
    </div>
  );
}
