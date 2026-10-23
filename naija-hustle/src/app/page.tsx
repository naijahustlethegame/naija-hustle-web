import Link from "next/link";
import Nav from "@/components/Nav";
import GameView from "@/components/GameView";
import SellersCanvas from "@/components/SellersCanvas";

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
          <h2>How to play</h2>
          <ol className="steps">
            <li className="red">
              <span className="n">1</span>
              <h3>Red light: cars stop</h3>
              <p>When the light is red, the cars stop and wait. Tap a car to run to it.</p>
            </li>
            <li className="amber">
              <span className="n">2</span>
              <h3>Sell to the driver</h3>
              <p>If the driver puts a hand out of the window, they want to buy. Tap to sell. If the window is shut, they will not buy.</p>
            </li>
            <li className="green">
              <span className="n">3</span>
              <h3>Run away before green</h3>
              <p>When the light turns yellow, run to the side of the road. When it is green the cars go. If a car hits you, you lose money.</p>
            </li>
          </ol>
        </section>

        <section className="sec">
          <h2>Not everybody buys</h2>
          <p>
            A hand out helps, but nobody is sure to buy. Rain means fewer buyers.
            Hot sun makes everyone want cold water.
          </p>
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