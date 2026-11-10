import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "@/routes/router";
import { AuthProvider } from "@/hooks/use-auth";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
