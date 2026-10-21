import Nav from "@/components/Nav";
import RunnerView from "@/components/RunnerView";
import "./restock.css";

export const metadata = { title: "Restock: Naija Hustle" };

export default function Restock() {
  return (
    <>
      <Nav />
      <main className="page">
        <RunnerView />
      </main>
    </>
  );
}
