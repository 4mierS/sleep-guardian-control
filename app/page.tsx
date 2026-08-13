import { redirect } from "next/navigation";

// Die App hat nur einen Zweck — die Startseite führt direkt dorthin.
export default function Home() {
  redirect("/control");
}
