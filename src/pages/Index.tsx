import { useEffect } from "react";
import Dashboard from "./Dashboard";
import { seedIfEmpty } from "@/lib/store";

const Index = () => {
  useEffect(() => { seedIfEmpty(); }, []);
  return <Dashboard />;
};

export default Index;
