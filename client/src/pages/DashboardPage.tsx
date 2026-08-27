import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Habit } from "../api/client";
import { useAuth } from "../context/AuthContext";
import HabitCard from "../components/HabitCard";
import CreateHabitModal from "../components/CreateHabitModal";
import ErrorMessage from "../components/ErrorMessage";

export default function DashboardPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const fetchHabits = async () => {
    try {
      const res = await api.habits();
      setHabits(res.habits);
      setToday(res.today);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHabits();
  }, []);

  const handleCheckIn = async (habitId: string) => {
    try {
      await api.checkIn(habitId);
      await fetchHabits();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (habitId: string) => {
    try {
      await api.deleteHabit(habitId);
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreate = async (name: string, description: string) => {
    await api.createHabit({ name, description: description || undefined });
    await fetchHabits();
  };

  if (loading) return <div className="loading">Loading habits...</div>;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Habit Tracker</h1>
          <p className="today-label">Today: {today}</p>
        </div>
        <div className="header-actions">
          <button className="primary" onClick={() => setShowCreate(true)}>
            + New Habit
          </button>
          <button className="secondary" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <ErrorMessage message={error} />

      {habits.length === 0 ? (
        <div className="empty-state">
          <p>No habits yet. Create your first one!</p>
        </div>
      ) : (
        <div className="habit-grid">
          {habits.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              onCheckIn={handleCheckIn}
              onDelete={handleDelete}
              onClick={(id) => navigate(`/habits/${id}`)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateHabitModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}
