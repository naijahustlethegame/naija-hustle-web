import Nav from "@/components/Nav";
import GameView from "@/components/GameView";

export const metadata = { title: "Play: Naija Hustle" };

export default function Play() {
  return (
    <>
      <Nav />
      <main className="page">
        <GameView />
      </main>
    </>
  );
}
