import Nav from "@/components/Nav";
import Leaderboard from "@/components/Leaderboard";
import "./leaderboard.css";

export const metadata = { title: "Leaderboard: Naija Hustle" };

export default function Ranks() {
  return (
    <>
      <Nav />
      <main className="page">
        <Leaderboard />
      </main>
    </>
  );
}
