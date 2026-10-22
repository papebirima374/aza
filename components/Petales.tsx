// Quelques pétales roses et dorés qui tombent lentement dans le bandeau (décor, sans JavaScript).
const PETALES = [
  { left: "6%", duree: 13, delai: 0, derive: 60, taille: 1 },
  { left: "18%", duree: 17, delai: 4, derive: -40, taille: 0.8 },
  { left: "31%", duree: 15, delai: 8, derive: 50, taille: 1.2 },
  { left: "47%", duree: 19, delai: 2, derive: -60, taille: 0.9 },
  { left: "62%", duree: 14, delai: 6, derive: 40, taille: 1.1 },
  { left: "76%", duree: 18, delai: 10, derive: -50, taille: 0.7 },
  { left: "88%", duree: 16, delai: 3, derive: 30, taille: 1 },
];

export function Petales() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {PETALES.map((p, i) => (
        <span
          key={i}
          className="aza-petale"
          style={{ left: p.left, animationDuration: `${p.duree}s`, animationDelay: `${p.delai}s`, scale: String(p.taille), ["--derive" as string]: `${p.derive}px` }}
        />
      ))}
    </div>
  );
}
