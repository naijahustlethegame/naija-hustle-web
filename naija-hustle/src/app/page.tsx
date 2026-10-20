import Link from "next/link";
import Nav from "@/components/Nav";
import GameCanvas from "@/components/GameCanvas";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="hero">
        <h1>Life happens.<br />Roll the dice.</h1>
        <p>Hustle the Lagos streets. Tap a ride, make the sale, don’t get hit.</p>
        <div className="btns">
          <Link className="btn" href="/play">Play now</Link>
          <Link className="btn alt" href="/customize">Style your hustler</Link>
        </div>
        <div className="frame"><GameCanvas demo /></div>
      </main>
    </>
  );
}
