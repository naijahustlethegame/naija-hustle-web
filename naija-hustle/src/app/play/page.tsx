import Nav from "@/components/Nav";
import GameCanvas from "@/components/GameCanvas";

export default function Play() {
  return (
    <>
      <Nav />
      <main className="page">
        <div className="frame"><GameCanvas /></div>
        <p style={{ marginTop: 12 }}>Tap a vehicle or person to run to them. Cross lanes carefully: getting hit costs you money.</p>
      </main>
    </>
  );
}
