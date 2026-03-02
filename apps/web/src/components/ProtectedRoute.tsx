import { Navigate, Outlet } from "react-router";
import useAuth from "../hooks/useAuth";
import LoadingSpinner from "./LoadingSpinner";

export default function ProtectedRoute() {
	const { user, isLoading } = useAuth();

	if (isLoading) return <LoadingSpinner />;
	if (!user) return <Navigate to="/login" replace />;

	return <Outlet />;
}
