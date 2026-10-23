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
            <h1>Survive the Naija Hustle.</h1>
            <p>
              Sell snacks and gadgets, open a stand, survive the hustle. Compete with other hustlers, make the sale, show what you're made of.
            </p>
            <div className="btns">
              <Link className="btn" href="/play">Play now</Link>
              <Link className="btn alt" href="/customize">Style your hustler</Link>
            </div>
          </div>
          <figure className="hero-demo">
            <GameView demo />
            
          </figure>
        </section>

        <div className="band" aria-hidden>
          {["No condition is permanent", "God dey", "Hustle no dey sleep", "Small small"].map((s) => (
            <span key={s}>{s}<i className="dots"><b /><b /><b /></i></span>
          ))}
        </div>

        <section className="sec">
          <h2>How to play</h2>
          <ol className="steps">
            <li className="red">
              <span className="n">1</span>
              <h3>Red light: cars stop</h3>
              <p>When the light is red, the cars stop and wait. Tap a car to run to it and sell.</p>
            </li>
            <li className="amber">
              <span className="n">2</span>
              <h3>Sell to the driver</h3>
              <p>Sell at the normal price or push to sell for a higher prie but be fast. Someone might get to the buyer before you.</p>
            </li>
            <li className="green">
              <span className="n">3</span>
              <h3>Run away before green</h3>
              <p>Run to the side of the road before the light turns green. If a car hits you, you lose money.</p>
            </li>
          </ol>
        </section>

        <section className="sec">
          <h2>Not everybody buys</h2>
          <p>
            Nobody is sure to buy but most buyers have patterns. If you pay attention, you can learn them.
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