import Link from "next/link";

function LightMark() {
  return (
    <svg className="mark" viewBox="0 0 20 34" width="20" height="34" aria-hidden>
      <rect x="1" y="1" width="18" height="32" rx="5" fill="#1b1b22" />
      <circle cx="10" cy="8" r="4" fill="#e4382f" />
      <circle cx="10" cy="17" r="4" fill="#f7b500" />
      <circle cx="10" cy="26" r="4" fill="#0e8f4e" />
    </svg>
  );
}

export default function Nav() {
  return (
    <header className="nav">
      <Link href="/" className="brand"><LightMark />Naija Hustle</Link>
      <nav aria-label="Main">
        <Link href="/play">Play</Link>
        <Link href="/sellers">Sellers</Link>
        <Link href="/restock">Restock</Link>
        <Link href="/leaderboard">Ranks</Link>
        <Link href="/customize">Style</Link>
      </nav>
    </header>
  );
}
