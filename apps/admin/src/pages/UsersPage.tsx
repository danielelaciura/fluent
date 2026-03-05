import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import LoadingSpinner from "../components/LoadingSpinner";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../components/ui/table";
import { fetchApi } from "../lib/api";
import { formatDate } from "../lib/format";

interface UserRow {
	id: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
	avatarUrl: string | null;
	role: string;
	createdAt: string;
	planId: string | null;
	planName: string | null;
	subscriptionStatus: string | null;
}

interface PaginatedUsers {
	data: UserRow[];
	page: number;
	pageSize: number;
	totalCount: number;
	totalPages: number;
}

export default function UsersPage() {
	const [result, setResult] = useState<PaginatedUsers | null>(null);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const navigate = useNavigate();
	const debounceRef = useRef<ReturnType<typeof setTimeout>>();

	const fetchUsers = useCallback(async (p: number, q: string) => {
		setLoading(true);
		const params = new URLSearchParams({ page: String(p), pageSize: "20" });
		if (q) params.set("search", q);
		const res = await fetchApi(`/admin/users?${params}`);
		const data = (await res.json()) as PaginatedUsers;
		setResult(data);
		setLoading(false);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: search is debounced separately
	useEffect(() => {
		fetchUsers(page, search);
	}, [page, fetchUsers]);

	function handleSearchChange(value: string) {
		setSearch(value);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			setPage(1);
			fetchUsers(1, value);
		}, 300);
	}

	if (!result && loading) return <LoadingSpinner />;

	return (
		<div className="space-y-4">
			<h1 className="font-heading text-2xl font-bold">Users</h1>

			<div className="relative max-w-sm">
				<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					placeholder="Search by name or email..."
					value={search}
					onChange={(e) => handleSearchChange(e.target.value)}
					className="pl-9"
				/>
			</div>

			{loading ? (
				<LoadingSpinner />
			) : result ? (
				<>
					<div className="rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>User</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>Plan</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Joined</TableHead>
									<TableHead>Role</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{result.data.map((user) => (
									<TableRow
										key={user.id}
										className="cursor-pointer"
										onClick={() => navigate(`/users/${user.id}`)}
									>
										<TableCell>
											<div className="flex items-center gap-2">
												<Avatar className="size-7">
													<AvatarImage src={user.avatarUrl ?? undefined} />
													<AvatarFallback className="text-xs">
														{(user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")}
													</AvatarFallback>
												</Avatar>
												<span className="font-medium">
													{user.firstName} {user.lastName}
												</span>
											</div>
										</TableCell>
										<TableCell className="text-muted-foreground">{user.email}</TableCell>
										<TableCell>
											{user.planName ? (
												<Badge variant="outline">{user.planName}</Badge>
											) : (
												<span className="text-muted-foreground">-</span>
											)}
										</TableCell>
										<TableCell>
											{user.subscriptionStatus ? (
												<Badge
													variant={user.subscriptionStatus === "active" ? "default" : "secondary"}
												>
													{user.subscriptionStatus}
												</Badge>
											) : (
												<span className="text-muted-foreground">-</span>
											)}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{formatDate(user.createdAt)}
										</TableCell>
										<TableCell>
											<Badge variant={user.role === "admin" ? "default" : "outline"}>
												{user.role}
											</Badge>
										</TableCell>
									</TableRow>
								))}
								{result.data.length === 0 && (
									<TableRow>
										<TableCell colSpan={6} className="text-center text-muted-foreground">
											No users found
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>

					{result.totalPages > 1 && (
						<div className="flex items-center justify-center gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={page <= 1}
								onClick={() => setPage((p) => p - 1)}
							>
								Previous
							</Button>
							<span className="text-sm text-muted-foreground">
								Page {result.page} of {result.totalPages}
							</span>
							<Button
								variant="outline"
								size="sm"
								disabled={page >= result.totalPages}
								onClick={() => setPage((p) => p + 1)}
							>
								Next
							</Button>
						</div>
					)}
				</>
			) : null}
		</div>
	);
}
