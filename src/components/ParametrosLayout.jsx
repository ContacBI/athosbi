import { Outlet } from "react-router-dom";
import ParametrosSidebar from "./ParametrosSidebar.jsx";

export default function ParametrosLayout() {
  return (
    <div className="flex min-h-screen bg-surface-page">
      <div className="sticky top-0 h-screen shrink-0">
        <ParametrosSidebar />
      </div>
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
