import { GoogleOAuthProvider } from "@react-oauth/google";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Toaster } from "sonner";
import AdminLayout from "./components/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import UserDetailPage from "./pages/UserDetailPage";
import UsersPage from "./pages/UsersPage";
import "./index.css";

const router = createBrowserRouter([
	{
		path: "/login",
		element: <LoginPage />,
	},
	{
		element: <AdminLayout />,
		children: [
			{
				element: <ProtectedRoute />,
				children: [
					{ index: true, element: <DashboardPage /> },
					{ path: "users", element: <UsersPage /> },
					{ path: "users/:id", element: <UserDetailPage /> },
				],
			},
		],
	},
]);

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
	<StrictMode>
		<GoogleOAuthProvider clientId={clientId}>
			<AuthProvider>
				<RouterProvider router={router} />
				<Toaster richColors position="top-right" />
			</AuthProvider>
		</GoogleOAuthProvider>
	</StrictMode>,
);
