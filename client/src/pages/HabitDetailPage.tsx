import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, type CheckIn } from "../api/client";
import ErrorMessage from "../components/ErrorMessage";

export default function HabitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [backfillDate, setBackfillDate] = useState("");
  const [backfillError, setBackfillError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchHistory = async (page = 1) => {
    try {
      const res = await api.checkInHistory(id!, page);
      setCheckIns(res.checkIns);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [id]);

  const handleBackfill = async (e: React.FormEvent) => {
    e.preventDefault();
    setBackfillError("");
    setSubmitting(true);
    try {
      await api.checkIn(id!, backfillDate);
      setBackfillDate("");
      await fetchHistory(pagination.page);
    } catch (err: any) {
      setBackfillError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading">Loading history...</div>;

  return (
    <div className="habit-detail">
      <header className="detail-header">
        <button className="back-btn" onClick={() => navigate("/")}>
          Back
        </button>
        <h1>Habit History</h1>
      </header>

      <ErrorMessage message={error} />

      <div className="backfill-section">
        <h2>Backfill a past date</h2>
        <form onSubmit={handleBackfill} className="backfill-form">
          <input
            type="date"
            value={backfillDate}
            onChange={(e) => setBackfillDate(e.target.value)}
            required
          />
          <button type="submit" disabled={submitting || !backfillDate}>
            {submitting ? "Saving..." : "Log it"}
          </button>
        </form>
        <ErrorMessage message={backfillError} />
      </div>

      <div className="checkin-list">
        <h2>Check-in History ({pagination.total} total)</h2>
        {checkIns.length === 0 ? (
          <p className="empty-state">No check-ins yet.</p>
        ) : (
          <ul>
            {checkIns.map((c) => (
              <li key={c.id} className="checkin-item">
                <span className="checkin-date">{c.localDay}</span>
                <span className="checkin-time">
                  logged at {new Date(c.occurredAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}

        {pagination.totalPages > 1 && (
          <div className="pagination">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchHistory(pagination.page - 1)}
            >
              Previous
            </button>
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchHistory(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
