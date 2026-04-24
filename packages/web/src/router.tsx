import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { Landing } from "./pages/Landing.js";
import { Dashboard } from "./pages/Dashboard.js";
import { RoomDetail } from "./pages/RoomDetail.js";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/rooms/:roomId", element: <RoomDetail /> },
      {
        path: "*",
        element: (
          <div className="mx-auto max-w-6xl px-6 py-20 text-center">
            <h1 className="text-2xl font-bold">404</h1>
            <p className="mt-2 text-ink-500">No route matched.</p>
          </div>
        ),
      },
    ],
  },
]);
