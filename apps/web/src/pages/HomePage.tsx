import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import EditableName from "../components/EditableName";
import { useLayoutContext } from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../components/ui/table";
import { fetchApi } from "../lib/api";
import { cefrColor, formatDate, formatDuration, scoreColor } from "../lib/format";

interface SessionSummary {
	id: string;
	name: string | null;
	status: string;
	durationSeconds: number | null;
	createdAt: string;
	overallScore: number | null;
	cefrLevel: string | null;
	grammarScore: number | null;
	vocabularyScore: number | null;
	fluencyScore: number | null;
	businessScore: number | null;
}

const PROCESSING_STATUSES = new Set(["created", "uploading", "processing", "transcribed"]);

function StatusBadge({ status }: { status: string }) {
	if (status === "complete") {
		return (
			<Badge variant="secondary" className="bg-green-100 text-green-700">
				Complete
			</Badge>
		);
	}
	if (status === "error") {
		return (
			<Badge variant="secondary" className="bg-red-100 text-red-700">
				Error
			</Badge>
		);
	}
	return (
		<Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
			<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
			Processing
		</Badge>
	);
}

function ScoreBar({ score }: { score: number | null }) {
	if (score === null) return <span className="text-muted-foreground">—</span>;
	const color = scoreColor(score);
	return (
		<div className="flex items-center gap-1.5">
			<div className="h-1.5 w-12 rounded-full bg-muted">
				<div
					className="h-1.5 rounded-full transition-all"
					style={{ width: `${score}%`, backgroundColor: color }}
				/>
			</div>
			<span className="w-6 text-right text-xs font-medium" style={{ color }}>
				{score}
			</span>
		</div>
	);
}

export default function HomePage() {
	const navigate = useNavigate();
	const { refreshSessions: refreshSidebar } = useLayoutContext();
	const [sessions, setSessions] = useState<SessionSummary[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const fetchSessions = useCallback(async () => {
		const res = await fetchApi("/sessions?limit=20");
		if (!res.ok) return;
		const data = (await res.json()) as SessionSummary[];
		setSessions(data);
		return data;
	}, []);

	useEffect(() => {
		fetchSessions().finally(() => setIsLoading(false));
	}, [fetchSessions]);

	// Polling when any session is still processing
	useEffect(() => {
		const hasProcessing = sessions.some((s) => PROCESSING_STATUSES.has(s.status));

		if (hasProcessing && !pollingRef.current) {
			pollingRef.current = setInterval(fetchSessions, 10_000);
		} else if (!hasProcessing && pollingRef.current) {
			clearInterval(pollingRef.current);
			pollingRef.current = null;
		}

		return () => {
			if (pollingRef.current) {
				clearInterval(pollingRef.current);
				pollingRef.current = null;
			}
		};
	}, [sessions, fetchSessions]);

	if (isLoading) return <LoadingSpinner />;

	return (
		<div>
			<h1 className="mb-6 text-2xl font-bold">Your Sessions</h1>

			{sessions.length === 0 ? (
				<Card>
					<CardContent className="py-6 text-center">
						<p className="mb-2 text-lg font-medium">No sessions yet</p>
						<p className="text-sm text-muted-foreground">
							Record your first meeting to get started! Install the MeetFluent browser extension and
							start a call.
						</p>
					</CardContent>
				</Card>
			) : (
				<Card className="p-5">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Date</TableHead>
								<TableHead>Duration</TableHead>
								<TableHead>Status</TableHead>
								{/* <TableHead className="text-center">CEFR</TableHead> */}
								<TableHead>Overall</TableHead>
								<TableHead>Grammar</TableHead>
								<TableHead>Vocab</TableHead>
								<TableHead>Fluency</TableHead>
								<TableHead>Business</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{sessions.map((s) => {
								const isComplete = s.status === "complete";
								return (
									<TableRow
										key={s.id}
										className="cursor-pointer"
										onClick={() => navigate(`/sessions/${s.id}`)}
									>
										<TableCell className="py-3 font-medium">
											<h5>
											<EditableName
												sessionId={s.id}
												name={s.name}
												className="text-sm"
												onSaved={(name) => {
													setSessions((prev) =>
														prev.map((ss) => (ss.id === s.id ? { ...ss, name } : ss)),
													);
													refreshSidebar();
												}}
											/>
											</h5>
										</TableCell>
										<TableCell className="py-3">{formatDate(s.createdAt)}</TableCell>
										<TableCell className="py-3 text-muted-foreground">
											{formatDuration(s.durationSeconds)}
										</TableCell>
										<TableCell className="py-3">
											<StatusBadge status={s.status} />
										</TableCell>
										{/* <TableCell className="py-3 text-center">
											{isComplete && s.cefrLevel ? (
												<span className="font-bold" style={{ color: cefrColor(s.cefrLevel) }}>
													{s.cefrLevel}
												</span>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell> */}
										<TableCell className="py-3">
											<ScoreBar score={isComplete ? s.overallScore : null} />
										</TableCell>
										<TableCell className="py-3">
											<ScoreBar score={isComplete ? s.grammarScore : null} />
										</TableCell>
										<TableCell className="py-3">
											<ScoreBar score={isComplete ? s.vocabularyScore : null} />
										</TableCell>
										<TableCell className="py-3">
											<ScoreBar score={isComplete ? s.fluencyScore : null} />
										</TableCell>
										<TableCell className="py-3">
											<ScoreBar score={isComplete ? s.businessScore : null} />
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</Card>
			)}
		</div>
	);
}
