import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import useAuth from "../hooks/useAuth";
import { fetchApi } from "../lib/api";
import { formatDate } from "../lib/format";

interface FullUser {
	subscriptionTier: "free" | "pro" | "team";
	createdAt: string;
}

const TIER_VARIANT: Record<string, { className: string }> = {
	free: { className: "bg-muted text-muted-foreground" },
	pro: { className: "bg-blue-100 text-blue-700" },
	team: { className: "bg-purple-100 text-purple-700" },
};

export default function ProfilePage() {
	const { user, logout, updateUser } = useAuth();
	const navigate = useNavigate();

	const [firstName, setFirstName] = useState(user?.firstName ?? "");
	const [lastName, setLastName] = useState(user?.lastName ?? "");
	const [isSaving, setIsSaving] = useState(false);
	const [fullUser, setFullUser] = useState<FullUser | null>(null);

	useEffect(() => {
		fetchApi("/auth/me")
			.then((r) => r.json())
			.then((u) => setFullUser(u as FullUser))
			.catch(() => {});
	}, []);

	const isDirty =
		firstName.trim() !== (user?.firstName ?? "") || lastName.trim() !== (user?.lastName ?? "");

	async function handleSave() {
		setIsSaving(true);
		try {
			const res = await fetchApi("/users/me", {
				method: "PATCH",
				body: JSON.stringify({
					firstName: firstName.trim() || undefined,
					lastName: lastName.trim() || undefined,
				}),
			});
			if (!res.ok) {
				const err = (await res.json()) as { error?: string };
				toast.error(err.error ?? "Failed to save");
				return;
			}
			updateUser({ firstName: firstName.trim() || null, lastName: lastName.trim() || null });
			toast.success("Profile updated");
		} catch {
			toast.error("Network error");
		} finally {
			setIsSaving(false);
		}
	}

	function handleLogout() {
		logout();
		navigate("/login", { replace: true });
	}

	const initials = (user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();
	const displayName = user?.firstName
		? `${user.firstName} ${user.lastName ?? ""}`.trim()
		: (user?.email ?? "");

	return (
		<div className="mx-auto max-w-lg">
			<h1 className="mb-6 text-2xl font-bold">Profile</h1>

			<Card>
				<CardContent className="space-y-6">
					{/* Avatar */}
					<div className="flex flex-col items-center gap-2">
						<Avatar className="size-20 text-2xl">
							{user?.avatarUrl ? (
								<AvatarImage src={user.avatarUrl} alt="avatar" />
							) : null}
							<AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
								{initials}
							</AvatarFallback>
						</Avatar>
						<p className="font-medium">{displayName}</p>
					</div>

					{/* Form */}
					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="firstName">First name</Label>
								<Input
									id="firstName"
									value={firstName}
									onChange={(e) => setFirstName(e.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="lastName">Last name</Label>
								<Input
									id="lastName"
									value={lastName}
									onChange={(e) => setLastName(e.target.value)}
								/>
							</div>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="email">Email</Label>
							<Input id="email" type="email" value={user?.email ?? ""} disabled />
							<p className="text-xs text-muted-foreground">Email cannot be changed</p>
						</div>

						<Button className="w-full" onClick={handleSave} disabled={!isDirty || isSaving}>
							{isSaving ? "Saving…" : "Save Changes"}
						</Button>
					</div>

					{/* Account info */}
					{fullUser && (
						<>
							<Separator />
							<div>
								<h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
									Account Info
								</h2>
								<div className="space-y-2 text-sm">
									<div className="flex justify-between">
										<span className="text-muted-foreground">Member since</span>
										<span>{formatDate(fullUser.createdAt)}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Subscription</span>
										<Badge
											variant="secondary"
											className={
												TIER_VARIANT[fullUser.subscriptionTier]?.className ??
												TIER_VARIANT.free.className
											}
										>
											{fullUser.subscriptionTier}
										</Badge>
									</div>
								</div>
							</div>
						</>
					)}
				</CardContent>
			</Card>

			{/* Sign out */}
			<div className="mt-6 text-center">
				<Button variant="ghost" size="sm" className="text-destructive" onClick={handleLogout}>
					Sign out
				</Button>
			</div>
		</div>
	);
}
