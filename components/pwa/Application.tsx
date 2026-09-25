"use client";

import { useEffect } from "react";

// Comportement « application » sur le téléphone :
//  - enregistre le service worker (installation, pages gardées sans réseau) ;
//  - bloque le zoom, comme dans une application : pincer (iPhone ignore l'interdiction de la
//    balise viewport, d'où les gestes bloqués ici) et double toucher (CSS touch-action).
export function Application() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    const bloquer = (e: Event) => e.preventDefault();
    const deuxDoigts = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("gesturestart", bloquer);
    document.addEventListener("gesturechange", bloquer);
    document.addEventListener("touchmove", deuxDoigts, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", bloquer);
      document.removeEventListener("gesturechange", bloquer);
      document.removeEventListener("touchmove", deuxDoigts);
    };
  }, []);
  return null;
}
