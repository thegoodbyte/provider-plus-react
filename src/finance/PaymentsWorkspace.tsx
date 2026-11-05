import FinanceBookingCreate from "./FinanceBookingCreate";
import { FinanceAccessContext } from "./FinanceAccessContext";
import React, { Suspense, lazy, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStaffFocus } from "../workModes/staffFocus";
import { api } from "../services/api";
import FinancialContextPage from "./FinancialContextPage";
import "./paymentsWorkspace.css";
const PaymentsPage = lazy(() => import("../components/PaymentsPage"));
const Scratchpad = lazy(() => import("../components/PaymentScratchpadPage"));
const PaymentEditor = lazy(() => import("../components/PaymentEditorPage"));
const JointEditor = lazy(() => import("../components/JointPaymentEditorPage"));
const Requests = lazy(() => import("../components/PaymentRequestsGrid"));
const RequestEditor = lazy(
  () => import("../components/PaymentRequestEditorPage"),
);
const Receipts = lazy(() => import("../components/PaymentReceiptsPage"));
const RequestBooking = lazy(
  () => import("../components/RequestBookingReviewPage"),
);
const ServiceRequest = lazy(
  () => import("../components/ServicePaymentRequestPage"),
);
export default function PaymentsWorkspace() {
  const { user, logout } = useAuth(),
    focus = useStaffFocus(user),
    navigate = useNavigate();
  const [access, setAccess] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .get("/staff-access/me")
        .then((r) => {
          if (active) {
            setAccess(r.data);
            setError("");
          }
        })
        .catch(() => {
          if (active) {
            setAccess(null);
            setError(
              "Your access could not be verified. Please sign in again or reload.",
            );
          }
        });
    void load();
    window.addEventListener("staff-access-change", load);
    return () => {
      active = false;
      window.removeEventListener("staff-access-change", load);
    };
  }, []);
  const granted =
    user?.role === "admin" || access?.profiles?.includes("payments");
  const allowed = (cap: string, node: React.ReactNode) =>
    user?.role === "admin" || access?.capabilities?.includes(cap) ? (
      node
    ) : (
      <p role="alert">
        This action is not included in your assigned Payments permissions.
      </p>
    );
  return (
    <main className="payments-workspace">
      <header>
        <div>
          <strong>Payments workspace</strong>
          <p>{user?.email}</p>
        </div>
        {user?.role === "admin" ? (
          <button
            onClick={() => {
              focus.setMode("all");
              navigate("/admin/focus");
            }}
          >
            Exit to admin tools
          </button>
        ) : (
          <button onClick={logout}>Sign out</button>
        )}
      </header>
      {error ? (
        <p role="alert">{error}</p>
      ) : !access ? (
        <p role="status">Checking access…</p>
      ) : !granted ? (
        <p role="alert">
          No work profile is assigned. Ask an administrator to grant access.
        </p>
      ) : (
        <>
          <FinanceAccessContext.Provider
            value={(cap) =>
              user?.role === "admin" ||
              Boolean(access?.capabilities?.includes(cap))
            }
          >
            <nav aria-label="Payments navigation">
              {[
                ["payments/scratchpad", "Match receipts"],
                ["payment-requests", "Payment requests"],
                ["payments", "Payments"],
                ["payments/receipts", "Receipts"],
                ["clients", "Clients"],
                ["bookings", "Bookings"],
                ["retreats", "Retreats"],
              ].map(([path, label]) => (
                <Link key={path} to={"/admin/" + path}>
                  {label}
                </Link>
              ))}
            </nav>
            <Suspense fallback={<p role="status">Loading payment tools…</p>}>
              <Routes>
                <Route
                  path="/admin/payments/scratchpad/*"
                  element={<Scratchpad />}
                />
                <Route
                  path="/admin/payments/new"
                  element={allowed("finance.capture", <PaymentEditor />)}
                />
                <Route
                  path="/admin/payments/joint/new"
                  element={allowed("finance.capture", <JointEditor />)}
                />
                <Route path="/admin/payments/receipts" element={<Receipts />} />
                <Route
                  path="/admin/payments/:id/edit"
                  element={allowed("finance.capture", <PaymentEditor />)}
                />
                <Route path="/admin/payments/:id" element={<PaymentEditor />} />
                <Route path="/admin/payments" element={<PaymentsPage />} />
                <Route
                  path="/admin/payment-requests/booking-review"
                  element={<RequestBooking />}
                />
                <Route
                  path="/admin/payment-requests/new"
                  element={allowed("finance.requests", <RequestEditor />)}
                />
                <Route
                  path="/admin/payment-requests/services/new"
                  element={allowed("finance.invoices", <ServiceRequest />)}
                />
                <Route
                  path="/admin/payment-requests/services/:id"
                  element={<ServiceRequest />}
                />
                <Route
                  path="/admin/payment-requests/:id/edit"
                  element={allowed("finance.requests", <RequestEditor />)}
                />
                <Route
                  path="/admin/payment-requests/:id"
                  element={<RequestEditor />}
                />
                <Route path="/admin/payment-requests" element={<Requests />} />
                <Route
                  path="/admin/bookings/new"
                  element={allowed(
                    "finance.bookings",
                    <FinanceBookingCreate />,
                  )}
                />
                {(["clients", "bookings", "retreats"] as const).map((kind) => (
                  <React.Fragment key={kind}>
                    <Route
                      path={"/admin/" + kind}
                      element={
                        <FinancialContextPage
                          key={kind + "-list"}
                          kind={kind}
                        />
                      }
                    />
                    <Route
                      path={"/admin/" + kind + "/:id"}
                      element={
                        <FinancialContextPage
                          key={kind + "-detail"}
                          kind={kind}
                        />
                      }
                    />
                  </React.Fragment>
                ))}
                <Route
                  path="/"
                  element={<Navigate to="/admin/payments/scratchpad" replace />}
                />
                <Route
                  path="/admin/focus"
                  element={<Navigate to="/admin/payments/scratchpad" replace />}
                />
                <Route
                  path="*"
                  element={
                    <p role="alert">
                      This page is outside the Payments workspace. Choose one of
                      the payment tools above.
                    </p>
                  }
                />
              </Routes>
            </Suspense>
          </FinanceAccessContext.Provider>
        </>
      )}
    </main>
  );
}
