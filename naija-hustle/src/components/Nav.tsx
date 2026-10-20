import Link from "next/link";

export default function Nav() {
  return (
    <header className="nav">
      <Link href="/">Naija RPG</Link>
      <nav>
        <Link href="/play">Play</Link>
        <Link href="/customize">Customize</Link>
      </nav>
    </header>
  );
}
