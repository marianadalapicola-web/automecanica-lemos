import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Reports from "@/pages/Reports";
import SettingsPage from "@/pages/Settings";

import ClientsList from "@/pages/clients/ClientsList";
import ClientDetail from "@/pages/clients/ClientDetail";

import VehiclesList from "@/pages/vehicles/VehiclesList";
import VehicleDetail from "@/pages/vehicles/VehicleDetail";

import SuppliersList from "@/pages/suppliers/SuppliersList";

import QuotesList from "@/pages/quotes/QuotesList";
import QuoteForm from "@/pages/quotes/QuoteForm";
import QuoteDetail from "@/pages/quotes/QuoteDetail";

import NotesList from "@/pages/notes/NotesList";
import NoteForm from "@/pages/notes/NoteForm";
import NoteDetail from "@/pages/notes/NoteDetail";

function Protected({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<Protected><Dashboard /></Protected>} />

            <Route path="/notas" element={<Protected><NotesList /></Protected>} />
            <Route path="/notas/nova" element={<Protected><NoteForm /></Protected>} />
            <Route path="/notas/:id" element={<Protected><NoteDetail /></Protected>} />
            <Route path="/notas/:id/editar" element={<Protected><NoteForm /></Protected>} />

            <Route path="/cotacoes" element={<Protected><QuotesList /></Protected>} />
            <Route path="/cotacoes/novo" element={<Protected><QuoteForm /></Protected>} />
            <Route path="/cotacoes/:id" element={<Protected><QuoteDetail /></Protected>} />
            <Route path="/cotacoes/:id/editar" element={<Protected><QuoteForm /></Protected>} />

            <Route path="/clientes" element={<Protected><ClientsList /></Protected>} />
            <Route path="/clientes/:id" element={<Protected><ClientDetail /></Protected>} />

            <Route path="/veiculos" element={<Protected><VehiclesList /></Protected>} />
            <Route path="/veiculos/:id" element={<Protected><VehicleDetail /></Protected>} />

            <Route path="/fornecedores" element={<Protected><SuppliersList /></Protected>} />

            <Route path="/relatorios" element={<Protected><Reports /></Protected>} />

            <Route
              path="/configuracoes"
              element={
                <Protected adminOnly>
                  <SettingsPage />
                </Protected>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
