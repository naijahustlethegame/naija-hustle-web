import Link from "next/link";
import Nav from "@/components/Nav";
import GameView from "@/components/GameView";
import SellersCanvas from "@/components/SellersCanvas";

const BUYERS = [
  ["Okada riders", "Water and snacks. Small money, but they are everywhere."],
  ["Keke drivers", "Water, drinks and snacks. A friendly crowd."],
  ["Danfo conductors", "Snacks first. Big vehicle, middling pay."],
  ["Office cars", "Cold drinks, and sometimes a gadget."],
  ["Jeeps", "Gadgets. They pay nearly double, and the glass is almost always up."],
];

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <h1>Beat the green light.</h1>
            <p>
              Sell water, snacks and gadgets to cars stopped at a Lagos junction. Read who
              will buy, close the sale, and get off the road before the light changes.
            </p>
            <div className="btns">
              <Link className="btn" href="/play">Play now</Link>
              <Link className="btn alt" href="/customize">Style your hustler</Link>
            </div>
          </div>
          <figure className="hero-demo">
            <GameView demo />
            <figcaption>A bot working the light, live. Your turn next.</figcaption>
          </figure>
        </section>

        <div className="band" aria-hidden>
          {["No condition is permanent", "God dey", "Hustle no dey sleep", "Wait for red"].map((s) => (
            <span key={s}>{s}<i className="dots"><b /><b /><b /></i></span>
          ))}
        </div>

        <section className="sec">
          <h2>How a red light plays</h2>
          <ol className="steps">
            <li className="red">
              <span className="n">1</span>
              <h3>The light turns red</h3>
              <p>Cars roll up and stop. The road is safe to cross, but the clock is running. Tap a car and run to it.</p>
            </li>
            <li className="amber">
              <span className="n">2</span>
              <h3>Read the window</h3>
              <p>A hand out or a bubble above the car means a chance. Glass up usually means no. Then take the offer, or push the price and risk it.</p>
            </li>
            <li className="green">
              <span className="n">3</span>
              <h3>Clear out before green</h3>
              <p>When the light flashes yellow, run for the pavement. Cars that start moving will knock you down, and you drop cash and stock.</p>
            </li>
          </ol>
        </section>

        <section className="sec split">
          <div>
            <h2>Not everybody buys</h2>
            <p>
              Body language helps, but it is never a promise. A hand out can still say no, and a
              closed window sometimes opens. Rain makes it worse. Hot sun makes cold water fly.
            </p>
          </div>
          <dl className="buyers">
            {BUYERS.map(([who, what]) => (
              <div key={who}><dt>{who}</dt><dd>{what}</dd></div>
            ))}
          </dl>
        </section>

        <section className="crew">
          <div className="crew-inner">
            <div>
              <h2>Hire sellers, then go play</h2>
              <p>
                Pay a seller once and they work their own corner on auto. They do not follow you to
                the junction. Visit their corner to watch them hustle and collect what they earned.
              </p>
              <Link className="btn" href="/sellers">Meet the sellers</Link>
            </div>
            <SellersCanvas ids={["tunde", "amaka", "chidi"]} />
          </div>
        </section>
      </main>
      <footer className="foot">Naija Hustle. Made in Lagos.</footer>
    </>
  );
}
