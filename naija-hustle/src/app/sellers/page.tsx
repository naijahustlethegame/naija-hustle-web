import Nav from "@/components/Nav";
import SellersBase from "@/components/SellersBase";

export const metadata = { title: "Your sellers: Naija Hustle" };

export default function Sellers() {
  return (
    <>
      <Nav />
      <main className="page">
        <SellersBase />
      </main>
    </>
  );
}
