import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { RoleGuard } from "@/components/RoleGuard";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import FormationsCatalogue from "./pages/FormationsCatalogue";
import Sessions from "./pages/Sessions";
import Formateurs from "./pages/Formateurs";
import Stagiaires from "./pages/Stagiaires";

import Documents from "./pages/Documents";
import AuditDashboard from "./pages/AuditDashboard";
import AccessTokens from "./pages/AccessTokens";
import Settings from "./pages/Settings";
import StagiairePortal from "./pages/StagiairePortal";
import Certificats from "./pages/Certificats";
import BilanPedagogiqueFinancier from "./pages/BilanPedagogiqueFinancier";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/portail" element={<StagiairePortal />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/formations" element={<RoleGuard allowedRoles={['super_admin', 'admin', 'assistante', 'lecteur']}><FormationsCatalogue /></RoleGuard>} />
              <Route path="/sessions" element={<RoleGuard allowedRoles={['super_admin', 'admin', 'assistante', 'lecteur']}><Sessions /></RoleGuard>} />
              <Route path="/formateurs" element={<RoleGuard allowedRoles={['super_admin', 'admin', 'assistante', 'lecteur']}><Formateurs /></RoleGuard>} />
              <Route path="/stagiaires" element={<RoleGuard allowedRoles={['super_admin', 'admin', 'assistante', 'lecteur']}><Stagiaires /></RoleGuard>} />
              <Route path="/documents" element={<RoleGuard allowedRoles={['super_admin', 'assistante', 'formateur']}><Documents /></RoleGuard>} />
              <Route path="/audit" element={<RoleGuard allowedRoles={['super_admin', 'admin', 'assistante']}><AuditDashboard /></RoleGuard>} />
              <Route path="/access-tokens" element={<RoleGuard allowedRoles={['super_admin', 'admin', 'assistante']}><AccessTokens /></RoleGuard>} />
              <Route path="/certificats" element={<RoleGuard allowedRoles={['super_admin']}><Certificats /></RoleGuard>} />
              <Route path="/bpf" element={<RoleGuard allowedRoles={['super_admin', 'admin']}><BilanPedagogiqueFinancier /></RoleGuard>} />
              <Route path="/roles" element={<Navigate to="/settings" replace />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
