import type { Habit } from "../api/client";

interface HabitCardProps {
  habit: Habit;
  onCheckIn: (habitId: string) => Promise<void>;
  onDelete: (habitId: string) => Promise<void>;
  onClick: (habitId: string) => void;
}

export default function HabitCard({ habit, onCheckIn, onDelete, onClick }: HabitCardProps) {
  return (
    <div className="habit-card" onClick={() => onClick(habit.id)}>
      <div className="habit-card-header">
        <h3>{habit.name}</h3>
        <div className="streak-badges">
          <span className="streak-badge fire" title="Current streak">
            {habit.currentStreak}
          </span>
          <span className="streak-badge trophy" title="Longest streak">
            {habit.longestStreak}
          </span>
        </div>
      </div>

      {habit.description && <p className="habit-description">{habit.description}</p>}

      <div className="habit-card-actions">
        <button
          className={`checkin-btn ${habit.checkedInToday ? "checked" : ""}`}
          disabled={habit.checkedInToday}
          onClick={(e) => {
            e.stopPropagation();
            onCheckIn(habit.id);
          }}
        >
          {habit.checkedInToday ? "Done today" : "Check in"}
        </button>
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete "${habit.name}"?`)) onDelete(habit.id);
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
