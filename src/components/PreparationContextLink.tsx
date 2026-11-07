import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../services/api";
import { authService } from "../services/authService";
export default function PreparationContextLink({
  clientId,
  bookingId,
  retreatId,
}: {
  clientId?: string;
  bookingId?: string;
  retreatId?: string;
}) {
  const role = authService.getUser()?.role,
    allowed = ["admin", "medical_staff"].includes(role || "");
  const location = useLocation(),
    prefix = location.pathname.startsWith("/medical/") ? "/medical" : "/admin";
  const q = new URLSearchParams(
    Object.entries({ clientId, bookingId, retreatId }).filter(([, v]) => v) as [
      string,
      string,
    ][],
  ).toString();
  const [count, setCount] = useState<any>(null);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    api
      .get("/medical-preparation?" + q)
      .then((r) => {
        if (active) {
          const today = new Date().toLocaleDateString("en-CA", {
            timeZone: "Europe/Prague",
          });
          setCount({
            total: r.data.length,
            overdue: r.data.filter(
              (i: any) => i.date && i.date < today && !i.completed,
            ).length,
          });
        }
      })
      .catch(() => {
        if (active) setCount(null);
      });
    return () => {
      active = false;
    };
  }, [q, allowed]);
  if (!allowed) return null;
  return (
    <div className="my-3 rounded-xl border border-teal-200 bg-teal-50 p-3">
      <Link
        className="font-semibold text-teal-800 underline"
        to={`${prefix}/medical-preparation?${q}`}
      >
        Medical Preparation · Items / Calendar
      </Link>
      {count && (
        <p className="mt-1 text-sm text-slate-600">
          {count.total} items · {count.overdue} past target date, not confirmed
          complete
        </p>
      )}
    </div>
  );
}
