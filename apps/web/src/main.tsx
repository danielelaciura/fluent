import { GoogleOAuthProvider } from "@react-oauth/google";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Toaster } from "sonner";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import ReportPage from "./pages/ReportPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import "./index.css";

const router = createBrowserRouter([
	{
		path: "/login",
		element: <LoginPage />,
	},
	{
		element: <Layout />,
		children: [
			{
				element: <ProtectedRoute />,
				children: [
					{ index: true, element: <HomePage /> },
					{ path: "sessions/:id", element: <ReportPage /> },
					{ path: "subscription", element: <SubscriptionPage /> },
					{ path: "profile", element: <ProfilePage /> },
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
