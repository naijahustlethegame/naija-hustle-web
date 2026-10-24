import Nav from "@/components/Nav";
import StatsView from "@/components/StatsView";
import "./stats.css";

export const metadata = { title: "Stats: Naija Hustle", robots: { index: false, follow: false } };

export default function Stats() {
  return (
    <>
      <Nav />
      <main className="page">
        <StatsView />
      </main>
    </>
  );
}
