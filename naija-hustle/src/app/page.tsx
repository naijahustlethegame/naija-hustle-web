import Link from "next/link";
import Nav from "@/components/Nav";
import GameView from "@/components/GameView";
import SellersCanvas from "@/components/SellersCanvas";

const BUYERS = [
  ["Okada riders", "Water and snacks. Small money, but they are everywhere."],
  ["Keke drivers", "Water, drinks and snacks. A friendly crowd."],
  ["Danfo conductors", "Snacks first. Medium pay."],
  ["Office cars", "Cold drinks, and sometimes a gadget."],
  ["Jeeps", "Gadgets. They pay almost double, but rarely buy."],
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
              Sell water, snacks and gadgets to cars at a Lagos junction. Pick who will
              buy, make the sale, and get off the road before the light turns green.
            </p>
            <div className="btns">
              <Link className="btn" href="/play">Play now</Link>
              <Link className="btn alt" href="/customize">Style your hustler</Link>
            </div>
          </div>
          <figure className="hero-demo">
            <GameView demo />
            <figcaption>Live from the junction. Your turn next!</figcaption>
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
              <p>Cars stop and wait. Tap a car and run to it. Be quick!</p>
            </li>
            <li className="amber">
              <span className="n">2</span>
              <h3>Read the window</h3>
              <p>A hand out means they may buy. A closed window usually means no. Take their price, or ask for more and risk it.</p>
            </li>
            <li className="green">
              <span className="n">3</span>
              <h3>Clear out before green</h3>
              <p>When the light flashes yellow, run to the pavement. Moving cars knock you down and you lose money and stock.</p>
            </li>
          </ol>
        </section>

        <section className="sec split">
          <div>
            <h2>Not everybody buys</h2>
            <p>
              A hand out helps, but nobody is sure to buy. Rain means fewer buyers.
              Hot sun makes everyone want cold water.
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
                Pay a seller once and they sell for you, even when you are away.
                Come back to collect the money.
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
