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
import Import from "./pages/Import";
import Documents from "./pages/Documents";
import AccessTokens from "./pages/AccessTokens";
import StagiairePortal from "./pages/StagiairePortal";
import NotFound from "./pages/NotFound";

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
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/formations" element={<RoleGuard allowedRoles={['admin', 'assistante']}><FormationsCatalogue /></RoleGuard>} />
              <Route path="/sessions" element={<RoleGuard allowedRoles={['admin', 'assistante']}><Sessions /></RoleGuard>} />
              <Route path="/formateurs" element={<RoleGuard allowedRoles={['admin', 'assistante']}><Formateurs /></RoleGuard>} />
              <Route path="/stagiaires" element={<RoleGuard allowedRoles={['admin', 'assistante']}><Stagiaires /></RoleGuard>} />
              <Route path="/import" element={<RoleGuard allowedRoles={['admin', 'assistante']}><Import /></RoleGuard>} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/access-tokens" element={<RoleGuard allowedRoles={['admin', 'assistante']}><AccessTokens /></RoleGuard>} />
              <Route path="/settings" element={<Dashboard />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
