import { GoogleLogin } from "@react-oauth/google";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import useAuth from "../hooks/useAuth";

export default function LoginPage() {
	const { login, user } = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		if (user) navigate("/", { replace: true });
	}, [user, navigate]);

	async function handleGoogleSuccess(credential: string) {
		try {
			await login(credential);
			navigate("/", { replace: true });
		} catch (err) {
			const message = err instanceof Error ? err.message : "Login failed";
			toast.error(message);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-muted">
			<Card className="w-full max-w-sm">
				<CardHeader className="text-center">
					<CardTitle className="text-3xl text-primary">Admin Dashboard</CardTitle>
					<CardDescription>MeetFluent internal administration</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="flex justify-center">
						<GoogleLogin
							onSuccess={(res) => {
								if (res.credential) handleGoogleSuccess(res.credential);
							}}
							onError={() => toast.error("Google login error")}
							theme="outline"
							size="large"
							text="signin_with"
						/>
					</div>

					<p className="text-center text-xs text-muted-foreground">
						Admin access required. Non-admin users will be rejected.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
