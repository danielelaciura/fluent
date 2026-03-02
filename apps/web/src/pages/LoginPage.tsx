import { GoogleLogin } from "@react-oauth/google";
import { useEffect } from "react";
import { useNavigate } from "react-router";
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
			console.error("Login failed", err);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-muted">
			<Card className="w-full max-w-sm">
				<CardHeader className="text-center">
					<CardTitle className="text-3xl text-primary">MeetFluent</CardTitle>
					<CardDescription>AI-Powered English Coaching for Professionals</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="flex justify-center">
						<GoogleLogin
							onSuccess={(res) => {
								if (res.credential) handleGoogleSuccess(res.credential);
							}}
							onError={() => console.error("Google login error")}
							theme="outline"
							size="large"
							text="signin_with"
						/>
					</div>

					<p className="text-center text-xs text-muted-foreground">
						Your voice. Your growth. Only your microphone is recorded.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
